"use client";

// Robot Collector: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// Start here when copying this game: the shell owns screens, HUD, timer, pause and score submit;
// the game owns Scene.tsx (frame loop + moving things), rules.ts (logic) and assets.ts (models).
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { BATTERY_COUNT, DURATION_MS } from "./rules";

const definition: GameDefinition = {
   slug: "robot-collector",
   Scene,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // only the first frame uses this: Scene's own CameraRig (core useFittedView) fits the warehouse
   // to the screen, clear of the HUD and the joystick (turning it for portrait phones), and follows the robot
   camera: { position: [0, 19, 13], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#0b1220", lighting: "indoor" },
   touchControls: ["joystick"],
   hudStats: [{ key: "batteries", label: "Batteries", max: BATTERY_COUNT }],
   instructions: [
      "Collect all 10 batteries before the clock runs out.",
      "They light up two at a time: grab both and the next pair appears.",
      "+100 per battery. Finish early for +10 per second left.",
   ],
};

export default definition;
