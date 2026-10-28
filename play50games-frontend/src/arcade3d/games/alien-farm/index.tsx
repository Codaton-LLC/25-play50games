"use client";

// Alien Farm: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The shell
// owns the screens, the HUD (score, Time, the stats), the 100 s timer ("timeup" ends the score
// attack, with the finish cue), pause and the submit; the game owns Scene.tsx, rules.ts, assets.ts.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { DESCRIPTIONS, LEVELS, type AlienFarmLevel } from "./levels";
import { COLORS, FOG, FOV } from "./looks";
import { DURATION_MS, HUD_STATS, RESULT_DELAY_MS } from "./rules";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

const definition: GameDefinition<AlienFarmLevel> = {
   slug: "alien-farm",
   Scene,
   Hud: CameraViewButton,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // only the first frame uses this: the Scene's CameraRig (core useFittedView) fits a 6 x 6 m
   // window around the farmer clear of the HUD, the joystick and the cookie banner, and follows it
   camera: { position: [0, 14, 12], fov: FOV, lookAt: [0, 0, 0] },
   environment: { background: COLORS.background, fog: [COLORS.fog, FOG.near, FOG.far], lighting: "sunset" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Pick" },
   hudStats: HUD_STATS,
   resultDelayMs: RESULT_DELAY_MS,
   instructions: [
      "Press Harvest (E, Enter or Space) when a crop's ring is full: gold = perfect. Too early or late loses that crop.",
      "Carry up to 4 crops and walk into the saucer's beam: a full load pays the most.",
      "Spores slow you; a wasted press cools the tool for 0.6 s. 100 seconds: score all you can.",
   ],
   levels: LEVEL_IDS.map((id): LevelSpec<AlienFarmLevel> => {
      const level = LEVELS[id];
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         durationMs: level.durationMs,
         hudStats: [
            { key: "delivered", label: "Delivered" },
            { key: "carry", label: "Basket", max: level.capacity },
            { key: "perfect", label: "Perfect" },
         ],
      };
   }),
};

export default definition;
