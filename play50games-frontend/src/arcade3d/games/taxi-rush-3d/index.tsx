"use client";

// Taxi Rush 3D. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap the grid, traffic, patience and lighting.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { LEVELS, LEVEL_LINES, type TaxiLevel } from "./levels";
import { FOV, fogFor, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick drives. There is no button.",
   "Stop inside the gold pad, under half a metre a second, for half a second.",
   "Red lights and a hard hit cost a life. Three lives. Patience is the fare meter.",
];

function stats(level: TaxiLevel): GameDefinition["hudStats"] {
   return [
      { key: "rides", label: "Rides", max: level.rides },
      { key: "fare", label: "Fare", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 4) return [LINES[0], LINES[1], "Night streets. The light is red or green, and running it costs a life."];
   if (id === 5) return [LINES[0], LINES[1], "Eight fares and eight cars. Patience drops faster."];
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<TaxiLevel> = {
   slug: "taxi-rush-3d",
   Scene,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [0, 18, 22], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: fogFor(LEVELS[1]),
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick"],
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<TaxiLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<TaxiLevel> = {
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
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
