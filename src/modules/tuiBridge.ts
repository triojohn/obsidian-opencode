import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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

/** True when `directory` is `root` itself or lives somewhere below it. */
function isInsideProject(directory: string, root: string): boolean {
	const normalizedDirectory = normalizeDirectory(directory);
	const normalizedRoot = normalizeDirectory(root);
	return (
		normalizedDirectory === normalizedRoot ||
		normalizedDirectory.startsWith(`${normalizedRoot}${path.sep}`)
	);
}

/**
 * Decide whether a session can be switched inside the running TUI.
 *
 * Args:
 *   tuiLive: True when the terminal view has a live, input-ready PTY.
 *   currentTuiCwd: Directory the running TUI was spawned in, or null.
 *   directory: Directory the requested session belongs to.
 *   projectRoot: Vault root; when set, a TUI running elsewhere inside the
 *     same project can be reused instead of restarted.
 *
 * Returns:
 *   True to send the command file; false to restart the terminal.
 */
export function shouldSwitchRunningTui(
	tuiLive: boolean,
	currentTuiCwd: string | null,
	directory: string,
	projectRoot?: string,
): boolean {
	if (!tuiLive || currentTuiCwd === null) return false;
	if (sameDirectory(currentTuiCwd, directory)) return true;
	if (!projectRoot) return false;
	return isInsideProject(currentTuiCwd, projectRoot) && isInsideProject(directory, projectRoot);
}

/**
 * Overwrite `file` with `temp`, retrying a few times on transient Windows
 * rename errors (EBUSY/EPERM).
 *
 * Returns:
 *   True when the rename succeeded, false after the last attempt.
 */
export function renameWithRetry(temp: string, file: string, attempts = 4): boolean {
	for (let attempt = 1; ; attempt++) {
		try {
			fs.renameSync(temp, file);
			return true;
		} catch (error) {
			if (attempt >= attempts) {
				console.warn(`Unable to replace ${file}`, error);
				return false;
			}
			sleepSync(attempt * 20);
		}
	}
}

// ponytail: busy-wait; retries are bounded (3×20-60 ms) so blocking the renderer is acceptable.
function sleepSync(ms: number): void {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		// spin until the backoff window elapses
	}
}

/**
 * Write one command to the queue file.
 *
 * The write is atomic (temporary file + rename) so the TUI never reads a
 * half-written command.
 *
 * Args:
 *   command: Command object serialized into the queue file.
 *
 * Raises:
 *   Error: When the command file cannot be written.
 */
function writeCommand(command: Record<string, unknown>): void {
	try {
		fs.mkdirSync(path.dirname(TUI_COMMAND_FILE), { recursive: true });
		const temporary = `${TUI_COMMAND_FILE}.${process.pid}.tmp`;
		fs.writeFileSync(temporary, JSON.stringify(command));
		if (!renameWithRetry(temporary, TUI_COMMAND_FILE)) {
			throw new Error(`Unable to replace ${TUI_COMMAND_FILE}`);
		}
	} catch (error) {
		console.warn("Unable to write an OpenCode TUI command", error);
		throw error;
	}
}

/**
 * Ask the running TUI to focus `sessionId`.
 *
 * Args:
 *   sessionId: OpenCode session id to focus.
 *
 * Raises:
 *   Error: When the command file cannot be written.
 */
export async function requestSessionSwitch(sessionId: string): Promise<void> {
	writeCommand({ action: "focus", sessionID: sessionId });
}

/**
 * Ask the running TUI to start a new session.
 *
 * Raises:
 *   Error: When the command file cannot be written.
 */
export async function requestNewSession(): Promise<void> {
	writeCommand({ action: "new" });
}
