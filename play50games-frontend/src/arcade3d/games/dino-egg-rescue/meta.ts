import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Scoring" (design approved 2026-10-09).
export const dinoEggRescueMeta: ArcadeGameMeta = {
   slug: "dino-egg-rescue",
   title: "Dino Egg Rescue",
   tagline: "Bring the runaway eggs home.",
   description: "A clumsy baby dino carries runaway eggs home to its nest while dodging rolling boulders and sticky mud.",
   order: 14,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, Space or E to dash",
      touch: "Joystick to move, tap Dash to dash",
   },
   scoring: {
      kind: "points",
      maxScore: 6000,
      minDurationMs: 88000,
      maxDurationMs: 92000,
      base: 0,
      maxPointsPerSec: 70,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/dino-egg-rescue.webp",
   accent: "#a3e635",
   owner: "antigravity",
};
