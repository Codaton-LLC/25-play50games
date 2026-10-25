import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). Scoring must match WP includes/arcade-games.json.
const SCORING: ScoringRules = PROPOSED_LEVEL_LIMITS[1];

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: PROPOSED_LEVEL_LIMITS[1] },
   { id: 2, title: LEVEL_TITLES[2], scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: LEVEL_TITLES[3], scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: LEVEL_TITLES[4], scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: LEVEL_TITLES[5], scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const marsRoverMissionMeta: ArcadeGameMeta = {
   slug: "mars-rover-mission",
   title: "Mars Rover Mission",
   tagline: "Scan. Sample. Return.",
   description: "Drive a rover across the red planet, stop at each scan site to take a sample and make it back to base with charge to spare.",
   order: 43,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "WASD / arrows to drive",
      touch: "Joystick to drive",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#f97316",
   owner: "antigravity",
};
