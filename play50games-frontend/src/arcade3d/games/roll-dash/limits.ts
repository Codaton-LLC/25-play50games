// roll-dash: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 10460, minDurationMs: 45400, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 12180, minDurationMs: 58200, maxDurationMs: 180000, timeBaseMs: 180000 },
   3: { kind: "time", maxScore: 14000, minDurationMs: 70000, maxDurationMs: 210000, timeBaseMs: 210000 },
   4: { kind: "time", maxScore: 15990, minDurationMs: 80100, maxDurationMs: 240000, timeBaseMs: 240000 },
   5: { kind: "time", maxScore: 28090, minDurationMs: 19100, maxDurationMs: 300000, timeBaseMs: 300000 },
} as const;
