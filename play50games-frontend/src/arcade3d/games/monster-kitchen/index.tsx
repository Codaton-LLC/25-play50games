"use client";

// Monster Kitchen: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The shell
// owns the screens, the HUD chips, the 90 s timer, pause and the score submit; the game owns Scene.tsx
// (the frame loop and what moves), rules.ts (the logic) and assets.ts (the models). The order bubbles
// and the ◀ ▶ wheel buttons live in the game-local Hud.
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS } from "./rules";

const definition: GameDefinition = {
   slug: "monster-kitchen",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   lives: 3,
   // only the first frame uses this: Scene's CameraRig refits the README's area every size/banner change
   camera: { position: [-0.7, 3.2, 8], fov: 42, lookAt: [-0.7, 1.0, -0.55] },
   environment: { background: "#3f3f46", fog: ["#3f3f46", 16, 42], lighting: "indoor" },
   // the swipe control renders no buttons; the two side arrows are the game-local ones in Hud.tsx
   touchControls: ["swipe", "tap"],
   hudStats: [{ key: "served", label: "Served" }],
   // the storm-off (or the last tip + confetti) is seen before the result
   resultDelayMs: 1200,
   instructions: [
      "Turn the ingredient wheel with Left/Right, A/D, swipes or the ◀ ▶ buttons.",
      "Toss (Space, Enter or tap an ingredient) what the bubble asks, in order, into the cauldron.",
      "A wrong toss burps: the order restarts and patience drops. Serve them before they storm off!",
   ],
};

export default definition;
