"use client";

// Energy Core Hunt (Menu 2, game 29): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CoreLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Simple Hunt: 2 colors, 6 cores. Take the reds the order asks for first; the blue is not wanted yet.",
   2: "Mixed Colors: 3 colors, 9 cores. A core left too long fades and drops again across the arena.",
   3: "Larger Arena: 4 colors, 12 cores. Cores circle their pylons; some are sealed in capsules (Action opens them).",
   4: "Moving Cores: 5 colors, 15 cores, shorter windows. Flickering decoy cores and tesla coils.",
   5: "Core Master: 5 colors, 20 cores in four dense waves, then the Core Sprite holds the last four.",
};

const definition: GameDefinition<CoreLevel> = {
   slug: "energy-core-hunt",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Action" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "The order (top left) asks for so many cores of each color. Walk into a core to take it; the order ticks down.",
      "Cores drop in waves: the next wave lands as soon as this one's share of the order is in. A core of a color that is already full (or a flickering decoy) jolts you: keep off them.",
      "WASD / arrows (or the stick) move, Space (or Jump) jumps. Some cores circle a pylon; some sit sealed in a capsule: stand by it and press E / Enter (or Action). Keep clear of the tesla coils while they spark.",
      "Order complete: the core gate opens at the far end. Walk in to finish. On level 5 jump the Core Sprite's shock rings and touch it while it is dazed.",
      "E / Enter away from a capsule is your power: Riko dashes, Nyla jumps again in the air (the orbs high over the crate stacks), Kiro's shield shrugs off sparks and shocks, Zuno's magnet pulls in the golden orbs (not the cores), Vexa phases through crates (into the crate ring).",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<CoreLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
      }),
   ),
};

export default definition;
