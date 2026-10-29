"use client";
import type { GameDefinition } from "../../core/types";
import { LEVEL_IDS } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type SnowLevel } from "./levels";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const definition: GameDefinition<SnowLevel> = {
   slug: "snow-slide-dash", Scene, Hud, ResultExtra: StarResult, assets: ASSETS,
   camera: { position: [0, 9.4, 10.8], lookAt: [0, 2.1, -3], fov: 58 },
   environment: { background: "#b9dce9", fog: ["#b9dce9", 75, 165], lighting: "day" },
   touchControls: ["joystick", "jump", "action"], touchLabels: { jump: "Hop", action: "Power" },
   hudStats: [], clockChip: false, intro: true, resultDelayMs: 1800,
   instructions: [
      "Roll downhill with free steering. Thread ice gates: each consecutive gate adds speed, up to six.",
      "Hold Down / pull the joystick down to carve a tighter turn at 15% less speed. Blue ice has no steering: aim before entering.",
      "Ramps launch you. Hold Left/Right to spin or Up/Down to flip; release after a full turn. Land within 20 degrees to boost. Space / Hop makes a small jump.",
      "Power opens your hero's side route: Riko's cracked pond, Nami's high ridge, Kiro's snow-dump forest, Zuno's creek trail or Vexa's ghost gully.",
      "Big Drift: chain three gates, then land clean ramp tricks and pass gates to fire frost stars. Finish with two spins onto his head.",
      "Drag / two fingers orbit; wheel / pinch zoom; Q/C turn, R/F tilt, V recenters. Local co-op adds drafting and twin-gate boosts.",
   ],
   finalScore, runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id) => ({ id, description: LEVELS[id].name, config: LEVELS[id],
      environment: LEVELS[id].night ? { background: "#142239", fog: ["#142239", 60, 145], lighting: "night" } : { background: "#b9dce9", fog: ["#b9dce9", 75, 165], lighting: "day" } })),
};
export default definition;
