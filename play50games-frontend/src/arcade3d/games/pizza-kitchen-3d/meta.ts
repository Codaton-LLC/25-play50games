import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 45, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const pizzaKitchen3dMeta: ArcadeGameMeta = {
   slug: "pizza-kitchen-3d",
   title: "Pizza Kitchen 3D",
   tagline: "Sauce, cheese, oven, serve.",
   description: "Build each pizza in order, bake it just right and serve it before the next ticket comes in.",
   order: 45,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
      touch: "Joystick to move + Use",
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
   accent: "#ef4444",
   owner: "claude",
};
