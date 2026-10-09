"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { CAMERA } from "./camera";
import { TUNING } from "./rules";

const definition: GameDefinition = {
   slug: "castle-defender",
   Scene,
   Hud,
   assets: ASSETS,
   camera: CAMERA,
   environment: { background: "#dbeafe", lighting: "day" },
   touchControls: ["tap", "action"],
   touchLabels: { action: "Rock" },
   hudStats: [],
   resultDelayMs: TUNING.resultDelayMs,
   instructions: [
      "Click the field or aim with arrows / WASD and Space to fire. Hit shields from behind.",
      "E / Enter or Rock clears an erected ladder. Rock reloads in 8 seconds.",
      "Choose upgrades with 1 / 2 or tap a card; hold the gate through five waves.",
   ],
};

export default definition;
