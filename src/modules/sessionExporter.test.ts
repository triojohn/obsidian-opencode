import { describe, it, expect, vi } from 'vitest';
import type { App } from 'obsidian';

vi.mock('obsidian', () => ({
	App: class {},
	TFile: class MockTFile {
		path: string;
		name: string;
		constructor() {
			this.path = '';
			this.name = '';
		}
	},
	Notice: class {
		constructor(_message: string) {}
	},
	moment: (_timestamp: number) => ({
		format: (fmt: string) => (fmt === 'YYYY-MM-DD' ? '2024-01-01' : '2024-01-01 12:00:00'),
	}),
}));

import { SessionExporter } from './sessionExporter';
import { OpencodeSession, OpencodeExport } from '../utils/opencode';
import { TFile } from 'obsidian';

interface MockFile {
	name: string;
	path: string;
	content: string;
}

interface MockApp {
	vault: {
		createFolder: ReturnType<typeof vi.fn>;
		getAbstractFileByPath: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		modify: ReturnType<typeof vi.fn>;
	};
	internalPlugins?: {
		getPluginById: ReturnType<typeof vi.fn>;
	};
}

const createMockApp = (dailyNotesFolder?: string): MockApp => {
	const files: Record<string, MockFile> = {};
	return {
		vault: {
			createFolder: vi.fn().mockResolvedValue(undefined),
			getAbstractFileByPath: vi.fn((path: string): MockFile | null => files[path] || null),
			create: vi.fn().mockImplementation((path: string, content: string) => {
				files[path] = { name: path.split('/').pop() ?? path, path, content };
				return Promise.resolve(files[path]);
			}),
			modify: vi.fn().mockResolvedValue(undefined),
		},
		internalPlugins: dailyNotesFolder === undefined ? undefined : {
			getPluginById: vi.fn(() => ({ enabled: true, instance: { options: { folder: dailyNotesFolder } } })),
		},
	};
};

const createSession = (): OpencodeSession => ({
	id: 'session-123',
	title: 'Test Session',
	updated: Date.now(),
	created: Date.now(),
	projectId: 'proj-1',
	directory: '/home/user/project',
});

const createData = (messages: OpencodeExport['messages'] = []): OpencodeExport => ({
	info: {
		id: 'session-123',
		slug: 'test-session',
		projectID: 'proj-1',
		directory: '/home/user/project',
		path: '/home/user/project',
		title: 'Test Session',
		agent: 'default',
		model: { id: 'gpt-4', providerID: 'openai' },
		version: '1.0',
		summary: { additions: 0, deletions: 0, files: 0 },
		cost: 0.001,
		tokens: { input: 100, output: 50, reasoning: 0 },
		time: { created: Date.now(), updated: Date.now() },
	},
	messages,
});

describe('SessionExporter', () => {
	it('creates a dated kebab-case note in the vault root when daily notes are off', async () => {
		const app = createMockApp();
		const exporter = new SessionExporter(app as unknown as App);

		await exporter.exportToNote(createSession(), createData([
			{
				info: { role: 'user', id: 'msg-1', sessionID: 'session-123', time: { created: Date.now() } },
				parts: [{ type: 'text', text: 'Hello', id: 'part-1', sessionID: 'session-123', messageID: 'msg-1' }],
			},
		]));

		expect(app.vault.createFolder).not.toHaveBeenCalled();
		expect(app.vault.create).toHaveBeenCalledWith('2024-01-01-opencode-test-session.md', expect.any(String));
		const content = app.vault.create.mock.calls[0][1] as string;
		expect(content).toContain('opencode-session-id: session-123');
	});

	it('transliterates a Cyrillic title into the file name', async () => {
		const app = createMockApp();
		const exporter = new SessionExporter(app as unknown as App);

		await exporter.exportToNote({ ...createSession(), title: 'Пропал шаблон в новых файлах' }, createData());

		expect(app.vault.create).toHaveBeenCalledWith(
			'2024-01-01-opencode-propal-shablon-v-novyh-faylah.md',
			expect.any(String),
		);
	});

	it('writes into the daily-notes folder when that plugin is enabled', async () => {
		const app = createMockApp('70-journal/daily-notes');
		const exporter = new SessionExporter(app as unknown as App);

		await exporter.exportToNote(createSession(), createData());

		expect(app.vault.createFolder).toHaveBeenCalledWith('70-journal/daily-notes');
		expect(app.vault.create).toHaveBeenCalledWith(
			'70-journal/daily-notes/2024-01-01-opencode-test-session.md',
			expect.any(String),
		);
	});

	it('modifies the existing dated note on a repeat export', async () => {
		const app = createMockApp();
		const exporter = new SessionExporter(app as unknown as App);

		const existingFile = new TFile();
		existingFile.path = '2024-01-01-opencode-test-session.md';
		existingFile.name = '2024-01-01-opencode-test-session.md';
		app.vault.getAbstractFileByPath.mockReturnValue(existingFile);

		await exporter.exportToNote(createSession(), createData());

		expect(app.vault.modify).toHaveBeenCalledWith(existingFile, expect.any(String));
	});
});
