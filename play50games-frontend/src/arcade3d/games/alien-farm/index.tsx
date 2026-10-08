"use client";

// Stub until the game is built. Owner: kimi. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "alien-farm",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "action"],
   instructions: ["Harvest each crop at its brightest pulse.", "Beam the harvest up to the saucer."],
};

export default definition;
