// Pure layout helper for Avoid the Red (no React): the arena's height from the live viewport.
// The rules are untouched: obstacles keep their px sizes and speeds; only the box they fly through
// follows the screen, as the old isMobile branch (300 px on phones, 380 px elsewhere) already did.

export const AVOID_RED_DESKTOP_HEIGHT = 380;
export const AVOID_RED_MIN_HEIGHT = 220;
export const AVOID_RED_MAX_COMPACT_HEIGHT = 420;
/** engine header + HUD + gaps (~250 px) plus the cookie banner's room (~180 px) kept clear of the arena */
export const AVOID_RED_RESERVED = 430;

/** Phones (< 640 px wide) and short screens (< 560 px tall) size the arena from the viewport; others keep 380 px. */
export function arenaHeightFor(vw: number, vh: number): number {
   const compact = vw < 640 || vh < 560;
   if (!compact) return AVOID_RED_DESKTOP_HEIGHT;
   return Math.max(AVOID_RED_MIN_HEIGHT, Math.min(AVOID_RED_MAX_COMPACT_HEIGHT, vh - AVOID_RED_RESERVED));
}
