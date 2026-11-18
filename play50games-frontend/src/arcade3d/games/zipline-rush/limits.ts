// zipline-rush: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = {
   1: { name: "Training Line" },
   2: { name: "Twin Lines" },
   3: { name: "Moving Landing" },
   4: { name: "Lighthouse Night" },
   5: { name: "Zipline Master" },
} as const;

const LIMITSFOR_TABLE = {
   1: { kind: "points", maxScore: 1460, base: 1460, maxPointsPerSec: 0, minDurationMs: 6200, maxDurationMs: 151000, unitLabel: "points", display: "int" },
   2: { kind: "points", maxScore: 1780, base: 1780, maxPointsPerSec: 0, minDurationMs: 9300, maxDurationMs: 181000, unitLabel: "points", display: "int" },
   3: { kind: "points", maxScore: 2100, base: 2100, maxPointsPerSec: 0, minDurationMs: 12500, maxDurationMs: 211000, unitLabel: "points", display: "int" },
   4: { kind: "points", maxScore: 2420, base: 2420, maxPointsPerSec: 0, minDurationMs: 15500, maxDurationMs: 241000, unitLabel: "points", display: "int" },
   5: { kind: "points", maxScore: 3990, base: 3990, maxPointsPerSec: 0, minDurationMs: 16900, maxDurationMs: 301000, unitLabel: "points", display: "int" },
} as const;

/** limitsFor(id) from rules.ts, as a table. */
export function limitsFor(id: 1 | 2 | 3 | 4 | 5) {
   return LIMITSFOR_TABLE[id];
}
