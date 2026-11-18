"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type WallLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Training Wall: one long wall over a pit with a floor, then two facing walls to kick between, then a column whip round a corner over the real chasm.",
   2: "Double Wall: wall panels slide in and out of the cliff on a 3 s cycle. Run while a panel is out, kick before it goes in.",
   3: "Column Hall: whip-to-whip column chains, and spike panels you roll under (Roll on the wall).",
   4: "Broken Temple: walls crack 0.8 s after you start running on them, and stone rams sweep the gaps.",
   5: "Master Wall Run: Umbra runs the opposite wall. Kick into him, catch him at a column, then out-climb him up the shaft to the top glyph.",
};

const definition: GameDefinition<WallLevel> = {
   slug: "wall-run-temple",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [-10, 7, 0], fov: FOV, lookAt: [0, 4, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Roll" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Jump at a glyph wall moving toward it (or hold toward it) and you stick, running along it. The run holds for a moment, then sinks: kick before you drop.",
      "Jump on a wall to wall-kick across to the facing wall. A chain of kicks is your combo (x1 to x5); landing on a platform ends it.",
      "Pass a stone column at speed and you whip 90° round it. Roll on a wall (E / Enter / Roll) to pass under spike panels.",
      "Power (off the wall): Riko dashes through cracked panels, Nami double jumps to the upper tier, Kiro shields through dart vents and rams, Zuno pulls gold orbs out of the cliff, Vexa phases into the ghost room.",
      "Turn the camera with a drag (two fingers on a phone), Q and C, or the on-screen control.",
   ],
   resultDelayMs: 1200,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<WallLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
