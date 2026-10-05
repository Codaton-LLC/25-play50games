"use client";

// Stub until the game is built. Owner: cursor. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "food-catcher",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["swipe","tap"],
   instructions: ["Catch fruit, avoid junk.","5 catches in a row doubles your points."],
};

export default definition;
