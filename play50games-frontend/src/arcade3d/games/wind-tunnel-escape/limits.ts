// wind-tunnel-escape: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 11190, minDurationMs: 8100, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 13700, minDurationMs: 13000, maxDurationMs: 150000, timeBaseMs: 150000 },
   3: { kind: "time", maxScore: 16730, minDurationMs: 12700, maxDurationMs: 180000, timeBaseMs: 180000 },
   4: { kind: "time", maxScore: 19380, minDurationMs: 16200, maxDurationMs: 210000, timeBaseMs: 210000 },
   5: { kind: "time", maxScore: 25950, minDurationMs: 40500, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
