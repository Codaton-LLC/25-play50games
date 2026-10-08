import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
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
      keyboard: "Left / right to turn the wheel, Space to toss, or click",
      touch: "Swipe to turn the wheel, tap to toss",
   },
   scoring: {
      kind: "points",
      maxScore: 6000,
      minDurationMs: 10000,
      maxDurationMs: 92000,
      base: 6000,
      maxPointsPerSec: 6000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#f472b6",
   owner: "kimi",
};
