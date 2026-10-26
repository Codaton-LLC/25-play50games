import type { ArcadeGameMeta, LevelMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring and levels match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts)
// and WP includes/arcade-games.json (registry.sync.test.ts). A level clears only on a win (every nectar banked).
import { PROPOSED_LEVEL_LIMITS } from "./rules";

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Flower Garden", scoring: PROPOSED_LEVEL_LIMITS[1] },
   { id: 2, title: "Vegetable Garden", scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: "Greenhouse", scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: "Forest Flowers", scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: "Giant Garden", scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const beeGardenMeta: ArcadeGameMeta = {
   slug: "bee-garden",
   title: "Bee Garden",
   tagline: "Buzz, gather, deliver.",
   description: "Fly a busy bee over the garden, gather nectar from the flowers and bring it home to the hive while dodging spider webs.",
   order: 40,
   status: "dev",
   collection: "skill",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to fly, hold Space to boost",
      touch: "Joystick to fly + hold Boost",
   },
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVELS,
   thumbnail: null,
   accent: "#fbbf24",
   owner: "antigravity",
};
