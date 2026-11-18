"use client";

// Crystal Tower (Menu 2, game 28, World 5 Neon Cosmos): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's timer, "timeup",
// unranked); a win submits the finish ms minus the gem and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TowerSpec } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "3-Color Sequence: three tiers of three colours on wide pads. Stand in the beacon, watch, climb, touch them in order.",
   2: "4 Colors: a fourth colour, longer sequences, and sliding bridge pads between the tiers.",
   3: "5 Colors: all five colours over five tiers; glass pads slide under you and the climbing pads crumble.",
   4: "Moving Crystals: the crystals bob up out of reach, spark drones patrol the climb, the gaps are tighter.",
   5: "Memory Tower: every hazard on the way up, then Prism Shade on the summit: his sequences shuffle, black out and flip.",
};

const definition: GameDefinition<TowerSpec> = {
   slug: "crystal-tower",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 8, -12], fov: FOV, lookAt: [0, 2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Stand in a beacon's ring: it flashes a colour sequence and the matching crystals pulse. Stay in the ring until it finishes.",
      "Climb the pads and touch the tier's crystals in that order. A wrong one shoves you back and the sequence starts over (step back into the beacon to see it again).",
      "A full sequence lights the next beacon up the tower. The summit crystal ends the run once every tier is done.",
      "Shard storms, spark drones and the boss's shockwave knock you; step aside, wait, or jump over it. Fall and you are back at your beacon.",
      "Power (E, Enter, or the Power button): Riko's dash (3 a run) shatters the dark crystal wall, Nyla jumps again, Kiro's shield, Zuno's magnet pulls gems and the next crystal, Vexa phases through the void gate.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Up on the stick runs away from the camera.",
   ],
   resultDelayMs: 1500,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<TowerSpec> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
