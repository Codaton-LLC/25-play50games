import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const penguinSlideMeta: ArcadeGameMeta = {
   slug: "penguin-slide",
   title: "Penguin Ice Slide",
   tagline: "Carve, jump, slurp the fish.",
   description: "Belly-slide a penguin down a twisting glacier: carve between ice blocks, launch off ramps and slurp up fish.",
   order: 25,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "A / D or left / right to steer; Space to hop; steer in the air to spin",
      touch: "Joystick left / right to steer and spin; tap Hop to hop; auto-hop assists cracks",
   },
   scoring: {
      kind: "points",
      maxScore: 75000,
      minDurationMs: 3000,
      maxDurationMs: 900000,
      base: 75000,
      maxPointsPerSec: 75000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#67e8f9",
   owner: "codex",
};
