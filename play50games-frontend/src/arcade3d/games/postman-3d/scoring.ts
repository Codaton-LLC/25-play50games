// Postman 3D server limits (README "Server limits and why they hold"), plain data so meta.ts stays
// server-safe. One proof per level: base = Bobj, the win bonus 5 * floor(D - t) peaks at the earliest win
// M, so maxScore >= Bobj + 5 * floor(D - M) and pps >= 5 * (D / M - 1); both get 3-5 % margin.
import type { LevelId, ScoringRules } from "@/arcade3d/types";

/** Bobj = 140 per item (100 + the 40 list-order bonus), each item pays once. */
export const objectiveCeiling = (items: number) => 140 * items;

/** The earliest win each proof assumes (s): 0.8 x the fastest oracle / careful bot win over 200 seeds at 30/60/144 Hz (tests pin it). */
export const PROOF_EARLIEST_WIN_S: Record<LevelId, number> = { 1: 5.23, 2: 17.95, 3: 22.59, 4: 51.37, 5: 86.76 };

const PTS = { kind: "points", unitLabel: "pts", display: "int", minDurationMs: 4000 } as const;

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 560, D 120 s, oracle 6.54 s → M 5.23 s, peak 1130; pps 109.7 */
   1: { ...PTS, maxScore: 1165, maxDurationMs: 120_000, base: 560, maxPointsPerSec: 115 },
   /** L2: Bobj 840, D 150 s, oracle 22.43 s → M 17.95 s, peak 1500; pps 36.8 */
   2: { ...PTS, maxScore: 1545, maxDurationMs: 150_000, base: 840, maxPointsPerSec: 38 },
   /** L3: Bobj 1120, D 180 s, oracle 28.23 s → M 22.59 s, peak 1905; pps 34.8 */
   3: { ...PTS, maxScore: 1965, maxDurationMs: 180_000, base: 1120, maxPointsPerSec: 36 },
   /** L4: Bobj 1400, D 180 s, oracle 64.22 s → M 51.37 s, peak 2040; pps 12.5 */
   4: { ...PTS, maxScore: 2105, maxDurationMs: 180_000, base: 1400, maxPointsPerSec: 13 },
   /** L5: Bobj 1960, D 210 s, oracle 108.45 s → M 86.76 s, peak 2575; pps 7.1 */
   5: { ...PTS, maxScore: 2655, maxDurationMs: 210_000, base: 1960, maxPointsPerSec: 8 },
};
