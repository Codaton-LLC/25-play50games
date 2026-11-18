// tightrope-path: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 13610, minDurationMs: 13900, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 18410, minDurationMs: 15900, maxDurationMs: 200000, timeBaseMs: 200000 },
   3: { kind: "time", maxScore: 22060, minDurationMs: 19400, maxDurationMs: 240000, timeBaseMs: 240000 },
   4: { kind: "time", maxScore: 25990, minDurationMs: 20100, maxDurationMs: 280000, timeBaseMs: 280000 },
   5: { kind: "time", maxScore: 33960, minDurationMs: 20400, maxDurationMs: 360000, timeBaseMs: 360000 },
} as const;
