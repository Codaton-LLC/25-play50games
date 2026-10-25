"use client";

// Stub until the game is built. Owner: antigravity. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "mars-rover-mission",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick"],
   instructions: ["Stop inside a scan ring to take a sample.", "Return to base before the battery runs out."],
};

export default definition;
