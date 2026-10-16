import { describe, it, expect } from 'vitest';
import { sessionUri } from './sessionUri';

describe('sessionUri', () => {
	it('builds a bare session link without a directory', () => {
		expect(sessionUri('ses_123')).toBe('obsidian://opencode?session=ses_123');
	});

	it('appends the encoded directory when given', () => {
		expect(sessionUri('ses_123', 'C:\\vault')).toBe('obsidian://opencode?session=ses_123&directory=C%3A%5Cvault');
	});

	it('percent-encodes reserved and non-ASCII session ids', () => {
		expect(sessionUri('a&b?c#d e')).toBe('obsidian://opencode?session=a%26b%3Fc%23d%20e');
		expect(sessionUri('сессия-1')).toBe('obsidian://opencode?session=%D1%81%D0%B5%D1%81%D1%81%D0%B8%D1%8F-1');
	});

	it('treats an empty directory as absent', () => {
		expect(sessionUri('ses_123', '')).toBe('obsidian://opencode?session=ses_123');
	});
});
