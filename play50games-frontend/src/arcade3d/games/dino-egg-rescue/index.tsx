"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import DinoHud from "./Hud";
import { DURATION_MS, RESULT_DELAY_MS } from "./rules";
import Scene from "./Scene";

const definition: GameDefinition = {
   slug: "dino-egg-rescue",
   Scene,
   Hud: DinoHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   resultDelayMs: RESULT_DELAY_MS,
   camera: { position: [0, 16, 13.4], fov: FOV, lookAt: [0, 0, 0] },
   environment: { background: "#7c2d12", lighting: "sunset" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dash" },
   hudStats: [{ key: "eggs", label: "Eggs Saved" }],
   instructions: [
      "Gather runaway eggs and carry them back to your nest in the South-East.",
      "Each carried egg slows you down; dodge boulders and sticky mud pits!",
      "WASD / Joystick to waddle, Space / E / tap Dash to dash.",
   ],
};

export default definition;
