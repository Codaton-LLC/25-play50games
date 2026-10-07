import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const warehouseRushMeta: ArcadeGameMeta = {
   slug: "warehouse-rush",
   title: "Warehouse Rush",
   tagline: "Right box, right zone, 60 seconds.",
   description: "Pick up coloured boxes and deliver them to the matching zone. The wrong zone costs points.",
   order: 6,
   status: "soon",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD to move, E / Space to pick up and drop",
      touch: "Joystick + Action button"
   },
   scoring: {
      kind: "points",
      maxScore: 1700,
      minDurationMs: 57000,
      maxDurationMs: 63000,
      base: 0,
      maxPointsPerSec: 29,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: "/images/3d/warehouse-rush.webp",
   accent: "#fb923c",
   owner: "claude"
};
