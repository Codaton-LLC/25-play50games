// plate-bounce-arena: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = { 1: { name: "Practice Table" }, 2: { name: "Mushroom Garden" }, 3: { name: "Ice Table" }, 4: { name: "Multiball" }, 5: { name: "Gristle's Table" } } as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 29850, minDurationMs: 1500, maxDurationMs: 300000, timeBaseMs: 300000 },
   2: { kind: "time", maxScore: 32460, minDurationMs: 5400, maxDurationMs: 330000, timeBaseMs: 330000 },
   3: { kind: "time", maxScore: 35850, minDurationMs: 1500, maxDurationMs: 360000, timeBaseMs: 360000 },
   4: { kind: "time", maxScore: 38750, minDurationMs: 2500, maxDurationMs: 390000, timeBaseMs: 390000 },
   5: { kind: "time", maxScore: 40680, minDurationMs: 13200, maxDurationMs: 420000, timeBaseMs: 420000 },
} as const;
