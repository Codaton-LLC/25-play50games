import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const pigeonCrossingMeta: ArcadeGameMeta = {
   slug: "pigeon-crossing",
   title: "Pigeon Crossing",
   tagline: "Why did the pigeon cross the road?",
   description: "Hop a brave pigeon across busy lanes of traffic. Every level adds faster cars.",
   order: 4,
   status: "soon",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "hop",
      keyboard: "Arrows / WASD to hop",
      touch: "Swipe or tap to hop"
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
   accent: "#a78bfa",
   owner: "codex"
};
