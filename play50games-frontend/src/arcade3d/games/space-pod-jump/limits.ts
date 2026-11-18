// space-pod-jump: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 11810, minDurationMs: 1900, maxDurationMs: 120000, timeBaseMs: 120000 },
   2: { kind: "time", maxScore: 14220, minDurationMs: 7800, maxDurationMs: 150000, timeBaseMs: 150000 },
   3: { kind: "time", maxScore: 15370, minDurationMs: 6300, maxDurationMs: 160000, timeBaseMs: 160000 },
   4: { kind: "time", maxScore: 16220, minDurationMs: 7800, maxDurationMs: 170000, timeBaseMs: 170000 },
   5: { kind: "time", maxScore: 24400, minDurationMs: 16000, maxDurationMs: 260000, timeBaseMs: 260000 },
} as const;
