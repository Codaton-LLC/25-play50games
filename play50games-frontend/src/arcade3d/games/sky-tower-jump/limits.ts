// sky-tower-jump: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 7980, minDurationMs: 10200, maxDurationMs: 90000, timeBaseMs: 90000 },
   2: { kind: "time", maxScore: 9970, minDurationMs: 20300, maxDurationMs: 120000, timeBaseMs: 120000 },
   3: { kind: "time", maxScore: 12280, minDurationMs: 27200, maxDurationMs: 150000, timeBaseMs: 150000 },
   4: { kind: "time", maxScore: 14280, minDurationMs: 37200, maxDurationMs: 180000, timeBaseMs: 180000 },
   5: { kind: "time", maxScore: 18400, minDurationMs: 56000, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
