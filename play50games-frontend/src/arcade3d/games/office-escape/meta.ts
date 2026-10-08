import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const officeEscapeMeta: ArcadeGameMeta = {
   slug: "office-escape",
   title: "Office Escape",
   tagline: "Late for the meeting. Run!",
   description: "Sprint through the office, jump desks and dodge chairs. It gets faster every 20 seconds.",
   order: 3,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "Left / right to change lane, Space to jump",
      touch: "Swipe left / right, swipe up to jump"
   },
   scoring: {
      kind: "points",
      maxScore: 152500,
      minDurationMs: 4800,
      maxDurationMs: 1800000,
      base: 0,
      maxPointsPerSec: 85,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: "/images/3d/office-escape.webp",
   accent: "#fbbf24",
   owner: "claude"
};
