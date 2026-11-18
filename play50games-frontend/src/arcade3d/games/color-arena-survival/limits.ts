// color-arena-survival: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 13670, minDurationMs: 13300, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 15910, minDurationMs: 20900, maxDurationMs: 180000, timeBaseMs: 180000 },
   3: { kind: "time", maxScore: 18890, minDurationMs: 31100, maxDurationMs: 220000, timeBaseMs: 220000 },
   4: { kind: "time", maxScore: 20880, minDurationMs: 41200, maxDurationMs: 250000, timeBaseMs: 250000 },
   5: { kind: "time", maxScore: 28100, minDurationMs: 19000, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
