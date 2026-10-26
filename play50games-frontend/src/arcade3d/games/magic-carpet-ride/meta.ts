import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 47, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const magicCarpetRideMeta: ArcadeGameMeta = {
   slug: "magic-carpet-ride",
   title: "Magic Carpet Ride",
   tagline: "Through the rings, among the stars.",
   description: "Fly a magic carpet along a winding route, pass through the rings, collect the stars and steer clear of the floating rocks.",
   order: 47,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to steer, hold Space to boost",
      touch: "Joystick to steer + hold Boost",
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
   accent: "#a78bfa",
   owner: "cursor",
};
