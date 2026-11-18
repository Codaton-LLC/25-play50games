// ice-peak-jumper: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 17760, minDurationMs: 2400, maxDurationMs: 180000, timeBaseMs: 180000 },
   2: { kind: "time", maxScore: 20940, minDurationMs: 600, maxDurationMs: 210000, timeBaseMs: 210000 },
   3: { kind: "time", maxScore: 23860, minDurationMs: 1400, maxDurationMs: 240000, timeBaseMs: 240000 },
   4: { kind: "time", maxScore: 26790, minDurationMs: 2100, maxDurationMs: 270000, timeBaseMs: 270000 },
   5: { kind: "time", maxScore: 34230, minDurationMs: 17700, maxDurationMs: 360000, timeBaseMs: 360000 },
} as const;
