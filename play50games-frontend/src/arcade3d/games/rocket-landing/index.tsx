"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, type RocketLevel } from "./levels";
import { DURATION_MS } from "./rules";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Five worlds: today's full campaign across Moon, Desert, Ice, Gas Moon and Asteroid.",
   2: "Breezy approach: gustier winds on Gas Moon, wider Asteroid pad swing, +500 clean bonus.",
   3: "Turbulent orbit: stronger wind gusts, wider pad swing, tighter landing gate, +700 clean bonus.",
   4: "High winds & cavern: heavy wind shear, wide pad oscillation, tighter speed gate, +900 clean bonus.",
   5: "Precision landing: high winds, widest pad swing, precision contact speed and tilt, +1100 clean bonus.",
};

function instructionsFor(level: RocketLevel): string[] {
   const count = level.planets;
   const vy = level.contactVy;
   const tilt = Math.round(level.contactAngle * 180 / Math.PI);
   const bonus = level.cleanBonus;
   return [
      "A/D or ←/→ rotate; hold Space, W or ↑ to thrust. Touch: joystick rotates, Thrust fires; release to auto-level.",
      `Land on all ${count} pads: descend at <${vy} m/s, drift at <1 m/s relative to the pad, tilt <${tilt}°. Three lives.`,
      `Soft + centre + fuel reserve: up to 500 per planet; crash-free finish +${bonus}. Enter the asteroid cave from either side.`,
   ];
}

const definition: GameDefinition<RocketLevel> = {
   slug: "rocket-landing",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   lives: 3,
   camera: { position: [0, 8, 40], fov: 35, lookAt: [0, 8, 0] },
   environment: { background: "#020617", lighting: "space" },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Thrust" },
   hudStats: [],
   resultDelayMs: 1200,
   instructions: instructionsFor(LEVELS[1]),
   levels: LEVEL_IDS.map((id): LevelSpec<RocketLevel> => {
      const level = LEVELS[id];
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         durationMs: level.durationMs,
         hudStats: [],
      };
   }),
};

export default definition;
