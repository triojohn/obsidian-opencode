import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

const tempRoot = vi.hoisted(() => {
	const nodePath = require("node:path") as typeof import("node:path");
	const nodeOs = require("node:os") as typeof import("node:os");
	return nodePath.join(nodeOs.tmpdir(), `opencode-tui-bridge-test-${process.pid}`);
});

vi.mock("os", async () => {
	const actual = await vi.importActual<typeof import("os")>("os");
	return { ...actual, tmpdir: () => tempRoot };
});

import { TUI_COMMAND_FILE, requestSessionSwitch, shouldSwitchRunningTui } from "./tuiBridge";

afterEach(() => {
	fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("requestSessionSwitch", () => {
	it("writes the session id to the command file", async () => {
		expect(TUI_COMMAND_FILE).toBe(path.join(tempRoot, "opencode", "tui-cmd.json"));

		await requestSessionSwitch("ses_123");

		expect(JSON.parse(fs.readFileSync(TUI_COMMAND_FILE, "utf8"))).toEqual({ sessionID: "ses_123" });
	});
});

describe("shouldSwitchRunningTui", () => {
	const project = path.join(tempRoot, "project");

	it("switches in place when the running TUI is live in the same directory", () => {
		expect(shouldSwitchRunningTui(true, project, `${project}${path.sep}`)).toBe(true);
	});

	it("restarts when the running TUI lives in another directory", () => {
		expect(shouldSwitchRunningTui(true, project, path.join(tempRoot, "other"))).toBe(false);
	});

	it("restarts when there is no live TUI", () => {
		expect(shouldSwitchRunningTui(false, project, project)).toBe(false);
		expect(shouldSwitchRunningTui(true, null, project)).toBe(false);
	});
});
