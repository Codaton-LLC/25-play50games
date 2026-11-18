// laser-maze-run: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 6930, minDurationMs: 5700, maxDurationMs: 75000, timeBaseMs: 75000 },
   2: { kind: "time", maxScore: 8290, minDurationMs: 7100, maxDurationMs: 90000, timeBaseMs: 90000 },
   3: { kind: "time", maxScore: 9620, minDurationMs: 8800, maxDurationMs: 105000, timeBaseMs: 105000 },
   4: { kind: "time", maxScore: 10950, minDurationMs: 10500, maxDurationMs: 120000, timeBaseMs: 120000 },
   5: { kind: "time", maxScore: 11590, minDurationMs: 34100, maxDurationMs: 150000, timeBaseMs: 150000 },
} as const;
