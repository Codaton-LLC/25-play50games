"use client";

// Wizard Potion Lab. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 add lives, a sliding ingredient and a second recipe.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type WizardLevel } from "./levels";
import { FOV, fogFor, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick moves. E or Use picks up an ingredient. You carry one.",
   "Stand at the cauldron and Use. Only the next step of an open recipe goes in.",
   "Each finished recipe scores. A recipe with no wrong add scores more.",
];

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], LINES[1], "A wrong ingredient stuns you and costs a life."];
   if (id === 3 || id === 4) return [LINES[0], "One ingredient slides along its shelf. The pickup follows it.", LINES[2]];
   if (id === 5) return [LINES[0], "Two recipes are open. The cauldron takes whichever head you are holding.", LINES[2]];
   return LINES;
}

const first = LEVELS[1];
const look = lookAtFor();

const definition: GameDefinition<WizardLevel> = {
   slug: "wizard-potion-lab",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: first.durationMs,
   resultDelayMs: 900,
   camera: { position: [0, 14, 16], fov: FOV, lookAt: look },
   environment: {
      background: first.background,
      fog: fogFor(first),
      lighting: first.lighting,
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Use" },
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<WizardLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<WizardLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: fogFor(level),
            lighting: level.lighting,
         },
      };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.lives = level.lives;
      }
      return spec;
   }),
};

export default definition;
