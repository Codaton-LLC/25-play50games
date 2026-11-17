// Pure layout numbers for Tap Counter: the tap button's diameter from the live viewport.
// Nothing here touches the rules (taps required, level duration, scoring): only how big the button is drawn.

export interface TapViewport {
   width: number;
   height: number;
   isMobile: boolean;
   isTablet: boolean;
}

/** The old fixed sizes: phones drew a 200 px button, everything else 280 px. */
export const TAP_BUTTON_DESKTOP = 280;
/** Phones and tablets may grow the button to this when the screen has the room. */
export const TAP_BUTTON_TOUCH_MAX = 300;
/** A short viewport (landscape phone) never shrinks the button below this; the page scrolls instead. */
export const TAP_BUTTON_MIN = 160;

/**
 * Everything on a phone that is not the button, in px, once the run has scrolled the engine's score bar to
 * the top: the score bar (~102), the game's header card, the Taps / Rate / Need chips, the gaps, the play
 * area's padding and the two goal lines under the button (~355 together), plus the cookie banner (~180 at
 * 360-390 px wide) that the button must stay clear of.
 */
export const TAP_PHONE_CHROME = 535;
/** The same on a tablet or a desktop: roomier cards, but a banner of only ~90-100 px. */
export const TAP_WIDE_CHROME = 470;

/** Root padding + play-area padding on each side, so the ring never touches the screen edge. */
export const TAP_PHONE_SIDE_ROOM = 56;

/**
 * Tap button diameter in px. Phones and tablets size it from the viewport so the whole ring sits above the
 * cookie banner while playing (and never wider than the screen); desktops keep the classic 280 unless the
 * window is too short for it (a landscape tablet with the banner open).
 */
export function tapButtonSize(vp: TapViewport): number {
   if (vp.isMobile) {
      const byHeight = vp.height - TAP_PHONE_CHROME;
      const byWidth = vp.width - TAP_PHONE_SIDE_ROOM;
      return clamp(Math.min(byHeight, byWidth), TAP_BUTTON_MIN, TAP_BUTTON_TOUCH_MAX);
   }
   const max = vp.isTablet ? TAP_BUTTON_TOUCH_MAX : TAP_BUTTON_DESKTOP;
   return clamp(vp.height - TAP_WIDE_CHROME, TAP_BUTTON_MIN, max);
}

/** Ring stroke width that reads at every size (8 px on a 160-200 px ring, 12 px on a 280-300 px ring). */
export function ringStroke(size: number): number {
   return clamp(Math.round(size / 24), 8, 12);
}

function clamp(value: number, min: number, max: number): number {
   return Math.max(min, Math.min(max, value));
}
