import type { SafeArea, ScreenRect } from "@/arcade3d/core/safeArea";

// Where the two upgrade cards go: a pure fit over the measured safe area (canvas px).
// Tries side-by-side cards, then the other row size, then stacked cards; for each layout, the lowest
// free spot (thumb reach) nearest the centre that clears every shell chip, game HUD panel,
// touch control and bottom obstruction by GAP px. Every card stays >= 72 px tall (touch target >= 44 px).
export const GAP = 10;
export const EDGE = 8;
export const CARD_GAP = 8;
const TALL = { width: 144, height: 88 };
const WIDE = { width: 176, height: 72 };

export interface CardPlacement { left: number; top: number; width: number; height: number; column: boolean; fits: boolean; }
type Area = Pick<SafeArea, "width" | "height" | "hud" | "controls" | "obstructions">;

const hits = (a: ScreenRect, b: ScreenRect) => a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;

export function stripRect(p: CardPlacement): ScreenRect {
   const w = p.column ? p.width : 2 * p.width + CARD_GAP, h = p.column ? 2 * p.height + CARD_GAP : p.height;
   return { left: p.left, top: p.top, right: p.left + w, bottom: p.top + h };
}

export function placeCards(area: Area): CardPlacement {
   const width = area.width > 0 ? area.width : 390, height = area.height > 0 ? area.height : 844;
   const blocks = [...area.hud, ...area.controls, ...area.obstructions];
   let floor = height - EDGE;
   for (const r of area.obstructions) floor = Math.min(floor, r.top - GAP);
   const short = height <= 520;
   const layouts = [
      { card: short ? WIDE : TALL, column: false }, { card: short ? TALL : WIDE, column: false },
      { card: TALL, column: true }, { card: WIDE, column: true },
   ];
   for (const { card, column } of layouts) {
      const w = column ? card.width : 2 * card.width + CARD_GAP, h = column ? 2 * card.height + CARD_GAP : card.height;
      if (w > width - 2 * EDGE) continue;
      const bottoms = [floor, ...blocks.map((r) => r.top - GAP)].filter((b) => b <= floor && b - h >= EDGE).sort((a, b) => b - a);
      const centre = (width - w) / 2;
      const xs = [centre, EDGE, width - EDGE - w, ...blocks.flatMap((r) => [r.left - GAP - w, r.right + GAP])]
         .map((x) => Math.min(width - EDGE - w, Math.max(EDGE, x)))
         .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
      for (const bottom of bottoms) for (const x of xs) {
         const rect = { left: x, top: bottom - h, right: x + w, bottom };
         if (!blocks.some((r) => hits(rect, r))) return { left: Math.round(x), top: Math.round(bottom - h), width: card.width, height: card.height, column, fits: true };
      }
   }
   // nothing is free (should not happen at the supported sizes): below the HUD, centred
   let top = EDGE;
   for (const r of area.hud) top = Math.max(top, r.bottom + GAP);
   const card = short ? WIDE : TALL;
   return { left: Math.max(EDGE, Math.round((width - 2 * card.width - CARD_GAP) / 2)), top: Math.round(top), width: card.width, height: card.height, column: false, fits: false };
}
