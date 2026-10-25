// Airport Luggage Rush's five levels: pure data, no React (docs/arcade-levels.md §6.3).
// One baggage hall. A level is a set of clock, belt, spawn and phase constants. Level 1 is
// today's game and must stay byte-for-byte: rules.test.ts pins those numbers, levels.test.ts
// replays createRun(seed) against createRun(seed, LEVELS[1]).
//
// Not in a level (no support in the built game — do not add them here): extra chutes or
// workstations, a fifth flight (only four chute mouths), and parallel objectives.
import type { LevelId } from "@/arcade3d/types";

export interface LuggageLevel {
   /** shell clock, milliseconds */
   durationMs: number;
   /** belt speed at t = 0, metres per second (then ×1.03 on each speed step) */
   beltBase: number;
   /** seconds between bags at t = 0 */
   spawnStart: number;
   /** seconds between bags once the ramp has finished */
   spawnEnd: number;
   /** seconds the spawn interval takes to fall from start to end */
   spawnRampS: number;
   /** D3 (green / hold) starts taking flips, seconds */
   phaseD3: number;
   /** D4 (yellow / overflow) starts taking flips, and yellow bags start, seconds */
   phaseD4: number;
   /** the belt steps ×1.03 at each multiple of this, up to just before the clock */
   speedEvery: number;
   /** from 50 s, a roll in [0.12, heavyLate) is heavy. VIP stays the first 0.12. */
   heavyLate: number;
}

export const LEVELS: Record<LevelId, LuggageLevel> = {
   // today's game
   1: { durationMs: 120_000, beltBase: 1.35, spawnStart: 2.2, spawnEnd: 0.9, spawnRampS: 120, phaseD3: 40, phaseD4: 70, speedEvery: 15, heavyLate: 0.3 },
   // 150 s, faster belt. The heavy and VIP rolls already exist; the chutes open a little sooner.
   2: { durationMs: 150_000, beltBase: 1.5, spawnStart: 2.2, spawnEnd: 0.9, spawnRampS: 120, phaseD3: 36, phaseD4: 64, speedEvery: 15, heavyLate: 0.32 },
   // 180 s, the fast spawn arrives sooner, four chutes open at 30 s and 55 s
   3: { durationMs: 180_000, beltBase: 1.5, spawnStart: 2.2, spawnEnd: 0.8, spawnRampS: 120, phaseD3: 30, phaseD4: 55, speedEvery: 15, heavyLate: 0.36 },
   // same 180 s clock, the belt steps every 10 s, more heavies, chutes open earlier
   4: { durationMs: 180_000, beltBase: 1.52, spawnStart: 2.2, spawnEnd: 0.76, spawnRampS: 120, phaseD3: 26, phaseD4: 48, speedEvery: 10, heavyLate: 0.4 },
   // 200 s (the plan's 210 s with this ramp clears the 3× level-1 ceiling; see the README)
   5: { durationMs: 200_000, beltBase: 1.55, spawnStart: 2.2, spawnEnd: 0.75, spawnRampS: 120, phaseD3: 22, phaseD4: 42, speedEvery: 10, heavyLate: 0.44 },
};
