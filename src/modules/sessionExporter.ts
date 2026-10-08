import { App, TFile, Notice, moment as obsidianMoment } from "obsidian";
import { OpencodeSession, OpencodeExport } from "../utils/opencode";

const moment: (input: number) => { format: (fmt: string) => string } = obsidianMoment;

/** Cyrillic-to-Latin map used to build a UTF-friendly file name. */
const TRANSLITERATION: Record<string, string> = {
	а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
	и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
	с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
	щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export class SessionExporter {
	constructor(private app: App) {}

	async exportToNote(session: OpencodeSession, data: OpencodeExport): Promise<void> {
		const folder = this.resolveFolder();
		const fileName = folder ? `${folder}/${this.buildFileName(session)}` : this.buildFileName(session);

		if (folder) {
			try {
				await this.app.vault.createFolder(folder);
			} catch {
				// Folder may already exist
			}
		}

		let content = this.buildMarkdown(session, data);

		try {
			const existing = this.app.vault.getAbstractFileByPath(fileName);
			if (existing instanceof TFile) {
				await this.app.vault.modify(existing, content);
				new Notice(`Updated ${fileName}`);
			} else {
				const file = await this.app.vault.create(fileName, content);
				new Notice(`Created ${file.name}`);
			}
		} catch (e) {
			console.error(e);
			new Notice("Failed to create note");
		}
	}

	/**
	 * Pick the note destination: the core daily-notes folder when that plugin
	 * is enabled, otherwise the vault root.
	 */
	private resolveFolder(): string {
		const internalPlugins = (this.app as unknown as {
			internalPlugins?: {
				getPluginById?: (id: string) => { enabled?: boolean; instance?: { options?: { folder?: unknown } } } | null;
			};
		}).internalPlugins;
		const plugin = internalPlugins?.getPluginById?.("daily-notes");
		if (!plugin?.enabled) return "";
		const folder = plugin.instance?.options?.folder;
		return typeof folder === "string" ? folder.replace(/^\/+|\/+$/g, "") : "";
	}

	/** `YYYY-MM-DD-opencode-<transliterated-slug>.md`. */
	private buildFileName(session: OpencodeSession): string {
		const date = moment(Date.now()).format("YYYY-MM-DD");
		const slug = this.slugify(session.title) || `session-${session.id.slice(-6)}`;
		return `${date}-opencode-${slug}.md`;
	}

	private slugify(title: string): string {
		return title
			.toLowerCase()
			.split("")
			.map((char) => TRANSLITERATION[char] ?? char)
			.join("")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	private buildMarkdown(session: OpencodeSession, data: OpencodeExport): string {
		let content = `---\n`;
		content += `opencode-session: ${session.id}\n`;
		content += `opencode-session-id: ${session.id}\n`;
		content += `opencode-model: ${data.info.model?.id || "unknown"}\n`;
		content += `opencode-agent: ${data.info.agent || "default"}\n`;
		content += `opencode-cost: ${data.info.cost || 0}\n`;
		content += `opencode-created: ${moment(data.info.time.created).format("YYYY-MM-DD HH:mm:ss")}\n`;
		content += `opencode-updated: ${moment(data.info.time.updated).format("YYYY-MM-DD HH:mm:ss")}\n`;
		content += `---\n\n`;
		content += `# ${session.title}\n\n`;

		for (const msg of data.messages) {
			const role = msg.info.role === "assistant" ? "Assistant" : "User";
			content += `## ${role}\n\n`;
			for (const part of msg.parts) {
				if (part.type === "text" && part.text) {
					content += `${part.text}\n\n`;
				} else if (part.type === "step-start") {
					content += `*(thinking...)*\n\n`;
				} else if (part.type === "tool-call") {
					content += `*(tool call)*\n\n`;
				}
			}
		}

		return content;
	}
}
