"use client";

// Haunted Mansion Keys definition. GameShell owns clock, lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap room counts, clock, armour and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type MansionLevel } from "./levels";
import { FOG_NEAR, FOV, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or joystick to move. Hold E, Enter or Use within 1.2 m to pick keys, open doors, and pull levers.",
   "Each locked door matches a key shape and colour. Find the key before trying its door.",
   "Basement and Grand Escape add patrolling suits of armour. Three lives.",
];

function stats(level: MansionLevel): GameDefinition["hudStats"] {
   return [{ key: "keys", label: "Keys", max: level.keys }];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 3) return [LINES[0], "Pulling a wall lever opens a shortcut door.", LINES[1]];
   if (id === 4) return [LINES[0], "An armour walks the corridor. Avoid touching it.", LINES[2]];
   if (id === 5) return [LINES[0], "Twelve rooms, five keys, and patrolling armour.", LINES[2]];
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<MansionLevel> = {
   slug: "haunted-mansion-keys",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   resultDelayMs: 900,
   camera: { position: [9, 14, 16], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: [LEVELS[1].background, FOG_NEAR, LEVELS[1].fogFar],
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Use" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<MansionLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<MansionLevel> = {
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
      if (level.lives !== undefined) {
         spec.lives = level.lives;
      }
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
