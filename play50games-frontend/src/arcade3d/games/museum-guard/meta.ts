import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const museumGuardMeta: ArcadeGameMeta = {
   slug: "museum-guard",
   title: "Museum Guard",
   tagline: "Statues only move when you look away.",
   description: "You are the night guard of a toy museum whose statues sneak off their pedestals whenever your flashlight looks away.",
   order: 12,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "look",
      keyboard: "Mouse or A / D to turn the flashlight, Space to flash",
      touch: "Drag to turn the flashlight, Action to flash",
   },
   scoring: {
      kind: "points",
      maxScore: 3900,
      minDurationMs: 10000,
      maxDurationMs: 92000,
      base: 3900,
      maxPointsPerSec: 3900,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#c4b5fd",
   owner: "cursor",
};
