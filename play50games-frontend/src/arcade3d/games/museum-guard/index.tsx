"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { finalScore } from "./rules";
import Scene from "./Scene";

const definition: GameDefinition = {
   slug: "museum-guard",
   Scene,
   Hud,
   assets: {
      knight: ASSETS.knight,
      robot: ASSETS.robot,
      penguin: ASSETS.penguin,
      dino: ASSETS.dino,
      door: ASSETS.door,
      bench: ASSETS.bench,
   },
   camera: { position: [0, 1.6, 0], lookAt: [0, 1.6, 1], fov: 70 },
   environment: { background: "#1e1b4b", fog: ["#1e1b4b", 18, 28], lighting: "night" },
   touchControls: ["action"],
   touchLabels: { action: "Flash" },
   input: { drag: true },
   hudStats: [
      { key: "alarms", label: "Alarms", max: 3 },
      { key: "flash", label: "Flash" },
      { key: "dawn", label: "Dawn" },
   ],
   instructions: [
      "Turn with the mouse, A / D or the arrows. Drag to turn on a phone.",
      "Space or E flashes (the Flash button). Hold the beam to send a statue home.",
      "Three alarms and the night wins. Last until dawn.",
   ],
   resultDelayMs: 1100,
   clockChip: false,
   finalScore,
};

export default definition;
