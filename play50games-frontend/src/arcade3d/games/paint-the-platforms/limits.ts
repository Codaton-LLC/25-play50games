// paint-the-platforms: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 5990, minDurationMs: 100, maxDurationMs: 60000, timeBaseMs: 60000 },
   2: { kind: "time", maxScore: 7400, minDurationMs: 1000, maxDurationMs: 75000, timeBaseMs: 75000 },
   3: { kind: "time", maxScore: 8950, minDurationMs: 500, maxDurationMs: 90000, timeBaseMs: 90000 },
   4: { kind: "time", maxScore: 10320, minDurationMs: 1800, maxDurationMs: 105000, timeBaseMs: 105000 },
   5: { kind: "time", maxScore: 10620, minDurationMs: 13800, maxDurationMs: 120000, timeBaseMs: 120000 },
} as const;
