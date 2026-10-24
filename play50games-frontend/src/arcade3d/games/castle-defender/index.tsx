"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { CAMERA } from "./camera";
import { LEVELS, type CastleLevel } from "./levels";
import { FOG, LEVEL_LOOKS } from "./looks";
import { TUNING } from "./rules";

export const KEYBOARD_INSTRUCTIONS = [
   "Click the field or aim with arrows / WASD and Space to fire. Hit shields from behind.",
   "E / Enter or Rock clears an erected ladder. Rock reloads in 8 seconds.",
   "Choose upgrades with 1 / 2 or tap a card; hold the gate through every wave.",
];
export const TOUCH_INSTRUCTIONS = [
   "Tap the field to fire; the shot snaps to the nearest goblin. Hit shields from behind.",
   "Tap Rock to clear an erected ladder. Rock reloads in 8 seconds.",
   "Tap an upgrade card between waves; hold the gate through every wave.",
];
/** one line under the level tiles */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Five waves of walkers, shields, runners and ladder crews.",
   2: "Shields and runners come a wave earlier, and every goblin is faster.",
   3: "Six waves: a second full siege wave at the end.",
   4: "Night: seven faster waves with an extra ladder crew.",
   5: "Eight fast waves with every goblin kind from the second wave.",
};
const environmentFor = (id: LevelId) => {
   const look = LEVEL_LOOKS[id];
   return { background: look.sky, fog: [look.fog, FOG.near, FOG.far] as [string, number, number], lighting: look.lighting };
};
const coarse = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

const definition: GameDefinition<CastleLevel> = {
   slug: "castle-defender",
   Scene,
   Hud,
   assets: ASSETS,
   camera: CAMERA,
   environment: environmentFor(1),
   levels: LEVEL_IDS.map((id) => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: environmentFor(id) })),
   touchControls: ["tap", "action"],
   touchLabels: { action: "Rock" },
   hudStats: [],
   resultDelayMs: TUNING.resultDelayMs,
   // read when the start card renders (client only, GameShell is ssr: false): touch lines on a coarse pointer
   get instructions() {
      return coarse() ? TOUCH_INSTRUCTIONS : KEYBOARD_INSTRUCTIONS;
   },
};

export default definition;
