// ultimate-color-trial: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 9330, minDurationMs: 6700, maxDurationMs: 100000, timeBaseMs: 100000 },
   2: { kind: "time", maxScore: 10700, minDurationMs: 13000, maxDurationMs: 120000, timeBaseMs: 120000 },
   3: { kind: "time", maxScore: 12880, minDurationMs: 21200, maxDurationMs: 150000, timeBaseMs: 150000 },
   4: { kind: "time", maxScore: 14900, minDurationMs: 31000, maxDurationMs: 180000, timeBaseMs: 180000 },
   5: { kind: "time", maxScore: 18920, minDurationMs: 50800, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
