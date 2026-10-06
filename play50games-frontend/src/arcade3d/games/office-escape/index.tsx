"use client";

// Office Escape: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// The shell owns the screens, the HUD (Score, Played, Coins), pause and the score submit. The game
// owns Scene.tsx (frame loop + drawing), rules.ts (the outcome), camera.ts (the chase camera fit),
// Hud.tsx (the speed-up notice) and assets.ts (models). Untimed: no durationMs, no lives. A run ends
// by the rules: a hit ("lose") or the 29:55 run limit ("win").
import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import OfficeHud from "./Hud";
import Scene from "./Scene";

const definition: GameDefinition = {
   slug: "office-escape",
   Scene,
   Hud: OfficeHud,
   assets: ASSETS,
   // first frame only: Scene's CameraRig refits on mount (camera.ts fitChase)
   camera: { position: [0, 4.3, 7], fov: 50, lookAt: [0, 0, -8] },
   environment: { background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "indoor" },
   touchControls: ["swipe"],
   hudStats: [{ key: "coins", label: "Coins" }],
   instructions: [
      "Run as far as you can. Swipe or press Left / Right to change lanes.",
      "Swipe up or press Space to jump desks, printers and boxes.",
      "Dodge chairs, coffee carts and water coolers. One hit ends the run.",
      "1 point per metre, +50 per coin. It gets faster every 20 s.",
   ],
};

export default definition;
