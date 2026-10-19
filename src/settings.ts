import type { EnvironmentVariables } from "./utils/environment";

export interface OpencodePluginSettings {
	opencodePath: string;
	defaultWorkingDirectory: string;
	environmentVariables: EnvironmentVariables;
	terminalFontSize: number;
	terminalFontFamily: string;
	newSessionArgs: string;
	shiftEnterNewline: boolean;
	resumeWithinDays: number;
	fileSessionFolder: string;
}

export const DEFAULT_SETTINGS: OpencodePluginSettings = {
	opencodePath: "",
	defaultWorkingDirectory: "",
	environmentVariables: {},
	terminalFontSize: 14,
	terminalFontFamily: "monospace",
	newSessionArgs: "",
	shiftEnterNewline: true,
	resumeWithinDays: 1,
	fileSessionFolder: "70-journal/daily-notes",
};
