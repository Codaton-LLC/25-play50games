"use client";

// Hotel Bellboy Rush. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap doors, floors, bags, clock and lighting (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type HotelLevel } from "./levels";
import { FOV, restLook } from "./looks";
import Scene from "./Scene";

const LINES = [
   "WASD or the stick walks. E, Enter or Use takes the bag at the desk and tries the door you stand at.",
   "Read the key card: deliver to that room. A wrong door costs a life. Three lives.",
   "+80 a bag, +40 if it is delivered within 15 s, +5 for each second left when the last bag is in.",
];

const ELEVATOR = "The doors show one floor. Stand on the elevator pad and Use: one second later they show the bag's floor.";

function stats(level: HotelLevel): GameDefinition["hudStats"] {
   const out = [{ key: "bags", label: "Bags", max: level.bags }];
   if (level.floors > 1) out.push({ key: "floor", label: "Floor", max: level.floors });
   return out;
}

function instructionsFor(id: LevelId): string[] {
   if (id === 1) return LINES;
   return [LINES[0], ELEVATOR, LINES[1], LINES[2]];
}

const environmentFor = (level: HotelLevel) => ({
   background: level.background,
   fog: [level.background, 16, 38] as [string, number, number],
   lighting: level.lighting,
});

const rest = restLook();

const definition: GameDefinition<HotelLevel> = {
   slug: "hotel-bellboy-rush",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [rest[0] - 9, rest[1] + 9, rest[2]], fov: FOV, lookAt: rest },
   environment: environmentFor(LEVELS[1]),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Use" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<HotelLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<HotelLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: environmentFor(level),
      };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
