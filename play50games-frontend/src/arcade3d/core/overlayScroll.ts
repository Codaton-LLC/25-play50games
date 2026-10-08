// The wheel over an overlay's backdrop. Owned by Claude. The shell's overlays (ShellOverlays.tsx
// Overlay) and the result card (ui/ResultPanel) never scroll themselves: their card is at most as
// tall as the free area above the cookie banner and scrolls inside itself, so its frame and its
// pinned buttons stay on screen. The wheel beside the card would then scroll nothing; this hands it
// to the card. Pure, so it is tested without a DOM (ShellOverlays.test.ts).

export interface BackdropWheel {
   target: unknown;
   currentTarget: unknown;
   deltaY: number;
   /** WheelEvent.deltaMode: 0 pixels, 1 lines, 2 pages */
   deltaMode: number;
   ctrlKey: boolean;
}

export interface ScrollBox {
   scrollHeight: number;
   clientHeight: number;
   scrollBy(options: ScrollToOptions): void;
}

/** px per wheel line (deltaMode 1, Firefox) */
const WHEEL_LINE_PX = 16;

/**
 * The wheel over the backdrop beside a panel scrolls the panel, as it scrolled the whole overlay
 * before the panel scrolled itself (a desktop start card with its top 10 is taller than the
 * screen). false, and nothing scrolls, when the wheel is over the panel (it scrolls natively),
 * zooms (ctrl), the overlay can scroll itself, or the panel has nothing to scroll.
 */
export function scrollPanelFromBackdrop(event: BackdropWheel, overlay: ScrollBox, panel: ScrollBox | null): boolean {
   if (!panel || event.ctrlKey || event.deltaY === 0 || event.target !== event.currentTarget) return false;
   if (overlay.scrollHeight > overlay.clientHeight + 1 || panel.scrollHeight <= panel.clientHeight + 1) return false;
   const unit = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? panel.clientHeight : 1;
   panel.scrollBy({ top: event.deltaY * unit });
   return true;
}
