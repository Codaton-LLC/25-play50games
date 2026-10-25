import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 39, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const hauntedMansionKeysMeta: ArcadeGameMeta = {
   slug: "haunted-mansion-keys",
   title: "Haunted Mansion Keys",
   tagline: "Find the keys. Find the way out.",
   description: "Search a dark mansion room by room for coloured keys, open the matching doors and escape as fast as you can.",
   order: 39,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
      touch: "Joystick to move + Use",
   },
   scoring: {
      kind: "time",
      maxScore: 29_200,
      minDurationMs: 8000,
      maxDurationMs: 300_000,
      base: 0,
      maxPointsPerSec: 0,
      timeBaseMs: 300_000,
      unitLabel: "time",
      display: "time",
   },
   thumbnail: null,
   accent: "#c4b5fd",
   owner: "antigravity",
};
