/**
 * Host context menu suppression for the embedded terminal.
 *
 * Obsidian builds a native Cut/Copy/Paste menu for a right click inside the
 * view (the Electron main process reacts to the unhandled `contextmenu` event),
 * and that menu races with the menu OpenCode draws itself. Cancelling the event
 * keeps the right click inside the TUI: the SGR mouse report of the right
 * button travels to the PTY independently, through `mousedown`/`mouseup`.
 */

/** The part of a DOM `contextmenu` event this handler needs. */
export interface ContextMenuEventLike {
	clientX: number;
	clientY: number;
	preventDefault(): void;
	stopPropagation(): void;
	stopImmediatePropagation(): void;
}

/** Terminal cell geometry of the xterm screen element. */
export interface ContextMenuCellGrid {
	cols: number;
	rows: number;
	rect: { left: number; top: number; width: number; height: number };
}

/** Rendered-image lookup and clipboard write, injected for testability. */
export interface ContextMenuImageCopy {
	grid: ContextMenuCellGrid;
	/** Rendered image at a viewport cell, or null when the cell holds text. */
	getImageAt(column: number, viewportRow: number): HTMLCanvasElement | null;
	/** Writes the PNG bytes of the clicked image to the system clipboard. */
	writeImagePng(png: Buffer): void;
}

/**
 * Cancels the host context menu over the terminal and, when the clicked cell
 * contains a rendered image, copies that image to the clipboard.
 *
 * Args:
 *   event: The `contextmenu` event captured on the terminal container
 *   copy: Image copying dependencies, or null when the clipboard cannot write images
 */
export function handleTerminalContextMenu(event: ContextMenuEventLike, copy: ContextMenuImageCopy | null): void {
	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();
	if (!copy) return;
	const { cols, rows, rect } = copy.grid;
	const column = Math.floor((event.clientX - rect.left) / (rect.width / cols));
	const viewportRow = Math.floor((event.clientY - rect.top) / (rect.height / rows));
	if (column < 0 || column >= cols || viewportRow < 0 || viewportRow >= rows) return;
	const canvas = copy.getImageAt(column, viewportRow);
	if (!canvas) return;
	const encoded = canvas.toDataURL("image/png").split(",", 2)[1];
	copy.writeImagePng(Buffer.from(encoded, "base64"));
}
