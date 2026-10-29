"use client";

// Mine Tunnel Run (Menu 2, game 12): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// A time game: rules.ts ends the run at the level's cap ("timeup", unranked); a win submits the finish
// ms minus the orb and flow bonus (finalScore). The shell owns the screens and the intro.
import type { GameDefinition, LevelSpec } from "../../core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type MineLevel } from "./levels";
import { LOOKS } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Dry Tunnel: dig down through soft soil, step out from under a rumbling boulder, drop one on the beetle guarding the lift.",
   2: "Pipe Zone: dig into the rail lines and ride the ore carts across the mine at 10 m/s.",
   3: "Water Gaps: breach a water pocket and it floods your tunnels. Dig around them.",
   4: "Fast Tunnel: after 15 s the roof collapses from the top, a row every 0.6 s. Tunnelling beetles carve paths you can use.",
   5: "Deep Mine Sprint: Rockjaw, the Tunnel Beetle. Drop the ceiling boulders on it, dodge its eruptions, roll-drop onto its belly.",
};

const definition: GameDefinition<MineLevel> = {
   slug: "mine-tunnel-run",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 1, 13], fov: 50, lookAt: [0, -1, 0] },
   environment: { background: LOOKS[1].background, fog: LOOKS[1].fog, lighting: "night" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Dig down to the lift. Move into soil to dig it: soft soil gives fast, packed slowly, rock never.",
      "Down digs down, Up digs up, Jump hops two cells. Down in the air is a roll-drop.",
      "A boulder with nothing under it wobbles, then falls: on beetles, on cracked floors, and on you. Step aside.",
      "Lanterns are checkpoints. Red ore holds orbs: each one takes 0.4 s off your time.",
      "Power (E, Enter, or the Power button): Riko's dash bores four cells and smashes cracked rock, Nami double-jumps to air pockets, Kiro's shield takes a boulder or gas, Zuno's magnet pulls orbs through rock, Vexa phases through ghost rock.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<MineLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: { background: LOOKS[id].background, fog: LOOKS[id].fog, lighting: "night" },
   })),
};

export default definition;
