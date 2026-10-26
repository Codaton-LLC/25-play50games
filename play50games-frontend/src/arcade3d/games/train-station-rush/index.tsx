"use client";

// Train Station Rush. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap platforms, tasks, passengers, the timetable, the crowd,
// the clock and the light (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, passengerCount, type StationLevel } from "./levels";
import { FOV, restLook } from "./looks";
import Scene from "./Scene";

const MOVE = "WASD or the stick walks. E, Enter or Use picks up at the entrance and hands over on a boarding pad.";
const BAGS = "Each task shows its platform: colour, shape and number. Carry the bag to that pad while its train is in.";
const PASSENGERS = "A passenger follows you: walk them onto their platform's pad, then Use.";
const SCORE = "+100 a task, +50 with more than half the train's wait left. A train that leaves without its task costs a life.";

function instructionsFor(level: StationLevel): string[] {
   const lines = [MOVE, BAGS];
   if (passengerCount(level) > 0) lines.push(PASSENGERS);
   if (level.parallel > 1) lines.push("Two tasks wait at the entrance at once. One in hand at a time.");
   lines.push(SCORE);
   return lines;
}

const stats = (level: StationLevel): GameDefinition["hudStats"] => [{ key: "delivered", label: "Delivered", max: level.tasks }];

const environmentFor = (level: StationLevel) => ({
   background: level.background,
   fog: [level.background, 26, 60] as [string, number, number],
   lighting: level.lighting,
});

const rest = restLook(false);

const definition: GameDefinition<StationLevel> = {
   slug: "train-station-rush",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: 3,
   resultDelayMs: 900,
   camera: { position: [rest[0], rest[1] + 16, rest[2] + 10], fov: FOV, lookAt: rest },
   environment: environmentFor(LEVELS[1]),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Use" },
   hudStats: stats(LEVELS[1]),
   instructions: instructionsFor(LEVELS[1]),
   levels: LEVEL_IDS.map((id): LevelSpec<StationLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<StationLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: environmentFor(level),
      };
      if (id !== 1) {
         spec.instructions = instructionsFor(level);
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
