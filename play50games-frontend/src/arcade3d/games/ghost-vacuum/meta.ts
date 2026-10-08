import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const ghostVacuumMeta: ArcadeGameMeta = {
   slug: "ghost-vacuum",
   title: "Ghost Vacuum",
   tagline: "Light them up, suck them in.",
   description: "Bust giggling ghosts out of a toy haunted mansion with a backpack vacuum: light them up to stun them, then suck them in.",
   order: 18,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD to move, mouse to aim, hold E or Space to vacuum",
      touch: "Joystick + hold Action to vacuum",
   },
   scoring: {
      kind: "points",
      maxScore: 5250,
      minDurationMs: 10000,
      maxDurationMs: 122000,
      base: 5250,
      maxPointsPerSec: 5250,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#a78bfa",
   owner: "kimi",
};
