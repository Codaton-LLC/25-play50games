"use client";

// Lava Pillar Jump (Menu 2, game 04): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the ember bonus (finalScore). A lava swallow ends "lose", unranked.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type LavaLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Warm Cavern: ten wide pillars. Climb while the lava rises slowly. 90 seconds.",
   2: "Pillar Field: fourteen pillars, some of them sliding. 120 seconds.",
   3: "Falling Rocks: moving pillars, sinking tops, glassy shelves and rocks. 150 seconds.",
   4: "Fast Lava: tighter gaps and lava that climbs faster. 180 seconds.",
   5: "Volcano Core: every hazard on the way to the core. 210 seconds.",
};

const definition: GameDefinition<LavaLevel> = {
   slug: "lava-pillar-jump",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "sunset" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Jump from pillar to pillar and reach the ring at the top before the lava catches you.",
      "Sliding pillars carry you. Blinking pillars vanish. Orange shelves sink. Pale shelves are glassy.",
      "Each ember takes 0.4 s off your time. A fall costs time and sends you back to the last crystal.",
      "Power (E, Enter, or the Power button) is your hero's ability. The same timing on touch and keyboard.",
   ],
   resultDelayMs: 1600,
   finalScore,
   levels: LEVEL_IDS.map((id): LevelSpec<LavaLevel> => {
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
