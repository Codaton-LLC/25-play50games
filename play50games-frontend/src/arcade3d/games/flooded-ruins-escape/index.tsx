"use client";

// Flooded Ruins Escape (Menu 2, game 03): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the coin bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type RoofLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Drain Entry: ten wide stone ledges. Climb eight sections before the water. 90 seconds.",
   2: "Pipe Maze: fourteen ledges, some of them sliding along the channel. Climb twelve sections. 120 seconds.",
   3: "Valve Shaft: sliding ledges, ledges that sink, and slick stone. Climb sixteen sections. 150 seconds.",
   4: "Flood Rise: tighter gaps, a shaft current, and water jets. Climb twenty sections.",
   5: "Final Escape: every hazard on the way to the flood gate. Climb twenty-five sections. 210 seconds.",
};

const definition: GameDefinition<RoofLevel> = {
   slug: "flooded-ruins-escape",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Climb the stone ledges and reach the flood gate before the water catches you.",
      "Sliding ledges carry you. Some ledges sink. Pale stone is slick.",
      "Each coin takes 0.4 s off your time. A fall costs time and sends you back to the last lever.",
      "Power (E, Enter, or the Power button) is your hero's ability. The same timing on touch and keyboard.",
   ],
   resultDelayMs: 1600,
   finalScore,
   levels: LEVEL_IDS.map((id): LevelSpec<RoofLevel> => {
      const night = levelEnvironment(id);
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         ...(night ? { environment: night } : {}),
      };
   }),
};

export default definition;
