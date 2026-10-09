"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import { Hud } from "./Hud";
import { ASSETS } from "./assets";
import { CLOCK_S } from "./rules";

const definition: GameDefinition = {
   slug: "construction-worker",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [8, 12, 18], fov: 42, lookAt: [0, 0.5, 5] },
   // The fitted phone camera sits about 65 m out. Fog that starts at 28 m hides the whole site.
   environment: { background: "#e7e5e4", fog: ["#e7e5e4", 100, 160], lighting: "day" },
   touchControls: ["joystick", "action", "tap"],
   hudStats: [
      { key: "time", label: "Time" },
      { key: "stability", label: "Stability", max: 100 },
      { key: "building", label: "Building", max: 3 },
      { key: "swing", label: "Swing" },
   ],
   durationMs: CLOCK_S * 1000,
   resultDelayMs: 1100,
   instructions: [
      "A / D rotates the crane, W / S runs the trolley. Arrows do the same.",
      "Press 1-5 or tap a pile while the hook is over it. Action picks too.",
      "Space or Action drops when the guide turns gold.",
   ],
};

export default definition;
