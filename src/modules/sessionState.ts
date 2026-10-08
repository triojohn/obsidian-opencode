export class SessionState {
	sessionArgs: string[] | null = null;
	sessionCwd: string | null = null;
	pendingPrompt: string | null = null;
	pendingAttachPath: string | null = null;
	pendingRouteSessionId: string | null = null;

	setNewSession(): void {
		this.sessionArgs = [];
		this.sessionCwd = null;
		this.pendingRouteSessionId = null;
	}

	setContinueLastSession(): void {
		this.sessionArgs = ["-c"];
		this.sessionCwd = null;
		this.pendingRouteSessionId = null;
	}

	setOpenSession(sessionId: string, directory: string): void {
		this.sessionArgs = ["-s", sessionId];
		this.sessionCwd = directory;
		this.pendingRouteSessionId = null;
	}

	setPendingPrompt(prompt: string): void {
		this.pendingPrompt = prompt;
	}
}
