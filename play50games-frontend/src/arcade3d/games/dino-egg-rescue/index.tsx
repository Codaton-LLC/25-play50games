"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import DinoHud from "./Hud";
import { LEVELS, type DinoLevel } from "./levels";
import { COLORS, FOG } from "./looks";
import { DURATION_MS, RESULT_DELAY_MS, regularSupply } from "./rules";
import Scene from "./Scene";

const BASE_INSTRUCTIONS = [
   "Gather runaway eggs and carry them back to your nest in the South-East.",
   "Each carried egg slows you down; dodge boulders and sticky mud pits!",
   "WASD / Joystick to waddle, Space / E / tap Dash to dash.",
];

function instructionsFor(level: DinoLevel): string[] {
   const extra =
      level.maxStack > 3
         ? "You can carry four eggs. The fourth one slows you the most."
         : level.unlocks[2] === 0
           ? "All four boulder lanes roll early. Golden eggs come sooner."
           : level.mudPatches > 3
             ? "More mud pits, and the boulders roll faster."
             : "Boulder lanes open sooner, and the rocks come in faster.";
   return [...BASE_INSTRUCTIONS, extra];
}

/** one line under the level tiles */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "90 seconds in the valley. Carry eggs home and dodge the boulders.",
   2: "Lanes open sooner and boulders come faster. 120 seconds.",
   3: "Five mud pits and faster boulders. 120 seconds.",
   4: "All four lanes roll early, and golden eggs come sooner. 120 seconds.",
   5: "More eggs, and you can carry four. 120 seconds.",
};

const savedMax = (level: DinoLevel) => regularSupply(level) + level.goldenSpawnTimes.length;

const definition: GameDefinition<DinoLevel> = {
   slug: "dino-egg-rescue",
   Scene,
   Hud: DinoHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   resultDelayMs: RESULT_DELAY_MS,
   camera: { position: [0, 16, 13.4], fov: FOV, lookAt: [0, 0, 0] },
   environment: {
      background: COLORS.skyBottom,
      lighting: "sunset",
      fog: [COLORS.fog, FOG.near, FOG.far],
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dash" },
   hudStats: [{ key: "eggs", label: "Eggs Saved" }],
   instructions: BASE_INSTRUCTIONS,
   levels: LEVEL_IDS.map((id): LevelSpec<DinoLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         durationMs: level.durationMs,
         instructions: instructionsFor(level),
         hudStats: [{ key: "eggs", label: "Eggs Saved", max: savedMax(level) }],
      };
   }),
};

export default definition;
