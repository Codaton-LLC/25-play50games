// temple-gong-timing: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "points", maxScore: 12790, minDurationMs: 72800, maxDurationMs: 79500, base: 400, maxPointsPerSec: 176 },
   2: { kind: "points", maxScore: 13690, minDurationMs: 71500, maxDurationMs: 78154, base: 400, maxPointsPerSec: 187 },
   3: { kind: "points", maxScore: 14180, minDurationMs: 64400, maxDurationMs: 70572, base: 400, maxPointsPerSec: 215 },
   4: { kind: "points", maxScore: 14790, minDurationMs: 41800, maxDurationMs: 46517, base: 400, maxPointsPerSec: 358 },
   5: { kind: "points", maxScore: 28600, minDurationMs: 64700, maxDurationMs: 242000, base: 5720, maxPointsPerSec: 318 },
} as const;
