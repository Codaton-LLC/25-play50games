import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 42, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const submarineTreasureDiveMeta: ArcadeGameMeta = {
   slug: "submarine-treasure-dive",
   title: "Submarine Treasure Dive",
   tagline: "Follow the sonar. Mind the battery.",
   description: "Pilot a mini submarine through the reef, dive to the treasure on the sea floor and get back to base before the battery runs out.",
   order: 42,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to steer, hold E or Enter to dive",
      touch: "Joystick to steer + hold Dive",
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
   accent: "#22d3ee",
   owner: "cursor",
};
