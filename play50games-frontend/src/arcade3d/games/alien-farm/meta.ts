import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits (README "Server limits and why they hold"; rules.ts PROPOSED_LIMITS).
export const alienFarmMeta: ArcadeGameMeta = {
   slug: "alien-farm",
   title: "Alien Farm",
   tagline: "Harvest at the brightest pulse.",
   description: "Tend a moonlit alien garden: harvest each glowing crop at its brightest pulse and beam the harvest up to your hovering saucer.",
   order: 20,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move; press E, Enter or Space to harvest at peak glow; enter the beam to deliver",
      touch: "Joystick to move; tap Pick at peak glow; enter the beam to deliver",
   },
   scoring: {
      kind: "points",
      maxScore: 12900,
      minDurationMs: 99000,
      maxDurationMs: 102000,
      base: 200,
      maxPointsPerSec: 250,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/alien-farm.webp",
   accent: "#4ade80",
   owner: "codex",
};
