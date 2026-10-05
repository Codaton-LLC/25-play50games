import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const foodCatcherMeta: ArcadeGameMeta = {
   slug: "food-catcher",
   title: "Food Catcher 3D",
   tagline: "Catch the good food, dodge the junk.",
   description: "A hungry chef catches falling fruit. Chain catches for a 2x combo, but three bad items and you are out.",
   order: 2,
   status: "soon",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "lanes",
      keyboard: "Left / right arrows to move",
      touch: "Drag or tap left / right"
   },
   scoring: {
      kind: "points",
      maxScore: 5000,
      minDurationMs: 5000,
      maxDurationMs: 100000,
      base: 0,
      maxPointsPerSec: 50,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: null,
   accent: "#86efac",
   owner: "cursor"
};
