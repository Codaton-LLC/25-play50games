// robot-factory-run: the values meta.ts needs, as plain literals with no imports, so the registry (loaded on every
// /3d page) does not pull in this game's rules and levels. rules.ts / levels.ts stay the source:
// src/arcade3d/menu2/limitsSync.test.ts fails if this file and them ever differ.

/** Level fields meta.ts reads (name); levels.ts holds the full levels. */
export const LEVELS = {
   1: { name: "Assembly Start" },
   2: { name: "Conveyor Hall" },
   3: { name: "Robot Arms" },
   4: { name: "Laser Line" },
   5: { name: "Factory Overdrive" },
} as const;

/** PROPOSED_LEVEL_LIMITS from rules.ts (derived there; menu2/limitsSync.test.ts checks this copy). */
export const PROPOSED_LEVEL_LIMITS = {
   1: { kind: "time", maxScore: 8280, minDurationMs: 7200, maxDurationMs: 90000, timeBaseMs: 90000 },
   2: { kind: "time", maxScore: 9650, minDurationMs: 13500, maxDurationMs: 110000, timeBaseMs: 110000 },
   3: { kind: "time", maxScore: 11170, minDurationMs: 8300, maxDurationMs: 120000, timeBaseMs: 120000 },
   4: { kind: "time", maxScore: 12910, minDurationMs: 10900, maxDurationMs: 140000, timeBaseMs: 140000 },
   5: { kind: "time", maxScore: 22490, minDurationMs: 15100, maxDurationMs: 240000, timeBaseMs: 240000 },
} as const;
