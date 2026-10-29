"use client";

// Tightrope Path (Menu 2, game 47, World 3 Wild Temples): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup",
// unranked); a win submits the finish ms less the orb, coin and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TightLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Wide Beams: a wide plank bridge, a narrow beam to correct on, a short rope with a gentle gust, and the first jump. Target 60 s.",
   2: "Narrow Beams: gusts push the needle 60 % in 1.5 s; the leaves and mist streaks warn you a second ahead. Riko's first dash rope.",
   3: "Moving Beams: sandbags swing across the beams every 2.5 s (crouch or wait) and the ropes sway.",
   4: "Rotating Path: beams that spin under your feet, in a night fog with only the lookout towers' torches.",
   5: "Balance Master: Umbra walks the rope towards you. Ride his stomps, stomp back, shove him off the beam, then out-balance him on the spinning beam.",
};

const definition: GameDefinition<TightLevel> = {
   slug: "tightrope-path",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 17, 7], fov: FOV, lookAt: [0, 14, -2] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Duck" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Walk the gorge (stick or W): every step tips the lean needle. Push the stick sideways against it to stay upright; past 100 % you wobble, and 0.5 s later you fall back to the last pillar.",
      "Hold forward to sprint (twice as fast, the needle drifts 3x); stand still and it drifts slowly. Hold Action to crouch: half the drift, and sandbags pass over you.",
      "Jump the gaps (Space / Jump). Each landing kicks the needle the same way every time: learn them.",
      "Action's press fires your hero: Riko dashes a cracked rope, Kiro's shield stops the drift 3 s, Zuno's magnet pulls coins out of the mist, Vexa phases onto the ghost bridge; Nami double jumps to the high orbs.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<TightLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
         ...(id === 5 ? { resultDelayMs: 2600 } : {}),
      }),
   ),
};

export default definition;
