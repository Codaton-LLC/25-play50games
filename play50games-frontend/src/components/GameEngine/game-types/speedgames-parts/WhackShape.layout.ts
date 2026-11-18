// Pure layout numbers for Shape Pop (WhackShape): arena height and shape size from the live viewport.
// Nothing here touches the rules (spawn rate, TTL, speed, required hits): only how big things are drawn.

export interface WhackViewport {
   height: number;
   isMobile: boolean;
   isTablet: boolean;
   isTouch: boolean;
}

/** The arena's base shape size in CSS px: a 0.8x shape still measures >= 44 px on a touch device. */
export const WHACK_DESKTOP_SHAPE = 54;
export const WHACK_TOUCH_SHAPE = 56;
export const WHACK_MIN_SIZE_FACTOR = 0.8;

export function whackShapeBase(vp: Pick<WhackViewport, "isMobile" | "isTablet" | "isTouch">): number {
   return vp.isMobile || vp.isTablet || vp.isTouch ? WHACK_TOUCH_SHAPE : WHACK_DESKTOP_SHAPE;
}

/**
 * Everything on a phone that is not the arena, in px: the engine's score bar (~102), the game's header
 * card, the target legend bar, the Replay / Share row, the gaps and the bottom padding (~246), plus the
 * cookie banner (~190 at 360-390 px wide).
 */
export const WHACK_PHONE_CHROME = 538;
/** The same on a tablet: a taller engine bar and roomier cards, but a banner of only ~90 px. */
export const WHACK_TABLET_CHROME = 520;

/**
 * Arena height in px. Desktop keeps the classic 380. Phones and tablets size it from the viewport so the
 * engine header, the game's header card, the legend, the arena and the Replay / Share row all end above the
 * cookie banner once the run has scrolled the score bar to the top; clamped so a short viewport (landscape
 * phone) still gets a playable arena and scrolls instead.
 */
export function whackArenaHeight(vp: WhackViewport): number {
   if (vp.isMobile) return clamp(vp.height - WHACK_PHONE_CHROME, 200, 380);
   if (vp.isTablet) return clamp(vp.height - WHACK_TABLET_CHROME, 240, 380);
   return 380;
}

function clamp(value: number, min: number, max: number): number {
   return Math.max(min, Math.min(max, value));
}
