"use client";

// Magic Carpet Ride. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap the route, the clock and the light (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type CarpetLevel } from "./levels";
import { FOG_NEAR, FOV } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick steers. Up is up. Hold Boost to fly faster.",
   "Pass through rings and collect the stars between them.",
   "A rock costs a life and drops you back to the path. Three lives.",
];

function stats(level: CarpetLevel): GameDefinition["hudStats"] {
   return [
      { key: "rings", label: "Rings", max: level.ringQuota },
      { key: "stars", label: "Stars", max: level.starQuota },
      { key: "boost", label: "Boost", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "The walls sit outside the window. The rocks do not.", LINES[2]];
   if (id === 3) return [LINES[0], "Clouds only slow you. Some of them drift up and down.", LINES[1]];
   if (id === 4) return [LINES[0], "Lanterns hang beside the lane. The towers drift.", LINES[2]];
   if (id === 5) return [LINES[0], LINES[1], "Twenty-five rings. The palace waits at the arch."];
   return LINES;
}

const definition: GameDefinition<CarpetLevel> = {
   slug: "magic-carpet-ride",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [0, 20, -6], fov: FOV, lookAt: [0, 18, 12] },
   environment: {
      background: LEVELS[1].background,
      fog: [LEVELS[1].background, FOG_NEAR, LEVELS[1].fogFar],
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Boost" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<CarpetLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<CarpetLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: [level.background, FOG_NEAR, level.fogFar],
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
