"use client";

// Stub until the game is built. Owner: antigravity. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "beach-lifeguard",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "action"],
   instructions: ["Reach the swimmer under the ring and grab them.", "Bring them back to dry sand."],
};

export default definition;
