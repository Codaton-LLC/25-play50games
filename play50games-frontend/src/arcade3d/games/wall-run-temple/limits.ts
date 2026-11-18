// wall-run-temple: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = {
   1: { name: "Training Wall" },
   2: { name: "Double Wall" },
   3: { name: "Column Hall" },
   4: { name: "Broken Ruins" },
   5: { name: "Master Wall Run" },
} as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 13720, minDurationMs: 12800, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 16570, minDurationMs: 14300, maxDurationMs: 180000, timeBaseMs: 180000 },
   3: { kind: "time", maxScore: 19680, minDurationMs: 13200, maxDurationMs: 210000, timeBaseMs: 210000 },
   4: { kind: "time", maxScore: 22640, minDurationMs: 13600, maxDurationMs: 240000, timeBaseMs: 240000 },
   5: { kind: "time", maxScore: 29300, minDurationMs: 7000, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
