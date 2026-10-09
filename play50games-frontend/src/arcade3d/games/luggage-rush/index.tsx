"use client";

// Airport Luggage Rush: the GameDefinition GameShell runs. The shell owns the screens, the 120 s
// clock, pause and the score submit; the game owns Scene.tsx, rules.ts and assets.ts.
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { DURATION_MS, RESULT_DELAY_MS, STRIKE_LIMIT } from "./rules";

const definition: GameDefinition = {
   slug: "luggage-rush",
   Scene,
   assets: ASSETS,
   durationMs: DURATION_MS,
   resultDelayMs: RESULT_DELAY_MS,
   camera: { position: [6, 16, 22], fov: 50, lookAt: [5.5, 0, 7] },
   environment: { background: "#e2e8f0", lighting: "indoor" },
   touchControls: ["tap"],
   hudStats: [
      { key: "strikes", label: "Strikes", max: STRIKE_LIMIT },
      { key: "combo", label: "Combo" },
   ],
   instructions: [
      "A / left, S / down and D / right flip diverters 1–3. W / up flips diverter 4 after 70 s.",
      "Or tap a diverter. Match each bag's colour and symbol to its chute.",
      "+20 a bag, up to ×3 in a row. A gold rim is a VIP and scores double. Three misses end the run.",
   ],
};

export default definition;
