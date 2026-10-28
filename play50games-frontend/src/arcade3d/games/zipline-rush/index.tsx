"use client";
import type { GameDefinition } from "../../core/types";
import { LEVEL_IDS } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { LEVELS, type ZipLevel } from "./levels";
import { ASSETS } from "./assets";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";
const definition: GameDefinition<ZipLevel> = {
   slug: "zipline-rush", Scene, Hud, ResultExtra: StarResult, assets: ASSETS,
   camera: { position: [-1.25, 26, 10], lookAt: [-1.25, 22, -2], fov: 55 },
   environment: { background: "#b9e1ed", fog: ["#b9e1ed", 65, 260], lighting: "day" },
   touchControls: ["joystick", "jump", "action"], touchLabels: { jump: "Release", action: "Power" },
   clockChip: false, intro: true, resultDelayMs: 2200, runPlayers: () => sessionRunPlayers(),
   instructions: [
      "Jump to grab the trolley. Hold Down / S to tuck (+40%); Up / W to brake (−60%). Read the green speed band: 6–8 m/s is a bullseye.",
      "Jump + sideways releases into a neighbouring cable within 3 m. Your sideways steering follows the camera. Release near the landing mat (last 16% of the line).",
      "Every mat has three zones. Too fast overshoots, too slow falls short. A miss retries the current line; orbs and landings pay only once.",
      "Power: Riko air-dashes to distant lines; Nami double-jumps to the high express cable; Kiro shields spark storms; Zuno pulls parallel orbs; Vexa phases through ghost signals.",
      "Collect every orb, beat the target time, and centre every landing for the Bullseye badge. Power or Jump rings the final Tide Bell.",
      "Drag to orbit; two fingers rotate, pinch or wheel zooms. V recenters. Volt Eel: evade the glowing cable, hop onto its open head three times, tuck-release into the spiral gill, then survive the plunge.",
   ],
   levels: LEVEL_IDS.map((id) => ({ id, config: LEVELS[id], description: `${LEVELS[id].name}: ${LEVELS[id].sections} lines · time star ${LEVELS[id].targetMs / 1000}s`, ...(LEVELS[id].night ? { environment: { background: "#10233e", fog: ["#10233e", 50, 210] as [string, number, number], lighting: "night" as const } } : {}) })),
};
export default definition;
