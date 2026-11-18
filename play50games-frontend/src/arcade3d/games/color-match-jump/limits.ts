// color-match-jump: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = {
   1: { name: "Two-Tone Steps" },
   2: { name: "Three Calls" },
   3: { name: "Shifting Hues" },
   4: { name: "Fast Countdown" },
   5: { name: "Frozen Crown" },
} as const;

/** LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const LIMITS = {
   1: {
      kind: "time",
      minDurationMs: 5599,
      maxDurationMs: 90000,
      timeBaseMs: 90000,
      maxScore: 8440,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   2: {
      kind: "time",
      minDurationMs: 13439,
      maxDurationMs: 120000,
      timeBaseMs: 120000,
      maxScore: 10656,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   3: {
      kind: "time",
      minDurationMs: 20159,
      maxDurationMs: 150000,
      timeBaseMs: 150000,
      maxScore: 12984,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   4: {
      kind: "time",
      minDurationMs: 35839,
      maxDurationMs: 180000,
      timeBaseMs: 180000,
      maxScore: 14416,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
   5: {
      kind: "time",
      minDurationMs: 30079,
      maxDurationMs: 240000,
      timeBaseMs: 240000,
      maxScore: 20992,
      base: 0,
      maxPointsPerSec: 0,
      unitLabel: "time",
      display: "time",
   },
} as const;
