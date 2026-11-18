// energy-core-hunt: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 5840, minDurationMs: 1600, maxDurationMs: 60000, timeBaseMs: 60000 },
   2: { kind: "time", maxScore: 7430, minDurationMs: 700, maxDurationMs: 75000, timeBaseMs: 75000 },
   3: { kind: "time", maxScore: 8860, minDurationMs: 1400, maxDurationMs: 90000, timeBaseMs: 90000 },
   4: { kind: "time", maxScore: 10350, minDurationMs: 1500, maxDurationMs: 105000, timeBaseMs: 105000 },
   5: { kind: "time", maxScore: 10520, minDurationMs: 14800, maxDurationMs: 120000, timeBaseMs: 120000 },
} as const;
