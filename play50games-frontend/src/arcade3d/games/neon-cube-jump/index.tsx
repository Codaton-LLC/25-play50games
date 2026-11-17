"use client";

// Neon Cube Jump (Menu 2, game 7, World 5 Neon Cosmos): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup",
// unranked); a win submits the finish ms less the orb, coin and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type NeonLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Static Grid: only the wireframe cubes lie ahead, so jump and they turn solid under you; the cube behind you vanishes on your next jump; then a six-cube square / triangle staircase. Target 45 s.",
   2: "Moving Cubes: triangle cubes slide on rails, but only while solid; a hologram freezes where it is, so park a cube by timing your jumps.",
   3: "Blink Grid: ring cubes flip on their own 1.6 s clock whatever you do; watch their pulse and jump in rhythm.",
   4: "Laser Grid: lasers belong to the sets, so your jumps switch them on and off; sentry drones patrol only while their set is solid.",
   5: "Neon Overdrive: Flipframe, a giant of cubes. Be on the other set when it stomps, turn its core's cube solid and land on it, then climb its tower while the field flips by itself.",
};

const definition: GameDefinition<NeonLevel> = {
   slug: "neon-cube-jump",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 5, 9], fov: FOV, lookAt: [0, 1, -2] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Cubes come in two sets: square (A) and triangle (B). Only one set is solid; the other is a wireframe you fall through.",
      "Every jump flips which set is solid, on takeoff, so every jump lands on the other set. Walking off an edge does not flip. The big glyph at the bottom shows the solid set.",
      "Moving cubes slide only while solid; ring cubes blink on their own clock; lasers and drones only bite while their set is solid.",
      "Power (E, Enter or the Power button): Riko air-dashes without a flip, Kiro's shield stands in a laser, Zuno's magnet pulls coins out of the cubes, Vexa phases (holograms hold her, ghost walls let her through); Nami's second jump flips twice.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<NeonLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
         ...(id === 5 ? { resultDelayMs: 2600 } : {}),
      }),
   ),
};

export default definition;
