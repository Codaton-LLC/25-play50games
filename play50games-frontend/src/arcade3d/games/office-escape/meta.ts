import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVELS } from "./levels";

const scoring = (maxScore: number, maxPointsPerSec: number): ScoringRules => ({
   kind: "points", maxScore, minDurationMs: 4800, maxDurationMs: 1800000,
   base: 0, maxPointsPerSec, unitLabel: "pts", display: "int",
});
const levels: readonly LevelMeta[] = [
   { id: 1, title: "Open Office", scoring: scoring(152500, 85), clearScore: LEVELS[1].clearScore },
   { id: 2, title: "Meeting Floor", scoring: scoring(170500, 95), clearScore: LEVELS[2].clearScore },
   { id: 3, title: "Copy Room", scoring: scoring(189000, 106), clearScore: LEVELS[3].clearScore },
   { id: 4, title: "Executive Floor", scoring: scoring(208000, 116), clearScore: LEVELS[4].clearScore },
   { id: 5, title: "After-Hours Office", scoring: scoring(228000, 128), clearScore: LEVELS[5].clearScore },
];

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
   levels,
   thumbnail: "/images/3d/office-escape.webp",
   accent: "#fbbf24",
   owner: "claude"
};
