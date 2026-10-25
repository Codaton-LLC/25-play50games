"use client";

// Stub until the game is built. Owner: kimi. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "dog-park-fetch",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "jump"],
   instructions: ["Run to the thrown toy and pick it up.", "Bring it back to your owner."],
};

export default definition;
