"use client";

// Robot Factory Sorter: the GameDefinition GameShell runs. The game keeps its own shift clock
// (rules.ts, the "Time" stat; clockChip off) and ends with a win at the level's robot quota;
// a 3rd grabbed faulty part (3 lives) ends it at once.
// Levels: one LevelSpec per meta.ts level, built from levels.ts. Lighting stays the indoor bay
// on every level (no per-level environment: the shell preset is one value). Level 1's spec adds
// nothing, so the start card and the HUD are today's.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene, { CAMERA } from "./Scene";
import { ASSETS } from "./assets";
import { LEVELS, type FactoryLevel } from "./levels";
import { COLORS } from "./looks";
import { SCORING, SHIFT } from "./rules";

const BASE_LINES = [
   "Grab the ringed part the blueprint wants next: tap it, or Space.",
   "Swipe down on a sparking faulty part (or S / Down) to scrap it. Grabbing one is a strike.",
];

/** Start-card lines for levels 2-5. Level 1 keeps definition.instructions. */
function instructionsFor(level: FactoryLevel): string[] {
   if (level.sorter) {
      return [
         "The line is sorting by colour and icon. Keys 1 to 4, or tap that bin — both act on the same moment.",
         "A correct drop scores. A wrong bin costs 10 and locks the claw for 1 second. A part that falls off is a miss.",
         `Sort ${level.sortQuota} parts in the ${level.duration} s shift. The belt speeds up, and so do the parts.`,
      ];
   }
   const lines = [...BASE_LINES];
   lines.push(`Build ${level.winQuota} robots in the ${level.duration} s shift. Clean grabs build a combo.`);
   return lines;
}

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Build 5 robots in 90 seconds. Grab the blueprint part, scrap the sparks.",
   2: "120 seconds, a faster belt, the feeder joins sooner. Build 6 robots.",
   3: "The feeder joins early and more parts are faulty. Build 7 robots in 120 seconds.",
   4: "Fast Factory: sort 38 parts into the matching bins while the belt speeds up.",
   5: "Overdrive: the belt is faster. Sort 50 parts before they fall off the end.",
};

const hudFor = (level: FactoryLevel): LevelSpec<FactoryLevel>["hudStats"] => level.sorter
   ? [
      { key: "sorted", label: "Sorted", max: level.sortQuota },
      { key: "combo", label: "Combo", max: SCORING.COMBO_MAX },
      { key: "time", label: "Time" },
   ]
   : [
      { key: "robots", label: "Robots", max: level.winQuota },
      { key: "combo", label: "Combo", max: SCORING.COMBO_MAX },
      { key: "time", label: "Time" },
   ];

const definition: GameDefinition<FactoryLevel> = {
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
      ...BASE_LINES,
      `Build ${SHIFT.WIN_QUOTA} robots in the ${SHIFT.DURATION} s shift. Clean grabs build a combo.`,
   ],
   levels: LEVEL_IDS.map((id): LevelSpec<FactoryLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         hudStats: hudFor(level),
      };
   }),
};

export default definition;
