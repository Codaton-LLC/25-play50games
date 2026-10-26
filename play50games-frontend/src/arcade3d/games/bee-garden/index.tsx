"use client";

// Bee Garden. GameShell owns the clock (durationMs per level), pause and the result.
// Level 1 is the definition; levels 2-5 swap counts, size, clock, breeze and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { LEVEL_DESCRIPTIONS, LEVELS, type BeeLevel } from "./levels";
import { FOV, LEVEL_LOOKS } from "./looks";
import Scene from "./Scene";
import { TUNING } from "./rules";

const LINES = [
   "Fly with WASD, the arrows or the stick. Hold Space or Boost to fly faster while stamina lasts.",
   "Fly into the nectar on the flowers: carry up to three, then fly over the hive pad to bank them.",
   "A full load of three pays a bonus, and time left pays at the end.",
];

function instructionsFor(id: LevelId): string[] {
   if (id === 1) return LINES;
   if (id === 5) return [LINES[0], LINES[1], "A breeze pushes you east. A spider web stuns you and drops your carry back on its flowers."];
   return [LINES[0], LINES[1], "A spider web stuns you and drops your carry back on its flowers."];
}

const environmentFor = (id: LevelId) => {
   const look = LEVEL_LOOKS[id];
   return { background: look.background, fog: [look.fogColor, look.fogNear, look.fogFar] as [string, number, number], lighting: look.lighting };
};

const definition: GameDefinition<BeeLevel> = {
   slug: "bee-garden",
   Scene,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   resultDelayMs: TUNING.resultDelayMs,
   camera: { position: [0, 12, 9], fov: FOV, lookAt: [0, 0, 0] },
   environment: environmentFor(1),
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Boost" },
   hudStats: [
      { key: "nectar", label: "Nectar", max: TUNING.carryCap },
      { key: "stamina", label: "Stamina", max: 100 },
   ],
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<BeeLevel> => {
      const spec: LevelSpec<BeeLevel> = {
         id,
         description: LEVEL_DESCRIPTIONS[id],
         config: LEVELS[id],
         durationMs: LEVELS[id].durationMs,
         environment: environmentFor(id),
      };
      if (id !== 1) spec.instructions = instructionsFor(id);
      return spec;
   }),
};

export default definition;
