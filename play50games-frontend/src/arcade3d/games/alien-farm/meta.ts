import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const alienFarmMeta: ArcadeGameMeta = {
   slug: "alien-farm",
   title: "Alien Farm",
   tagline: "Harvest at the brightest pulse.",
   description: "Tend a moonlit alien garden: harvest each glowing crop at its brightest pulse and beam the harvest up to your hovering saucer.",
   order: 20,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD to move, E or Space to harvest",
      touch: "Joystick + Action to harvest",
   },
   scoring: {
      kind: "points",
      maxScore: 6000,
      minDurationMs: 10000,
      maxDurationMs: 102000,
      base: 6000,
      maxPointsPerSec: 6000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#4ade80",
   owner: "codex",
};
