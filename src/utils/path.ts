import * as path from "path";

/**
 * Resolve the plugin's directory on disk.
 *
 * Obsidian reports `manifest.dir` relative to the vault root on desktop
 * (e.g. `.obsidian/plugins/opencode`), so joining it directly against
 * `process.cwd()` points at the app installation instead of the vault.
 * An absolute `manifest.dir` is kept as-is; an empty one falls back to
 * `<vaultBasePath>/<configDir>/plugins/<pluginId>`.
 */
export function resolvePluginDirectory(
	manifestDir: string | undefined,
	vaultBasePath: string,
	configDir: string,
	pluginId: string,
): string {
	if (manifestDir) {
		return path.isAbsolute(manifestDir) ? manifestDir : path.join(vaultBasePath, manifestDir);
	}
	return path.join(vaultBasePath, configDir, "plugins", pluginId);
}

/**
 * Normalize a dropped file path relative to the vault root.
 * - If the path is already relative, return it as-is.
 * - If the path is absolute and inside the vault, return the vault-relative path.
 * - If the path is absolute and outside the vault, return the absolute path unchanged.
 */
export function normalizeVaultPath(filePath: string, vaultRoot: string): string {
	if (!path.isAbsolute(filePath)) {
		return filePath;
	}

	const relative = path.relative(vaultRoot, filePath);

	// If relative starts with ".." or is itself absolute (Windows cross-drive),
	// the file lives outside the vault.
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		return filePath;
	}

	return relative.split(path.sep).join("/");
}
