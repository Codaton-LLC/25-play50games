"use client";

// Pirate Cannon Battle: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the 90 s timer, the lives, pause and the score submit; the game
// owns Scene.tsx (the frame loop and what moves), rules.ts (the logic), aim.ts (the lob aim) and
// assets.ts (the models).
import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Hud from "./Hud";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { COLORS, FOV, SEA_FOCUS } from "./looks";
import { LEVELS, type PirateLevel } from "./levels";
import { DURATION_MS, LIVES, WAVES } from "./rules";

const HUD: NonNullable<GameDefinition["hudStats"]> = [{ key: "wave", label: "Wave", max: WAVES.length }];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Five waves of pirate ships in 90 seconds. Score 3000 to clear.",
   2: "Every ship sails a lane farther out, and one more each wave. Score 3500.",
   3: "Sloops zig-zag from the first wave and every ship is faster. Score 4000.",
   4: "Two more dinghies a wave, faster again, a stronger wind. Score 4500.",
   5: "A dinghy and a sloop more each wave, the fastest ships, the strongest wind.",
};

const definition: GameDefinition<PirateLevel> = {
   slug: "pirate-cannons",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   lives: LIVES,
   // only the first frame uses this: Scene's CameraRig (core useFittedView, looks.ts viewFor) fits the
   // three lanes and the cannon clear of the HUD, the wind vane and the cookie banner
   camera: { position: [0, 7, 9], fov: FOV, lookAt: SEA_FOCUS },
   environment: { background: COLORS.sky, fog: [COLORS.sky, 140, 380], lighting: "day" },
   input: { drag: true },
   touchControls: [],
   hudStats: HUD,
   // the ship sailing into the harbour and the fort's flag coming down are seen before the result
   resultDelayMs: 1400,
   levels: LEVEL_IDS.map((id) => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], hudStats: HUD })),
   instructions: [
      "Drag sideways to turn, pull down to shoot farther.",
      "Release to fire. Tap fires the same aim again.",
      "Read the wind arrow. Hit a powder barrel to blast ships near it.",
   ],
};

export default definition;
