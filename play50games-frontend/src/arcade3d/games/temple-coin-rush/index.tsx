"use client";

// Temple Coin Rush (Menu 2, game 16): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A points game: no durationMs (rules.ts ends the run at its own cap, "timeup"); the Scene keeps the
// store's score at the run's score (bank x2, and on a win the finish bonus and the time bonus).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TempleLevel } from "./levels";
import { COLORS, LOOKS, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Temple Entry: grab coins, pay a 5-coin gate, meet one you cannot afford, then choose: pay or bank. 3 gates.",
   2: "Coin Hall: gates in pairs, a cheap toll and a dear one, and spike tiles popping on a rhythm. 4 gates.",
   3: "Broken Floors: the boulder's rumble drops the floor behind you; the 50-coin jackpot gate. 4 gates.",
   4: "Rolling Hazards: boulders roll in from the side ramps, and a hesitant runner pays more. 5 gates.",
   5: "Temple Sprint: Coilstone, the Temple Serpent, chases you. Pay the bells and the offerings to free it.",
};

const definition: GameDefinition<TempleLevel> = {
   slug: "temple-coin-rush",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.5, -6] },
   environment: { background: COLORS.background, fog: [LOOKS[1].fog, LOOKS[1].fogNear, LOOKS[1].fogFar], lighting: LOOKS[1].lighting },
   touchControls: ["swipe", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Run from the boulder through the collapsing temple. Grab the coins: they fill your purse for this run.",
      "Change lanes with A / D or the arrows (swipe on touch); jump with Space / up, roll with S / down.",
      "Toll gates split the path: run through a toll arch with enough coins to pay its price (shown over it) and take the fast lane; without enough, it pushes you into the slow lane, where the boulder gains on you.",
      "Unspent coins score double at the finish: buy speed, or bank points. A perfect lane (no stumble, every coin) pushes the boulder back; when it catches you, you lose a life (3).",
      "Power (E, Enter, or the Power button): Riko's dash breaks a cracked side wall (a free toll), Nami double jumps to the ledge coins, Kiro's shield walks through fire jets, Zuno's magnet pulls coins from the walls, Vexa phases through the ghost gate.",
      "Turn the camera: drag the view (two fingers on touch), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<TempleLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
