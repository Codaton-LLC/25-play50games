"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";

const definition: GameDefinition = {
   slug: "penguin-slide",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [0, 12, 22], fov: 50, lookAt: [0, 0, -10] },
   environment: { background: "#bae6fd", fog: ["#bae6fd", 25, 56], lighting: "snow" },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Hop" },
   hudStats: [{ key: "time", label: "Time" }, { key: "distance", label: "Distance" }, { key: "crashes", label: "Crashes", max: 3 }],
   resultDelayMs: 1200,
   instructions: ["A / D or arrows to carve; Space or Hop to jump.", "Follow fish and cross gates for +8 seconds. Three crashes end the slide.", "Steer off ramps to spin, then land facing forward. Touch auto-hop is always on."],
};

export default definition;
