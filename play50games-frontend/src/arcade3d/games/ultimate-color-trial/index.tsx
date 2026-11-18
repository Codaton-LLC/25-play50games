"use client";

// Ultimate Color Trial (Menu 2, game 50, World 6 Prism Fortress): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the
// intro (intro: true). A time game: no durationMs (rules.ts ends the run at the level's timer,
// "timeup", unranked); a win submits the finish ms minus the gem and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TrialSpec } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Jump Trial: three sections: pads over the void, four rings in order, one row of colour doors.",
   2: "Runner Trial: sliding pads, a laser runway, a high ring, two rows of doors in four colours.",
   3: "Color Trial: two rows of five colours, high rings, raised pads, the energy core, a survival round.",
   4: "Mixed Trial: a fast runway, tight sliding pads, three rows of doors, high rings, a longer round, orbs round the core.",
   5: "Grand Hero Trial: every section, then the Chroma Sentinel: his beacon asks a colour, three rings, the core.",
};

const definition: GameDefinition<TrialSpec> = {
   slug: "ultimate-color-trial",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 7, -8], fov: FOV, lookAt: [0, 1.2, 6] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "The corridor is made of sections, each one trial: jump the pads, pass the rings in order, charge a colour on a switch and take the door of that colour, hop the laser beams, outlast the rolling orbs, carry the energy core to its receptor.",
      "A section with a goal has a gate at its end: it opens when the goal is done. Fall and you are back at the section's start.",
      "On the summit the Chroma Sentinel's beacon asks: a colour (take it to him through its door), his three rings in order, or his core to his receptor. Jump his sweeps.",
      "Power (E, Enter, or the Power button): Riko's dash (3 a run) shatters the crystal wall, Nyla jumps again, Kiro's shield, Zuno's magnet pulls gems and the core, Vexa phases through the void gate.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Up on the stick runs away from the camera.",
   ],
   resultDelayMs: 1500,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<TrialSpec> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
