import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const { home } = vi.hoisted(() => ({ home: { value: "" } }));
vi.mock("os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("os")>();
	return { ...actual, default: { ...actual, homedir: () => home.value }, homedir: () => home.value };
});

import { mergeSessionTabs, readSessionTabs } from "./sessionTabs";

describe("mergeSessionTabs", () => {
	let dir: string;
	const cwd = "C:\\vault\\10-projects\\demo";

	function tabsPath(): string {
		return path.join(home.value, ".local", "state", "opencode", "latest", "tui", "tabs.json");
	}

	function readTabs(): Record<string, unknown> {
		return JSON.parse(fs.readFileSync(tabsPath(), "utf8")) as Record<string, unknown>;
	}

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "tabs-"));
		home.value = dir;
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("creates the file and appends sessions for the cwd", () => {
		mergeSessionTabs(cwd, [{ id: "ses_b", title: "B" }, { id: "ses_a", title: "A" }]);
		const tabs = (readTabs().cwd as Record<string, { tabs: unknown[] }>)[cwd].tabs;
		expect(tabs).toEqual([
			{ sessionID: "ses_b", title: "B" },
			{ sessionID: "ses_a", title: "A" },
		]);
	});

	it("keeps existing order and never removes or duplicates tabs", () => {
		mergeSessionTabs(cwd, [{ id: "ses_b", title: "B" }]);
		mergeSessionTabs(cwd, [{ id: "ses_a", title: "A" }, { id: "ses_b", title: "B" }]);
		const tabs = (readTabs().cwd as Record<string, { tabs: unknown[] }>)[cwd].tabs;
		expect(tabs).toEqual([
			{ sessionID: "ses_b", title: "B" },
			{ sessionID: "ses_a", title: "A" },
		]);
	});

	it("ignores the pseudo session id \"new\" and empty ids", () => {
		mergeSessionTabs(cwd, [{ id: "new", title: "New" }, { id: "", title: "x" }]);
		expect(fs.existsSync(tabsPath())).toBe(false);
	});

	it("preserves other cwd keys and recovers from broken JSON", () => {
		fs.mkdirSync(path.dirname(tabsPath()), { recursive: true });
		fs.writeFileSync(tabsPath(), "{ not json");
		mergeSessionTabs(cwd, [{ id: "ses_a", title: "A" }]);
		expect((readTabs().cwd as Record<string, { tabs: unknown[] }>)[cwd].tabs).toHaveLength(1);
	});
});

describe("readSessionTabs", () => {
	let dir: string;
	const cwd = "C:\\vault\\10-projects\\demo";
	const CWD_OTHER_KEY = "C:\\vault\\10-projects\\other";

	function tabsPath(): string {
		return path.join(home.value, ".local", "state", "opencode", "latest", "tui", "tabs.json");
	}

	function writeTabs(content: unknown): void {
		fs.mkdirSync(path.dirname(tabsPath()), { recursive: true });
		fs.writeFileSync(tabsPath(), typeof content === "string" ? content : JSON.stringify(content));
	}

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "tabs-"));
		home.value = dir;
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("returns the bucket for the matching cwd only", () => {
		writeTabs({
			cwd: {
				[CWD_OTHER_KEY]: { tabs: [{ sessionID: "ses_other", title: "Other" }] },
				[cwd]: { tabs: [{ sessionID: "ses_a", title: "A" }] },
			},
		});
		expect(readSessionTabs(cwd)).toEqual([{ id: "ses_a", title: "A" }]);
		expect(readSessionTabs(CWD_OTHER_KEY)).toEqual([{ id: "ses_other", title: "Other" }]);
	});

	it("matches the cwd key across case and slash style", () => {
		writeTabs({ cwd: { "c:/VAULT/10-projects/demo/": { tabs: [{ sessionID: "ses_a", title: "A" }] } } });
		expect(readSessionTabs(cwd)).toEqual([{ id: "ses_a", title: "A" }]);
	});

	it("returns an empty list for broken JSON", () => {
		writeTabs("{ not json");
		expect(readSessionTabs(cwd)).toEqual([]);
	});

	it("returns an empty list when the file is missing", () => {
		expect(fs.existsSync(tabsPath())).toBe(false);
		expect(readSessionTabs(cwd)).toEqual([]);
	});

	it("drops entries without a sessionID", () => {
		writeTabs({
			cwd: {
				[cwd]: { tabs: [{ title: "No id" }, { sessionID: "ses_a", title: "A" }] },
			},
		});
		expect(readSessionTabs(cwd)).toEqual([{ id: "ses_a", title: "A" }]);
	});
});
