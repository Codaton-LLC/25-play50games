"use client";

// Food Catcher: the GameDefinition GameShell runs. The shell owns screens, the timer, pause and
// score submit. This game owns the scene, the rules and the 2x badge.
import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import FoodHud from "./Hud";
import Scene from "./Scene";
import { LIVES, ROUND_MS, finalScore } from "./rules";

const definition: GameDefinition = {
   slug: "food-catcher",
   Scene,
   Hud: FoodHud,
   assets: ASSETS,
   durationMs: ROUND_MS,
   lives: LIVES,
   // only the first frame uses this: Scene's CameraRig (core useFittedView) fits the play rectangle
   // to the screen, clear of the HUD and the 2x badge
   camera: { position: [0, 3.25, 12], fov: 40, lookAt: [0, 3.25, 0] },
   environment: { background: "#1c1410", lighting: "indoor" },
   touchControls: [],
   hudStats: [{ key: "combo", label: "Combo" }],
   instructions: [
      "Slide the chef and catch the good food.",
      "Five catches in a row score double.",
      "Socks and tins cost a life. Three and you are out.",
   ],
   // safety net only (core capScore): README proves a real run never reaches the cap
   finalScore: (s) => finalScore(s.score, s.elapsedMs),
};

export default definition;
