"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV, LOOK_AT } from "./camera";
import { COLORS } from "./Primitives";
import { DURATION_MS } from "./rules";

const definition: GameDefinition = {
   slug: "tower-climb",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [3, 3, 12], fov: FOV, lookAt: LOOK_AT },
   environment: { background: COLORS.background, lighting: "day" },
   touchControls: ["joystick", "jump"],
   hudStats: [{ key: "height", label: "Height" }],
   instructions: [
      "A/D or Left/Right to run. Space, W or Up jumps once per press.",
      "On touch: steer with the joystick, then tap Jump or swipe up.",
      "Follow the cyan and violet slabs. Orange spurs crack and fall after contact.",
      "Yellow flags mark safe checkpoint ledges. There are no respawns.",
      "+10 per new metre of height, +25 per coin. Falling ends the climb.",
   ],
};

export default definition;
