"use client";

// Warehouse Rush: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the 60 s timer, pause and the score submit; the game owns
// Scene.tsx (frame loop + moving things), rules.ts (logic), Hud.tsx (the order panel) and
// assets.ts (models).
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import OrderHud from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS, capScore } from "./rules";

const definition: GameDefinition = {
   slug: "warehouse-rush",
   Scene,
   Hud: OrderHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // first frame only: Scene's CameraRig (core useFittedView) fits the warehouse, clear of the HUD,
   // the order panel, the joystick and the Action button
   camera: { position: [0, 17.3, 11.7], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#0b1220", lighting: "indoor" },
   touchControls: ["joystick", "action"],
   hudStats: [{ key: "delivered", label: "Delivered" }],
   instructions: [
      "Read the order at the top: a box colour and its zone.",
      "Drive to a box of that colour and press Action (E or Space) to lift it.",
      "Drive into its zone and press Action again: +50. Wrong zone: -20.",
      "One box at a time. You have 60 seconds.",
   ],
   // safety net only (core capScore with meta.ts limits): README proves a real run never reaches the cap
   finalScore: (s) => ({ score: capScore(s.score, s.elapsedMs), durationMs: s.elapsedMs }),
};

export default definition;
