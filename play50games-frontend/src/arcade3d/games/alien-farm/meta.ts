import type { ArcadeGameMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold", one proof per level; they equal
// rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and arcade-games.json levels (registry.sync.test.ts).
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 12900,
   minDurationMs: 99000,
   maxDurationMs: 102000,
   base: 200,
   maxPointsPerSec: 250,
   unitLabel: "pts",
   display: "int",
};

export const alienFarmMeta: ArcadeGameMeta = {
   slug: "alien-farm",
   title: "Alien Farm",
   tagline: "Harvest at the brightest pulse.",
   description: "Tend a moonlit alien garden: harvest each glowing crop at its brightest pulse and beam the harvest up to your hovering saucer.",
   order: 20,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move; press E, Enter or Space to harvest at peak glow; enter the beam to deliver",
      touch: "Joystick to move; tap Pick at peak glow; enter the beam to deliver",
   },
   scoring: SCORING_L1,
   levels: [
      { id: 1, title: "Starter Plot", scoring: SCORING_L1, clearScore: 2000 },
      { id: 2, title: "Crystal Farm", scoring: { ...SCORING_L1, maxScore: 20600, minDurationMs: 148000, maxDurationMs: 153000 }, clearScore: 3000 },
      { id: 3, title: "Glow Marsh", scoring: { ...SCORING_L1, maxScore: 26900, minDurationMs: 178000, maxDurationMs: 183000, maxPointsPerSec: 260 }, clearScore: 3500 },
      { id: 4, title: "Meteor Field", scoring: { ...SCORING_L1, maxScore: 22100, minDurationMs: 178000, maxDurationMs: 183000, maxPointsPerSec: 260 }, clearScore: 1600 },
      { id: 5, title: "Grand Alien Harvest", scoring: { ...SCORING_L1, maxScore: 30500, minDurationMs: 208000, maxDurationMs: 213000, maxPointsPerSec: 260 } },
   ],
   thumbnail: "/images/3d/alien-farm.webp",
   accent: "#4ade80",
   owner: "codex",
};
