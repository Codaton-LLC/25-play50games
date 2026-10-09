"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS, COUNT } from "./rules";

const definition: GameDefinition = {
   slug: "ghost-vacuum",
   Scene, Hud, assets: ASSETS, durationMs: DURATION_MS,
   camera: { position: [0, 14, 9], fov: 45, lookAt: [0, 0, 8] },
   environment: { lighting: "night", background: "#1e1b4b" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Vacuum" },
   hudStats: [{ key: "ghosts", label: "Ghosts", max: COUNT }], resultDelayMs: 1600,
   instructions: ["Explore the rooms: nearby desks reveal hidden ghosts.", "Aim the flashlight to stun; hold E, Enter or Space to vacuum.", "Touch: joystick moves and aims; held Vacuum assists nearby stunned targets."],
};

export default definition;
