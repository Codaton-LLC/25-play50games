"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { CAMERA } from "./camera";
import { COLORS } from "./palette";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, type SpaceRepairLevel } from "./levels";
import { CLOCK } from "./rules";

const definition: GameDefinition<SpaceRepairLevel> = {
   slug: "space-repair",
   Scene,
   Hud,
   assets: ASSETS,
   camera: CAMERA,
   environment: { background: COLORS.space, lighting: "space" },
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: `${LEVELS[id].times.length} repair tickets in ${LEVELS[id].duration} seconds; timing arcs ${LEVELS[id].arcs.join(" / ")} degrees.`,
      config: LEVELS[id],
      hudStats: [],
   })),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Repair" },
   clockChip: false,
   hudStats: [],
   resultDelayMs: CLOCK.resultDelayMs,
   instructions: ["Thrust to a lit dock. Release to brake.", "Tap E, Enter or Space in the green repair arc.", "Keep station power above zero for 2 minutes."],
};

export default definition;
