"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type JungleLevel } from "./levels";
import { CAMERA_OFFSET, FOV, LOOK_AHEAD_Z, fogConfigFor } from "./looks";
import Scene from "./Scene";

const INSTRUCTIONS = [
   "A / D, the arrows or a swipe left / right change lane. Space, W or a swipe up jumps; S or a swipe down slides.",
   "Jump the gaps, take the clear lane past a pillar. Grab the gems.",
   "A fall costs a life and puts you back at the section start. Three lives.",
];

function stats(level: JungleLevel): GameDefinition["hudStats"] {
   return [
      { key: "section", label: "Section", max: level.sections },
      { key: "gems", label: "Gems", max: level.sections * level.gemsPerSection },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [INSTRUCTIONS[0], "On a rope bridge only one lane has planks: be on it. Slide under the vines.", INSTRUCTIONS[2]];
   if (id === 3) return [INSTRUCTIONS[0], "Logs roll across the path: jump them or dodge them.", INSTRUCTIONS[2]];
   if (id === 4) return [INSTRUCTIONS[0], "Faster, and two obstacles in many sections.", INSTRUCTIONS[2]];
   if (id === 5) return [INSTRUCTIONS[0], "Lava vents burn for 1.2 s every 3 s. Twelve sections.", INSTRUCTIONS[2]];
   return INSTRUCTIONS;
}

const definition: GameDefinition<JungleLevel> = {
   slug: "jungle-bridge-run",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [CAMERA_OFFSET[0], CAMERA_OFFSET[1], CAMERA_OFFSET[2] + LOOK_AHEAD_Z], fov: FOV, lookAt: [0, 0, LOOK_AHEAD_Z] },
   environment: {
      background: LEVELS[1].background,
      fog: fogConfigFor(LEVELS[1]),
      lighting: LEVELS[1].lighting,
   },
   touchControls: [],
   hudStats: stats(LEVELS[1]),
   instructions: INSTRUCTIONS,
   levels: LEVEL_IDS.map((id): LevelSpec<JungleLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<JungleLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: fogConfigFor(level),
            lighting: level.lighting,
         },
      };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
