"use client";

// Toy Store Night Shift. GameShell owns the clock, pause and the result (no lives).
// Level 1 is the definition; levels 2-5 swap the store, the toys, the carry cap, the wind-ups and
// the light (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type ToyLevel } from "./levels";
import { FOV, fog, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick walks. Press Use next to a toy to pick it up.",
   "Read the shelf signs: the colour, the shape and the toy picture say which toys go there. Press Use at the matching shelf.",
   "A wrong shelf drops the toy back and stuns you for half a second.",
];

function stats(level: ToyLevel): GameDefinition["hudStats"] {
   return [
      { key: "shelved", label: "Shelved", max: level.toys },
      { key: "carrying", label: "Carrying", max: level.carry },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], LINES[1], "A wind-up robot rolls the aisles. A hit knocks the toy out of your hands."];
   if (id === 3) return [LINES[0], "Two shelves take each kind: either one is right.", "Wind-ups patrol the aisles in the dark. Your torch lights the floor ahead."];
   if (id === 4) return [LINES[0], "You can carry two toys. Use drops the top one: a wrong top toy blocks the one under it.", "Three wind-ups patrol the aisles."];
   if (id === 5) return [LINES[0], "Carry two. Seven kinds, eighteen toys, four wind-ups. Only your torch and the emergency strips are lit.", LINES[2]];
   return LINES;
}

const look = lookAtFor();

const definition: GameDefinition<ToyLevel> = {
   slug: "toy-store-night-shift",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   resultDelayMs: 900,
   camera: { position: [0, 12, 8], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: fog(LEVELS[1]),
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Use" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<ToyLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<ToyLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: fog(level),
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
