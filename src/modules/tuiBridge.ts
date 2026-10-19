import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { renameWithRetry } from "../utils/sessionTabs";

/**
 * Command file watched by the OpenCode TUI plugin.
 *
 * The TUI polls this file and focuses the requested session without a
 * restart; the plugin never injects keystrokes.
 */
export const TUI_COMMAND_FILE = path.join(os.tmpdir(), "opencode", "tui-cmd.json");

/** Normalize a directory for comparison across case and trailing separators. */
function normalizeDirectory(directory: string): string {
	return path.resolve(directory).replace(/[\\/]+$/, "").toLowerCase();
}

/** True when both paths point at the same directory. */
export function sameDirectory(a: string, b: string): boolean {
	return normalizeDirectory(a) === normalizeDirectory(b);
}

/**
 * Decide whether a session can be switched inside the running TUI.
 *
 * Args:
 *   tuiLive: True when the terminal view has a live, input-ready PTY.
 *   currentTuiCwd: Directory the running TUI was spawned in, or null.
 *   directory: Directory the requested session belongs to.
 *
 * Returns:
 *   True to send the command file; false to restart the terminal.
 */
export function shouldSwitchRunningTui(
	tuiLive: boolean,
	currentTuiCwd: string | null,
	directory: string,
): boolean {
	return tuiLive && currentTuiCwd !== null && sameDirectory(currentTuiCwd, directory);
}

/**
 * Ask the running TUI to focus `sessionId`.
 *
 * Writes `{"sessionID": ...}` atomically (temporary file + rename) so the TUI
 * never reads a half-written command.
 *
 * Args:
 *   sessionId: OpenCode session id to focus.
 *
 * Raises:
 *   Error: When the command file cannot be written.
 */
export async function requestSessionSwitch(sessionId: string): Promise<void> {
	try {
		fs.mkdirSync(path.dirname(TUI_COMMAND_FILE), { recursive: true });
		const temporary = `${TUI_COMMAND_FILE}.${process.pid}.tmp`;
		fs.writeFileSync(temporary, JSON.stringify({ sessionID: sessionId }));
		if (!renameWithRetry(temporary, TUI_COMMAND_FILE)) {
			throw new Error(`Unable to replace ${TUI_COMMAND_FILE}`);
		}
	} catch (error) {
		console.warn("Unable to request an OpenCode TUI session switch", error);
		throw error;
	}
}
