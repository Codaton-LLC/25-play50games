"use client";

// Beach Lifeguard. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap width, swim depth, alerts, clock, jet ski and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { LEVELS, LEVEL_LINES, type BeachLevel } from "./levels";
import { FOV } from "./looks";
import { LIVES } from "./rules";
import Scene from "./Scene";

const LINES = [
   "WASD, the arrows or the stick move. You wade slower in the water.",
   "Reach the swimmer in the pink ring and press E, Enter or Grab, then carry them back up the beach.",
   "A rescue counts on the dry sand past the white line. Three missed alerts end the run.",
];

function instructionsFor(id: LevelId): string[] {
   if (id >= 4) return [LINES[0], "Grab next to the jet ski to ride it: fast on the water, it stops at the shore.", LINES[1], LINES[2]];
   return LINES;
}

function stats(level: BeachLevel): GameDefinition["hudStats"] {
   return [
      { key: "saved", label: "Saved", max: level.rescues },
      { key: "alert", label: "Alert", max: 100 },
   ];
}

const environmentFor = (level: BeachLevel, id: LevelId) => ({
   background: level.background,
   fog: [level.background, id === 5 ? 12 : 22, level.fogFar] as [string, number, number],
   lighting: level.lighting,
});

const definition: GameDefinition<BeachLevel> = {
   slug: "beach-lifeguard",
   Scene,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: LIVES,
   resultDelayMs: 900,
   camera: { position: [0, 14, 18], fov: FOV, lookAt: [0, 0, 4] },
   environment: environmentFor(LEVELS[1], 1),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Grab" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<BeachLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<BeachLevel> = { id, description: LEVEL_LINES[id], config: level, durationMs: level.durationMs, environment: environmentFor(level, id) };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
