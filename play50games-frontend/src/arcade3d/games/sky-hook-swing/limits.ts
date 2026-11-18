// sky-hook-swing: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = {
   1: { name: "Single Swing" },
   2: { name: "Double Swing" },
   3: { name: "Moving Anchors" },
   4: { name: "Long Gaps" },
   5: { name: "Sky Swing Master" },
} as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 9700, minDurationMs: 3000, maxDurationMs: 100000, timeBaseMs: 100000 },
   2: { kind: "time", maxScore: 13320, minDurationMs: 6800, maxDurationMs: 140000, timeBaseMs: 140000 },
   3: { kind: "time", maxScore: 17600, minDurationMs: 4000, maxDurationMs: 180000, timeBaseMs: 180000 },
   4: { kind: "time", maxScore: 19290, minDurationMs: 7100, maxDurationMs: 200000, timeBaseMs: 200000 },
   5: { kind: "time", maxScore: 23310, minDurationMs: 6900, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
