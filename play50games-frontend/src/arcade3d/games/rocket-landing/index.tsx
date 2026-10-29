"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, type RocketLevel } from "./levels";
import { DURATION_MS } from "./rules";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Five worlds: Moon, Desert, Ice, a windy Gas Moon and the Asteroid cave with its sliding pad.",
   2: "Wide Crater: five landings in one big crater; a breeze on three (watch the windsock), the last pad rides a sled.",
   3: "Mars Ridge: red rock towers stand beside the pads, a dust storm gusts, the last pad slides along the ridge.",
   4: "High winds & caverns: crystal caves close over three pads (fly in from a side shaft) and a gale ridge between.",
   5: "Precision landing: a night beacon field of needle-narrow pads, two on rails, one in the wind, and an orbital dock.",
};

/** Each level's own hazard line. */
const HAZARDS: Record<LevelId, string> = {
   1: "Enter the asteroid cave from either side.",
   2: "The windsock shows the breeze: lean into it. The sled pad slides: hover in the middle and drop as it comes.",
   3: "Stay high until you are over the pad: rock towers stand on both sides. Lean into the dust-storm gusts.",
   4: "Under a cavern roof: fly in low from a side shaft, then under the roof to the pad. Lean into the gale.",
   5: "Needle pads are narrow: line up exactly. Rail pads slide: hover in the middle and drop as they come.",
};

function instructionsFor(level: RocketLevel): string[] {
   const count = level.planets;
   const vy = level.contactVy;
   const tilt = Math.round(level.contactAngle * 180 / Math.PI);
   const bonus = level.cleanBonus;
   return [
      "A/D or ←/→ rotate; hold Space, W or ↑ to thrust. Touch: joystick rotates, Thrust fires; release to auto-level.",
      `Land on all ${count} pads: descend at <${vy} m/s, drift at <1 m/s relative to the pad, tilt <${tilt}°. Three lives.`,
      `Soft + centre + fuel reserve: up to 500 per landing; crash-free finish +${bonus}. ${HAZARDS[level.id]}`,
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
   environment: { background: "#020617", lighting: "space", fog: ["#020617", 45, 120] },
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
