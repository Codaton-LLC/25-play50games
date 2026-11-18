// ring-jump-challenge: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "points", maxScore: 9421, minDurationMs: 6100, maxDurationMs: 91000, base: 0, maxPointsPerSec: 1545 },
   2: { kind: "points", maxScore: 11935, minDurationMs: 7800, maxDurationMs: 101000, base: 0, maxPointsPerSec: 1531 },
   3: { kind: "points", maxScore: 17755, minDurationMs: 9700, maxDurationMs: 121000, base: 0, maxPointsPerSec: 1831 },
   4: { kind: "points", maxScore: 14353, minDurationMs: 11300, maxDurationMs: 131000, base: 0, maxPointsPerSec: 1271 },
   5: { kind: "points", maxScore: 16228, minDurationMs: 33500, maxDurationMs: 221000, base: 0, maxPointsPerSec: 485 },
} as const;
