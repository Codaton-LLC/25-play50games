// snow-slide-dash: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = { 1: { name: "Bunny Hill" }, 2: { name: "Pine Run" }, 3: { name: "Frozen Lake" }, 4: { name: "Lantern Slope" }, 5: { name: "Avalanche Run" } } as const;

/** LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const LIMITS = {
   1: {
      kind: "time",
      minDurationMs: 14771,
      maxDurationMs: 100000,
      timeBaseMs: 100000,
      maxScore: 8522,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   2: {
      kind: "time",
      minDurationMs: 20908,
      maxDurationMs: 125000,
      timeBaseMs: 125000,
      maxScore: 10409,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   3: {
      kind: "time",
      minDurationMs: 24999,
      maxDurationMs: 145000,
      timeBaseMs: 145000,
      maxScore: 12000,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   4: {
      kind: "time",
      minDurationMs: 29544,
      maxDurationMs: 165000,
      timeBaseMs: 165000,
      maxScore: 13545,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   5: {
      kind: "time",
      minDurationMs: 40908,
      maxDurationMs: 210000,
      timeBaseMs: 210000,
      maxScore: 16909,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
} as const;
