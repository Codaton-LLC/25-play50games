"use client";

// Tiny Escape Room: the GameDefinition GameShell runs. Time game. The shell owns the clock,
// the result and the submit. Found is the only shell stat. Status stays "soon".
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Checklist from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS } from "./rules";

const definition: GameDefinition = {
   slug: "escape-room",
   Scene,
   Hud: Checklist,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // first frame only: Scene's CameraRig fits the room at yaw 30°, clear of the HUD,
   // the checklist, the joystick and the cookie banner
   camera: { position: [4, 14, 12], fov: 45, lookAt: [0, 0.5, 0] },
   environment: { background: "#c5d4e8", lighting: "indoor" },
   touchControls: ["joystick", "tap"],
   hudStats: [{ key: "found", label: "Found", max: 3 }],
   instructions: [
      "Open containers, take all three items, then open the door.",
      "Walk with WASD or arrows. Click a yellow marker, or press E, when you are close.",
      "Faster escapes rank higher. You have 10 minutes.",
   ],
};

export default definition;
