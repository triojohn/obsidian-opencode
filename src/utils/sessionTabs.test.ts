import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const { home } = vi.hoisted(() => ({ home: { value: "" } }));
vi.mock("os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("os")>();
	return { ...actual, default: { ...actual, homedir: () => home.value }, homedir: () => home.value };
});

import { mergeSessionTabs } from "./sessionTabs";

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
