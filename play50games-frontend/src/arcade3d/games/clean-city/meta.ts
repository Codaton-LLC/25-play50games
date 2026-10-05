import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const cleanCityMeta: ArcadeGameMeta = {
   slug: "clean-city",
   title: "Clean the City",
   tagline: "Tidy up the park, the city and the beach.",
   description: "Collect every piece of litter across three maps. Faster clean-ups earn a time bonus.",
   order: 8,
   status: "soon",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move",
      touch: "Joystick to move"
   },
   scoring: {
      kind: "points",
      maxScore: 6000,
      minDurationMs: 10000,
      maxDurationMs: 900000,
      base: 1000,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: null,
   accent: "#4ade80",
   owner: "cursor"
};
