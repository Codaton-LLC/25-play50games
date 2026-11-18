"use client";

// Rooftop Roll Climb (Menu 2, game 02): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the coin and flow bonus (finalScore).
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
import StarResult from "./StarResult";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Low Roofs: roll down your first slanted roof and leap a 7 m street, switch back, then chain two slopes to the helipad. 90 seconds.",
   2: "Office Roofs: window-cleaner gondolas slide across two streets. Time the roll so the leap meets one. 120 seconds.",
   3: "Moving Rooftops: crane-swung roof slabs, rain-wet tin that rolls 1.5x faster with no brakes, and blinking roofs. 150 seconds.",
   4: "Night Skyline: chimney updrafts lift you a whole climb, neon spark arcs cross the slopes. 180 seconds.",
   5: "High-Rise Climb: up the high-rises to the helipad arena and Ashback, the Shadow Armadillo. Roll down the ramps into him. 240 seconds.",
};

const definition: GameDefinition<RoofLevel> = {
   slug: "rooftop-roll-climb",
   Scene,
   Hud,
   // the Menu 2 star screen on the result card (menu2/stars)
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Climb the zigzag skyline to the helipad. A plain jump is about 6 m: the streets are wider.",
      "Lean downhill on a slanted roof and you curl into a ball that banks speed (up to 13 m/s). Jump at the lip: the leap keeps it.",
      "Gondolas and crane slabs slide, blinking roofs vanish, wet tin rolls faster and will not brake, chimneys blow you up a climb.",
      "Each coin takes 0.4 s off your time. Chain slopes, leaps and new roofs for a little more. A fall costs time and sends you back to the last lamp.",
      "Power (E, Enter, or the Power button) is your hero's ability. The same timing on touch and keyboard.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   // local multiplayer (menu2/multiplayer): a run with 2-4 players is never submitted to the solo board
   runPlayers: () => sessionRunPlayers(),
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
