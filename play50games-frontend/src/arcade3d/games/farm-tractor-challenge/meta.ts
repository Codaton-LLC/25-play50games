import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 35, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const farmTractorChallengeMeta: ArcadeGameMeta = {
   slug: "farm-tractor-challenge",
   title: "Farm Tractor Challenge",
   tagline: "Hitch, haul, park.",
   description: "Drive a tractor across the farm, roll gently into hay bales to load the trailer and park them in the barn bay.",
   order: 35,
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
   accent: "#eab308",
   owner: "kimi",
};
