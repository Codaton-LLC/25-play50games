// jungle-vine-jump: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 19910, minDurationMs: 900, maxDurationMs: 200000, timeBaseMs: 200000 },
   2: { kind: "time", maxScore: 23880, minDurationMs: 1200, maxDurationMs: 240000, timeBaseMs: 240000 },
   3: { kind: "time", maxScore: 27800, minDurationMs: 2000, maxDurationMs: 280000, timeBaseMs: 280000 },
   4: { kind: "time", maxScore: 31750, minDurationMs: 2500, maxDurationMs: 320000, timeBaseMs: 320000 },
   5: { kind: "time", maxScore: 37860, minDurationMs: 21400, maxDurationMs: 400000, timeBaseMs: 400000 },
} as const;
