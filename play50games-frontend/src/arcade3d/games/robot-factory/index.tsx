"use client";

// Robot Factory Sorter: the GameDefinition GameShell runs. The game keeps its own 90 s shift clock
// (rules.ts, the "Time" stat; clockChip off) and ends with a win at 5 robots or more; a 3rd grabbed
// faulty part (3 lives) ends it at once.
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene, { CAMERA } from "./Scene";
import { ASSETS } from "./assets";
import { COLORS } from "./palette";
import { SCORING, SHIFT } from "./rules";

const definition: GameDefinition = {
   slug: "robot-factory",
   Scene,
   assets: ASSETS,
   lives: SHIFT.LIVES,
   resultDelayMs: SHIFT.RESULT_DELAY_MS,
   clockChip: false,
   camera: CAMERA,
   environment: { background: COLORS.background, fog: [COLORS.background, 24, 42], lighting: "indoor" },
   touchControls: ["tap", "swipe"],
   hudStats: [
      { key: "robots", label: "Robots" },
      { key: "combo", label: "Combo", max: SCORING.COMBO_MAX },
      { key: "time", label: "Time" },
   ],
   instructions: [
      "Grab the ringed part the blueprint wants next: tap it, or Space.",
      "Swipe down on a sparking faulty part (or S / Down) to scrap it. Grabbing one is a strike.",
      `Build ${SHIFT.WIN_QUOTA} robots in the ${SHIFT.DURATION} s shift. Clean grabs build a combo.`,
   ],
};

export default definition;
