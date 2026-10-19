import { describe, expect, it, vi } from "vitest";
import {
	TUI_NEW_SESSION_DELAY_MS,
	TUI_SESSION_FILTER_DELAY_MS,
	TUI_SESSION_PICKER_DELAY_MS,
	openSessionInTui,
	runCommand,
	startNewSessionInTui,
} from "./tuiInput";

function recorder() {
	const writes: string[] = [];
	return { writes, write: (data: string) => writes.push(data) };
}

describe("TUI input", () => {
	it("writes the text and the Enter as separate writes with a gap", async () => {
		vi.useFakeTimers();
		try {
			const { writes, write } = recorder();
			const command = runCommand(write, "hello", undefined, 250);
			expect(writes).toEqual(["hello"]);
			await vi.advanceTimersByTimeAsync(249);
			expect(writes).toEqual(["hello"]);
			await vi.advanceTimersByTimeAsync(1);
			expect(writes).toEqual(["hello", "\r"]);
			await command;
		} finally {
			vi.useRealTimers();
		}
	});

	it("opens the picker, waits, filters, then submits", async () => {
		vi.useFakeTimers();
		try {
			const { writes, write } = recorder();
			const open = openSessionInTui(write, "My session");
			expect(writes).toEqual(["\x13"]);
			await vi.advanceTimersByTimeAsync(TUI_SESSION_PICKER_DELAY_MS);
			expect(writes).toEqual(["\x13", "My session"]);
			await vi.advanceTimersByTimeAsync(TUI_SESSION_FILTER_DELAY_MS - 1);
			expect(writes).toEqual(["\x13", "My session"]);
			await vi.advanceTimersByTimeAsync(1);
			expect(writes).toEqual(["\x13", "My session", "\r"]);
			await open;
		} finally {
			vi.useRealTimers();
		}
	});

	it("starts a new session and leaves the mention without Enter", async () => {
		vi.useFakeTimers();
		try {
			const { writes, write } = recorder();
			const start = startNewSessionInTui(write, "notes/a.md");
			expect(writes).toEqual(["/new"]);
			await vi.advanceTimersByTimeAsync(250);
			expect(writes).toEqual(["/new", "\r"]);
			await vi.advanceTimersByTimeAsync(TUI_NEW_SESSION_DELAY_MS);
			expect(writes).toEqual(["/new", "\r", "@notes/a.md"]);
			await start;
		} finally {
			vi.useRealTimers();
		}
	});
});
