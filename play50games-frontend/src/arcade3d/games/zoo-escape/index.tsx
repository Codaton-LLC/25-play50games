"use client";

// Zoo Escape: the GameDefinition GameShell runs. The shell owns the screens, the HUD chips, pause
// and the score submit; the game keeps its own clock in rules.ts (catches cost 5 s), so there is no
// durationMs and the shell's clock chip is off (clockChip: false); "Time" is a hudStat.
import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { CATCH, SNACK_COUNT, STATS } from "./rules";
import { COLORS, FOG } from "./looks";
import { LEVELS, type ZooLevel } from "./levels";

const hudFor = (level: ZooLevel): NonNullable<GameDefinition["hudStats"]> => [
   { key: STATS.time, label: "Time" },
   { key: STATS.snacks, label: "Snacks", max: SNACK_COUNT },
   { key: STATS.catches, label: "Catches", max: CATCH.max },
   { key: STATS.bamboo, label: "Bamboo", max: level.bundles },
];

const INSTRUCTIONS = (level: ZooLevel) => [
   "Sneak out of the zoo: stay out of the keepers' flashlight cones and reach each gate.",
   "Hold Space / Sneak to tiptoe past, hide in bushes, toss bamboo (E / Toss) to lure a keeper.",
   `Snacks +50, caught -100 and -${level.penalty} s, +10 per second left at the exit.`,
];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Three stages, three gates. Escape, or score 1500.",
   2: "Keepers notice you a little sooner and investigate faster. Score 1600.",
   3: "One bamboo bundle per stage, sharper keepers. Score 1700.",
   4: "Keepers catch on quickly and chase faster. Score 1800.",
   5: "The sharpest keepers; a catch costs 10 seconds.",
};

const definition: GameDefinition<ZooLevel> = {
   slug: "zoo-escape",
   Scene,
   Hud,
   assets: ASSETS,
   // only the first frame uses this: Scene's CameraRig (useFittedView, camera.ts viewFor) follows the panda
   camera: { position: [0, 12, 6], fov: FOV, lookAt: [0, 0, 0] },
   environment: { background: COLORS.fogDay, fog: [COLORS.fogDay, FOG.day.near, FOG.day.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Sneak", action: "Toss" },
   hudStats: hudFor(LEVELS[1]),
   clockChip: false,
   // the gate fanfare, confetti and the panda's hop through the gate
   resultDelayMs: 1500,
   instructions: INSTRUCTIONS(LEVELS[1]),
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: hudFor(LEVELS[id]),
      ...(id === 1 ? {} : { instructions: INSTRUCTIONS(LEVELS[id]) }),
   })),
};

export default definition;
