import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR
// (proposed in README.md "Server limits and why they hold": 10500, 19000-92000 ms, 1500 + 110/s).
const CLEAR = [3000, 3500, 4000, 4500] as const;

const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 10500,
   minDurationMs: 19000,
   maxDurationMs: 92000,
   base: 1500,
   maxPointsPerSec: 110,
   unitLabel: "pts",
   display: "int",
};

const limits = (maxScore: number, minDurationMs: number, base: number, maxPointsPerSec: number): ScoringRules => ({ ...SCORING, maxScore, minDurationMs, base, maxPointsPerSec });

// Levels (README "Levels"): rules.ts PROPOSED_LEVEL_LIMITS, proven per level. No win state: a level
// clears at its score target; level 5 has nothing to unlock.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training Deck", scoring: SCORING, clearScore: CLEAR[0] },
   { id: 2, title: "Harbor Targets", scoring: limits(13125, 16500, 1900, 140), clearScore: CLEAR[1] },
   { id: 3, title: "Moving Boats", scoring: limits(13125, 15500, 1900, 140), clearScore: CLEAR[2] },
   { id: 4, title: "Storm Battle", scoring: limits(14250, 13500, 2000, 150), clearScore: CLEAR[3] },
   { id: 5, title: "Captain Challenge", scoring: limits(15000, 13500, 2100, 155) },
];

export const pirateCannonsMeta: ArcadeGameMeta = {
   slug: "pirate-cannons",
   title: "Pirate Cannon Battle",
   tagline: "Read the wind, sink the ships.",
   description: "Man a seaside fort's cartoon cannon: drag to aim, read the wind, and sink pirate ships before they reach the harbour.",
   order: 23,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "aim-drag",
      keyboard: "Drag to aim, release to fire, click to fire again; or arrows + Space",
      touch: "Drag to aim, release to fire, tap to fire again",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/pirate-cannons.webp",
   accent: "#f87171",
   owner: "claude",
};
