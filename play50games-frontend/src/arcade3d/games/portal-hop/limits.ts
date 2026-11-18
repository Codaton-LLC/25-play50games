// portal-hop: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 14950, minDurationMs: 500, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 17920, minDurationMs: 800, maxDurationMs: 180000, timeBaseMs: 180000 },
   3: { kind: "time", maxScore: 20960, minDurationMs: 400, maxDurationMs: 210000, timeBaseMs: 210000 },
   4: { kind: "time", maxScore: 23950, minDurationMs: 500, maxDurationMs: 240000, timeBaseMs: 240000 },
   5: { kind: "time", maxScore: 28370, minDurationMs: 16300, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
