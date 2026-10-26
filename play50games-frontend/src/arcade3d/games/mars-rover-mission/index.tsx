"use client";

// Mars Rover Mission. GameShell owns the clock, lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap arena dimensions, sites, and hazards (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { LEVELS, LEVEL_LINES, type MarsLevel } from "./levels";
import { FOV, fogFor } from "./looks";
import Scene from "./Scene";
import { LIVES } from "./rules";

const LINES = [
   "W / up drives, S / down brakes and reverses, A D / left right steer (or the joystick).",
   "Stop inside each beacon ring for 1 s to scan a sample: dead centre pays a bonus.",
   "Stop on a green charger pad to recharge. Scan every site, then park on the base pad to win.",
];

function stats(level: MarsLevel): GameDefinition["hudStats"] {
   return [
      { key: "samples", label: "Samples", max: level.sites },
      { key: "battery", label: "Battery", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "Rocks everywhere: hitting one faster than 3 m/s costs a life.", LINES[1]];
   if (id === 3) return [LINES[0], "Boulders roll down the canyon lanes. Steer clear to save lives.", LINES[2]];
   if (id === 4) return [LINES[0], "Dense dust storm: visibility is low. Follow beacon markers on screen.", LINES[2]];
   if (id === 5) return [LINES[0], "Seven ancient sites under starlight. Monitor battery levels carefully.", LINES[2]];
   return LINES;
}


const definition: GameDefinition<MarsLevel> = {
   slug: "mars-rover-mission",
   Scene,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: LIVES,
   resultDelayMs: 900,
   camera: { position: [0, 14, 13], fov: FOV, lookAt: [0, 0, 0] },
   environment: {
      background: LEVELS[1].background,
      fog: fogFor(LEVELS[1], 1),
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick"],
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<MarsLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<MarsLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: fogFor(level, id),
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
