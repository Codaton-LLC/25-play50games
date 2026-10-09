import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold" (bots in rules.test.ts); Claude copies them
// to arcade-games.json.
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
      keyboard: "Drag to aim and putt, or arrows to aim and hold Space, release to putt",
      touch: "Pull back from anywhere, release to putt",
   },
   scoring: {
      kind: "points",
      maxScore: 4100,
      minDurationMs: 15000,
      maxDurationMs: 602000,
      base: 1200,
      maxPointsPerSec: 200,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#86efac",
   owner: "claude",
};
