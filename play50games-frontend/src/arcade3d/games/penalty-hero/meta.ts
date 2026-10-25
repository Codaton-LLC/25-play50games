import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). Level 1 scoring must match WP includes/arcade-games.json.
// Levels 2-5 duplicate rules.ts PROPOSED_LEVEL_LIMITS for the server-safe registry; levels.test.ts
// checks the tables, and Claude copies the proposals into arcade-games.json at merge.
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 1450,
   minDurationMs: 15500,
   maxDurationMs: 225000,
   base: 0,
   maxPointsPerSec: 95,
   unitLabel: "pts",
   display: "int"
};

const levelScoring = (maxScore: number, minDurationMs: number, maxDurationMs: number, maxPointsPerSec: number): ScoringRules => ({
   ...SCORING_L1,
   maxScore,
   minDurationMs,
   maxDurationMs,
   maxPointsPerSec
});

// A level clears on a win. Level 1 keeps its legacy always-win ending; Levels 2-5 win only at
// their goal target, so no clearScore can accidentally clear a failed run.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training", scoring: SCORING_L1 },
   { id: 2, title: "Local Cup", scoring: levelScoring(1750, 18400, 245000, 97) },
   { id: 3, title: "Night Match", scoring: levelScoring(2375, 21500, 257000, 113) },
   { id: 4, title: "Semi Final", scoring: levelScoring(2725, 24600, 260000, 113) },
   { id: 5, title: "Final Shootout", scoring: levelScoring(3500, 27600, 255000, 129) }
];

export const penaltyHeroMeta: ArcadeGameMeta = {
   slug: "penalty-hero",
   title: "Penalty Hero",
   tagline: "10 shots. Beat the keeper.",
   description: "Pick a corner and shoot. The keeper guesses a side. Score streaks for bonus points.",
   order: 5,
   status: "live",
   difficulty: 2,
   orientation: "portrait",
   controls: {
      scheme: "tap-target",
      keyboard: "Arrow keys to aim, Space to shoot",
      touch: "Tap a target zone"
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/penalty-hero.webp",
   accent: "#f472b6",
   owner: "cursor"
};
