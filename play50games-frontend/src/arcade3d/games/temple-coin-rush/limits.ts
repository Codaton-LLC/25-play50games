// temple-coin-rush: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "points", maxScore: 480, minDurationMs: 1000, maxDurationMs: 120000, base: 21, maxPointsPerSec: 12 },
   2: { kind: "points", maxScore: 610, minDurationMs: 1000, maxDurationMs: 130000, base: 36, maxPointsPerSec: 14 },
   3: { kind: "points", maxScore: 710, minDurationMs: 1000, maxDurationMs: 140000, base: 38, maxPointsPerSec: 16 },
   4: { kind: "points", maxScore: 690, minDurationMs: 1000, maxDurationMs: 150000, base: 27, maxPointsPerSec: 14 },
   5: { kind: "points", maxScore: 910, minDurationMs: 1000, maxDurationMs: 240000, base: 38, maxPointsPerSec: 15 },
} as const;
