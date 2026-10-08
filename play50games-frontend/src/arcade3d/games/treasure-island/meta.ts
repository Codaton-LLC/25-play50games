import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const treasureIslandMeta: ArcadeGameMeta = {
   slug: "treasure-island",
   title: "Treasure Island",
   tagline: "Follow the detector, dig up the treasure.",
   description: "Explore a tiny tropical island with a buzzing treasure detector and dig up five buried treasures before the tide comes in.",
   order: 11,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, hold E, Enter or Space to dig",
      touch: "Joystick to move, hold Dig to dig",
   },
   scoring: {
      kind: "points",
      maxScore: 2850,
      minDurationMs: 15000,
      maxDurationMs: 92000,
      base: 2850,
      maxPointsPerSec: 2850,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/treasure-island.webp",
   accent: "#2dd4bf",
   owner: "claude",
};
