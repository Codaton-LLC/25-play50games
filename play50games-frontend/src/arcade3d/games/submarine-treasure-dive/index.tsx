"use client";

// Submarine Treasure Dive. GameShell owns the clock, pause and the result.
// Level 1 is the definition; levels 2-5 swap theme (look + landmarks), counts, clock and light.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type SubLevel } from "./levels";
import { FOV, fogOf, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick flies the sub. Hold Dive to sink, release to rise.",
   "Scoop a treasure only on the sea floor, then follow the next ping.",
   "With every treasure aboard, land on the dock before the battery dies.",
];

function stats(level: SubLevel): GameDefinition["hudStats"] {
   return [
      { key: "treasure", label: "Treasure", max: level.treasures },
      { key: "battery", label: "Battery", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "Coral heads are solid. Steer around them.", LINES[2]];
   if (id === 3) return [LINES[0], "Jellyfish drift between the wrecks. A touch costs battery.", LINES[2]];
   if (id === 4) return [LINES[0], "The water is dark and a current pushes east.", LINES[2]];
   if (id === 5) return [LINES[0], LINES[1], "Eight treasures. The headlight is your lamp."];
   return LINES;
}

const level = LEVELS[1];
const look = lookAtFor(level);

const definition: GameDefinition<SubLevel> = {
   slug: "submarine-treasure-dive",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: level.durationMs,
   resultDelayMs: 900,
   camera: { position: [0, 12, 14], fov: FOV, lookAt: look },
   environment: {
      background: level.background,
      fog: fogOf(level),
      lighting: level.lighting,
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dive" },
   hudStats: stats(level),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<SubLevel> => {
      const config = LEVELS[id];
      const spec: LevelSpec<SubLevel> = {
         id,
         description: LEVEL_LINES[id],
         config,
         durationMs: config.durationMs,
         environment: {
            background: config.background,
            fog: fogOf(config),
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
