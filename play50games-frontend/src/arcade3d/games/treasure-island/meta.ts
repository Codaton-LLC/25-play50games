import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold" (rules.test.ts checks them).
// Level 1's scoring is today's window. Levels 2–5 are proven in README "Levels" (levels.test.ts).

/** Today's window. Level 1 and level 2 (same route, the tide starts after the earliest win). */
const SCORING_L1 = {
   kind: "points",
   maxScore: 2060,
   minDurationMs: 8500,
   maxDurationMs: 92000,
   base: 1250,
   maxPointsPerSec: 100,
   unitLabel: "pts",
   display: "int",
} as const;

/** Six treasures, route band floor 40 m (levels 3 and 4). */
const SCORING_SIX = {
   kind: "points",
   maxScore: 2300,
   minDurationMs: 9100,
   maxDurationMs: 92000,
   base: 1500,
   maxPointsPerSec: 100,
   unitLabel: "pts",
   display: "int",
} as const;

/** Six treasures on the wide island, route band floor 37 m (level 5). */
const SCORING_PEAK = {
   kind: "points",
   maxScore: 2300,
   minDurationMs: 8500,
   maxDurationMs: 92000,
   base: 1500,
   maxPointsPerSec: 100,
   unitLabel: "pts",
   display: "int",
} as const;

export const treasureIslandMeta: ArcadeGameMeta = {
   slug: "treasure-island",
   title: "Treasure Island",
   tagline: "Follow the detector, dig up the treasure.",
   description: "Explore a tiny tropical island with a buzzing treasure detector and dig up five buried treasures before the tide comes in.",
   order: 11,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, hold E, Enter or Space to dig",
      touch: "Joystick to move, hold Dig to dig",
   },
   scoring: SCORING_L1,
   levels: [
      { id: 1, title: "Starter Beach", scoring: SCORING_L1, clearScore: 1250 },
      { id: 2, title: "Palm Grove", scoring: SCORING_L1, clearScore: 1250 },
      { id: 3, title: "Rocky Cove", scoring: SCORING_SIX, clearScore: 1500 },
      { id: 4, title: "Jungle Interior", scoring: SCORING_SIX, clearScore: 1500 },
      { id: 5, title: "Pirate Peak", scoring: SCORING_PEAK, clearScore: 1500 },
   ],
   thumbnail: "/images/3d/treasure-island.webp",
   accent: "#2dd4bf",
   owner: "claude",
};
