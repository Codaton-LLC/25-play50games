"use client";

// Dragon Cave Rush (Menu 2, game 14): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CaveLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Crystal Entry: gentle curves to learn the lean, a gap to hop and a beam to duck, then the hoard: Cindermaw wakes, and two breaths chase you to the gate.",
   2: "Rockfall: crystals drop from the roof where their shadows fall, and forks give two routes, one of them through the rockfall.",
   3: "Glow Tunnel: a dark cave lit by glow mushrooms, and by the dragon's breath, which lights the track ahead for a moment.",
   4: "Deep Cave: lavafalls on timers, parallel tracks to swap under fire, and breaths in pairs.",
   5: "Dragon Hoard: Cindermaw in her grey collar. Drop crystals on her, fling ore off the boost ramps, then hop at the three collar locks round the loop.",
};

const definition: GameDefinition<CaveLevel> = {
   slug: "dragon-cave-rush",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.4, 0] },
   environment: levelEnvironment(1, false),
   touchControls: ["joystick", "jump", "action", "swipe"],
   touchLabels: { jump: "Hop", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Ride the mine cart out of the crystal cave with Cindermaw the dragon on your tail, and bring back her stolen egg.",
      "Lean into every curve (A / D or the stick): the right lean is +15 % speed. A wrong lean on a sharp curve tips you onto two wheels; a second one derails you.",
      "Space / Hop jumps gaps and rocks; S / Down (stick down) ducks under beams and breath. At a fork, tap ← / → (or swipe) to swap tracks.",
      "Keep the distance meter up: hits shrink it, perfect leans and boosts grow it. At 0 she catches you and you restart at the last lantern. An orange glow and a roar warn of each breath 1 s ahead.",
      "E / Enter is your power: Riko boosts through cracked barricades onto shortcuts, Nami's second hop reaches the upper scaffold, Kiro's shield takes a breath or a lavafall, Zuno's magnet pulls crystal trails, Vexa phases onto the ghost rails.",
      "Turn the camera: right-drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<CaveLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id, LEVELS[id].dark),
      }),
   ),
};

export default definition;
