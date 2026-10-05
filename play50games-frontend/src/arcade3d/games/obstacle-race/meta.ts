import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const obstacleRaceMeta: ArcadeGameMeta = {
   slug: "obstacle-race",
   title: "Obstacle Race",
   tagline: "Spinning bars, moving blocks, one finish line.",
   description: "Race through a physics obstacle course. Beat your best time and climb the leaderboard.",
   order: 10,
   status: "soon",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD to move, Space to jump",
      touch: "Joystick + Jump button"
   },
   scoring: {
      kind: "time",
      maxScore: 30000,
      minDurationMs: 15000,
      maxDurationMs: 300000,
      base: 0,
      maxPointsPerSec: 0,
      timeBaseMs: 300000,
      unitLabel: "time",
      display: "time"
   },
   thumbnail: null,
   accent: "#6366f1",
   owner: "claude"
};
