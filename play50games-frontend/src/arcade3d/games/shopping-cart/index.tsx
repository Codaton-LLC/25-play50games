"use client";

// Crazy Shopping Cart GameDefinition: loaded lazily by arcade3d/loaders.ts.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Hud from "./Hud";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { COLORS, FOG } from "./looks";
import { LEVELS, type ShoppingCartLevel } from "./levels";
import { STORE_LOOKS } from "./storeLooks";
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
   2: "Fresh Food: 7 items in 100 s. Produce stands, chilled cases and misted, slippery floors.",
   3: "Household Aisles: 9 items in 150 s. Stock pallets zigzag the aisles and a floor scrubber patrols.",
   4: "Superstore: 12 items in 150 s. Bakery promo islands, a zigzag aisle and a moving stock pallet.",
   5: "Closing-Time Rush: 15 items in 180 s, lights half off, cleaning crew out, one checkout lane shuts at 60 s.",
};

/** Each level's twist, as a fourth start-card line. */
const TWISTS: Record<Exclude<LevelId, 1>, string> = {
   2: "Fresh Food: the misters keep two patches of floor wet from the start; steer around the produce stands.",
   3: "Household: weave the pallets in aisle 2 and 5. The floor scrubber stuns you like a shopper.",
   4: "Superstore: bakery islands in the side aisles, and a stock pallet rolls up and down aisle 5.",
   5: "Closing time: the left checkout lane shuts at 60 s. Scrubber and pallet are both out; mop water by the freezers.",
};

/** The level's light, sky and fog (storeLooks.ts). */
function environmentFor(id: LevelId) {
   const look = STORE_LOOKS[LEVELS[id].store.theme];
   return { background: look.background, fog: [look.fog[0], look.fog[1], look.fog[2]] as [string, number, number], lighting: look.lighting };
}

const definition: GameDefinition<ShoppingCartLevel> = {
   slug: "shopping-cart",
   Scene,
   Hud,
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
         instructions: [...instructionsFor(level), TWISTS[id]],
         environment: environmentFor(id),
         durationMs: level.durationMs,
         hudStats: [{ key: "items", label: "Items", max: level.listCount }],
      };
   }),
};

export default definition;
