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
   tagline: "Drill. Scan. Bring it home.",
   description: "One mission per level on the red planet: drill crystals, scan beacons, repair solar panels, then drive back to the lander before the battery or the clock runs out.",
   order: 43,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "W / up drives, S / down brakes and reverses, A D / arrows steer (the camera follows behind). 📷 or C changes the view",
      touch: "Joystick: push up to drive, left or right to turn",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#f97316",
   owner: "antigravity",
};
