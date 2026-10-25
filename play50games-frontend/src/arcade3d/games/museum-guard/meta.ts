import type { ArcadeGameMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits: README "Server limits and why they hold" and the rules.test.ts bots.
// Level 1 scoring is today's limits. Levels 2-5 equal rules.ts PROPOSED_LEVEL_LIMITS;
// Claude copies those into arcade-games.json at merge.
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 2050,
   minDurationMs: 12000,
   maxDurationMs: 92000,
   base: 0,
   maxPointsPerSec: 25,
   unitLabel: "pts",
   display: "int",
};

export const museumGuardMeta: ArcadeGameMeta = {
   slug: "museum-guard",
   title: "Museum Guard",
   tagline: "Statues only move when you look away.",
   description: "You are the night guard of a toy museum whose statues sneak off their pedestals whenever your flashlight looks away.",
   order: 12,
   status: "live",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "look",
      keyboard: "Move the mouse left or right, or hold A / D or the arrows, to turn; Space or E flashes",
      touch: "Drag to turn, Flash to burst",
   },
   scoring: SCORING,
   // a level clears on a win (an alarm left at dawn); no clearScore
   levels: [
      { id: 1, title: "Main Hall", scoring: SCORING },
      { id: 2, title: "Ancient Wing", scoring: { ...SCORING, maxScore: 2290, maxDurationMs: 107000 } },
      { id: 3, title: "Art Wing", scoring: { ...SCORING, maxScore: 2520, maxDurationMs: 122000 } },
      { id: 4, title: "Science Wing", scoring: { ...SCORING, maxScore: 2630, maxDurationMs: 122000 } },
      { id: 5, title: "Full Museum Night", scoring: { ...SCORING, maxScore: 2870, minDurationMs: 11000, maxDurationMs: 137000 } },
   ],
   thumbnail: "/images/3d/museum-guard.webp",
   accent: "#c4b5fd",
   owner: "cursor",
};
