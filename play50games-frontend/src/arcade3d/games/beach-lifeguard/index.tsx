"use client";

// Beach Lifeguard. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap counts, clock and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type BeachLevel } from "./levels";
import { FOV, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the joystick moves. Reach the swimmer in trouble and press Grab (E/Enter).",
   "Walk them back to dry sand (z \u2265 2). One rescue at a time.",
   "Three expired alerts lose the run. Water slows your stride.",
];

function stats(level: BeachLevel): GameDefinition["hudStats"] {
   return [
      { key: "saved", label: "Saved", max: level.rescues },
      { key: "alert", label: "Alert", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id >= 4) {
      return [
         LINES[0],
         LINES[1],
         "Mount the rescue jet ski in the water for high-speed crossings. Touching sand dismounts.",
      ];
   }
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<BeachLevel> = {
   slug: "beach-lifeguard",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [0, 14, 18], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: [LEVELS[1].background, 15, LEVELS[1].fogFar],
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Grab" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<BeachLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<BeachLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: [level.background, id === 5 ? 10 : 15, level.fogFar],
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
