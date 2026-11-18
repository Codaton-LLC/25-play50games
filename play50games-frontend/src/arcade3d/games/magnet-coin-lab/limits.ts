// magnet-coin-lab: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = { 1: { name: "Basic Magnet" }, 2: { name: "Two Poles" }, 3: { name: "Moving Metal" }, 4: { name: "Drone Lab" }, 5: { name: "Scrap Magnus" } } as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 17990, minDurationMs: 100, maxDurationMs: 180000, timeBaseMs: 180000 },
   2: { kind: "time", maxScore: 23990, minDurationMs: 100, maxDurationMs: 240000, timeBaseMs: 240000 },
   3: { kind: "time", maxScore: 29990, minDurationMs: 100, maxDurationMs: 300000, timeBaseMs: 300000 },
   4: { kind: "time", maxScore: 31990, minDurationMs: 100, maxDurationMs: 320000, timeBaseMs: 320000 },
   5: { kind: "time", maxScore: 34500, minDurationMs: 15000, maxDurationMs: 360000, timeBaseMs: 360000 },
} as const;
