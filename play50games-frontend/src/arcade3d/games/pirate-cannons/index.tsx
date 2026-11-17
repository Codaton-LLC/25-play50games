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
import { BAY_THEMES, COLORS, FOV, SEA_FOCUS } from "./looks";
import { LEVELS, type PirateLevel } from "./levels";
import { DURATION_MS, LIVES, WAVES } from "./rules";

const HUD: NonNullable<GameDefinition["hudStats"]> = [{ key: "wave", label: "Wave", max: WAVES.length }];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Training Deck on a sunny bay: five waves of pirate ships in 90 seconds. Score 3000 to clear.",
   2: "Harbor Targets, ships moored off the shore: every ship a lane farther out, one more each wave. Score 3500.",
   3: "Moving Boats at sunset, a fleet on the horizon: sloops zig-zag from wave 1, every ship faster. Score 4000.",
   4: "Storm Battle at night: rain, lightning and rough seas; more dinghies, faster ships, stronger wind. Score 4500.",
   5: "Captain Challenge under the flagship's guns: the most ships, the fastest, the strongest wind.",
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
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: HUD,
      // each level's own sky and light (looks.ts BAY_THEMES); level 1 keeps today's sunny bay
      ...(id === 1 ? {} : { environment: { background: BAY_THEMES[id].sky, fog: [BAY_THEMES[id].sky, id === 4 ? 90 : 140, id === 4 ? 260 : 380] as [string, number, number], lighting: BAY_THEMES[id].lighting } }),
   })),
   instructions: [
      "Drag sideways to turn, pull down to shoot farther.",
      "Release to fire. Tap fires the same aim again.",
      "Read the wind arrow. Hit a powder barrel to blast ships near it.",
   ],
};

export default definition;
