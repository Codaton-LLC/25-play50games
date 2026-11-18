// toy-room-run: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 10750, minDurationMs: 12500, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 13690, minDurationMs: 13100, maxDurationMs: 150000, timeBaseMs: 150000 },
   3: { kind: "time", maxScore: 14580, minDurationMs: 14200, maxDurationMs: 160000, timeBaseMs: 160000 },
   4: { kind: "time", maxScore: 15340, minDurationMs: 16600, maxDurationMs: 170000, timeBaseMs: 170000 },
   5: { kind: "time", maxScore: 18410, minDurationMs: 15900, maxDurationMs: 200000, timeBaseMs: 200000 },
} as const;
