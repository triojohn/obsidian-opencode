/**
 * Build an `obsidian://opencode` URI that opens the given session in the
 * plugin's terminal.
 *
 * @param sessionId OpenCode session id
 * @param directory Optional session working directory; when omitted the
 *   handler resolves it from the session list
 */
export function sessionUri(sessionId: string, directory?: string): string {
	let uri = `obsidian://opencode?session=${encodeURIComponent(sessionId)}`;
	if (directory) uri += `&directory=${encodeURIComponent(directory)}`;
	return uri;
}
