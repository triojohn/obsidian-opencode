/**
 * Input sequences that drive an already-running OpenCode TUI.
 *
 * Every step is its own PTY write: the TUI parses a chunk of keystrokes as a
 * single key event, so text and the Enter that submits it must be separated by
 * a pause or the Enter is swallowed by the composer.
 */

/** `ctrl+s` — bound to `session.list` in the user's `cli.json`. */
export const TUI_SESSION_PICKER_KEY = "\x13";
/** Time the session picker takes to render its list. */
export const TUI_SESSION_PICKER_DELAY_MS = 1500;
/** Time the picker's text filter takes to narrow the list to one entry. */
export const TUI_SESSION_FILTER_DELAY_MS = 500;
/** Time `/new` takes to leave the composer empty and focused. */
export const TUI_NEW_SESSION_DELAY_MS = 800;
/** Gap between typed text and the Enter that submits it. */
export const TUI_INPUT_GAP_MS = 250;

/** Writes raw bytes to the running TUI's stdin. */
export type TuiWriter = (data: string) => void;

/** Waits `ms` milliseconds; injectable so tests can use fake timers. */
export type TuiDelay = (ms: number) => Promise<void>;

/**
 * Resolves after `ms` milliseconds.
 *
 * Args:
 *   ms: Delay in milliseconds.
 */
export function tuiDelay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const host: Pick<typeof globalThis, "setTimeout"> = typeof window === "undefined" ? globalThis : window;
		host.setTimeout(resolve, ms);
	});
}

/**
 * Types `text` and submits it with a separate Enter write.
 *
 * Args:
 *   write: Sink for raw PTY input.
 *   text: Command or filter text to type.
 *   delay: Delay implementation.
 *   gapMs: Pause between the text and Enter writes.
 */
export async function runCommand(
	write: TuiWriter,
	text: string,
	delay: TuiDelay = tuiDelay,
	gapMs: number = TUI_INPUT_GAP_MS,
): Promise<void> {
	write(text);
	await delay(gapMs);
	write("\r");
}

/**
 * Opens the session picker and selects the entry filtered by `title`.
 *
 * Args:
 *   write: Sink for raw PTY input.
 *   title: Session title shown in the picker.
 *   delay: Delay implementation.
 */
export async function openSessionInTui(
	write: TuiWriter,
	title: string,
	delay: TuiDelay = tuiDelay,
): Promise<void> {
	write(TUI_SESSION_PICKER_KEY);
	await delay(TUI_SESSION_PICKER_DELAY_MS);
	await runCommand(write, title, delay, TUI_SESSION_FILTER_DELAY_MS);
}

/**
 * Starts a fresh session and, when given, leaves a file mention in the
 * composer. The mention is written without Enter so its menu stays open.
 *
 * Args:
 *   write: Sink for raw PTY input.
 *   attachPath: Vault-relative note to mention, or null.
 *   delay: Delay implementation.
 */
export async function startNewSessionInTui(
	write: TuiWriter,
	attachPath: string | null,
	delay: TuiDelay = tuiDelay,
): Promise<void> {
	await runCommand(write, "/new", delay);
	await delay(TUI_NEW_SESSION_DELAY_MS);
	if (attachPath) write(`@${attachPath}`);
}
