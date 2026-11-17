"use client";

// Mars Rover Mission. GameShell owns the clock, lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap the mission, the plain, the hazards and the look (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import MarsHud from "./Hud";
import { LEVELS, LEVEL_LINES, MISSION_WORDS, type MarsLevel } from "./levels";
import { FOV, fogFor } from "./looks";
import Scene from "./Scene";
import { RESULT_DELAY_MS } from "./resultDelay";
import { LIVES } from "./rules";


const DRIVE = "Drive with W A S D / arrows or the joystick: left turns left, the camera follows behind. 📷 or C changes the view.";

/** The action line: what to do at a site, and the dead-centre bonus. */
function actionLine(level: MarsLevel): string {
   if (level.mission === "crystal") return "Follow the teal light. Stop inside the ring: the rover drills by itself (1 s). Dead centre = +60.";
   if (level.mission === "panel") return "Follow the blue light. Stop inside the ring by a broken panel: the rover repairs it (1 s). Dead centre = +60.";
   return "Follow the light. Stop inside the ring by the beacon: the rover scans it (1 s). Dead centre = +60.";
}

/** The hazard line per level. */
const HAZARDS: Record<LevelId, string> = {
   1: "Then park on the blue pad by the lander. Watch the battery: green pads recharge it.",
   2: "Rocks everywhere: hitting one faster than 3 m/s costs a life. Green pads recharge the battery.",
   3: "Sliding rocks roll down the dust chutes from the cliff: wait for them to pass.",
   4: "The dust storm closes in as time runs out. Crevasses: a fall costs a life.",
   5: "Night: your headlights are on. Sliding rocks, crevasses, and a hungry battery.",
};

function stats(level: MarsLevel): GameDefinition["hudStats"] {
   return [
      { key: "samples", label: MISSION_WORDS[level.mission].chip, max: level.sites },
      { key: "battery", label: "Battery", max: 100 },
   ];
}

function instructionsFor(id: LevelId): string[] {
   return [actionLine(LEVELS[id]), HAZARDS[id], DRIVE];
}

const definition: GameDefinition<MarsLevel> = {
   slug: "mars-rover-mission",
   Scene,
   Hud: MarsHud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: LIVES,
   resultDelayMs: RESULT_DELAY_MS,
   camera: { position: [0, 6, 20], fov: FOV, lookAt: [0, 0, 10] },
   environment: {
      background: LEVELS[1].background,
      fog: fogFor(LEVELS[1], 1),
      lighting: LEVELS[1].lighting,
   },
   touchControls: ["joystick"],
   hudStats: stats(LEVELS[1]),
   instructions: instructionsFor(1),
   levels: LEVEL_IDS.map((id): LevelSpec<MarsLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<MarsLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: level,
         durationMs: level.durationMs,
         environment: {
            background: level.background,
            fog: fogFor(level, id),
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
