// candy-world-runner: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 7920, minDurationMs: 40800, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 9010, minDurationMs: 39900, maxDurationMs: 130000, timeBaseMs: 130000 },
   3: { kind: "time", maxScore: 11000, minDurationMs: 30000, maxDurationMs: 140000, timeBaseMs: 140000 },
   4: { kind: "time", maxScore: 12290, minDurationMs: 27100, maxDurationMs: 150000, timeBaseMs: 150000 },
   5: { kind: "time", maxScore: 16740, minDurationMs: 32600, maxDurationMs: 200000, timeBaseMs: 200000 },
} as const;
