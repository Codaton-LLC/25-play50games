import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 36, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const catVsRobotVacuumMeta: ArcadeGameMeta = {
   slug: "cat-vs-robot-vacuum",
   title: "Cat vs Robot Vacuum",
   tagline: "Snack fast. Stay clean.",
   description: "Sneak around the house as a cat, collect every treat and hop away from the robot vacuums before curling up on the bed.",
   order: 36,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, Space to hop",
      touch: "Joystick to move + Hop",
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
   accent: "#fb923c",
   owner: "kimi",
};
