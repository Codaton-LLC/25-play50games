"use client";

// Stub until the game is built. Owner: kimi. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "ghost-vacuum",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["joystick", "action"],
   instructions: ["Shine your light on a ghost to stun it.", "Hold Vacuum to suck it in."],
};

export default definition;
