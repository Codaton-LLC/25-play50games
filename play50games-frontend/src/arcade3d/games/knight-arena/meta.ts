import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits: README "Server limits and why they hold" and the rules.test.ts bots.
export const knightArenaMeta: ArcadeGameMeta = {
   slug: "knight-arena",
   title: "Knight Training Arena",
   tagline: "Strike on the beat.",
   description: "A young knight trains on the castle green: strike each target in the direction it shows, on the beat, and build the biggest combo.",
   order: 28,
   status: "live",
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
      maxScore: 11600,
      minDurationMs: 58000,
      maxDurationMs: 62000,
      base: 0,
      maxPointsPerSec: 200,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/knight-arena.webp",
   accent: "#facc15",
   owner: "antigravity",
};
