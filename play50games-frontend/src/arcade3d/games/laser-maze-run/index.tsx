"use client";

// Laser Maze Run (Menu 2, game 38): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type LaserLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Static Lasers: 3 rooms. Jump a low beam, find the gap in a wall of light, then press a switch to drop a gate.",
   2: "Moving Lasers: 4 rooms. A pulsing wall to time, a beam sliding along the floor, a moving barrier.",
   3: "Cross Grid: 5 rooms. Linked switches: the one that opens the first gate closes the second.",
   4: "Fast Maze: 6 rooms. Shorter windows, two barriers in a row, and decoy switches that wake a sweep.",
   5: "Laser Master: 8 rooms of everything, then the Vault Core: jump its sweeps and overload it from its pylons.",
};

const definition: GameDefinition<LaserLevel> = {
   slug: "laser-maze-run",
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
      "Cross the vault room by room. Touch a laser and you are back on the room's checkpoint pad.",
      "WASD / arrows (or the stick) move, Space (or Jump) jumps. Amber beams are low: jump them. Red walls of light: find the gap, or wait until a pulsing wall goes dark.",
      "A beam sliding along the floor: jump it as it reaches you. A barrier sliding across: slip past on the open side.",
      "Magenta gates: stand on a switch pad and press E / Enter (or Action) to drop the gate for a few seconds. Some switches open one gate and close another; on level 4 some are decoys.",
      "E / Enter away from a switch is your power: Riko dashes (and dash-jumps the short live floors), Nami jumps again in the air (over a full wall), Kiro's shield soaks lasers for 1.2 s (and crosses live floors), Zuno's magnet pulls the orbs out of the laser cages, Vexa phases through every beam (into the cages).",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<LaserLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
      }),
   ),
};

export default definition;
