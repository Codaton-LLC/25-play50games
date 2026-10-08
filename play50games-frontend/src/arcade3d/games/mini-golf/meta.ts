import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const miniGolfMeta: ArcadeGameMeta = {
   slug: "mini-golf",
   title: "Mini Golf 3D",
   tagline: "Six holes, as few strokes as you can.",
   description: "Six bite-size toy holes with ramps, tunnels and a spinning windmill: drag, aim and sink it in as few strokes as possible.",
   order: 21,
   status: "dev",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "aim-drag",
      keyboard: "Drag to aim and putt, or arrows + hold Space",
      touch: "Drag to aim, release to putt",
   },
   scoring: {
      kind: "points",
      maxScore: 6750,
      minDurationMs: 30000,
      maxDurationMs: 900000,
      base: 6750,
      maxPointsPerSec: 6750,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#86efac",
   owner: "claude",
};
