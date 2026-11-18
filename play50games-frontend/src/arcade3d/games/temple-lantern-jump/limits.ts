// temple-lantern-jump: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 17870, minDurationMs: 1300, maxDurationMs: 180000, timeBaseMs: 180000 },
   2: { kind: "time", maxScore: 20740, minDurationMs: 2600, maxDurationMs: 210000, timeBaseMs: 210000 },
   3: { kind: "time", maxScore: 23610, minDurationMs: 3900, maxDurationMs: 240000, timeBaseMs: 240000 },
   4: { kind: "time", maxScore: 26480, minDurationMs: 5200, maxDurationMs: 270000, timeBaseMs: 270000 },
   5: { kind: "time", maxScore: 33570, minDurationMs: 24300, maxDurationMs: 360000, timeBaseMs: 360000 },
} as const;
