"use client";

// Mini Golf 3D: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The shell
// owns the screens, the HUD chips, pause and the score submit; the game owns Scene.tsx (the frame
// loop and what moves), rules.ts / physics.ts / course.ts (the logic), aim.ts (the putt aim) and
// assets.ts (the models). No durationMs: the rules end the run at 600 s of play themselves.
import type { GameDefinition } from "@/arcade3d/core/types";
import Hud from "./Hud";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { HOLE_COUNT } from "./course";
import { COLORS, FOV } from "./looks";

const definition: GameDefinition = {
   slug: "mini-golf",
   Scene,
   Hud,
   assets: ASSETS,
   // only the first frame uses this: Scene's CameraRig (core useFittedView, looks.ts) fits each hole
   camera: { position: [0, 8, 6], fov: FOV, lookAt: [0, 0, 0] },
   environment: { background: COLORS.sky, fog: [COLORS.sky, 30, 90], lighting: "day" },
   input: { drag: true },
   touchControls: [],
   hudStats: [
      { key: "hole", label: "Hole", max: HOLE_COUNT },
      { key: "par", label: "Par" },
      { key: "strokes", label: "Strokes" },
   ],
   // the drop, the flag and (birdie or better) the confetti are seen before the result
   resultDelayMs: 1800,
   instructions: [
      "Pull back from anywhere: the longer the pull, the harder the putt.",
      "Release to putt. Sink it in as few strokes as you can.",
      "Keys: arrows aim and set power; hold Space and release, or Enter putts the power shown.",
   ],
};

export default definition;
