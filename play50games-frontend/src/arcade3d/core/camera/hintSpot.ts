// Where the first-time camera hint chip goes (CameraViewButton's Hint). Pure: no React, no DOM.
//
// The chip used to sit in the middle of the screen, over the hero. It now sits at the top right,
// just under the shell's chips, and steps down past any HUD panel or touch control it would cover.
// The top right under the chips is outside every fitted view's gameplay window (fits keep the hero
// clear of the HUD and centred in the free area), and it never meets the HintLine slot (bottom
// centre / above the joystick) or the joystick and buttons (bottom).
import type { ScreenRect } from "../view";

/** The rows of shell chips start at the top: a HUD rect that starts above this belongs to them. */
export const TOP_BAR_PX = 72;
/** Gap to the chips above, the panels it steps past and the canvas edge (px). */
export const HINT_GAP = 8;
export const HINT_EDGE = 12;

export interface HintSpotArea {
   width: number;
   height: number;
   hud: readonly ScreenRect[];
   controls: readonly ScreenRect[];
}

const overlaps = (a: ScreenRect, b: ScreenRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * The chip's top-left corner (px from the canvas top-left) for a chip `w` x `h`: right-aligned
 * HINT_EDGE from the right edge, HINT_GAP under the lowest top-bar HUD rect, then moved down past
 * every HUD panel or control it would overlap. Never lower than the middle of the canvas: if the
 * right column is full down to there, it stays under the top bar (a HUD panel may be covered for
 * the few seconds it shows; the hero, the joystick and the buttons never are).
 */
export function cameraHintSpot(area: HintSpotArea, w: number, h: number): { left: number; top: number } {
   const left = Math.max(HINT_EDGE, area.width - HINT_EDGE - w);
   let barBottom = 0;
   for (const r of area.hud) if (r.top < TOP_BAR_PX && r.bottom > barBottom) barBottom = r.bottom;
   const start = Math.max(HINT_EDGE, barBottom + HINT_GAP);
   const blockers = [...area.hud, ...area.controls];
   let top = start;
   for (let guard = 0; guard < 32; guard++) {
      const chip = { left, right: left + w, top, bottom: top + h };
      const hit = blockers.find((r) => overlaps(chip, r));
      if (!hit) break;
      top = hit.bottom + HINT_GAP;
   }
   if (top + h > area.height / 2) top = start;
   return { left, top };
}
