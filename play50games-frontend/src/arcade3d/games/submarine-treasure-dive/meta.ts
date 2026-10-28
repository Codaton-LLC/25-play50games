import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS. A level clears only on a win.
const SCORING: ScoringRules = PROPOSED_LEVEL_LIMITS[1];

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: LEVEL_TITLES[3], scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: LEVEL_TITLES[4], scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: LEVEL_TITLES[5], scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const submarineTreasureDiveMeta: ArcadeGameMeta = {
   slug: "submarine-treasure-dive",
   title: "Submarine Treasure Dive",
   tagline: "Follow the sonar. Mind the battery.",
   description: "Pilot a mini submarine through the reef, dive to the treasure on the sea floor and get back to base before the battery runs out.",
   order: 42,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to steer, hold E or Enter to dive",
      touch: "Joystick to steer + hold Dive",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Steer", main: true, role: "move" },
         { id: "dive", keys: ["E", "Enter"], label: "Dive", hold: true, main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Steer" },
         { id: "dive", control: "action", label: "Dive", hold: true },
      ],
      steps: [
         { title: "Goal", text: "Find every treasure on the sea floor, then land on the dock before the battery dies." },
         {
            title: "Steer",
            text: "Use WASD or the arrow keys to steer the sub.",
            touchText: "Push the joystick to steer the sub.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Dive",
            text: "Hold E or Enter to sink, let go to rise. Scoop a treasure only on the sea floor.",
            touchText: "Hold Dive to sink, let go to rise. Scoop a treasure only on the sea floor.",
            keys: ["dive"],
            touch: ["dive"],
         },
         { title: "Watch out", text: "Coral heads are solid. Jellyfish cost battery." },
         {
            title: "Tips",
            text: "Follow the ping to the next treasure. Esc or P pauses.",
            touchText: "Follow the ping to the next treasure. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/submarine-treasure-dive.webp",
   accent: "#22d3ee",
   owner: "cursor",
};
