"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, type RocketLevel } from "./levels";
import { DURATION_MS } from "./rules";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Moon & Desert: two controlled landings, open corridors.",
   2: "Three worlds: introduces high-gravity Ice.",
   3: "Four worlds: gusting winds on Gas Moon and wider pad swing.",
   4: "Five worlds: today's full campaign with Asteroid cave approach.",
   5: "Precision landing: tighter contact gates and +450 clean bonus.",
};

function instructionsFor(level: RocketLevel): string[] {
   const count = level.planets;
   const vy = level.contactVy;
   const tilt = Math.round(level.contactAngle * 180 / Math.PI);
   const bonus = level.cleanBonus;
   return [
      "A/D or ←/→ rotate; hold Space, W or ↑ to thrust. Touch: joystick rotates, Thrust fires; release to auto-level.",
      `Land on ${count === 2 ? "both" : `all ${count}`} pads: descend at <${vy} m/s, drift at <1 m/s relative to the pad, tilt <${tilt}°. Three lives.`,
      `Soft + centre + fuel reserve: up to 500 per planet; crash-free finish +${bonus}.${count === 5 ? " Enter the asteroid cave from either side." : ""}`,
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
