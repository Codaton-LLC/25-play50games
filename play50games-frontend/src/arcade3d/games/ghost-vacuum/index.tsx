"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { LEVELS, type GhostLevel } from "./levels";
import { DURATION_MS, COUNT } from "./rules";

const HUD: NonNullable<GameDefinition["hudStats"]> = [{ key: "ghosts", label: "Ghosts", max: COUNT }];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Twelve ghosts, three of them gold. Catch them all, or score 1500.",
   2: "Four gold ghosts, a little faster, and a shorter stun. Score 1600.",
   3: "Five gold ghosts, and four can roam at once early. Score 1700.",
   4: "Six gold and three big ghosts, quicker all round. Score 1800.",
   5: "Seven gold, four big, the fastest ghosts in the whole mansion.",
};

const definition: GameDefinition<GhostLevel> = {
   slug: "ghost-vacuum",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [0, 14, 9], fov: 45, lookAt: [0, 0, 8] },
   environment: {
      lighting: "night",
      background: COLORS.skyTop,
      fog: [COLORS.fog, 25, 75],
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Vac" },
   hudStats: HUD,
   resultDelayMs: 1600,
   levels: LEVEL_IDS.map((id) => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], hudStats: HUD })),
   instructions: [
      "Explore the rooms: nearby desks reveal hidden ghosts.",
      "Aim the flashlight to stun; hold E, Enter or Space to vacuum.",
      "Touch: joystick moves and aims; held Vacuum assists nearby stunned targets.",
   ],
};

export default definition;
