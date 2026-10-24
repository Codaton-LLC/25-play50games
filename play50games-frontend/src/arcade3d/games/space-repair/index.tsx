"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { CAMERA } from "./camera";
import { COLORS } from "./palette";
import { CLOCK } from "./rules";

const definition: GameDefinition = {
   slug: "space-repair",
   Scene,
   Hud,
   assets: ASSETS,
   camera: CAMERA,
   environment: { background: COLORS.space, lighting: "space" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Repair" },
   clockChip: false,
   hudStats: [],
   resultDelayMs: CLOCK.resultDelayMs,
   instructions: ["Thrust to a lit dock. Release to brake.", "Tap E, Enter or Space in the green repair arc.", "Keep station power above zero for 2 minutes."],
};

export default definition;
