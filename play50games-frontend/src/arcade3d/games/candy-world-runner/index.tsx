"use client";

// Candy World Runner (Menu 2, game 19): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CandyLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Candy Lane: eat 3 coins to grow, smash a jelly cube at Big; roll to shrink and slip under a cookie arch at Small; then both in a row.",
   2: "Cookie Road: chocolate-bar bridges crack under a Big hero, and donuts bounce a Small one high over the road.",
   3: "Sorbet Slopes: on frosted ice a lane change drifts; frozen blocks need Big and frozen arches Small, packed close.",
   4: "Gummy Grove: gummy monsters bite you down a size, but a jump onto a gummy's head grows you a size.",
   5: "Bonbon Palace: King Bonbon. Small under his lollipop wheels, Big into his drum, his throne, and at last his crown.",
};

const definition: GameDefinition<CandyLevel> = {
   slug: "candy-world-runner",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action", "swipe"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "You run on your own down three candy lanes. Your size decides what you smash, what you squeeze through and what holds your weight.",
      "Eat 3 candy coins to grow a size (Small, Normal, Big). Hold Down (S, or the stick pulled down) to sugar-burn roll: one size down every 0.6 s.",
      "Big smashes jelly cubes, chocolate walls and frozen blocks; Small slips under cookie, candy-cane and frozen arches. The sign over each one shows the size it needs.",
      "← / → (A / D, a swipe, or a flick of the stick) change lane; Space / Jump hops. Meet an obstacle at the wrong size and you stumble through it slowly.",
      "E / Enter is your power: Riko's Big dash breaks gingerbread walls into a bonus lane, Nami's second jump reaches the candy-cane rail, Kiro's shield crosses popping candy, Zuno switches his magnet on and off (coins and frosting trails), Vexa phases into the hidden fourth lane.",
      "Turn the camera: right-drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<CandyLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
      }),
   ),
};

export default definition;
