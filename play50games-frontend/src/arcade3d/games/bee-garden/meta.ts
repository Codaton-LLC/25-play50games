import type { ArcadeCollection, ArcadeGameMeta, ArcadeSlug, LevelMeta } from "@/arcade3d/types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

const SCORING_L1 = PROPOSED_LEVEL_LIMITS[1];

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Flower Garden", scoring: PROPOSED_LEVEL_LIMITS[1] },
   { id: 2, title: "Vegetable Garden", scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: "Greenhouse", scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: "Forest Flowers", scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: "Giant Garden", scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const beeGardenMeta: ArcadeGameMeta = {
   slug: "bee-garden" as ArcadeSlug,
   title: "Bee Garden",
   tagline: "Fly through the garden, gather nectar, and fill the hive.",
   description: "Fly as a busy bee across vibrant garden beds: sip sweet nectar from flowers, carry up to 3 drops, dodge sticky spider webs and return to the hive before time runs out.",
   order: 40,
   status: "dev",
   collection: "adventure" as ArcadeCollection,
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to fly, Space to boost",
      touch: "Joystick to fly, Boost to fly faster",
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/bee-garden.webp",
   accent: "#fbbf24",
   owner: "antigravity",
};
