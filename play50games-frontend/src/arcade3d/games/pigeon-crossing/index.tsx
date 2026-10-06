"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV, LOOK_AT } from "./camera";
import { COLORS } from "./Primitives";
import { DURATION_MS } from "./rules";

const definition: GameDefinition = {
   slug: "pigeon-crossing",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [0, 29.711, 17.204], fov: FOV, lookAt: LOOK_AT },
   environment: { background: COLORS.background, lighting: "day" },
   touchControls: ["swipe", "tap"],
   hudStats: [{ key: "level", label: "Level" }],
   instructions: [
      "Arrows or WASD: one hop per press. Swipe to hop in any direction.",
      "Tap or click to hop forward. You can queue one hop while in the air.",
      "Watch the gaps, wait on grass and cross twenty rows to the next level.",
      "+10 for each new furthest row, +100 for a level. One hit ends the run.",
   ],
};

export default definition;
