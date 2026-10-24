import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring matches WP includes/arcade-games.json: the decided limits
// (2026-10-24), same as rules.PROPOSED_LIMITS — maxScore 4830 = the proven seed-independent ceiling
// 4680 × 1.03, rounded up to the nearest 10 (README.md "Server limits and why they hold").
// Levels 2-5: rules.ts PROPOSED_LEVEL_LIMITS (README "Levels"). Level 1 scoring is this object.
// A level clears when the score reaches clearScore (there is no win; the shift ends on the clock).
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 4830,
   minDurationMs: 12000,
   maxDurationMs: 92000,
   base: 240,
   maxPointsPerSec: 60,
   unitLabel: "pts",
   display: "int",
};

const levelScoring = (
   maxScore: number, maxDurationMs: number, maxPointsPerSec: number, minDurationMs = 12000,
): ScoringRules => ({
   ...SCORING,
   maxScore,
   minDurationMs,
   maxDurationMs,
   maxPointsPerSec,
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Snack Bar", scoring: SCORING, clearScore: 2000 },
   { id: 2, title: "Monster Café", scoring: levelScoring(6300, 102000, 62), clearScore: 2600 },
   { id: 3, title: "Busy Kitchen", scoring: levelScoring(7640, 110000, 70), clearScore: 3000 },
   { id: 4, title: "Dinner Rush", scoring: levelScoring(8470, 116000, 74, 11000), clearScore: 3200 },
   { id: 5, title: "Grand Feast", scoring: levelScoring(9600, 122000, 79, 11000), clearScore: 3600 },
];

export const monsterKitchenMeta: ArcadeGameMeta = {
   slug: "monster-kitchen",
   title: "Monster Kitchen",
   tagline: "Weird orders, in order.",
   description: "Cook for a queue of hungry, picky monsters: spin the ingredient wheel and toss the right weird ingredients into the bubbling cauldron in order.",
   order: 27,
   status: "dev",
   collection: "skill",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "Left / right to turn the wheel, Space or Enter to toss, or click an ingredient",
      touch: "Swipe to turn the wheel, tap ◀ ▶ to turn one slot, tap an ingredient to toss",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/monster-kitchen.webp",
   accent: "#f472b6",
   owner: "kimi",
};
