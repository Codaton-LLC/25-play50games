// color-rail-grind: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 9800, minDurationMs: 22000, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 12440, minDurationMs: 25600, maxDurationMs: 150000, timeBaseMs: 150000 },
   3: { kind: "time", maxScore: 15230, minDurationMs: 17700, maxDurationMs: 170000, timeBaseMs: 170000 },
   4: { kind: "time", maxScore: 15400, minDurationMs: 26000, maxDurationMs: 180000, timeBaseMs: 180000 },
   5: { kind: "time", maxScore: 23510, minDurationMs: 24900, maxDurationMs: 260000, timeBaseMs: 260000 },
} as const;
