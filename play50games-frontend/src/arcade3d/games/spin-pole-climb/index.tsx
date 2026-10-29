"use client";

// Spin Pole Climb (Menu 2, game 34, World 3 Wild Temples): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup",
// unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type SpinLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Slow Poles: run round a still pole and rise, ride one that spins with you, then hop off one that spins against you onto its neighbour. 18 m, target 60 s.",
   2: "Twin Poles: two tall poles turning opposite ways, sweeper bars on their own spin. Jump them on the rhythm, hop to the pole that suits you. 24 m.",
   3: "Mixed Rotation: three poles flip direction every 6 s (the glyphs flash a second before). Hop to the one turning your way. 30 m.",
   4: "Fast Tower: one wide tower, four stairs at four pitches. Push in and jump to hop onto a steeper stair; spike collars ride up and down. 36 m.",
   5: "Spin Master: Coilstone is wound round the central pole. Jump its coils and stomp its plates, strike its crown from a side pole, then climb to the gong and ring it.",
};

const definition: GameDefinition<SpinLevel> = {
   slug: "spin-pole-climb",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [4, 4, 13], fov: FOV, lookAt: [0, 2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Run round the pole (A / D, the arrows or the joystick: left and right on the screen) to climb its spiral stair: every lap lifts you 3 m. Jump (Space) hops a sweeper bar, a spike collar or a gap.",
      "The poles turn. Green chevrons: the spin carries you up. Red: it drags you down. Facing a neighbour pole, Jump while pushing towards it to hop across (a gold ring shows where you land).",
      "Five green orbs a level, each 0.1 s off your time. Power (E, Enter or the Power button): Riko dashes and smashes the cracked urn, Kiro shields, Zuno's magnet pulls the orb from the hollow pole, Vexa phases onto the ghost pole; Nami jumps again in the air.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Left alone, it swings back out behind you.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<SpinLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
