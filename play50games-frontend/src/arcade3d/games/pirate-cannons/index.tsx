"use client";

// Pirate Cannon Battle: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the 90 s timer, the lives, pause and the score submit; the game
// owns Scene.tsx (the frame loop and what moves), rules.ts (the logic), aim.ts (the lob aim) and
// assets.ts (the models).
import type { GameDefinition } from "@/arcade3d/core/types";
import Hud from "./Hud";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { FOV, SEA_FOCUS } from "./looks";
import { DURATION_MS, LIVES, WAVES } from "./rules";

const definition: GameDefinition = {
   slug: "pirate-cannons",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   lives: LIVES,
   // only the first frame uses this: Scene's CameraRig (core useFittedView, looks.ts viewFor) fits the
   // three lanes and the cannon clear of the HUD, the wind vane and the cookie banner
   camera: { position: [0, 7, 9], fov: FOV, lookAt: SEA_FOCUS },
   environment: { background: "#bae6fd", fog: ["#bae6fd", 140, 380], lighting: "day" },
   input: { drag: true },
   touchControls: [],
   hudStats: [{ key: "wave", label: "Wave", max: WAVES.length }],
   // the ship sailing into the harbour and the fort's flag coming down are seen before the result
   resultDelayMs: 1400,
   instructions: [
      "Drag sideways to turn, pull down to shoot farther.",
      "Release to fire. Tap fires the same aim again.",
      "Read the wind arrow. Hit a powder barrel to blast ships near it.",
   ],
};

export default definition;
