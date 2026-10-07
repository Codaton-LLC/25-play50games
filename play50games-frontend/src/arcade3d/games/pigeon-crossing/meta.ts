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
   orientation: "portrait",
   controls: {
      scheme: "hop",
      keyboard: "Arrows / WASD: one hop per press",
      touch: "Swipe in any direction; tap hops forward"
   },
   scoring: {
      kind: "points",
      maxScore: 50000,
      minDurationMs: 3000,
      maxDurationMs: 1800000,
      base: 0,
      maxPointsPerSec: 28,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: "/images/3d/pigeon-crossing.webp",
   accent: "#a78bfa",
   owner: "codex"
};
