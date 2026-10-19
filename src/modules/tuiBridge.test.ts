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

import { TUI_COMMAND_FILE, requestNewSession, requestSessionSwitch, shouldSwitchRunningTui } from "./tuiBridge";

afterEach(() => {
	fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("requestSessionSwitch", () => {
	it("writes the session id to the command file", async () => {
		expect(TUI_COMMAND_FILE).toBe(path.join(tempRoot, "opencode", "tui-cmd.json"));

		await requestSessionSwitch("ses_123");

		expect(JSON.parse(fs.readFileSync(TUI_COMMAND_FILE, "utf8"))).toEqual({
			action: "focus",
			sessionID: "ses_123",
		});
	});
});

describe("requestNewSession", () => {
	it("writes the new-session command to the command file", async () => {
		await requestNewSession();

		expect(JSON.parse(fs.readFileSync(TUI_COMMAND_FILE, "utf8"))).toEqual({ action: "new" });
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

	it("switches in place across directories of the same project", () => {
		expect(
			shouldSwitchRunningTui(true, project, path.join(tempRoot, "other"), tempRoot),
		).toBe(true);
	});

	it("restarts when the running TUI lives outside the project", () => {
		const outside = path.join(tempRoot, "..");
		expect(shouldSwitchRunningTui(true, outside, project, tempRoot)).toBe(false);
		expect(shouldSwitchRunningTui(true, path.join(outside, "repo"), project, tempRoot)).toBe(false);
	});

	it("restarts when no project root is given", () => {
		expect(shouldSwitchRunningTui(true, project, path.join(tempRoot, "other"))).toBe(false);
	});

	it("restarts when there is no live TUI", () => {
		expect(shouldSwitchRunningTui(false, project, project)).toBe(false);
		expect(shouldSwitchRunningTui(true, null, project)).toBe(false);
	});
});
