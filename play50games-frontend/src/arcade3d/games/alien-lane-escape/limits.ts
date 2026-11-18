// alien-lane-escape: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 8480, minDurationMs: 35200, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 9280, minDurationMs: 37200, maxDurationMs: 130000, timeBaseMs: 130000 },
   3: { kind: "time", maxScore: 10080, minDurationMs: 39200, maxDurationMs: 140000, timeBaseMs: 140000 },
   4: { kind: "time", maxScore: 11430, minDurationMs: 35700, maxDurationMs: 150000, timeBaseMs: 150000 },
   5: { kind: "time", maxScore: 15910, minDurationMs: 40900, maxDurationMs: 200000, timeBaseMs: 200000 },
} as const;
