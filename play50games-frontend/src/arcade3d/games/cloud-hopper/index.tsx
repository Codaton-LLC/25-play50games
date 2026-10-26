"use client";

// Cloud Hopper (Menu 2, game 05): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the star bonus (finalScore).
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
   1: "Soft Clouds: a wide helix and a few bounce clouds. Reach the rainbow arch. 90 seconds.",
   2: "Moving Clouds: drifting chains slide along the helix. Reach the arch in 120 seconds.",
   3: "Wind Zone: lanes of wind push you sideways between clouds. Reach the arch in 150 seconds.",
   4: "Fading Clouds: a cloud fades after you land. Reach the arch in 180 seconds.",
   5: "Sky Sprint: bounce, drift, fade and wind together. Reach the arch in 210 seconds.",
};

const definition: GameDefinition<RoofLevel> = {
   slug: "cloud-hopper",
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
      "Bounce from cloud to cloud up the helix and reach the rainbow arch.",
      "Springy clouds launch you. Some clouds drift as a chain, and some fade after you land.",
      "Wind lanes push you sideways. Each star takes 0.4 s off your time.",
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
