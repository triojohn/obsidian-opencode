/**
 * Describes how a terminal open request resolves.
 */
export interface TerminalOpenPlan {
	/** "resume" reuses an existing session, "new" starts a fresh one. */
	kind: "new" | "resume";
	/**
	 * Vault-relative note pre-filled as an `@path` mention, or null when the
	 * open has no note.
	 */
	attachPath: string | null;
}

/**
 * Plans a terminal open: whether an existing session is resumed and which note
 * is pre-filled as an `@path` mention.
 *
 * The mention is returned on every open — new session, resumed session and
 * per-file session alike — so opening a note never silently drops the file.
 *
 * Args:
 *   attachPath: Vault-relative note to attach, or null.
 *   resumeSessionId: Session id to resume, or null to start a new session.
 *
 * Returns:
 *   The plan for this open request.
 */
export function planTerminalOpen(
	attachPath: string | null,
	resumeSessionId: string | null,
): TerminalOpenPlan {
	return {
		kind: resumeSessionId ? "resume" : "new",
		attachPath: attachPath ? attachPath : null,
	};
}
