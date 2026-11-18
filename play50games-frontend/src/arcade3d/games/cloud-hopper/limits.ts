// cloud-hopper: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 10970, minDurationMs: 20300, maxDurationMs: 130000, timeBaseMs: 130000 },
   2: { kind: "time", maxScore: 12330, minDurationMs: 26700, maxDurationMs: 150000, timeBaseMs: 150000 },
   3: { kind: "time", maxScore: 15530, minDurationMs: 24700, maxDurationMs: 180000, timeBaseMs: 180000 },
   4: { kind: "time", maxScore: 17180, minDurationMs: 38200, maxDurationMs: 210000, timeBaseMs: 210000 },
   5: { kind: "time", maxScore: 20030, minDurationMs: 39700, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
