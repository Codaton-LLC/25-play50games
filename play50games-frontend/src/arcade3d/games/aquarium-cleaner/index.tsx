"use client";

// Aquarium Cleaner. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap the tank, the counts, the drain and the light (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, tasksOf, type AquariumLevel } from "./levels";
import { FOV, fog, lookAtFor } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick walks. Hold Work for 1 second at an algae patch, 1.5 seconds at a filter.",
   "Walk over the trash and drop it in the basket. Your air runs down: refill it in the bubble column.",
   "Float lifts you for a moment. Finish the list, then stand on the hatch. Three lives.",
];

function stats(level: AquariumLevel): GameDefinition["hudStats"] {
   return [
      { key: "tasks", label: "Tasks", max: tasksOf(level) },
      { key: "air", label: "Air", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [LINES[0], "A high patch only scrubs while you float above it: hold Work and tap Float.", LINES[1]];
   if (id === 3) return [LINES[0], LINES[1], "A shark patrols the middle. A bite costs 30 air. A 2 m lane along the glass stays clear."];
   if (id === 5) return [LINES[0], LINES[1], "A current pushes you to the right. Two sharks. Eight tasks."];
   return LINES;
}

const look = lookAtFor(LEVELS[1]);

const definition: GameDefinition<AquariumLevel> = {
   slug: "aquarium-cleaner",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [0, 12, 12], fov: FOV, lookAt: look },
   environment: {
      background: LEVELS[1].background,
      fog: fog(LEVELS[1]),
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick", "action", "jump"],
   touchLabels: { action: "Work", jump: "Float" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<AquariumLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<AquariumLevel> = {
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
