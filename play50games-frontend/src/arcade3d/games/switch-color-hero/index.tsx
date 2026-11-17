"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type SwitchLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two Gates: red and blue. Switch to the gate's colour before you reach it; energy blocks stand in single lanes. 8 gates, 60 s for the star.",
   2: "Three Colors: green joins, and low walls to jump. 12 gates, 75 s.",
   3: "Fast Switching: four colours, gates in quick pairs, blinking gates and sweepers sliding across the lanes. 16 gates, 90 s.",
   4: "Mixed Obstacles: split gates with a colour per lane, beams to slide under, gaps to jump, at speed. 20 gates, 105 s.",
   5: "Color Overdrive: all five colours, then Chroma's arena: pass his core gates in the right colour while he is open. 25 gates.",
};

const definition: GameDefinition<SwitchLevel> = {
   slug: "switch-color-hero",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.5, -6] },
   environment: levelEnvironment(1),
   touchControls: ["swipe", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "You run on your own. Switch your colour to match each energy gate before you reach it: keys 1-5, a click or tap anywhere, or the colour swatches.",
      "A wrong colour bounces you back and costs a heart; so do energy blocks, low walls, beams, gaps and sweepers. Three hearts.",
      "A / D or Left / Right (or a swipe) change lanes, Space or Up jumps, S or Down slides. Split gates have a colour per lane; blinking gates change as you arrive.",
      "Power (E / Enter / Power): Riko dashes through energy blocks, Nami double jumps, Kiro's shield shrugs off hazards, Zuno pulls pickups, Vexa phases through blocks and beams.",
      "Turn the camera with a right-drag (two fingers on a phone), Q and C, or pinch to zoom.",
   ],
   resultDelayMs: 1200,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<SwitchLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
