"use client";

// Stub until the game is built. Owner: codex. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "pigeon-crossing",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["swipe","tap"],
   instructions: ["Hop forward lane by lane.","Do not get hit by traffic."],
};

export default definition;
