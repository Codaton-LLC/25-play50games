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
//
// Each level is also its own place (README "Levels"): its own light, sky and snow (looks.ts THEMES),
// its own bank scenery, and its own obstacle mix (`kinds`: fallen ice in the cave, thin-ice cracks on
// the lake...). The mix only chooses which of the three obstacle kinds fills a slot; the slot count,
// the 12 m spacing and the reserved corridor stay, so the proof and the fairness checks are unchanged.
import type { LevelId } from "@/arcade3d/types";

/** Which place a level is (its look and scenery). */
export type SlideSite = "snowHill" | "iceCave" | "frozenLake" | "auroraRun" | "glacierSprint";

/** Relative chance of each obstacle kind, in rules.ts order: ice block, snowman, crack. */
export type KindWeights = readonly [number, number, number];

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
   site: SlideSite;
   /** relative chance of each obstacle kind (all 1 = rules' uniform pick) */
   kinds: KindWeights;
}

export const LEVELS: Record<LevelId, SlideLevel> = {
   // Snow Hill: today's game on a sunny pine slope.
   1: { slots: 2, extraSlots: 3, rampS: 120, clock: 30, forms: [1, 1, 1, 1, 1, 1], site: "snowHill", kinds: [1, 1, 1] },
   // Ice Cave: a third obstacle from the start, more narrow passages; a dim blue cave of glowing
   // crystals and ice columns, and mostly fallen ice blocks.
   2: { slots: 3, extraSlots: 2, rampS: 100, clock: 40, forms: [1, 1, 1, 1, 1.5, 1], site: "iceCave", kinds: [3, 0.5, 0.75] },
   // Frozen Lake: full density sooner, more bends; a flat glassy lake under a pale lilac sky, boulders
   // on the shore, and thin ice: mostly cracks to hop or carve round.
   3: { slots: 3, extraSlots: 2, rampS: 75, clock: 45, forms: [0.5, 1.5, 1.5, 1, 1.5, 1], site: "frozenLake", kinds: [0.75, 0.5, 3] },
   // Aurora Run: four obstacles from the start, more ramps and narrows; a starry night under the
   // northern lights, a snowman parade on the slope.
   4: { slots: 4, extraSlots: 1, rampS: 60, clock: 50, forms: [0.5, 1.5, 1.5, 1.5, 1.5, 1.5], site: "auroraRun", kinds: [1, 2, 1] },
   // Glacier Sprint: full density after 30 s, almost no straights; a glacier at dusk between ice
   // cliffs, ice blocks and cracks.
   5: { slots: 4, extraSlots: 1, rampS: 30, clock: 60, forms: [0.25, 1.5, 1.5, 1.5, 1.5, 1.5], site: "glacierSprint", kinds: [2, 0.5, 1.5] },
};

/** Obstacle slots in a chunk generated at `elapsed` seconds: today's 2 + floor(3 q), q = elapsed / 120 capped at 1. */
export function slotsAt(level: SlideLevel, elapsed: number): number {
   return Math.min(5, level.slots + Math.floor(level.extraSlots * Math.min(elapsed / level.rampS, 1)));
}

/** Picks an obstacle kind index (ice, snowman, crack) from one uniform draw; equal weights give floor(u * 3), today's pick. */
export function kindIndex(level: SlideLevel, u: number): number {
   const w = level.kinds;
   const total = w[0] + w[1] + w[2];
   if (w[0] === w[1] && w[1] === w[2]) return Math.floor(u * 3);
   let at = u * total;
   for (let i = 0; i < 3; i++) {
      if (at < w[i]) return i;
      at -= w[i];
   }
   return 2;
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
