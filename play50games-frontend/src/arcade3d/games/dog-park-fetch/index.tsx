"use client";

// Dog Park Fetch. GameShell owns the clock, pause and the result. There are no lives: a run ends on
// a win (every throw back, all but one), on two timed-out throws (L4-L5), or on the clock.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { LEVELS, LEVEL_LINES, type DogLevel } from "./levels";
import { FOV, lookAtFor } from "./looks";
import Hud from "./Hud";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick runs the dog. Run to the toy and pick it up.",
   "Jump catches a frisbee in the air, low, just before it lands.",
   "Bring each toy back to the blanket. A mower knocks you down.",
];

function stats(level: DogLevel): GameDefinition["hudStats"] {
   return [{ key: "fetched", label: "Fetched", max: level.throws }];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], LINES[1], "A fountain stands in the middle of the lawn. Go round it."];
   if (id === 3) return [LINES[0], LINES[1], LINES[2]];
   if (id === 4) return [LINES[0], LINES[1], "The owner fetches a toy that lies too long. Two of those and the run is over."];
   if (id === 5) return [LINES[0], LINES[1], "Two mowers and a festival crowd. Watch the loops."];
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<DogLevel> = {
   slug: "dog-park-fetch",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   resultDelayMs: 900,
   camera: { position: [0, 14, 12], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: [LEVELS[1].background, 16, 40],
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Jump" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<DogLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<DogLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: [level.background, 16, 40],
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
