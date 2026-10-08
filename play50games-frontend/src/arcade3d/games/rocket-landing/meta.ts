import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
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
      maxScore: 4500,
      minDurationMs: 15000,
      maxDurationMs: 300000,
      base: 4500,
      maxPointsPerSec: 4500,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#fda4af",
   owner: "codex",
};
