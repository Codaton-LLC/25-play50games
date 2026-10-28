import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Level 1 is the live game (do not change its numbers). Levels 2–5 equal rules.ts
// PROPOSED_LEVEL_LIMITS; Claude copies them into arcade-games.json at merge.

/** Level 1 = today's live game. These limits are already on the server. */
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 1700,
   minDurationMs: 57000,
   maxDurationMs: 63000,
   base: 0,
   maxPointsPerSec: 29,
   unitLabel: "pts",
   display: "int",
};

// A level clears by reaching clearScore at the clock (this game never wins). Level 5 unlocks nothing.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training Depot", scoring: SCORING, clearScore: 600 },
   { id: 2, title: "Blue/Red Zones", scoring: { ...SCORING, maxScore: 2150, minDurationMs: 71250, maxDurationMs: 78750 }, clearScore: 700 },
   { id: 3, title: "Multi-Aisle Warehouse", scoring: { ...SCORING, maxScore: 2550, minDurationMs: 85500, maxDurationMs: 94500 }, clearScore: 850 },
   { id: 4, title: "Rush Shift", scoring: { ...SCORING, maxScore: 2950, minDurationMs: 99750, maxDurationMs: 110250 }, clearScore: 950 },
   { id: 5, title: "Night Logistics", scoring: { ...SCORING, maxScore: 3400, minDurationMs: 114000, maxDurationMs: 126000 } },
];

export const warehouseRushMeta: ArcadeGameMeta = {
   slug: "warehouse-rush",
   title: "Warehouse Rush",
   tagline: "Right box, right zone, 60 seconds.",
   description: "Pick up coloured boxes and deliver them to the matching zone within 60 seconds. The wrong zone costs points, so sort carefully.",
   order: 6,
   status: "live",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD to move, E / Space to pick up and drop",
      touch: "Joystick + Action button",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/warehouse-rush.webp",
   accent: "#fb923c",
   owner: "claude",
};
