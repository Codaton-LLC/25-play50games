// color-orb-defense: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = { 1: { name: "Two Colors" }, 2: { name: "Three Colors" }, 3: { name: "Four Colors" }, 4: { name: "Fast Waves" }, 5: { name: "Orb Defense Master" } } as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "points", maxScore: 4940, minDurationMs: 51000, maxDurationMs: 121000, base: 0, maxPointsPerSec: 97 },
   2: { kind: "points", maxScore: 8890, minDurationMs: 83900, maxDurationMs: 151000, base: 0, maxPointsPerSec: 106 },
   3: { kind: "points", maxScore: 15600, minDurationMs: 143400, maxDurationMs: 211000, base: 0, maxPointsPerSec: 109 },
   4: { kind: "points", maxScore: 24150, minDurationMs: 179600, maxDurationMs: 261000, base: 0, maxPointsPerSec: 135 },
   5: { kind: "points", maxScore: 28450, minDurationMs: 171400, maxDurationMs: 321000, base: 0, maxPointsPerSec: 166 },
} as const;
