"use client";

// Stub until the game is built. Owner: antigravity. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "shopping-cart",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "jump"],
   instructions: ["Grab every item on your list.", "Dodge shoppers, spills and can pyramids."],
};

export default definition;
