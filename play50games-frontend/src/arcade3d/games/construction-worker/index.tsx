"use client";

// Stub until the game is built. Owner: cursor. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "construction-worker",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "action", "tap"],
   instructions: ["Pick the material the blueprint asks for.", "Swing it into the glowing slot and drop."],
};

export default definition;
