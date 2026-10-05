import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const robotCollectorMeta: ArcadeGameMeta = {
   slug: "robot-collector",
   title: "Robot Collector",
   tagline: "Grab 10 batteries before the clock runs out.",
   description: "Steer a tiny warehouse robot and collect all 10 batteries before the timer hits zero. Every second left is bonus points.",
   order: 1,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move",
      touch: "Joystick to move"
   },
   scoring: {
      kind: "points",
      maxScore: 1600,
      minDurationMs: 5000,
      maxDurationMs: 75000,
      base: 600,
      maxPointsPerSec: 120,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: "/images/3d/robot-collector.webp",
   accent: "#7dd3fc",
   owner: "claude"
};
