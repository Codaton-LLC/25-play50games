// switch-color-hero: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = {
   1: { name: "Two Gates" },
   2: { name: "Three Colors" },
   3: { name: "Fast Switching" },
   4: { name: "Mixed Obstacles" },
   5: { name: "Color Overdrive" },
} as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 10450, minDurationMs: 15500, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 12920, minDurationMs: 20800, maxDurationMs: 150000, timeBaseMs: 150000 },
   3: { kind: "time", maxScore: 16050, minDurationMs: 19500, maxDurationMs: 180000, timeBaseMs: 180000 },
   4: { kind: "time", maxScore: 18830, minDurationMs: 21700, maxDurationMs: 210000, timeBaseMs: 210000 },
   5: { kind: "time", maxScore: 26690, minDurationMs: 33100, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
