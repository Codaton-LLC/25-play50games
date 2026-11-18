// rooftop-roll-climb: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 7870, minDurationMs: 11300, maxDurationMs: 90000, timeBaseMs: 90000 },
   2: { kind: "time", maxScore: 10390, minDurationMs: 16100, maxDurationMs: 120000, timeBaseMs: 120000 },
   3: { kind: "time", maxScore: 13250, minDurationMs: 17500, maxDurationMs: 150000, timeBaseMs: 150000 },
   4: { kind: "time", maxScore: 16340, minDurationMs: 16600, maxDurationMs: 180000, timeBaseMs: 180000 },
   5: { kind: "time", maxScore: 20110, minDurationMs: 38900, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
