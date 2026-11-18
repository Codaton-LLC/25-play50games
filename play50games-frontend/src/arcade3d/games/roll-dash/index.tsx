"use client";

// Roll Dash (Menu 2, game 11, World 6 Prism Fortress): the GameDefinition GameShell runs (loaded lazily
// by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true).
// A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup", unranked); a win
// submits the finish ms minus the flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type DashLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Gate Street: red barricades (tag Riko and dash through one), blue barriers (tag Nyla and double-jump one), then full locks across all three lanes: red, then blue, 1.5 s apart. 600 m.",
   2: "Market Lane: gold vaults (Zuno's magnet), green sprays (Kiro's shield) and ghost walls (Vexa's phase) join, and double locks: a ghost wall with a barricade 6 m behind it. 900 m.",
   3: "Old Town: grey shadow rollers repaint a lock a second before you reach it, and ore carts roll across the lanes. Read the late change. 1200 m.",
   4: "Night Causeway: a lock shows its colour only under a street lamp, and Prism Lock zones stop you tagging: be the right hero before you enter. 1500 m.",
   5: "Fortress Bridge: the Echo Storm Hawk. Open its feather-locks, jump into its glowing plate as that hero, then tag through its five plates.",
};

const definition: GameDefinition<DashLevel> = {
   slug: "roll-dash",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1, -6] },
   environment: levelEnvironment(1),
   touchControls: ["swipe", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "You roll forward on your own. Change lane with A / D, the arrows or a swipe; Space, Up or a swipe up jumps; S, Down or a swipe down tucks under a sign.",
      "Prism Locks carry a hero colour and glyph. Tag that hero (1-5, or tap a portrait) and fire the power (E, Enter or Power): Riko dashes through red, Nyla double-jumps blue, Kiro shields through green, Zuno's magnet opens gold, Vexa phases through purple.",
      "A lock in one lane can be dodged; a full lock across all three must be answered. A correct unlock gives a speed boost and repaints the street. Three hearts: a wrong answer or a crash costs one.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Left alone, it swings back behind you.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<DashLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
