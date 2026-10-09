import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const spaceRepairMeta: ArcadeGameMeta = {
   slug: "space-repair",
   title: "Space Repair Mission",
   tagline: "Fix the station before the power runs out.",
   description: "Jetpack around a tiny space station in zero gravity and fix sparking modules before the station's power runs out.",
   order: 26,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "timing",
      keyboard: "WASD to thrust, E or Space to repair on time",
      touch: "Joystick + Action to repair",
   },
   scoring: {
      kind: "points",
      maxScore: 4500,
      minDurationMs: 10000,
      maxDurationMs: 122000,
      base: 4500,
      maxPointsPerSec: 4500,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#818cf8",
   owner: "codex",
};
