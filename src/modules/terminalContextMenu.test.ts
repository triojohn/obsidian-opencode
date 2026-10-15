import { describe, expect, it, vi } from 'vitest';
import { handleTerminalContextMenu } from './terminalContextMenu';

function contextMenuEvent(clientX: number, clientY: number) {
	const event = {
		clientX,
		clientY,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
		stopImmediatePropagation: vi.fn(),
	};
	return event;
}

function copyFixture(canvas: { toDataURL: () => string } | null) {
	return {
		grid: { cols: 80, rows: 24, rect: { left: 100, top: 200, width: 800, height: 480 } },
		getImageAt: vi.fn(() => canvas as unknown as HTMLCanvasElement | null),
		writeImagePng: vi.fn(),
	};
}

describe('terminal context menu', () => {
	it('suppresses the host menu when the cell holds text', () => {
		const event = contextMenuEvent(500, 400);
		const copy = copyFixture(null);
		handleTerminalContextMenu(event, copy);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(event.stopPropagation).toHaveBeenCalledOnce();
		expect(copy.writeImagePng).not.toHaveBeenCalled();
	});

	it('suppresses the host menu when the clipboard cannot write images', () => {
		const event = contextMenuEvent(500, 400);
		handleTerminalContextMenu(event, null);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
	});

	it('suppresses the host menu outside the screen cells', () => {
		const event = contextMenuEvent(0, 0);
		const copy = copyFixture({ toDataURL: () => 'data:image/png;base64,cG5n' });
		handleTerminalContextMenu(event, copy);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(copy.getImageAt).not.toHaveBeenCalled();
		expect(copy.writeImagePng).not.toHaveBeenCalled();
	});

	it('copies the rendered image of the clicked cell', () => {
		const event = contextMenuEvent(200, 300); // column 10, row 5
		const copy = copyFixture({ toDataURL: () => 'data:image/png;base64,cG5n' });
		handleTerminalContextMenu(event, copy);
		expect(copy.getImageAt).toHaveBeenCalledWith(10, 5);
		expect(copy.writeImagePng).toHaveBeenCalledWith(Buffer.from('png'));
		expect(event.preventDefault).toHaveBeenCalledOnce();
	});
});
