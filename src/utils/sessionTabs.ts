import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** A session to surface as a tab in the OpenCode TUI tab bar. */
export interface SessionTabEntry {
	id: string;
	title: string;
}

interface SessionTab {
	sessionID: string;
	title: string;
}

interface TabsBucket {
	tabs: SessionTab[];
	unread?: Record<string, unknown>;
}

type TabsFile = Record<string, unknown> & {
	global?: TabsBucket;
	cwd?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolve the channel state directory (`.../opencode/<channel>`). */
function resolveChannelDirectory(): string {
	const root = path.join(os.homedir(), ".local", "state", "opencode");
	const latest = path.join(root, "latest");
	if (fs.existsSync(latest)) return latest;
	try {
		const dirs = fs
			.readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
		if (dirs.length === 1) return path.join(root, dirs[0]);
	} catch {
		// No state directory yet; fall back to the default channel name.
	}
	return latest;
}

function tabsFilePath(): string {
	return path.join(resolveChannelDirectory(), "tui", "tabs.json");
}

function coerceTab(value: unknown): SessionTab | null {
	if (!isRecord(value) || typeof value.sessionID !== "string") return null;
	const title = typeof value.title === "string" ? value.title : value.sessionID;
	return { sessionID: value.sessionID, title };
}

/**
 * Add `sessions` to the OpenCode TUI tab bar entry for `cwd`.
 *
 * Existing tabs keep their order and are never removed; missing sessions are
 * appended. Never writes the pseudo tab `sessionID: "new"`. Best-effort: any
 * failure is swallowed so terminal opening is not blocked.
 */
export function mergeSessionTabs(cwd: string, sessions: SessionTabEntry[]): void {
	try {
		const wanted = sessions.filter((session) => session.id && session.id !== "new");
		if (wanted.length === 0) return;

		const file = tabsFilePath();
		let parsed: TabsFile = {};
		try {
			const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
			if (isRecord(raw)) parsed = raw as TabsFile;
		} catch {
			parsed = {};
		}

		const cwdMap: Record<string, unknown> = isRecord(parsed.cwd) ? parsed.cwd : {};
		const existingBucket = isRecord(cwdMap[cwd]) ? (cwdMap[cwd] as Record<string, unknown>) : {};
		const existingTabs = Array.isArray(existingBucket.tabs)
			? existingBucket.tabs.map(coerceTab).filter((tab): tab is SessionTab => tab !== null)
			: [];
		const known = new Set(existingTabs.map((tab) => tab.sessionID));

		const merged = [...existingTabs];
		for (const session of wanted) {
			if (known.has(session.id)) continue;
			merged.push({ sessionID: session.id, title: session.title || session.id });
			known.add(session.id);
		}

		if (merged.length === existingTabs.length) return;

		const bucket: TabsBucket = { ...existingBucket, tabs: merged };
		if (!isRecord(bucket.unread)) delete bucket.unread;
		cwdMap[cwd] = bucket;
		parsed.cwd = cwdMap;
		if (!isRecord(parsed.global)) parsed.global = { tabs: [], unread: {} };

		fs.mkdirSync(path.dirname(file), { recursive: true });
		const temp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(temp, JSON.stringify(parsed, null, 2));
		fs.renameSync(temp, file);
	} catch (error) {
		console.debug("Unable to merge OpenCode session tabs", error);
	}
}
