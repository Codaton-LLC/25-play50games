"use client";

// Stub until the game is built. Owner: claude. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "zoo-escape",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "jump", "action"],
   instructions: ["Stay out of the keepers' flashlights.", "Reach the gate."],
};

export default definition;
