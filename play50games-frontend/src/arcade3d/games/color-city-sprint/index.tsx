"use client";

// Color City Sprint (Menu 2, game 15, World 1 Ember Heights): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the
// intro (intro: true). A time game: no durationMs (rules.ts ends the run at the level's timer,
// "timeup", unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CitySpec } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Red Block: one beacon at a time, you pick the line. The streets you ran turn red; on lap 2 they are 30 % faster. 2 laps, 4 beacons.",
   2: "Bus Line: buses loop their blocks every 9 s. Jump off a ramp onto a roof: one beacon rides a bus.",
   3: "Rush Hour: colour gates at the crossings turn red every 4 s, like traffic lights. Meet the green.",
   4: "Night Neon: only the lamps and your red lanes are lit. Scout lap 1, race laps 2 and 3 on your own loop.",
   5: "Greyout Avenue: the street sweeper erases your red. Ramp onto its brushes, roll into its valves, slam it in a gate.",
};

const definition: GameDefinition<CitySpec> = {
   slug: "color-city-sprint",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [-8, 7, 4], fov: FOV, lookAt: [0, 1.2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "One beacon lights at a time (the red light pillar; the arrow and the mini-map point to it). Pick your own line through the city.",
      "The streets you ran between two beacons turn red. From lap 2 a red street is 30 % faster and you roll into the ball: plan a loop.",
      "Chain red streets, beacons and gems for the flow meter. Grey sludge slows you, steam vents knock you, buses shove you aside.",
      "Ramps launch you onto bus roofs. Each gem takes 0.2 s off your time.",
      "Power (E, Enter, or the Power button): Riko's dash smashes the cracked hoarding, Nami jumps again (bus roof to the rail), Kiro's shield, Zuno's magnet pulls gems out of drains, Vexa phases through the ghost shop.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Up on the stick runs away from the camera.",
   ],
   resultDelayMs: 1500,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<CitySpec> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
