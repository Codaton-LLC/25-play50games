import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Scoring" (design approved 2026-10-09).
export const ghostVacuumMeta: ArcadeGameMeta = {
   slug: "ghost-vacuum",
   title: "Ghost Vacuum",
   tagline: "Light them up, suck them in.",
   description: "Bust giggling ghosts out of a toy haunted mansion with a backpack vacuum: light them up to stun them, then suck them in.",
   order: 18,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, mouse to aim; hold E, Enter or Space to vacuum",
      touch: "Joystick to move and aim, hold Vacuum to catch stunned ghosts",
   },
   scoring: {
      kind: "points",
      maxScore: 2630,
      minDurationMs: 91000,
      maxDurationMs: 122000,
      base: 1720,
      maxPointsPerSec: 10,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/ghost-vacuum.webp",
   accent: "#a78bfa",
   owner: "codex",
};
