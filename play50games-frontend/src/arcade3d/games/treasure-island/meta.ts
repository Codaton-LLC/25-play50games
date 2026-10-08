import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold" (rules.test.ts checks them).
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
      maxScore: 2060,
      minDurationMs: 8500,
      maxDurationMs: 92000,
      base: 1250,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/treasure-island.webp",
   accent: "#2dd4bf",
   owner: "claude",
};
