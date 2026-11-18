// dragon-cave-rush: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 5360, minDurationMs: 36400, maxDurationMs: 90000, timeBaseMs: 90000 },
   2: { kind: "time", maxScore: 7670, minDurationMs: 33300, maxDurationMs: 110000, timeBaseMs: 110000 },
   3: { kind: "time", maxScore: 8940, minDurationMs: 30600, maxDurationMs: 120000, timeBaseMs: 120000 },
   4: { kind: "time", maxScore: 10170, minDurationMs: 28300, maxDurationMs: 130000, timeBaseMs: 130000 },
   5: { kind: "time", maxScore: 14610, minDurationMs: 33900, maxDurationMs: 180000, timeBaseMs: 180000 },
} as const;
