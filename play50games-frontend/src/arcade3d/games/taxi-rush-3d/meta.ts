import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 32, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const taxiRush3dMeta: ArcadeGameMeta = {
   slug: "taxi-rush-3d",
   title: "Taxi Rush 3D",
   tagline: "Pick up. Drop off. Mind the lights.",
   description: "Drive a yellow cab around a small street grid, stop on the pickup pad, then stop on the destination pad before your rider runs out of patience.",
   order: 32,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "WASD / arrows to drive",
      touch: "Joystick to drive",
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
   accent: "#facc15",
   owner: "cursor",
};
