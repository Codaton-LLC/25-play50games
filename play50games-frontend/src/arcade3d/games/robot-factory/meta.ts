import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const robotFactoryMeta: ArcadeGameMeta = {
   slug: "robot-factory",
   title: "Robot Factory Sorter",
   tagline: "Right part, right order.",
   description: "Build robots on a humming assembly line: grab the right parts off the conveyor in the order the blueprint asks, and scrap the faulty ones.",
   order: 22,
   status: "dev",
   collection: "skill",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "Space to grab, S / Down to scrap, or click a part",
      touch: "Tap a part to grab, swipe down to scrap",
   },
   scoring: {
      kind: "points",
      maxScore: 6000,
      minDurationMs: 10000,
      maxDurationMs: 92000,
      base: 6000,
      maxPointsPerSec: 6000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#7dd3fc",
   owner: "kimi",
};
