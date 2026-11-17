"use client";

// Color Rail Grind (Menu 2, game 35): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win submits
// the finish ms less the orb, ring, relight and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type RailLevel } from "./levels";
import { COLORS, LOOKS, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Station Yard: hop rails for the rings, throw your first switch onto the orb branch, jump a gap.",
   2: "Village Loop: some branches end in buffer stops; the mini-map shows the next two switches.",
   3: "Ice Bridge: frozen rails run 20 % faster, and frozen switches need a jump-stomp.",
   4: "Night Express: toy trains follow the switches too. Send them off your line, or hop.",
   5: "Runaway Express: route the Clockwork Express into its buffers, dodge its wagons, stomp its key.",
};

const definition: GameDefinition<RailLevel> = {
   slug: "color-rail-grind",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.5, -6] },
   environment: { background: COLORS.background, fog: [LOOKS[1].fog, LOOKS[1].fogNear, LOOKS[1].fogFar], lighting: LOOKS[1].lighting },
   touchControls: ["swipe", "tap", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Grind the workshop's toy train line: you ride the rails on your own. Hop between parallel rails with A / D or the arrows (swipe on touch).",
      "A track switch ahead lights up 1.5 s before you reach it: press E / Enter (or tap the view) to throw it and take its branch. Orb branches and shortcuts pay; dead ends hit a buffer stop (3 s lost).",
      "Jump (Space / up) the gaps and through the grind rings; crouch (S / down) downhill for speed. A missed gap costs 2 s on the hook.",
      "Each orb takes 0.15 s off your time, each ring 0.1 s, and riding the rails 90 % of the run relights the lamps (1.5 s more).",
      "Power (E / Enter with no switch lit, or the Power button): Riko's dash clears the long broken rail and smashes barriers, Nami double jumps to the high rails, Kiro's shield crosses icicle tunnels, Zuno's magnet rides the loop and pulls coins from the snow, Vexa phases through the ghost door.",
      "Turn the camera: drag the view (two fingers on touch), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<RailLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
