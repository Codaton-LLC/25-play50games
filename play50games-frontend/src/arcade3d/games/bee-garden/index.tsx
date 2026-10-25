"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type ArcadeSlug, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVEL_DESCRIPTIONS, LEVELS, type BeeLevel } from "./levels";
import { LEVEL_LOOKS } from "./looks";
import { TUNING } from "./rules";

export const KEYBOARD_INSTRUCTIONS = [
   "Fly with WASD or arrows; hold Space to boost flight speed.",
   "Collect nectar from blooming flowers (carry up to 3 drops) and return to the hive.",
   "Avoid sticky spider webs: hitting a web drops carried nectar back onto the flowers.",
];

export const TOUCH_INSTRUCTIONS = [
   "Use the joystick to fly; hold Boost to fly faster.",
   "Collect nectar from blooming flowers (carry up to 3 drops) and return to the hive.",
   "Avoid sticky spider webs: hitting a web drops carried nectar back onto the flowers.",
];

const environmentFor = (id: LevelId) => {
   const look = LEVEL_LOOKS[id] ?? LEVEL_LOOKS[1];
   return {
      background: look.background,
      fog: [look.fogColor, look.fogNear, look.fogFar] as [string, number, number],
      lighting: look.lighting,
   };
};

const coarse = () =>
   typeof window !== "undefined" &&
   typeof window.matchMedia === "function" &&
   window.matchMedia("(pointer: coarse)").matches;

const definition: GameDefinition<BeeLevel> = {
   slug: "bee-garden" as ArcadeSlug,
   Scene,
   Hud,
   assets: ASSETS,
   camera: {
      position: [0, 18, 14],
      fov: 45,
      lookAt: [0, 0, 0],
   },
   environment: environmentFor(1),
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: LEVEL_DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: environmentFor(id),
   })),
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Boost" },
   hudStats: [
      { key: "nectar", label: "Nectar", max: 3 },
      { key: "stamina", label: "Stamina", max: 100 },
   ],
   resultDelayMs: TUNING.resultDelayMs,
   get instructions() {
      return coarse() ? TOUCH_INSTRUCTIONS : KEYBOARD_INSTRUCTIONS;
   },
};

export default definition;
