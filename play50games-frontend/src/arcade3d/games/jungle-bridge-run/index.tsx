"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type JungleLevel } from "./levels";
import { CAMERA_OFFSET, FOV, fogConfigFor } from "./looks";
import Scene from "./Scene";

const INSTRUCTIONS = [
   "Swipe or use A / D / arrows to switch lanes (0.18 s per lane).",
   "Space or swipe up to jump (0.55 s). S or swipe down to slide (0.60 s).",
   "Jump gaps and logs, slide under vines, avoid pillars and lava vents. Collect gems!",
];

function stats(level: JungleLevel): GameDefinition["hudStats"] {
   return [
      { key: "section", label: "Section", max: level.sections },
      { key: "gems", label: "Gems", max: level.sections * level.gemsPerSection },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [INSTRUCTIONS[0], "Rope bridges ahead: only one lane has wooden planks for 8 metres.", INSTRUCTIONS[1]];
   if (id === 3) return [INSTRUCTIONS[0], "Logs roll across the path. Hop them or switch lanes.", INSTRUCTIONS[1]];
   if (id === 4) return [INSTRUCTIONS[0], "Faster pace and closer obstacles through the ancient temple.", INSTRUCTIONS[1]];
   if (id === 5) return [INSTRUCTIONS[0], "Twelve sections with lava vents that erupt periodically.", INSTRUCTIONS[1]];
   return INSTRUCTIONS;
}

const definition: GameDefinition<JungleLevel> = {
   slug: "jungle-bridge-run",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 800,
   camera: { position: CAMERA_OFFSET, fov: FOV, lookAt: [0, 0, 0] },
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
