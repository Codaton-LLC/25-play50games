"use client";

// Temple Lantern Jump (Menu 2, game 02): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the coin bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TempleLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Low Roofs: ten wide roofs. Climb eight sections to the top. 90 seconds.",
   2: "Office Roofs: fourteen roofs, some of them sliding. Climb twelve sections. 120 seconds.",
   3: "Moving Rooftops: sliding roofs, blinking roofs and ice. Climb sixteen sections. 150 seconds.",
   4: "Night Skyline: tighter gaps, faster slides, gusts and antenna arcs. Climb twenty sections.",
   5: "High-Rise Climb: every hazard on the way to the helipad. Climb twenty-five sections. 210 seconds.",
};

const definition: GameDefinition<TempleLevel> = {
   slug: "temple-lantern-jump",
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
      "Jump from temple to temple and reach the helipad at the top.",
      "Sliding roofs carry you. Blinking roofs vanish. Pale roofs are icy.",
      "Each coin takes 0.4 s off your time. A fall costs time and sends you back to the last lamp.",
      "Power (E, Enter, or the Power button) is your hero's ability. The same timing on touch and keyboard.",
   ],
   resultDelayMs: 1600,
   finalScore,
   levels: LEVEL_IDS.map((id): LevelSpec<TempleLevel> => {
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
