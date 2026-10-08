import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const shoppingCartMeta: ArcadeGameMeta = {
   slug: "shopping-cart",
   title: "Crazy Shopping Cart",
   tagline: "Grab the list, dodge the spills.",
   description: "Drift a runaway shopping cart through the aisles, grab everything on your list and dodge shoppers, spills and can pyramids.",
   order: 16,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to steer, hold Space to ride",
      touch: "Joystick + hold Jump to ride",
   },
   scoring: {
      kind: "points",
      maxScore: 3000,
      minDurationMs: 10000,
      maxDurationMs: 77000,
      base: 3000,
      maxPointsPerSec: 3000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#fb923c",
   owner: "antigravity",
};
