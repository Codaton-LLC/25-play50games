import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 40, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const beeGardenMeta: ArcadeGameMeta = {
   slug: "bee-garden",
   title: "Bee Garden",
   tagline: "Buzz, gather, deliver.",
   description: "Fly a busy bee over the garden, gather nectar from the flowers and bring it home to the hive while dodging spider webs.",
   order: 40,
   status: "dev",
   collection: "skill",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to fly, hold Space to boost",
      touch: "Joystick to fly + hold Boost",
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
   accent: "#fbbf24",
   owner: "antigravity",
};
