import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const towerClimbMeta: ArcadeGameMeta = {
   slug: "tower-climb",
   title: "Tower Climb",
   tagline: "Jump higher. Do not look down.",
   description: "Climb a tower of moving and falling platforms, grab coins and reach checkpoints.",
   order: 7,
   status: "soon",
   difficulty: 2,
   orientation: "portrait",
   controls: {
      scheme: "platformer",
      keyboard: "Left / right to move, Space or Up to jump",
      touch: "Joystick + Jump button, or swipe up"
   },
   scoring: {
      kind: "points",
      maxScore: 50000,
      minDurationMs: 3000,
      maxDurationMs: 1800000,
      base: 0,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: null,
   accent: "#06b6d4",
   owner: "codex"
};
