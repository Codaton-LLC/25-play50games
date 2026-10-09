"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS } from "./rules";

const definition: GameDefinition = {
   slug: "rocket-landing",
   Scene, Hud, assets: ASSETS, durationMs: DURATION_MS, lives: 3,
   camera: { position: [0, 8, 40], fov: 35, lookAt: [0, 8, 0] },
   environment: { background: "#020617", lighting: "space" },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Thrust" }, hudStats: [], resultDelayMs: 1200,
   instructions: [
      "A/D or ←/→ rotate; hold Space, W or ↑ to thrust. Touch: joystick rotates, Thrust fires; release to auto-level.",
      "Land on all five pads: descend at <2 m/s, drift at <1 m/s relative to the pad, tilt <10°. Three lives.",
      "Soft + centre + fuel reserve: up to 500 per planet; crash-free finish +300. Enter the asteroid cave from either side.",
   ],
};

export default definition;
