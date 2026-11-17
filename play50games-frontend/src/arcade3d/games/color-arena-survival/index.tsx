"use client";

// Color Arena Survival (Menu 2, game 26, World 6 Prism Fortress): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup",
// unranked; three falls end it "lose"); a win submits the finish ms (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type ArenaLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Slow Rounds: two colours in big patches and long calls. Run to the called colour and stand still on it to lock in. Survive 5 rounds. Target 60 s.",
   2: "Three Colors: three colours, and the tiles that crack (they shake darker) stay down as holes after the drop. Survive 8 rounds.",
   3: "Five Colors: every colour, holes, and tiles that blink and swap colour halfway through a call. Survive 12 rounds.",
   4: "Fast Rounds: three-second calls, holes, and a sweeping bar: jump its padded face. Survive 16 rounds.",
   5: "Survival Master: the Prism Keeper. Every third round a beacon stands on the called colour: be on it when the floor drops and its beam strikes the Keeper. Dodge its cracks, jump its shock rings, follow its repaints.",
};

const definition: GameDefinition<ArenaLevel> = {
   slug: "color-arena-survival",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 12, 16], fov: FOV, lookAt: [0, 0, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Move with WASD, the arrows or the joystick (camera-relative); Space jumps.",
      "Each round a colour is called (the beacon's crown and the chip at the top, with its symbol). When the call runs out every tile of another colour drops: be on the called colour.",
      "Stand still on the called colour to LOCK IN: the floor drops at once and your time gets better. Five orbs float over the called colour on some rounds.",
      "Fall into the pit and you lose a heart (three a level) and come back on the safe marker.",
      "Power (E, Enter or the Power button): Riko dashes, Kiro's shield blocks a knock and saves a fall, Zuno's magnet pulls the orb, Vexa phases over holes; Nami jumps again in the air.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<ArenaLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
