import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { normalizeVaultPath, resolvePluginDirectory } from './path';

describe('normalizeVaultPath', () => {
    it('should keep an already-relative path as-is', () => {
        expect(normalizeVaultPath('folder/note.md', '/home/user/vault')).toBe('folder/note.md');
    });

    it('should convert an absolute path inside the vault to relative', () => {
        expect(normalizeVaultPath('/home/user/vault/folder/note.md', '/home/user/vault')).toBe('folder/note.md');
    });

    it('should use Obsidian separators for a native relative path', () => {
        const vaultRoot = process.platform === 'win32' ? 'C:\\vault' : '/vault';
        const filePath = process.platform === 'win32' ? 'C:\\vault\\folder\\note.md' : '/vault/folder/note.md';
        expect(normalizeVaultPath(filePath, vaultRoot)).toBe('folder/note.md');
    });

    it('should preserve an absolute path outside the vault', () => {
        expect(normalizeVaultPath('/home/other/file.md', '/home/user/vault')).toBe('/home/other/file.md');
    });
});

describe('resolvePluginDirectory', () => {
    const basePath = process.platform === 'win32' ? 'C:\\aaz_vault' : '/vault';

    it('should resolve a relative manifest.dir against the vault base path', () => {
        const resolved = resolvePluginDirectory('.obsidian/plugins/obsidian-opencode', basePath, '.obsidian', 'obsidian-opencode');
        expect(resolved).toBe(path.join(basePath, '.obsidian', 'plugins', 'obsidian-opencode'));
        expect(path.isAbsolute(resolved)).toBe(true);
    });

    it('should produce an absolute node-pty entry from a relative manifest.dir', () => {
        const resolved = resolvePluginDirectory('.obsidian/plugins/obsidian-opencode', basePath, '.obsidian', 'obsidian-opencode');
        expect(path.join(resolved, 'native', 'node-pty', 'lib', 'index.js'))
            .toBe(path.join(basePath, '.obsidian', 'plugins', 'obsidian-opencode', 'native', 'node-pty', 'lib', 'index.js'));
    });

    it('should keep an absolute manifest.dir as-is', () => {
        const absolute = path.join(basePath, '.obsidian', 'plugins', 'obsidian-opencode');
        expect(resolvePluginDirectory(absolute, '/other/vault', '.obsidian', 'obsidian-opencode')).toBe(absolute);
    });

    it('should fall back to basePath/configDir/plugins/pluginId when manifest.dir is empty', () => {
        expect(resolvePluginDirectory(undefined, basePath, '.obsidian', 'obsidian-opencode'))
            .toBe(path.join(basePath, '.obsidian', 'plugins', 'obsidian-opencode'));
        expect(resolvePluginDirectory('', basePath, '.obsidian', 'obsidian-opencode'))
            .toBe(path.join(basePath, '.obsidian', 'plugins', 'obsidian-opencode'));
    });
});
