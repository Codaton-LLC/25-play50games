"use client";
import type { GameDefinition } from "../../core/types";
import { LEVEL_IDS } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type FactoryLevel } from "./levels";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";
const definition: GameDefinition<FactoryLevel> = {
   slug: "robot-factory-run", Scene, Hud, ResultExtra: StarResult, assets: ASSETS,
   camera: { position: [-3.8, 12.7, 15.5], lookAt: [-8, 0.8, 3.5], fov: 50 },
   environment: { background: "#221820", fog: ["#35232b", 24, 75], lighting: "indoor" },
   touchControls: ["joystick", "jump", "action"], touchLabels: { jump: "Jump", action: "Power" },
   clockChip: false, intro: true, resultDelayMs: 2200, hudStats: [], finalScore, runPlayers: () => sessionRunPlayers(),
   instructions: [
      "Route the live power cells into the orange charger, then enter its ring. A belt carries you too.",
      "Hold Shift or the Roll button and cross a RED plate: the wired turntable turns 90 degrees. Cross again for another turn. The triangle shows its NEXT direction.",
      "L1: ride a belt, turn the first junction toward the charger, then connect the second junction. The press flashes orange for half a second before it slams. Lost cells return after four seconds.",
      "Space / Jump hops hazards. E / Power: Riko flicks a cell and unjams tables; Nami jumps twice; Kiro shields lasers; Zuno pulls a cell from 4 m; Vexa phases into maintenance.",
      "Eight orbs subtract 0.3 s each. Flow only rewards each orb and each first correct route once. Find the hidden sixth junction, maintenance shard and roof window.",
      "Drag / two fingers orbit, wheel / pinch zoom. Q/C rotate, R/F tilt, V recenter. Movement follows the camera.",
      "Local 2-4 players: co-op shares the line; versus has one line each. Hold Jump to roll on the ground; release and press to jump. In versus, Roll + Power at the orange middle belt steals a live cell. The gold sixth junction feeds the secret charger.",
   ],
   levels: LEVEL_IDS.map((id) => ({ id, description: LEVELS[id].name, config: LEVELS[id], environment: { lighting: id >= 4 ? "night" : "indoor", background: id === 5 ? "#30141d" : "#221820" } })),
};
export default definition;
