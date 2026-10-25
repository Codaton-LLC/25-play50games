"use client";

// Firefighter Rescue. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap counts, clock and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type ArcadeSlug, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type FireLevel } from "./levels";
import { FOV, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick moves. Hold Spray on a fire for 0.75 seconds.",
   "Hold Spray on a neighbour for 0.30 seconds, then walk them to the exit. One at a time.",
   "Space or Hop clears debris. Smoke slows you and spends breath. Three lives.",
];

function stats(level: FireLevel): GameDefinition["hudStats"] {
   return [
      { key: "fires", label: "Fires", max: level.fires },
      { key: "saved", label: "Saved", max: level.civilians },
      { key: "breath", label: "Breath", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "A doorway with a fire in it stays shut until that fire is out.", LINES[1]];
   if (id === 4) return [LINES[0], LINES[1], "Debris crosses the hall. Hop it. A hit costs a life and stuns you."];
   if (id === 5) return [LINES[0], LINES[1], "Thick smoke. Two debris paths. Ten fires, five neighbours."];
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<FireLevel> = {
   slug: "firefighter-rescue" as ArcadeSlug,
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [0, 16, 18], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: [LEVELS[1].background, 14, 36],
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "action", "jump"],
   touchLabels: { action: "Spray", jump: "Hop" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<FireLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<FireLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: [level.background, 14, 36],
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
