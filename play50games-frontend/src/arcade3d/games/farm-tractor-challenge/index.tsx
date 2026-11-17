"use client";

// Farm Tractor Challenge. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap the yard, the clock and the light (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type FarmLevel } from "./levels";
import { FOV, fogFor, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick drives. Roll slowly into a bale to hitch it.",
   "A fast hit bumps the bale and costs a life. Fences bump above a crawl.",
   "Stop in the barn bay until the load counts.",
];

function stats(level: FarmLevel): GameDefinition["hudStats"] {
   return [{ key: "trips", label: "Trips", max: level.trips }];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "Two bales ride the trailer. The hitch rule is the same.", LINES[2]];
   if (id === 3) return [LINES[0], "Orchard crates hitch like hay. The trees are solid.", LINES[2]];
   if (id === 4) return [LINES[0], "Mud cuts your speed. You get fewer bumps.", LINES[2]];
   if (id === 5) return [LINES[0], "Six trips. Mud and solid trees share the yard.", LINES[2]];
   return LINES;
}

const level = LEVELS[1];

const definition: GameDefinition<FarmLevel> = {
   slug: "farm-tractor-challenge",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: level.durationMs,
   lives: level.lives,
   resultDelayMs: 900,
   camera: { position: [0, 18, -22], fov: FOV, lookAt: lookAtFor(level) },
   environment: {
      background: level.background,
      fog: fogFor(level),
      lighting: level.lighting,
   },
   touchControls: ["joystick"],
   hudStats: stats(level),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<FarmLevel> => {
      const config = LEVELS[id];
      const spec: LevelSpec<FarmLevel> = {
         id,
         description: LEVEL_LINES[id],
         config,
         durationMs: config.durationMs,
         lives: config.lives,
         environment: {
            background: config.background,
            fog: fogFor(config),
            lighting: config.lighting,
         },
      };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.hudStats = stats(config);
      }
      return spec;
   }),
};

export default definition;
