import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring matches WP includes/arcade-games.json: the decided limits
// (2026-10-24), same as rules.PROPOSED_LIMITS — maxScore 4830 = the proven seed-independent ceiling
// 4680 × 1.03, rounded up to the nearest 10 (README.md "Server limits and why they hold").
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
   scoring: {
      kind: "points",
      maxScore: 4830,
      minDurationMs: 12000,
      maxDurationMs: 92000,
      base: 240,
      maxPointsPerSec: 60,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/monster-kitchen.webp",
   accent: "#f472b6",
   owner: "kimi",
};
