import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Scoring" (design approved 2026-10-09).
export const rocketLandingMeta: ArcadeGameMeta = {
   slug: "rocket-landing",
   title: "Rocket Landing Challenge",
   tagline: "Touch down gently.",
   description: "Feather the thrusters of a chunky toy rocket and set it down gently on floating landing pads across five tricky planets.",
   order: 30,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "A / D to rotate, hold Space or W to thrust",
      touch: "Joystick to rotate + hold Jump to thrust",
   },
   scoring: {
      kind: "points",
      maxScore: 2800,
      minDurationMs: 5000,
      maxDurationMs: 242000,
      base: 800,
      maxPointsPerSec: 200,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#fda4af",
   owner: "codex",
};
