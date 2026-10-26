"use client";

// Sky Tower Jump (Menu 2, game 01): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro);
// the game owns Scene.tsx, rules.ts (outcome, 90 s cap, proof), Hud.tsx and the look.
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the orb bonus (finalScore), never the frame's end.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type SkyLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Training Sky: wide islands, four moving blocks, three bounce pads, three checkpoints. Reach 60 m.",
   2: "Cloud Steps: a taller route to 100 m, with a few moving blocks. 120 seconds.",
   3: "Moving Platforms: moving blocks along the climb. Reach 150 m in 150 seconds.",
   4: "Storm Heights: gusts push you sideways and lightning hits the rims. Reach 220 m.",
   5: "Infinite Tower: a long climb to 300 m, movers, gusts and lightning. 240 seconds.",
};

const definition: GameDefinition<SkyLevel> = {
   slug: "sky-tower-jump",
   Scene,
   Hud,
   assets: ASSETS,
   // the first frame only: the Scene's follow camera (or the intro) takes over on mount
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Jump from island to island up the sky tower and reach the gate at the top.",
      "Blue pads bounce you high. Moving blocks carry you. Beacons are checkpoints.",
      "Each orb takes 0.4 s off your time. A fall costs time and sends you back to the last beacon.",
      "Power (E, Enter, or the Power button) is your hero's ability. The same timing on touch and keyboard.",
   ],
   // the hero hops and spins at the gate before the result panel
   resultDelayMs: 1600,
   finalScore,
   levels: LEVEL_IDS.map((id): LevelSpec<SkyLevel> => {
      const storm = levelEnvironment(id);
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         ...(storm ? { environment: storm } : {}),
      };
   }),
};

export default definition;
