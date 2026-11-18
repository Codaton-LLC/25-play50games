// disc-target-throw: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "points", maxScore: 14616, minDurationMs: 3400, maxDurationMs: 151000, base: 0, maxPointsPerSec: 4299 },
   2: { kind: "points", maxScore: 12816, minDurationMs: 3400, maxDurationMs: 161000, base: 0, maxPointsPerSec: 3770 },
   3: { kind: "points", maxScore: 27666, minDurationMs: 3400, maxDurationMs: 171000, base: 0, maxPointsPerSec: 8138 },
   4: { kind: "points", maxScore: 14341, minDurationMs: 3400, maxDurationMs: 181000, base: 0, maxPointsPerSec: 4218 },
   5: { kind: "points", maxScore: 15239, minDurationMs: 25000, maxDurationMs: 241000, base: 0, maxPointsPerSec: 610 },
} as const;
