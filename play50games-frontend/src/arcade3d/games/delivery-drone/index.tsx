"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type DroneLevel } from "./levels";
import { COLORS } from "./looks";

/** one line under the level tiles */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Twelve rooftop drops. Wind after a minute; fragile parcels from the ninth.",
   2: "Thirteen drops on tighter pads, with the wind arriving sooner.",
   3: "Fourteen drops. Pigeons fill the streets early and the gusts are stronger.",
   4: "Fifteen drops. Fragile cargo, hard gusts and a faster battery drain.",
   5: "Sixteen drops on the densest route. The sky stays bright; the pressure is the route.",
};

function instructionsFor(level: DroneLevel): string[] {
   return [
      "Hover at the depot for 4 seconds to load a parcel.",
      "Fly to the blue rooftop; brake early and line up the landing cross.",
      `Space, E, Enter or Drop releases. Complete ${level.count} deliveries before the battery runs flat. Fragile parcels from delivery ${level.fragileFrom + 1} need ${level.fragilePrecision} precision.`,
   ];
}

function hudFor(level: DroneLevel): GameDefinition["hudStats"] {
   return [
      { key: "deliveries", label: "Deliveries", max: level.count },
      { key: "distance", label: "Target m" },
   ];
}

const definition: GameDefinition<DroneLevel> = {
   slug: "delivery-drone",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [0, 14, 9], fov: FOV, lookAt: [0, 3, 0] },
   environment: { background: COLORS.skyBottom, lighting: "day" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Drop" },
   hudStats: hudFor(LEVELS[1]),
   resultDelayMs: 1200,
   instructions: [
      "Hover at the depot for 4 seconds to load a parcel.",
      "Fly to the blue rooftop; brake early and line up the landing cross.",
      "Space, E, Enter or Drop releases. Complete 12 deliveries before the battery runs flat.",
   ],
   levels: LEVEL_IDS.map((id): LevelSpec<DroneLevel> => {
      const level = LEVELS[id];
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         hudStats: hudFor(level),
         ...(id === 1 ? {} : { instructions: instructionsFor(level) }),
      };
   }),
};

export default definition;
