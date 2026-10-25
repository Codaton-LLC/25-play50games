import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five. A level clears only on a win (every treat, then the bed).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 700, minDurationMs: 4000, maxDurationMs: 90_000, base: 380, maxPointsPerSec: 46 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 970, minDurationMs: 4000, maxDurationMs: 120_000, base: 560, maxPointsPerSec: 23 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1270, minDurationMs: 4000, maxDurationMs: 150_000, base: 760, maxPointsPerSec: 30 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1410, minDurationMs: 4000, maxDurationMs: 150_000, base: 940, maxPointsPerSec: 17 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 1730, minDurationMs: 4000, maxDurationMs: 180_000, base: 1185, maxPointsPerSec: 13 } },
];

export const catVsRobotVacuumMeta: ArcadeGameMeta = {
   slug: "cat-vs-robot-vacuum",
   title: "Cat vs Robot Vacuum",
   tagline: "Snack fast. Stay clean.",
   description: "Sneak around the house as a cat, collect every treat and hop away from the robot vacuums before curling up on the bed.",
   order: 36,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, Space to hop",
      touch: "Joystick to move + Hop",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#fb923c",
   owner: "kimi",
};
