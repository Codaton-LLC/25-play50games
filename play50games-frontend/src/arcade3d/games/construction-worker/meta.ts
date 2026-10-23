import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README (design approved 2026-10-09).
export const constructionWorkerMeta: ArcadeGameMeta = {
   slug: "construction-worker",
   title: "Construction Worker",
   tagline: "Build it floor by floor.",
   description: "Run the crane on a toy building site: pick the right material for the glowing blueprint slot and swing it into place, floor by floor.",
   order: 19,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile",
      touch: "Joystick, Action to drop, tap a pile",
   },
   scoring: {
      kind: "points",
      maxScore: 6100,
      minDurationMs: 9000,
      maxDurationMs: 242000,
      base: 0,
      maxPointsPerSec: 150,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/construction-worker.webp",
   accent: "#fbbf24",
   owner: "cursor",
};
