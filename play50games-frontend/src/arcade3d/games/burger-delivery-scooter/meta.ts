import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 33, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const burgerDeliveryScooterMeta: ArcadeGameMeta = {
   slug: "burger-delivery-scooter",
   title: "Burger Delivery Scooter",
   tagline: "Hot food, cold streets.",
   description: "Ride a scooter from the burger shop to each door, hop the barriers and keep the food quality high.",
   order: 33,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "WASD / arrows to ride, Space to hop",
      touch: "Joystick to ride + Hop",
   },
   scoring: {
      kind: "points",
      maxScore: 3000,
      minDurationMs: 10_000,
      maxDurationMs: 300_000,
      base: 3000,
      maxPointsPerSec: 3000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#fb7185",
   owner: "claude",
};
