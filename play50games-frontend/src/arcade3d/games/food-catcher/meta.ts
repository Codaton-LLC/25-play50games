import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). Level 1 scoring stays byte-for-byte aligned with production.
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 2500,
   minDurationMs: 9500,
   maxDurationMs: 93000,
   base: 0,
   maxPointsPerSec: 28,
   unitLabel: "pts",
   display: "int"
};

const levelScoring = (maxScore: number, minDurationMs: number, maxDurationMs: number, maxPointsPerSec: number, base = 0): ScoringRules => ({
   ...SCORING_L1,
   maxScore,
   minDurationMs,
   maxDurationMs,
   base,
   maxPointsPerSec,
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Fruit Catch", scoring: SCORING_L1, clearScore: 260 },
   { id: 2, title: "Snack Catch", scoring: levelScoring(510, 8620, 123000, 19) },
   { id: 3, title: "Fast Food Mix", scoring: levelScoring(740, 7890, 153000, 22, 15) },
   { id: 4, title: "Speed Kitchen", scoring: levelScoring(970, 7940, 183000, 27) },
   { id: 5, title: "Master Catch", scoring: levelScoring(1340, 7270, 183000, 32) },
];

export const foodCatcherMeta: ArcadeGameMeta = {
   slug: "food-catcher",
   title: "Food Catcher 3D",
   tagline: "Catch the good food, dodge the junk.",
   description: "A hungry chef catches falling fruit. Chain catches for a 2x combo, but three bad items and you are out.",
   order: 2,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "lanes",
      keyboard: "Left / right arrows to move",
      touch: "Hold and drag left / right"
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/food-catcher.webp",
   accent: "#86efac",
   owner: "cursor"
};
