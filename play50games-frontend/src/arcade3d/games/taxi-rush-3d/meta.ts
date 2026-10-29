import { LEVEL_IDS, type ArcadeGameMeta, type LevelMeta } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data (server-safe; rules.ts imports no three.js or React). scoring and levels are
// PROPOSED_LEVEL_LIMITS (README proof) and equal arcade-games.json (registry.sync.test.ts).
// A level clears only on a win (every fare dropped off).
const LEVELS: readonly LevelMeta[] = LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: PROPOSED_LEVEL_LIMITS[id] }));

export const taxiRush3dMeta: ArcadeGameMeta = {
   slug: "taxi-rush-3d",
   title: "Taxi Rush 3D",
   tagline: "Stop for the fare. Stop for the drop.",
   description: "Drive a cab on a small street grid. Stop in the gold pad to pick up, then stop in the destination pad to drop off.",
   order: 32,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "WASD / arrows drive. Stop in a pad to pick up or drop off",
      touch: "Joystick drives. Stop in a pad to pick up or drop off",
   },
   howTo: {
      keys: [{ id: "drive", keys: ["WASD", "Arrows"], label: "Drive", main: true, role: "move" }],
      touch: [{ id: "joystick", control: "joystick", label: "Drive" }],
      steps: [
         { title: "Goal", text: "Pick up each fare in the gold pad, then drop them off in their destination pad." },
         {
            title: "Drive",
            text: "Use WASD or the arrow keys to drive. There is no other button.",
            touchText: "Push the joystick to drive. There is no other button.",
            keys: ["drive"],
            touch: ["joystick"],
         },
         {
            title: "Stop in the pad",
            text: "Roll into the pad and come almost to a stop for half a second: the fare gets in or out.",
            keys: ["drive"],
            touch: ["joystick"],
         },
         { title: "Watch out", text: "Red lights and hard hits cost a life. Three lives, and the fare's patience runs down." },
         {
            title: "Tips",
            text: "Brake early: ease off before the pad. Esc or P pauses the run.",
            touchText: "Brake early: ease off before the pad. Tap Pause, top right, any time.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVELS,
   thumbnail: "/images/3d/taxi-rush-3d.webp",
   accent: "#facc15",
   owner: "cursor",
};
