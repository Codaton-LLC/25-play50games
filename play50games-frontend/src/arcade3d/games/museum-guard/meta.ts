import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits: README "Server limits and why they hold" and the rules.test.ts bots.
export const museumGuardMeta: ArcadeGameMeta = {
   slug: "museum-guard",
   title: "Museum Guard",
   tagline: "Statues only move when you look away.",
   description: "You are the night guard of a toy museum whose statues sneak off their pedestals whenever your flashlight looks away.",
   order: 12,
   status: "live",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "look",
      keyboard: "Move the mouse left or right, or hold A / D or the arrows, to turn; Space or E flashes",
      touch: "Drag to turn, Flash to burst",
   },
   scoring: {
      kind: "points",
      maxScore: 2050,
      minDurationMs: 12000,
      maxDurationMs: 92000,
      base: 0,
      maxPointsPerSec: 25,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/museum-guard.webp",
   accent: "#c4b5fd",
   owner: "cursor",
};
