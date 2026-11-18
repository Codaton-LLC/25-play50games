// gem-collector-3d: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "points", maxScore: 4235, minDurationMs: 85500, maxDurationMs: 91000, base: 0, maxPointsPerSec: 50 },
   2: { kind: "points", maxScore: 5449, minDurationMs: 95000, maxDurationMs: 101000, base: 0, maxPointsPerSec: 58 },
   3: { kind: "points", maxScore: 6300, minDurationMs: 104500, maxDurationMs: 111000, base: 0, maxPointsPerSec: 61 },
   4: { kind: "points", maxScore: 7132, minDurationMs: 114000, maxDurationMs: 121000, base: 0, maxPointsPerSec: 63 },
   5: { kind: "points", maxScore: 14157, minDurationMs: 29100, maxDurationMs: 241000, base: 0, maxPointsPerSec: 487 },
} as const;

/** Level fields meta.ts reads (targetScore); levels.ts holds the full levels. */
export const LEVELS = { 1: { targetScore: 300 }, 2: { targetScore: 600 }, 3: { targetScore: 900 }, 4: { targetScore: 1200 }, 5: { targetScore: 0 } } as const;
