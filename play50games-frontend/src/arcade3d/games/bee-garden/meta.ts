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
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Fly", main: true, role: "move" },
         { id: "boost", keys: ["Space"], label: "Boost", hold: true, main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Fly" },
         { id: "boost", control: "jump", label: "Boost", hold: true },
      ],
      steps: [
         { title: "Goal", text: "Collect nectar from the flowers and bank it at the hive." },
         {
            title: "Fly",
            text: "Use WASD or the arrow keys to fly.",
            touchText: "Push the joystick to fly.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Boost",
            text: "Hold Space to fly faster while your stamina lasts.",
            touchText: "Hold Boost to fly faster while your stamina lasts.",
            keys: ["boost"],
            touch: ["boost"],
         },
         {
            title: "Bank it",
            text: "Carry up to three nectar, then fly over the hive pad. A full load of three pays a bonus.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Tips",
            text: "Spider webs stun you and drop your carry: fly round them. Time left pays at the end. Esc or P pauses.",
            touchText: "Spider webs stun you and drop your carry: fly round them. Time left pays at the end. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVELS,
   thumbnail: "/images/3d/bee-garden.webp",
   accent: "#fbbf24",
   owner: "antigravity",
};
