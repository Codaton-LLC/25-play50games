// Penguin Ice Slide's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One glacier, five configurations. Level 1 is today's game and must never change: the same
// obstacle ramp (2 slots, +3 over 120 s), the same 30 s starting clock, every course form equally
// likely. levels.test.ts pins it to the rules.ts constants.
//
// The built game is an endless slide (no finish, no win): the plan's "reach the finish and collect
// N fish" becomes a score target (meta.ts clearScore). Its moving obstacles, per-level lighting and
// finish line are not built. A later level starts denser, reaches full density sooner and draws the
// harder forms (bends, narrows, splits, ramps) more often; it also starts with more clock, so a
// harder level never offers fewer points than level 1. The speed cap (22 m/s), the 12 m obstacle
// spacing, the safe corridor, the fish budget and the 180 s ceiling are the same on every level,
// which is why every level keeps level 1's limit proof (README "Levels").
import type { LevelId } from "@/arcade3d/types";

/** Weights of the six course forms, in rules.ts FORMS order: straight, curve, s-bend, ramp, narrow, split. */
export type FormWeights = readonly [number, number, number, number, number, number];

export interface SlideLevel {
   /** obstacle slots per chunk at the start of the run (rules: 2) */
   slots: number;
   /** extra slots reached by `rampS` seconds (rules: +3); capped at 5 per chunk by the 12 m spacing */
   extraSlots: number;
   /** seconds of play until the obstacle density is full (rules: 120) */
   rampS: number;
   /** starting clock, seconds (CLOCK.initial); gates still add 8 s and the 180 s ceiling holds */
   clock: number;
   /** relative chance of each course form (all 1 = rules' uniform pick) */
   forms: FormWeights;
}

export const LEVELS: Record<LevelId, SlideLevel> = {
   // Snow Hill: today's game.
   1: { slots: 2, extraSlots: 3, rampS: 120, clock: 30, forms: [1, 1, 1, 1, 1, 1] },
   // Ice Cave: a third obstacle from the start, more narrow passages.
   2: { slots: 3, extraSlots: 2, rampS: 100, clock: 40, forms: [1, 1, 1, 1, 1.5, 1] },
   // Frozen Lake: full density sooner, more bends.
   3: { slots: 3, extraSlots: 2, rampS: 75, clock: 45, forms: [0.5, 1.5, 1.5, 1, 1.5, 1] },
   // Aurora Run: four obstacles from the start, more ramps and narrows.
   4: { slots: 4, extraSlots: 1, rampS: 60, clock: 50, forms: [0.5, 1.5, 1.5, 1.5, 1.5, 1.5] },
   // Glacier Sprint: full density after 30 s, almost no straights.
   5: { slots: 4, extraSlots: 1, rampS: 30, clock: 60, forms: [0.25, 1.5, 1.5, 1.5, 1.5, 1.5] },
};

/** Obstacle slots in a chunk generated at `elapsed` seconds: today's 2 + floor(3 q), q = elapsed / 120 capped at 1. */
export function slotsAt(level: SlideLevel, elapsed: number): number {
   return Math.min(5, level.slots + Math.floor(level.extraSlots * Math.min(elapsed / level.rampS, 1)));
}

/** Picks a course form index from one uniform draw; equal weights give floor(u * 6), today's pick. */
export function formIndex(level: SlideLevel, u: number): number {
   const w = level.forms;
   let total = 0;
   for (let i = 0; i < w.length; i++) total += w[i];
   let at = u * total;
   for (let i = 0; i < w.length; i++) {
      if (at < w[i]) return i;
      at -= w[i];
   }
   return w.length - 1;
}
