"use client";

// Stub until the game is built. Owner: antigravity. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "jungle-bridge-run",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: [],
   instructions: ["Swipe or use the arrows to switch lanes.", "Jump the gaps, slide under the vines."],
};

export default definition;
