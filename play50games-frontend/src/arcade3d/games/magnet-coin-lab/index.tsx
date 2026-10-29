"use client";

// Magnet Coin Lab (Menu 2, game 42): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// A time game: rules.ts ends the run at the level's cap ("timeup", unranked); a win submits the finish
// ms minus the orb and flow bonus (finalScore). The shell owns the screens and the intro.
import type { GameDefinition, LevelSpec } from "../../core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type LabLevel } from "./levels";
import { LOOKS } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Basic Magnet: coins follow you into the piggy bank, an opposite pad pulls you over a gap, a matching one launches you to the high door.",
   2: "Two Poles: polarity gates let one sign through, and your coins take your sign. Pass, flip, keep your swarm.",
   3: "Moving Metal: push metal blocks out on their rails, ride one across a gap as -, plug a vent to open a hidden way.",
   4: "Drone Lab: lab drones steal your coins. Get close as + to knock them loose. Zuno's overcharge pulls coins through glass.",
   5: "Scrap Magnus: through the forge, then the golem. Match his sign through the slam, flip into his core, throw his blocks back, launch into his risen core.",
};

const definition: GameDefinition<LabLevel> = {
   slug: "magnet-coin-lab",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [5, 4, 14], fov: 50, lookAt: [5, 3, 0] },
   environment: { background: LOOKS[1].background, fog: LOOKS[1].fog, lighting: LOOKS[1].lighting },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Flip" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Each room: lead enough coins into the piggy bank and its door opens.",
      "Walk past a coin pile and the coins follow you as a swarm. They lag behind, and they fall into pits.",
      "Tap Action (E, Enter, or Flip) to switch between + (a ring) and - (a bar). An opposite pad pulls you, a matching floor pad launches you.",
      "Gates let one sign through, and your coins carry your sign. Metal blocks slide away from a matching sign and towards an opposite one.",
      "Hold Action for your hero power: Zuno's overcharge, Riko's dash, Kiro's shield, Vexa's phase. Nami double-jumps any time.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<LabLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: { background: LOOKS[id].background, fog: LOOKS[id].fog, lighting: LOOKS[id].lighting },
   })),
};

export default definition;
