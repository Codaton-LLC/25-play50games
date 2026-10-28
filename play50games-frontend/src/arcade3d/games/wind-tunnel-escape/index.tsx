"use client";
import type { GameDefinition } from "../../core/types";
import { LEVEL_IDS } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type WindLevel } from "./levels";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";
const definition: GameDefinition<WindLevel> = {
   slug: "wind-tunnel-escape", Scene, Hud, ResultExtra: StarResult, assets: ASSETS,
   camera: { position: [0, 9, 15], fov: 55, lookAt: [0, 2, -3] },
   environment: { background: "#19374d", fog: ["#39687e", 25, 65], lighting: "day" },
   touchControls: ["joystick", "jump", "action"], touchLabels: { action: "Fan / Power" },
   intro: true, clockChip: false, resultDelayMs: 1800, finalScore,
   runPlayers: () => sessionRunPlayers(),
   instructions: [
      "Ride the first blue fan upward. At the high fan, tap Action to turn its arrow toward the next ledge. Chain up, then across.",
      "Fans rotate 90 degrees with E / Enter or Fan. Hold Jump + Action beside a fan to switch it off or on. Cyan streaks show the live current; gold arrows show a hint after 20 s.",
      "Steer inside the current. Crosswinds add together: disable or redirect a side fan. The storm waits during your first puzzle setup, then follows 30 seconds behind.",
      "Away from a fan, Action uses your hero power: Riko breaks vents, Nami double jumps to shelves, Kiro shields shock vents, Zuno attracts distant orbs, Vexa phases into ducts. Any hero can clear every level.",
      "Gale Engine: aim each of the three side fans forward during its open window, then send all three crates into its core. Escape four rooms in 25 s and ring the Tide Bell.",
      "Drag / two fingers to orbit, wheel / pinch to zoom, Q / C turn, R / F tilt, V recenter.",
   ],
   levels: LEVEL_IDS.map((id) => ({ id, description: LEVELS[id].name, config: LEVELS[id], environment: { background: id >= 4 ? "#171b39" : "#19374d", fog: [id >= 4 ? "#3f3563" : "#39687e", 25, 65], lighting: id >= 4 ? "night" : "day" } })),
};
export default definition;
