// Monster Kitchen's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One cave kitchen, five configurations. Level 1 is today's game and must never change: 90 s,
// the second hatch at 70 s, order lengths 3 / 3-4 / 4-5 at 25 s and 50 s, drift from 50 s every
// 6 s, patience penalty 3 and drains 1.0 / 1.15 / 1.3. Those numbers are the rules.ts constants;
// levels.test.ts pins them.
//
// The plan's walking multi-zone chef was never built (the player spins one wheel and tosses into
// one cauldron). Each later level adapts the plan's objective, hazard and new mechanic onto the
// knobs the game already has, and offers more points than level 1 (a longer shift and an earlier
// second hatch, so more orders fit). No new models.
import type { LevelId } from "@/arcade3d/types";

export interface KitchenLevel {
   /** the shell's clock (ms). Level 1 is DURATION_MS. */
   durationMs: number;
   /** the second hatch opens at this time (s); its first order is walkInS later. Level 1: 70. */
   windowBAtS: number;
   /** an order arriving before this is 3 ingredients. Level 1: 25. */
   len3Until: number;
   /** an order arriving before this is 3 or 4; from here on it is 4 or 5. Level 1: 50. */
   len4Until: number;
   /** the wheel's first unprompted turn (s). Level 1: 50. */
   driftFromS: number;
   /** seconds between drift turns. Level 1: 6. */
   driftEveryS: number;
   /** patience a wrong toss takes off the earliest order. Level 1: 3. */
   penalty: number;
   /** patience drained per second after the grace, by monster. Level 1: 1.0 / 1.15 / 1.3. */
   drains: { jolly: number; greedy: number; grumpy: number };
}

export const LEVELS: Record<LevelId, KitchenLevel> = {
   // today's game. Snack Bar: one hatch for most of the shift, drift only near the end.
   1: {
      durationMs: 90_000, windowBAtS: 70, len3Until: 25, len4Until: 50,
      driftFromS: 50, driftEveryS: 6, penalty: 3,
      drains: { jolly: 1.0, greedy: 1.15, grumpy: 1.3 },
   },
   // Monster Café: the second hatch is the second task, and orders lengthen sooner. 100 s.
   2: {
      durationMs: 100_000, windowBAtS: 48, len3Until: 18, len4Until: 40,
      driftFromS: 42, driftEveryS: 6, penalty: 3,
      drains: { jolly: 1.0, greedy: 1.15, grumpy: 1.3 },
   },
   // Busy Kitchen: the wheel drifts early and faster while both hatches are open. 108 s.
   3: {
      durationMs: 108_000, windowBAtS: 36, len3Until: 14, len4Until: 32,
      driftFromS: 28, driftEveryS: 5, penalty: 3,
      drains: { jolly: 1.05, greedy: 1.2, grumpy: 1.35 },
   },
   // Dinner Rush: stricter timing (faster drain, a wrong toss costs 4) on top of the drift. 114 s.
   4: {
      durationMs: 114_000, windowBAtS: 28, len3Until: 10, len4Until: 24,
      driftFromS: 20, driftEveryS: 4.5, penalty: 4,
      drains: { jolly: 1.1, greedy: 1.28, grumpy: 1.45 },
   },
   // Grand Feast: every pressure knob at once, for the longest shift. 120 s.
   5: {
      durationMs: 120_000, windowBAtS: 18, len3Until: 8, len4Until: 16,
      driftFromS: 12, driftEveryS: 4, penalty: 4,
      drains: { jolly: 1.15, greedy: 1.35, grumpy: 1.55 },
   },
};
