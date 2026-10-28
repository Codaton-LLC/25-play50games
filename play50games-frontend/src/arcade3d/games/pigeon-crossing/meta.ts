import { CLEAR_SCORES } from "./levels";
import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const pigeonCrossingMeta: ArcadeGameMeta = {
   slug: "pigeon-crossing",
   title: "Pigeon Crossing",
   tagline: "Why did the pigeon cross the road?",
   description: "Hop a brave pigeon across busy lanes of traffic to reach the other side. Every level adds faster cars, so time each dash carefully.",
   order: 4,
   status: "live",
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
   levels: [
      { id: 1, title: "Quiet Street", clearScore: CLEAR_SCORES[1], scoring: { kind: "points", maxScore: 50000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 28, unitLabel: "pts", display: "int" } },
      { id: 2, title: "Main Road", clearScore: CLEAR_SCORES[2], scoring: { kind: "points", maxScore: 75000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 42, unitLabel: "pts", display: "int" } },
      { id: 3, title: "City Crossing", clearScore: CLEAR_SCORES[3], scoring: { kind: "points", maxScore: 100000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 56, unitLabel: "pts", display: "int" } },
      { id: 4, title: "Night Traffic", clearScore: CLEAR_SCORES[4], scoring: { kind: "points", maxScore: 125000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 70, unitLabel: "pts", display: "int" } },
      { id: 5, title: "Rush Hour", clearScore: CLEAR_SCORES[5], scoring: { kind: "points", maxScore: 150000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 84, unitLabel: "pts", display: "int" } },
   ],
   thumbnail: "/images/3d/pigeon-crossing.webp",
   accent: "#a78bfa",
   owner: "codex"
};
