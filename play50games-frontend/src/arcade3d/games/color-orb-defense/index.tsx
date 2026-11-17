"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type DefenseLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two Colors: 3 portals, 2 colours, 4 waves. Stand on the zone of the orb's colour on its lane to block it; the outer zone scores more.",
   2: "Three Colors: 4 portals, 6 waves, and the drone sweeping the middle ring (jump it).",
   3: "Four Colors: 5 portals, 8 waves; some orbs blink between two colours: match the colour it shows as it reaches you.",
   4: "Fast Waves: 6 portals, 10 faster waves, orbs in pairs on two lanes.",
   5: "Orb Defense Master: 5 colours, 9 waves, then the Orb Mortar: block his golden core orbs in his window to send them back.",
};

const definition: GameDefinition<DefenseLevel> = {
   slug: "color-orb-defense",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 18, 16], fov: FOV, lookAt: [0, 0, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Energy orbs fly from the portals down their lane to the beacon in the middle. They are harmless, but each one that reaches the beacon costs it a hit point.",
      "Every lane has colour zones. Stand on the zone that matches the orb's colour as it passes and your shield blocks it. The outer zone scores more; a wave with no leak scores a bonus.",
      "WASD / arrows or the joystick to run (camera-relative), Space / Jump to hop over the drone that sweeps the middle ring.",
      "Power (E / Enter / Power): Riko dashes, Nami double jumps, Kiro shields the beacon, Zuno's magnet blocks matching orbs near him, Vexa phases through the drone and runs faster.",
      "Turn the camera with a drag (two fingers on a phone), Q and C, or pinch to zoom.",
   ],
   resultDelayMs: 1200,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<DefenseLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
