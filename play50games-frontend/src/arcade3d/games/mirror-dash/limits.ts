// mirror-dash: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = { 1: { name: "Mirror Lane" }, 2: { name: "Converge" }, 3: { name: "Frosted Glass" }, 4: { name: "Echo" }, 5: { name: "Glass Hall" } } as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 13430, minDurationMs: 15700, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 15560, minDurationMs: 14400, maxDurationMs: 170000, timeBaseMs: 170000 },
   3: { kind: "time", maxScore: 16350, minDurationMs: 16500, maxDurationMs: 180000, timeBaseMs: 180000 },
   4: { kind: "time", maxScore: 17150, minDurationMs: 18500, maxDurationMs: 190000, timeBaseMs: 190000 },
   5: { kind: "time", maxScore: 21710, minDurationMs: 22900, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
