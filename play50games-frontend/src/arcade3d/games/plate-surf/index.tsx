"use client";

// Plate Surf (Menu 2, game 37): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked; out of hearts,
// "lose", unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type SurfLevel } from "./levels";
import { COLORS, LOOKS, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Training Swell: a small wave. Pump up and down the face, carve round the buoys, then air off the lip. 600 m.",
   2: "Rocky Path: sea rocks and buoys in the lanes. Pick the high or the low line. 800 m.",
   3: "Jump Gates: rings over the lip only an air reaches, jellies in the trough. 900 m.",
   4: "Speed Canyon: the cliffs close in, the curl runs at 15 m/s and gulls dive. 1050 m.",
   5: "Plate Surf Master: King Breaker rides the wave ahead. Air onto its shell, trick into its eyes, carve through the barrel.",
};

const definition: GameDefinition<SurfLevel> = {
   slug: "plate-surf",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [-3, 7.5, 7.5], fov: FOV, lookAt: [6, 4, -3] },
   environment: { background: COLORS.background, fog: [LOOKS[1].fog, LOOKS[1].fogNear, LOOKS[1].fogFar], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Air", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Ride the wave to the lagoon before the curl behind you swallows you.",
      "Pump for speed: carve up the face, then hard down through the glowing band. Stop pumping and the curl catches up.",
      "At the lip, Jump to air. Hold a direction in the air for a trick: it buys time from the curl. Land it fully or you bail.",
      "Rocks wipe you out, buoys slow you, jellies, gulls and the violet spray sting. Each orb takes 0.25 s off your time.",
      "Power (E, Enter, or the Power button): Riko's dash carve breaks the reef walls, Nami airs twice, Kiro's shield, Zuno's magnet shows hidden orbs, Vexa phases through ghost arches.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<SurfLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
