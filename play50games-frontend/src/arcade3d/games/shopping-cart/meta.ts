import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits (README "Server limits and why they hold"); arcade-games.json carries the same values.
export const PROPOSED_LIMITS = {
   kind: "points",
   maxScore: 2030,
   minDurationMs: 3500,
   maxDurationMs: 77000,
   base: 1700,
   maxPointsPerSec: 100,
   unitLabel: "pts",
   display: "int",
} as const;

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
      touch: "Joystick to steer, hold Ride to ride",
   },
   scoring: { ...PROPOSED_LIMITS },
   thumbnail: "/images/3d/shopping-cart.webp",
   accent: "#fb923c",
   owner: "antigravity",
};
