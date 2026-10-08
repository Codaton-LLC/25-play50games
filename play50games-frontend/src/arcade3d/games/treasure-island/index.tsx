"use client";

// Treasure Island: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the 90 s timer, pause and the score submit; the game owns
// Scene.tsx (the frame loop and what moves), rules.ts (the logic) and assets.ts (the models).
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { FOV } from "./looks";
import { DURATION_MS, TREASURE_COUNT } from "./rules";

const definition: GameDefinition = {
   slug: "treasure-island",
   Scene,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // only the first frame uses this: Scene's CameraRig (core useFittedView, looks.ts viewFor) fits a
   // window around the explorer clear of the HUD, the joystick and the cookie banner, and follows it
   camera: { position: [0, 14, 20], fov: FOV, lookAt: [0, 0, 9] },
   environment: { background: "#fdba74", fog: ["#fdba74", 40, 95], lighting: "sunset" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dig" },
   hudStats: [{ key: "treasures", label: "Treasures", max: TREASURE_COUNT }],
   // the last reveal (often the chest), the confetti and the cheer are seen before the result
   resultDelayMs: 1600,
   instructions: [
      "Walk until the detector ring turns gold and pulses fast.",
      "Hold Dig (E, Enter or Space) to dig: find all 5 treasures before the tide.",
      "+200 a treasure, +50 with no wrong dig before it, +10 per second left.",
   ],
};

export default definition;
