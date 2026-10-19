import { Plugin, FileSystemAdapter, Notice, Platform, addIcon, setIcon, TFile, TFolder, Editor, MarkdownView } from "obsidian";
import * as path from "node:path";
import * as fs from "node:fs";
import { OpencodePluginSettings, DEFAULT_SETTINGS } from "./settings";
import { OpencodeSettingTab } from "./settingsTab";
import { OpencodeTerminalView, OPENCODE_TERMINAL_VIEW_TYPE } from "./views/opencodeTerminalView";
import { OpencodeConversationView, OPENCODE_CONVERSATION_VIEW_TYPE } from "./views/conversationView";
import { OpencodeEditorSuggest } from "./opencodeEditorSuggest";
import { SessionState } from "./modules/sessionState";
import { ViewCoordinator } from "./modules/viewCoordinator";
import { PtySession } from "./modules/ptySession";
import { PtySessionRegistry } from "./modules/ptySessionRegistry";
import { OpencodeActivitySource, OpencodeStatus, OpencodeStatusTracker } from "./modules/opencodeStatus";
import { OpencodeClient } from "./utils/opencode";
import type { OpencodeSession } from "./utils/opencode";
import { activeLineReferenceCommand } from "./modules/activeLineReference";
import { OPENCODE_ICON_ID, OPENCODE_ICON_SVG } from "./icons";
import { mergeSessionTabs, readSessionTabs } from "./utils/sessionTabs";
import { sessionUri } from "./modules/sessionUri";
import { resolvePluginDirectory } from "./utils/path";
import { planTerminalOpen } from "./modules/terminalOpenPlan";

/**
 * Normalize a directory for comparison across case and trailing separators.
 */
function normalizeDirectory(directory: string): string {
	return path.resolve(directory).replace(/[\\/]+$/, "").toLowerCase();
}

export default class OpencodePlugin extends Plugin {
	settings: OpencodePluginSettings;
	vaultRoot: string = "";
	vaultConfigDir: string = "";
	private sessionState: SessionState;
	private viewCoordinator: ViewCoordinator;
	private readonly ptySessions = new PtySessionRegistry();
	private statusTracker: OpencodeStatusTracker | null = null;
	private statusSource: OpencodeActivitySource | null = null;
	private statusButton: HTMLButtonElement | null = null;
	private statusBadge: HTMLSpanElement | null = null;
	private statusRefreshPending = false;
	private unloading = false;
	private lastActiveMarkdownFile: TFile | null = null;

	get pendingPrompt(): string | null {
		return this.sessionState.pendingPrompt;
	}

	set pendingPrompt(value: string | null) {
		this.sessionState.pendingPrompt = value;
	}

	get pendingAttachPath(): string | null {
		return this.sessionState.pendingAttachPath;
	}

	set pendingAttachPath(value: string | null) {
		this.sessionState.pendingAttachPath = value;
	}

	get sessionArgs(): string[] | null {
		return this.sessionState.sessionArgs;
	}

	set sessionArgs(value: string[] | null) {
		this.sessionState.sessionArgs = value;
	}

	get sessionCwd(): string | null {
		return this.sessionState.sessionCwd;
	}

	set sessionCwd(value: string | null) {
		this.sessionState.sessionCwd = value;
	}

	get pendingRouteSessionId(): string | null {
		return this.sessionState.pendingRouteSessionId;
	}

	set pendingRouteSessionId(value: string | null) {
		this.sessionState.pendingRouteSessionId = value;
	}

	async onload() {
		this.sessionState = new SessionState();
		this.viewCoordinator = new ViewCoordinator(this.app.workspace, {
			terminalViewType: OPENCODE_TERMINAL_VIEW_TYPE,
			conversationViewType: OPENCODE_CONVERSATION_VIEW_TYPE,
		});

		await this.loadSettings();
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			this.vaultRoot = this.app.vault.adapter.getBasePath();
		} else {
			this.vaultRoot = "/";
		}
		this.vaultConfigDir = this.app.vault.configDir;
		this.lastActiveMarkdownFile = this.app.workspace.getActiveFile();
		this.registerEvent(this.app.workspace.on("file-open", (file) => {
			if (file && file.extension === "md") this.lastActiveMarkdownFile = file;
		}));
		this.setupStatusBar();

		this.registerView(
			OPENCODE_TERMINAL_VIEW_TYPE,
			(leaf) => new OpencodeTerminalView(leaf, this)
		);

		this.registerView(
			OPENCODE_CONVERSATION_VIEW_TYPE,
			(leaf) => new OpencodeConversationView(leaf, this)
		);

		this.registerObsidianProtocolHandler("opencode", (params) => {
			void this.openSessionFromUri(params);
		});

		addIcon(OPENCODE_ICON_ID, OPENCODE_ICON_SVG);
		this.addRibbonIcon(OPENCODE_ICON_ID, "Opencode terminal", (evt: MouseEvent) => {
			void this.openActiveNoteTerminal();
		});

		this.addRibbonIcon("message-circle", "Opencode conversations", (evt: MouseEvent) => {
			void this.activateConversationView();
		});

		this.addRibbonIcon("link", "Insert OpenCode session link", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) {
				new Notice("Open a Markdown note first");
				return;
			}
			void this.insertActiveSessionLink(view.editor);
		});

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
			if (!(file instanceof TFile) && !(file instanceof TFolder)) return;
			menu.addSeparator();
			menu.addItem((item) => item
				.setTitle("Открыть в Opencode")
				.setIcon("terminal")
				.onClick(() => { void this.openTerminalForFileMenu(file); }));
			menu.addSeparator();
		}));

		this.addCommand({
			id: "open-terminal",
			name: "Open terminal",
			callback: () => { void this.activateTerminalView(); },
		});

		this.addCommand({
			id: "toggle-terminal-sidebar",
			name: "Toggle terminal in sidebar",
			callback: () => { void this.toggleTerminalSidebar(); },
		});

		this.addCommand({
			id: "open-conversations",
			name: "Open conversations",
			callback: () => { void this.activateConversationView(); },
		});

		this.addCommand({
			id: "new-session",
			name: "New session",
			callback: () => { void this.newSession(); },
		});

		this.addCommand({
			id: "continue-last-session",
			name: "Continue last session",
			callback: () => { void this.continueLastSession(); },
		});

		this.addCommand({
			id: "close-terminal",
			name: "Close terminal",
			checkCallback: (checking) => {
				const hasTerminal = this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE).length > 0;
				if (hasTerminal && !checking) void this.viewCoordinator.closeTerminal();
				return hasTerminal;
			},
		});

		this.addCommand({
			id: "restart-terminal",
			name: "Restart terminal (reset size)",
			callback: () => { void this.openOrRestartTerminal(); },
		});

		this.addCommand(activeLineReferenceCommand({
			findTerminal: () => {
				const view = this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0]?.view;
				return view instanceof OpencodeTerminalView ? view : null;
			},
			revealTerminal: () => this.activateTerminalView(),
			notice: (message) => { new Notice(message); },
		}));

		this.addCommand({
			id: "insert-session-link",
			name: "Insert link to OpenCode session",
			editorCheckCallback: (checking, editor, view) => {
				if (!view.file || view.file.extension !== "md") return false;
				if (!checking) void this.insertActiveSessionLink(editor);
				return true;
			},
		});

		this.addSettingTab(new OpencodeSettingTab(this.app, this));

		this.registerEditorSuggest(new OpencodeEditorSuggest(this));

		this.logPtyHostDiagnostics();
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<OpencodePluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings() {
		for (const leaf of this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)) {
			if (leaf.view instanceof OpencodeTerminalView) {
				leaf.view.setShiftEnterNewline(this.settings.shiftEnterNewline);
			}
		}
		await this.saveData(this.settings);
	}

	openSettings(): void {
		const settings = (this.app as typeof this.app & {
			setting?: { open(): void; openTabById(id: string): void };
		}).setting;
		settings?.open();
		settings?.openTabById(this.manifest.id);
	}

	createPtySession(): PtySession {
		return this.ptySessions.register(new PtySession(this.pluginDirectory()));
	}

	private pluginDirectory(): string {
		const adapter = this.app.vault.adapter;
		const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
		return resolvePluginDirectory(this.manifest.dir, basePath, this.app.vault.configDir, this.manifest.id);
	}

	/**
	 * Logs the resolved plugin directory and the vendored PTY assets to the
	 * developer console at startup, so a support log shows which PTY path the
	 * plugin will take before any terminal is opened.
	 */
	private logPtyHostDiagnostics(): void {
		const prefix = "[obsidian-opencode]";
		const directory = this.pluginDirectory();
		const nodePtyDirectory = path.join(directory, "native", "node-pty");
		const entry = path.join(nodePtyDirectory, "lib", "index.js");
		const entryExists = fs.existsSync(entry);
		console.log(`${prefix} plugin directory: ${directory}`);
		console.log(`${prefix} node-pty entry: ${entry} (found=${entryExists})`);
		if (entryExists) {
			try {
				const manifest = JSON.parse(fs.readFileSync(path.join(nodePtyDirectory, "package.json"), "utf8")) as { version?: string };
				console.log(`${prefix} node-pty version: ${manifest.version ?? "<unknown>"}`);
			} catch (error) {
				console.log(`${prefix} node-pty version: unreadable (${error instanceof Error ? error.message : String(error)})`);
			}
		}
		if (process.platform === "win32") {
			const conptyDirectory = path.join(nodePtyDirectory, "prebuilds", "win32-x64", "conpty");
			const dll = fs.existsSync(path.join(conptyDirectory, "conpty.dll"));
			const openConsole = fs.existsSync(path.join(conptyDirectory, "OpenConsole.exe"));
			console.log(`${prefix} bundled ConPTY: conpty.dll=${dll} OpenConsole.exe=${openConsole}`);
		}
		console.log(`${prefix} runtime: platform=${process.platform} arch=${process.arch} electron=${process.versions.electron ?? "<none>"} node=${process.versions.node}`);
	}

	async closePtySession(session: PtySession): Promise<void> {
		await this.ptySessions.close(session);
	}

	onunload(): void {
		this.unloading = true;
		void this.ptySessions.closeAll().catch((error) => {
			console.error("Unable to stop every OpenCode PTY during plugin unload", error);
		});
	}

	private setupStatusBar(): void {
		if (!Platform.isDesktopApp) return;

		const item = this.addStatusBarItem();
		item.addClass("opencode-status-bar-item");
		this.statusButton = item.createEl("button", {
			cls: ["opencode-status", "clickable-icon", "is-idle"],
			attr: { type: "button" },
		});
		const icon = this.statusButton.createSpan({ cls: "opencode-status-icon", attr: { "aria-hidden": "true" } });
		setIcon(icon, "terminal");
		this.statusBadge = this.statusButton.createSpan({
			cls: "opencode-status-badge",
			attr: { "aria-hidden": "true" },
		});
		this.registerDomEvent(this.statusButton, "click", () => { void this.activateTerminalView(); });

		this.statusTracker = new OpencodeStatusTracker();
		this.updateStatusActiveFile(this.app.workspace.getActiveFile());
		this.registerEvent(this.app.workspace.on("file-open", (file) => this.updateStatusActiveFile(file)));

		void this.startStatusTracking();
	}

	private async startStatusTracking(): Promise<void> {
		const client = new OpencodeClient(
			this.settings.opencodePath || "opencode",
			this.vaultRoot,
			this.settings.environmentVariables,
		);
		try {
			const compatibility = await client.checkCompatibility();
			if (this.unloading || compatibility.generation === "stable") return;
			this.statusSource = new OpencodeActivitySource(client, this.vaultRoot);
			await this.refreshStatus();
			if (this.unloading) return;
			this.registerInterval(window.setInterval(() => { void this.refreshStatus(); }, 1_500));
		} catch (error) {
			console.debug("OpenCode status tracking is unavailable", error);
		}
	}

	private async refreshStatus(): Promise<void> {
		if (!this.statusSource || !this.statusTracker || this.statusRefreshPending) return;
		this.statusRefreshPending = true;
		try {
			this.statusTracker.updateSessions(await this.statusSource.read());
			this.renderStatus(this.statusTracker.status);
		} catch (error) {
			console.debug("Unable to refresh OpenCode status", error);
		} finally {
			this.statusRefreshPending = false;
		}
	}

	private updateStatusActiveFile(file: TFile | null): void {
		if (!this.statusTracker) return;
		this.statusTracker.updateActiveFile(file ? path.join(this.vaultRoot, file.path) : null);
		this.renderStatus(this.statusTracker.status);
	}

	private renderStatus(status: OpencodeStatus): void {
		if (!this.statusButton || !this.statusBadge) return;
		this.statusButton.removeClass("is-idle", "is-running", "is-touched");
		this.statusButton.addClass(`is-${status.kind}`);
		this.statusButton.setAttribute("aria-label", status.tooltip);
		this.statusButton.setAttribute("title", status.tooltip);
		this.statusBadge.setText(status.kind === "touched" ? "!" : "");
	}

	async activateTerminalView() {
		await this.viewCoordinator.activateTerminalView();
	}

	async activateConversationView() {
		await this.viewCoordinator.activateConversationView();
	}

	async toggleTerminalSidebar() {
		await this.viewCoordinator.toggleTerminalSidebar();
	}

	async newSession() {
		this.sessionState.setNewSession();
		await this.openOrRestartTerminal();
	}

	async continueLastSession() {
		this.sessionState.setContinueLastSession();
		await this.openOrRestartTerminal();
	}

	async openTerminalWithSession(sessionId: string, directory: string) {
		this.sessionState.setOpenSession(sessionId, directory);
		await this.openOrRestartTerminal();
	}

	/**
	 * Handle an `obsidian://opencode?session=<id>[&directory=<dir>]` link.
	 *
	 * The directory from the link wins; otherwise it is resolved from the
	 * session list. A session that cannot be located is not opened.
	 */
	private async openSessionFromUri(params: Record<string, string>): Promise<void> {
		const sessionId = params.session?.trim();
		if (!sessionId) {
			new Notice("OpenCode: session id missing in link");
			return;
		}
		const directory = params.directory?.trim() || await this.resolveSessionDirectory(sessionId);
		if (!directory) {
			new Notice(`OpenCode session not found: ${sessionId}`);
			return;
		}
		await this.openTerminalWithSession(sessionId, directory);
	}

	/** Look up a session's working directory, or null when it is unknown. */
	private async resolveSessionDirectory(sessionId: string): Promise<string | null> {
		const cwd = this.settings.defaultWorkingDirectory || this.vaultRoot;
		try {
			const client = new OpencodeClient(
				this.settings.opencodePath || "opencode",
				cwd,
				this.settings.environmentVariables,
			);
			const compatibility = await client.checkCompatibility();
			const sessions = await client.listSessions(compatibility.generation);
			return sessions.find((session) => session.id === sessionId)?.directory ?? null;
		} catch (error) {
			console.debug("Unable to resolve OpenCode session directory", error);
			return null;
		}
	}

	/**
	 * Open the terminal rooted at the active note's folder.
	 *
	 * Resumes the folder's most recently updated session when it falls within
	 * `resumeWithinDays`, otherwise starts a new session. Either way the active
	 * note is pre-filled as an `@path` mention in the composer.
	 */
	async openActiveNoteTerminal(): Promise<void> {
		const file = this.app.workspace.getActiveFile() ?? this.lastActiveMarkdownFile;
		const cwd = file
			? path.join(this.vaultRoot, path.dirname(file.path))
			: this.settings.defaultWorkingDirectory || this.vaultRoot;

		await this.openTerminalForTarget(cwd, file ? file.path : null);
	}

	/**
	 * Insert a Markdown link to an OpenCode session for the active note's
	 * folder at the editor cursor.
	 *
	 * Prefers the per-file session (when the note lives in
	 * `fileSessionFolder`), then the folder's first TUI tab, then the most
	 * recently updated folder session.
	 */
	async insertActiveSessionLink(editor: Editor): Promise<void> {
		const file = this.app.workspace.getActiveFile() ?? this.lastActiveMarkdownFile;
		const cwd = file
			? path.join(this.vaultRoot, path.dirname(file.path))
			: this.settings.defaultWorkingDirectory || this.vaultRoot;

		const found = await this.findSessionForNote(cwd, file);
		if (!found) {
			new Notice("No OpenCode session found for this folder");
			return;
		}
		const title = found.title.replace(/\]/g, "\\]");
		editor.replaceSelection(`[${title}](${sessionUri(found.id, found.directory)})`);
	}

	/** Resolve which session a link in the active note should point at. */
	private async findSessionForNote(
		cwd: string,
		file: TFile | null,
	): Promise<{ id: string; title: string; directory: string } | null> {
		const folder = this.settings.fileSessionFolder.trim().replace(/[\\/]+$/, "");
		if (file && folder) {
			const posixPath = file.path.replace(/\\/g, "/");
			if (path.posix.dirname(posixPath) === folder) {
				const name = path.posix.basename(posixPath).replace(/\.[^./]+$/, "");
				const session = (await this.listFolderSessions(cwd))
					.find((candidate) => candidate.title === name);
				if (session) {
					return { id: session.id, title: session.title, directory: session.directory };
				}
			}
		}

		const tab = readSessionTabs(cwd)[0];
		if (tab) return { id: tab.id, title: tab.title, directory: cwd };

		const session = (await this.listFolderSessions(cwd))[0];
		if (session) {
			return { id: session.id, title: session.title, directory: session.directory };
		}
		return null;
	}

	/**
	 * Open the terminal rooted at `cwd`, resuming the folder's most recently
	 * updated session within `resumeWithinDays`, otherwise starting a new
	 * session. Either way `attachPath` (vault-relative) is pre-filled as an
	 * `@path` mention in the composer.
	 */
	async openTerminalForTarget(cwd: string, attachPath: string | null): Promise<void> {
		if (attachPath && await this.openFileSessionIfConfigured(cwd, attachPath)) return;

		const sessions = await this.listFolderSessions(cwd);
		const threshold = Date.now() - this.settings.resumeWithinDays * 24 * 60 * 60 * 1000;
		const resumeId = sessions.find((session) => session.updated >= threshold)?.id ?? null;

		const recentTabs = this.settings.recentTabsCount > 0
			? sessions
				.slice(0, this.settings.recentTabsCount)
				.map((session) => ({ id: session.id, title: session.title }))
			: null;
		if (recentTabs) mergeSessionTabs(cwd, recentTabs);

		const plan = planTerminalOpen(attachPath, resumeId);
		if (plan.kind === "resume" && resumeId) {
			this.sessionState.setOpenSession(resumeId, cwd);
			this.pendingRouteSessionId = resumeId;
		} else {
			this.sessionState.setNewSession();
			this.sessionCwd = cwd;
		}
		this.pendingAttachPath = plan.attachPath;

		await this.openOrRestartTerminal();

		if (recentTabs) {
			// The first write can lose a Windows rename race with the TUI's own
			// flush; re-merge once the terminal is up so live-reload picks the
			// tabs up. Skipped if the plugin unloaded or the terminal is gone.
			this.registerInterval(window.setTimeout(() => {
				if (this.unloading) return;
				if (this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE).length === 0) return;
				mergeSessionTabs(cwd, recentTabs);
			}, 1_500));
		}
	}

	/**
	 * Open the terminal for a file-explorer context-menu entry: folders open
	 * rooted at the folder, files open rooted at their parent folder with the
	 * file attached as an `@path` mention on a new session.
	 */
	private async openTerminalForFileMenu(file: TFile | TFolder): Promise<void> {
		if (file instanceof TFolder) {
			await this.openTerminalForTarget(path.join(this.vaultRoot, file.path), null);
			return;
		}
		await this.openTerminalForTarget(path.join(this.vaultRoot, path.dirname(file.path)), file.path);
	}

	/**
	 * When `attachPath` lives in the configured per-file session folder, resume
	 * or create a session titled after the file name (without extension).
	 *
	 * Returns true when this branch handled the request, false to fall back to
	 * the default resume-or-new logic.
	 */
	private async openFileSessionIfConfigured(cwd: string, attachPath: string): Promise<boolean> {
		const folder = this.settings.fileSessionFolder.trim().replace(/[\\/]+$/, "");
		if (!folder) return false;
		const posixPath = attachPath.replace(/\\/g, "/");
		if (path.posix.dirname(posixPath) !== folder) return false;
		const name = path.posix.basename(posixPath).replace(/\.[^./]+$/, "");
		try {
			const client = new OpencodeClient(
				this.settings.opencodePath || "opencode",
				cwd,
				this.settings.environmentVariables,
			);
			const found = await client.findSessionByTitle(name, cwd);
			const session = found ?? await client.createSession({ title: name, directory: cwd });
			// The note is attached whether the per-file session was found or
			// created, so resuming it still pre-fills the file.
			const plan = planTerminalOpen(attachPath, session.id);
			this.sessionState.setOpenSession(session.id, cwd);
			this.pendingRouteSessionId = session.id;
			this.pendingAttachPath = plan.attachPath;
			await this.openOrRestartTerminal();
			return true;
		} catch (error) {
			console.debug("Unable to open per-file OpenCode session", error);
			return false;
		}
	}

	private async listFolderSessions(cwd: string): Promise<OpencodeSession[]> {
		try {
			const client = new OpencodeClient(
				this.settings.opencodePath || "opencode",
				cwd,
				this.settings.environmentVariables,
			);
			const compatibility = await client.checkCompatibility();
			const sessions = await client.listSessions(compatibility.generation);
			const target = normalizeDirectory(cwd);
			return sessions
				.filter((session) => normalizeDirectory(session.directory) === target)
				.sort((a, b) => b.updated - a.updated);
		} catch (error) {
			console.debug("Unable to list OpenCode sessions for the folder", error);
			return [];
		}
	}

	private async openOrRestartTerminal() {
		await this.viewCoordinator.openOrRestartTerminal(async () => {
			const leaf = this.app.workspace.getLeavesOfType(OPENCODE_TERMINAL_VIEW_TYPE)[0];
			if (leaf?.view instanceof OpencodeTerminalView) {
				await leaf.view.restartPty();
			}
		});
	}
}
