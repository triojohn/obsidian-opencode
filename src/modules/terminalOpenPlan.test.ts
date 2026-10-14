import { describe, expect, it } from "vitest";
import { planTerminalOpen } from "./terminalOpenPlan";

describe("planTerminalOpen", () => {
	it("attaches the note when a new session is started", () => {
		expect(planTerminalOpen("notes/todo.md", null)).toEqual({
			kind: "new",
			attachPath: "notes/todo.md",
		});
	});

	it("keeps the note when an existing session is resumed", () => {
		expect(planTerminalOpen("notes/todo.md", "ses_123")).toEqual({
			kind: "resume",
			attachPath: "notes/todo.md",
		});
	});

	it("keeps the note when a per-file session is found", () => {
		expect(planTerminalOpen("70-journal/daily-notes/2026-10-14-notes.md", "ses_daily")).toEqual({
			kind: "resume",
			attachPath: "70-journal/daily-notes/2026-10-14-notes.md",
		});
	});

	it("returns no mention when there is no note", () => {
		expect(planTerminalOpen(null, "ses_123")).toEqual({ kind: "resume", attachPath: null });
		expect(planTerminalOpen("", null)).toEqual({ kind: "new", attachPath: null });
	});
});
