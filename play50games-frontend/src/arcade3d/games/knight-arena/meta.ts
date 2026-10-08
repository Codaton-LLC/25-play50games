import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const knightArenaMeta: ArcadeGameMeta = {
   slug: "knight-arena",
   title: "Knight Training Arena",
   tagline: "Strike on the beat.",
   description: "A young knight trains on the castle green: strike each target in the direction it shows, on the beat, and build the biggest combo.",
   order: 28,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "timing",
      keyboard: "Arrows / WASD to strike, Space to spin",
      touch: "Swipe to strike, Action to spin",
   },
   scoring: {
      kind: "points",
      maxScore: 9000,
      minDurationMs: 58000,
      maxDurationMs: 62000,
      base: 9000,
      maxPointsPerSec: 9000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#facc15",
   owner: "antigravity",
};
