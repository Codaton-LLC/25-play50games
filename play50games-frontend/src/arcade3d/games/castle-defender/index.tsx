"use client";

import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, LEVEL_DESCRIPTIONS, type CastleLevel } from "./levels";
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { CAMERA } from "./camera";
import { COLORS, FOG, LEVEL_LOOKS } from "./looks";
import { TUNING } from "./rules";

export const KEYBOARD_INSTRUCTIONS = [
   "Click the field or aim with arrows / WASD and Space to fire. Hit shields from behind.",
   "E / Enter or Rock clears an erected ladder. Rock reloads in 8 seconds.",
   "Choose upgrades with 1 / 2 or tap a card; hold the gate through five waves.",
];
export const TOUCH_INSTRUCTIONS = [
   "Tap the field to fire; the shot snaps to the nearest goblin. Hit shields from behind.",
   "Tap Rock to clear an erected ladder. Rock reloads in 8 seconds.",
   "Tap an upgrade card between waves; hold the gate through five waves.",
];
const coarse = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

const definition: GameDefinition<CastleLevel> = {
   slug: "castle-defender",
   Scene,
   Hud,
   assets: ASSETS,
   camera: CAMERA,
   environment: { background: COLORS.sky, fog: [COLORS.fog, FOG.near, FOG.far], lighting: "sunset" },
   levels: LEVEL_IDS.map((id) => ({
      id, config: LEVELS[id], description: LEVEL_DESCRIPTIONS[id],
      environment: { lighting: LEVEL_LOOKS[id].lighting, background: LEVEL_LOOKS[id].bottom, fog: [LEVEL_LOOKS[id].bottom, FOG.near, FOG.far] as [string, number, number] },
      ...(id > 1 ? { instructions: [
         "Click / tap the field or aim with arrows / WASD and Space. Hit shields from behind.",
         "E / Enter or Rock clears an erected ladder; the cooldown is 8 seconds on every device.",
         LEVEL_DESCRIPTIONS[id],
      ] } : {}),
   })),
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
