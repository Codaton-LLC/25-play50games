// neon-cube-jump: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 14790, minDurationMs: 2100, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 17850, minDurationMs: 1500, maxDurationMs: 180000, timeBaseMs: 180000 },
   3: { kind: "time", maxScore: 19790, minDurationMs: 2100, maxDurationMs: 200000, timeBaseMs: 200000 },
   4: { kind: "time", maxScore: 21790, minDurationMs: 2100, maxDurationMs: 220000, timeBaseMs: 220000 },
   5: { kind: "time", maxScore: 28750, minDurationMs: 12500, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
