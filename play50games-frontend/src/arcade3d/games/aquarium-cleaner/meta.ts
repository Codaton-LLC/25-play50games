import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 49, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const aquariumCleanerMeta: ArcadeGameMeta = {
   slug: "aquarium-cleaner",
   title: "Aquarium Cleaner",
   tagline: "Scrub, collect, keep breathing.",
   description: "Walk the floor of a giant aquarium as a diver, scrub the algae, collect the trash and check the machines before your air runs low.",
   order: 49,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, hold E or Enter to work, Space to float up",
      touch: "Joystick to move + hold Work + Float",
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
   accent: "#2dd4bf",
   owner: "kimi",
};
