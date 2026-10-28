import { FLOOR, PLAN, predictLanding, rateLanding, slotAt, type Run } from "./rules";
import { COLORS } from "./looks";

export const VISUAL_EXTENSION = 0.45;
/* Landing colours by rating: green perfect, light green good, yellow ok, red miss. */
const RATING_COLORS = [COLORS.ratePerfect, COLORS.rateGood, COLORS.rateOk, COLORS.rateMiss] as const;
export const RATING_NAME = ["Perfect", "Good", "OK", "Miss"] as const;

export function markerColor(rating: number): string {
   return RATING_COLORS[rating] ?? COLORS.rateMiss;
}

/** Caller-owned output: shared scoring prediction, without changing the run. */
export function landingMarker(run: Readonly<Run>, out: { x: number; y: number; z: number }): number {
   const step = PLAN[run.planIndex];
   if (!step) return 3;
   const distance = predictLanding(run, step, out);
   out.y = step.floor * FLOOR + 0.09;
   return rateLanding(distance, step.building === 2, run.level.band);
}

/** Highest placed floor directly below the hook, otherwise the ground. */
export function shadowTop(run: Readonly<Run>, at: { x: number; z: number }): number {
   let top = 0;
   for (let i = 0; i < run.pieces.length; i++) {
      const piece = run.pieces[i];
      if (!piece.on) continue;
      slotAt(piece.slot, at);
      if (Math.abs(run.hookX - at.x) <= 0.68 && Math.abs(run.hookZ - at.z) <= 0.68) {
         top = Math.max(top, (piece.floor + 1) * FLOOR);
      }
   }
   return top;
}
