"use client";

// Stub until the game is built. Owner: kimi. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "monster-kitchen",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["swipe", "tap"],
   instructions: ["Turn the wheel to the ingredient.", "Toss them in the order shown."],
};

export default definition;
