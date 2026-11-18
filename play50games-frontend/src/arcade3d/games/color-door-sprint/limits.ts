// color-door-sprint: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 7460, minDurationMs: 15400, maxDurationMs: 90000, timeBaseMs: 90000 },
   2: { kind: "time", maxScore: 9530, minDurationMs: 14700, maxDurationMs: 110000, timeBaseMs: 110000 },
   3: { kind: "time", maxScore: 11680, minDurationMs: 13200, maxDurationMs: 130000, timeBaseMs: 130000 },
   4: { kind: "time", maxScore: 13770, minDurationMs: 12300, maxDurationMs: 150000, timeBaseMs: 150000 },
   5: { kind: "time", maxScore: 20730, minDurationMs: 32700, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
