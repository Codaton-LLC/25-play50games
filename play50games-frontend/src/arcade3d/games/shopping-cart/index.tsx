"use client";

// Crazy Shopping Cart GameDefinition: loaded lazily by arcade3d/loaders.ts.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { COLORS, FOG } from "./looks";
import { LEVELS, type ShoppingCartLevel } from "./levels";
import { DURATION_MS, LIST_COUNT } from "./rules";

function instructionsFor(level: ShoppingCartLevel): string[] {
   return [
      `Steer the runaway cart through aisles to grab all ${level.listCount} items on your list.`,
      "Hold Ride (Space or Ride button) to drift faster; dodge shoppers, spills & pyramids.",
      `Collect all ${level.listCount} items and dash to checkout before ${Math.round(level.durationMs / 1000)} s runs out!`,
   ];
}

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "6 items in 75 seconds: learn the drift and dodge.",
   2: "7 items in 100 seconds: more spread targets across aisles.",
   3: "9 items in 150 seconds: faster shoppers and an early 4th patrol.",
   4: "12 items in 150 seconds: dense shopping list across half the store.",
   5: "15 items in 180 seconds: rush hour with all 4 shoppers active from the start.",
};

const definition: GameDefinition<ShoppingCartLevel> = {
   slug: "shopping-cart",
   Scene,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [0, 16, 18], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: COLORS.bg, fog: [COLORS.fog, FOG.near, FOG.far], lighting: "indoor" },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Ride" },
   hudStats: [{ key: "items", label: "Items", max: LIST_COUNT }],
   resultDelayMs: 1200,
   instructions: instructionsFor(LEVELS[1]),
   levels: LEVEL_IDS.map((id): LevelSpec<ShoppingCartLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         durationMs: level.durationMs,
         hudStats: [{ key: "items", label: "Items", max: level.listCount }],
      };
   }),
};

export default definition;
