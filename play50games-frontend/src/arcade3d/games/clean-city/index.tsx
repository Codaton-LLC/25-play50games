"use client";

// Clean the City: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// The shell owns the screens, the HUD chips, the 240 s clock, pause and the score submit.
// The game owns Scene.tsx (one step per frame, then the draw), rules.ts (already built) and
// Primitives.tsx (the three maps). Status stays "soon"; scoring is meta.ts, unchanged.
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import MapHud from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS, ITEMS_PER_MAP, MAP_COUNT } from "./rules";

const definition: GameDefinition = {
   slug: "clean-city",
   Scene,
   Hud: MapHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // first frame only: Scene's CameraRig (core useFittedView) fits the floor, yaw 0, clear of
   // the HUD, the map pill, the joystick and the cookie banner, and follows the runner
   camera: { position: [0, 18.2, 12.3], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#8ec5f0", lighting: "day" },
   touchControls: ["joystick"],
   hudStats: [
      { key: "items", label: "Litter", max: ITEMS_PER_MAP },
      { key: "map", label: "Map", max: MAP_COUNT },
   ],
   instructions: [
      "Walk into litter to pick it up. Each map has 20 pieces.",
      "Clear the park, then the city, then the beach.",
      "+50 a piece. Finish all three for +10 per second left. You have 4 minutes.",
   ],
};

export default definition;
