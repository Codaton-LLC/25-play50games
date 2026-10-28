"use client";

// Ring Jump Challenge (Menu 2, game 27, World 2): the GameDefinition GameShell runs (loaded lazily by
// loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true,
// core/intro). A points game: no durationMs (rules.ts ends the run at its own clock cap, "timeup");
// the store's score is the rules' run.score and the duration the run time (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type RingLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Wide Rings: big rings straight below, then rings to steer for, then hold Dive to beat the closing trio. A 330 m drop.",
   2: "Moving Rings: rings slide and orbit, so aim where they will be. 420 m.",
   3: "Updraft Rings: a fast line of speed rings, or a slow wide line of geysers with more rings. 520 m.",
   4: "Fast Route: the canyon pinches into slots with spinning blade gates. 600 m.",
   5: "Perfect Streak: everything at once, then Cyclone Ray in the storm eye and a final drop onto its tail. 900 m.",
};

const definition: GameDefinition<RingLevel> = {
   slug: "ring-jump-challenge",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 340, 32], fov: FOV, lookAt: [0, 320, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Dive", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Leap off the column (Jump) and steer your fall down the canyon through the rings.",
      "Hold Dive (Space / the Dive button) to tuck into a ball and fall fast; let go to spread out and steer better.",
      "Each ring scores and speeds you up; its bright centre doubles it. Passing close by a ring without threading it breaks your streak.",
      "Land on the target pad (the bull's-eye pays most) or in the marked pool. A splash anywhere else drops you again.",
      "Power (E, Enter, or the Power button): Riko air-dashes through cracked seals, Nami air-brakes back up, Kiro shields through storms and blades, Zuno's magnet pulls orbs out of the walls, Vexa phases through ghost panels.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<RingLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
         ...(id === 5 ? { resultDelayMs: 2600 } : {}),
      }),
   ),
};

export default definition;
