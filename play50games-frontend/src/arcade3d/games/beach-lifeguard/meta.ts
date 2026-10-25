import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 34, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const beachLifeguardMeta: ArcadeGameMeta = {
   slug: "beach-lifeguard",
   title: "Beach Lifeguard",
   tagline: "Run, swim, rescue.",
   description: "Sprint across the sand, wade into the water, grab the swimmer in trouble and bring them back to the beach before the alert runs out.",
   order: 34,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to grab",
      touch: "Joystick to move + Grab",
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
   owner: "antigravity",
};
