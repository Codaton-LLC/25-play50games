// Pure layout helpers for Falling Objects (no React): the play field's height from the live viewport and
// the tap target of a falling object. The rules are untouched: objects fall in percent of the field per
// frame, so the fall time per level is what getLevelConfig defines whatever the field's pixel height.

/** The old fixed heights (phone 400, elsewhere 500) stay the ceiling. */
export const FALLING_PHONE_MAX_HEIGHT = 400;
export const FALLING_DESKTOP_MAX_HEIGHT = 500;
export const FALLING_MIN_HEIGHT = 220;
/** Engine header + our HUD card + stats + Replay/Share row + gaps, plus the cookie banner's room (~176 px). */
export const FALLING_RESERVED_COMPACT = 520;
/** Wider screens: the banner is shorter and the chips sit on one row. */
export const FALLING_RESERVED_WIDE = 440;

/** The field's height for a viewport: never above the old fixed size, never below 220 px, else what fits. */
export function fieldHeightFor(vw: number, vh: number): number {
   const compact = vw < 640 || vh < 560;
   const maxH = vw < 640 ? FALLING_PHONE_MAX_HEIGHT : FALLING_DESKTOP_MAX_HEIGHT;
   const reserved = compact ? FALLING_RESERVED_COMPACT : FALLING_RESERVED_WIDE;
   return Math.round(Math.max(FALLING_MIN_HEIGHT, Math.min(maxH, vh - reserved)));
}

/** The visual box of an object before its size multiplier (phone 64, elsewhere 72), as the game always drew it. */
export function objectBaseFor(isMobile: boolean): number {
   return isMobile ? 64 : 72;
}

/**
 * The tap target of an object: its drawn size (base × size multiplier), but never under `minTarget` px,
 * so the tiny high-level objects keep their look while the finger still has 44 px to land on.
 */
export function objectHitSize(base: number, size: number, minTarget: number): number {
   return Math.max(minTarget, Math.round(base * size));
}
