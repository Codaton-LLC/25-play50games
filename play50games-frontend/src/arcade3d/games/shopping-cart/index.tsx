"use client";

// Crazy Shopping Cart GameDefinition: loaded lazily by arcade3d/loaders.ts.
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { DURATION_MS, LIST_COUNT } from "./rules";

const definition: GameDefinition = {
   slug: "shopping-cart",
   Scene,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [0, 16, 18], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#0b1220", fog: ["#0b1220", 18, 38], lighting: "indoor" },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Ride" },
   hudStats: [{ key: "items", label: "Items", max: LIST_COUNT }],
   resultDelayMs: 1200,
   instructions: [
      "Steer the runaway cart through aisles to grab all 6 items on your list.",
      "Hold Ride (Space or Ride button) to drift faster; dodge shoppers, spills & pyramids.",
      "Collect all 6 items and dash to checkout before 75 s runs out!",
   ],
};

export default definition;
