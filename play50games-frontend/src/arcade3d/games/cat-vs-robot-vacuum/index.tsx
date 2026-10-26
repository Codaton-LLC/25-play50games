"use client";

// Cat vs Robot Vacuum. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap counts, sight and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type CatLevel } from "./levels";
import { FOG_FAR, FOG_NEAR, FOV, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick moves the cat. Collect every treat.",
   "Hop (Space) for a short dodge past a robot vacuum. A hit costs a life.",
   "When every treat is in, curl up on the bed to finish.",
];

function stats(level: CatLevel): GameDefinition["hudStats"] {
   return [{ key: "treats", label: "Treats", max: level.treats }];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "The sofa blocks the vacuum's sight. It can still see you in the open.", LINES[2]];
   if (id === 4) return [LINES[0], LINES[1], "Boxes on the floor block you too."];
   if (id === 5) return [LINES[0], LINES[1], "Three vacuums on one floor. Watch the loops."];
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<CatLevel> = {
   slug: "cat-vs-robot-vacuum",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [0, 14, 12], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: [LEVELS[1].background, FOG_NEAR, FOG_FAR],
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Hop" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<CatLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<CatLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: [level.background, FOG_NEAR, FOG_FAR],
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
