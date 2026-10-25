"use client";

// Stub until the game is built. Owner: antigravity. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "bee-garden",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "jump"],
   instructions: ["Fly into the nectar on the flowers.", "Bring it back to the hive."],
};

export default definition;
