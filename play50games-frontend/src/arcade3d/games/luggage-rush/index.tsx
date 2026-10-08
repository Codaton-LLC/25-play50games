"use client";

// Stub until the game is built. Owner: cursor. Replace PlaceholderScene with ./Scene.
import type { GameDefinition } from "@/arcade3d/core/types";
import { PlaceholderScene } from "@/arcade3d/core/PlaceholderScene";

const definition: GameDefinition = {
   slug: "luggage-rush",
   Scene: PlaceholderScene,
   assets: {},
   camera: { position: [0, 6, 10], fov: 50, lookAt: [0, 0, 0] },
   touchControls: ["tap"],
   instructions: ["Flip the diverters to route each bag.", "Match the bag's colour and symbol to its flight."],
};

export default definition;
