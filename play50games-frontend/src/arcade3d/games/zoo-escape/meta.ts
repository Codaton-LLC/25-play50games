import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): the proven ones are PROPOSED_LIMITS in
// rules.ts (README "Server limits and why they hold"); Claude copies them here and into
// arcade-games.json in the go-live PR.
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 4500,
   minDurationMs: 20000,
   maxDurationMs: 200000,
   base: 4500,
   maxPointsPerSec: 4500,
   unitLabel: "pts",
   display: "int",
};

// Levels (README "Levels"): every level is the same escape made harder, so every level serves the
// same provisional block now and the same proven PROPOSED_LEVEL_LIMITS (rules.ts) after go-live.
// A level clears on an escape or at its score target; level 5 has nothing to unlock.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Small Enclosure", scoring: SCORING, clearScore: 1500 },
   { id: 2, title: "Safari Zone", scoring: SCORING, clearScore: 1600 },
   { id: 3, title: "Bird Garden", scoring: SCORING, clearScore: 1700 },
   { id: 4, title: "Central Zoo", scoring: SCORING, clearScore: 1800 },
   { id: 5, title: "Night Escape", scoring: SCORING },
];

export const zooEscapeMeta: ArcadeGameMeta = {
   slug: "zoo-escape",
   title: "Zoo Escape",
   tagline: "Sneak past the keepers.",
   description: "Help a mischievous panda sneak out of the zoo: hide in bushes, slip past the keepers' flashlight gaze and reach the gate.",
   order: 29,
   status: "dev",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, hold Space to sneak, E or Enter to toss bamboo",
      touch: "Joystick to move, hold Sneak to sneak, Toss to throw bamboo",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/zoo-escape.webp",
   accent: "#34d399",
   owner: "claude",
};
