"use client";

// Zoo Escape: the GameDefinition GameShell runs. The shell owns the screens, the HUD chips, pause
// and the score submit; the game keeps its own clock in rules.ts (catches cost 5 s), so there is no
// durationMs and the shell's clock chip is off (clockChip: false); "Time" is a hudStat.
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { CATCH, SNACK_COUNT, STATS, TOSS } from "./rules";

const definition: GameDefinition = {
   slug: "zoo-escape",
   Scene,
   Hud,
   assets: ASSETS,
   // only the first frame uses this: Scene's CameraRig (useFittedView, camera.ts viewFor) follows the panda
   camera: { position: [0, 12, 6], fov: FOV, lookAt: [0, 0, 0] },
   environment: { background: "#bae6fd", fog: ["#bae6fd", 30, 70], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Sneak", action: "Toss" },
   hudStats: [
      { key: STATS.time, label: "Time" },
      { key: STATS.snacks, label: "Snacks", max: SNACK_COUNT },
      { key: STATS.catches, label: "Catches", max: CATCH.max },
      { key: STATS.bamboo, label: "Bamboo", max: TOSS.perStage },
   ],
   clockChip: false,
   // the gate fanfare, confetti and the panda's hop through the gate
   resultDelayMs: 1500,
   instructions: [
      "Sneak out of the zoo: stay out of the keepers' flashlight cones and reach each gate.",
      "Hold Space / Sneak to tiptoe past, hide in bushes, toss bamboo (E / Toss) to lure a keeper.",
      "Snacks +50, caught -100 and -5 s, +10 per second left at the exit.",
   ],
};

export default definition;
