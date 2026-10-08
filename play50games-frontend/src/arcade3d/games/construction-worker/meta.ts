import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const constructionWorkerMeta: ArcadeGameMeta = {
   slug: "construction-worker",
   title: "Construction Worker",
   tagline: "Build it floor by floor.",
   description: "Run the crane on a toy building site: pick the right material for the glowing blueprint slot and swing it into place, floor by floor.",
   order: 19,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile",
      touch: "Joystick, Action to drop, tap a pile",
   },
   scoring: {
      kind: "points",
      maxScore: 9000,
      minDurationMs: 20000,
      maxDurationMs: 152000,
      base: 9000,
      maxPointsPerSec: 9000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#fbbf24",
   owner: "cursor",
};
