import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const luggageRushMeta: ArcadeGameMeta = {
   slug: "luggage-rush",
   title: "Airport Luggage Rush",
   tagline: "Every bag to the right flight.",
   description: "Flip conveyor switches so every suitcase rides to the flight with its colour and symbol before the baggage hall overflows.",
   order: 13,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "A / S / D / W or a click flip the diverters",
      touch: "Tap a diverter to flip it",
   },
   scoring: {
      kind: "points",
      maxScore: 7500,
      minDurationMs: 10000,
      maxDurationMs: 122000,
      base: 7500,
      maxPointsPerSec: 7500,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#60a5fa",
   owner: "cursor",
};
