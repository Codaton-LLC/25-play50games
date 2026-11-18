// TypingSprint (classic Speed game 39): pure viewport math for the on-screen keyboard.
// Nothing here touches the typing rules; it only decides how tall the play area may be.

/** Below this many px of difference the visual viewport is just browser chrome, not a keyboard. */
export const KEYBOARD_MIN_PX = 120;

/**
 * The height (px) of the on-screen keyboard covering the bottom of the layout viewport, or 0.
 * `visualHeight` / `visualOffsetTop` come from `window.visualViewport`; the visible band is
 * [offsetTop, offsetTop + height] in layout-viewport coordinates, the keyboard is what is left under it.
 */
export function keyboardInset(windowInnerHeight: number, visualHeight: number, visualOffsetTop = 0): number {
   if (!(windowInnerHeight > 0) || !(visualHeight > 0)) return 0;
   const inset = Math.round(windowInnerHeight - visualHeight - Math.max(0, visualOffsetTop));
   return inset >= KEYBOARD_MIN_PX ? inset : 0;
}

/** The height cap for the play area while the keyboard is up (null = no cap), never from 100vh. */
export function playAreaMaxHeight(visualHeight: number, inset: number): number | null {
   if (inset <= 0 || !(visualHeight > 0)) return null;
   return Math.max(160, Math.floor(visualHeight));
}
