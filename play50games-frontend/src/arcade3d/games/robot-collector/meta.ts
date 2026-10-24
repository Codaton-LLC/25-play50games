import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.

/** Level 1 = today's live game: these are the limits already on the server. Do not change. */
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 1470,
   minDurationMs: 12500,
   maxDurationMs: 62000,
   base: 600,
   maxPointsPerSec: 120,
   unitLabel: "pts",
   display: "int"
};

// Levels 2-5: the limits proposed in rules.ts PROPOSED_LEVEL_LIMITS (the proof is in README.md);
// rules.test.ts checks the two tables are equal. They reach arcade-games.json `levels` when
// Claude copies them at merge (registry.sync.test.ts fails for this game until then).
// A level is cleared by a win (all its batteries): no `clearScore`.
const levelScoring = (maxScore: number, minDurationMs: number, maxDurationMs: number): ScoringRules => ({
   kind: "points",
   maxScore,
   minDurationMs,
   maxDurationMs,
   base: 600,
   maxPointsPerSec: 120,
   unitLabel: "pts",
   display: "int"
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training Bay", scoring: SCORING_L1 },
   { id: 2, title: "Small Warehouse", scoring: levelScoring(1740, 14900, 72500) },
   { id: 3, title: "Conveyor Zone", scoring: levelScoring(2010, 17400, 82500) },
   { id: 4, title: "Dark Storage", scoring: levelScoring(2240, 19900, 88000) },
   { id: 5, title: "Mega Warehouse", scoring: levelScoring(2460, 22300, 93000) }
];

export const robotCollectorMeta: ArcadeGameMeta = {
   slug: "robot-collector",
   title: "Robot Collector",
   tagline: "Grab 10 batteries before the clock runs out.",
   description: "Steer a tiny warehouse robot and collect all 10 batteries before the timer hits zero. Every second left is bonus points.",
   order: 1,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move",
      touch: "Joystick to move"
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/robot-collector.webp",
   accent: "#7dd3fc",
   owner: "claude"
};
