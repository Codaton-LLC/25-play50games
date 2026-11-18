// color-city-sprint: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 8290, minDurationMs: 17100, maxDurationMs: 100000, timeBaseMs: 100000 },
   2: { kind: "time", maxScore: 10360, minDurationMs: 26400, maxDurationMs: 130000, timeBaseMs: 130000 },
   3: { kind: "time", maxScore: 12710, minDurationMs: 32900, maxDurationMs: 160000, timeBaseMs: 160000 },
   4: { kind: "time", maxScore: 16130, minDurationMs: 38700, maxDurationMs: 200000, timeBaseMs: 200000 },
   5: { kind: "time", maxScore: 17390, minDurationMs: 26100, maxDurationMs: 200000, timeBaseMs: 200000 },
} as const;
