"use client";

// Monster Kitchen: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The shell
// owns the screens, the HUD chips, the timer, pause and the score submit; the game owns Scene.tsx
// (the frame loop and what moves), rules.ts (the logic) and assets.ts (the models). The order bubbles
// and the ◀ ▶ wheel buttons live in the game-local Hud.
// Levels: one LevelSpec per meta.ts level, built from levels.ts (core/README.md "Levels").
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, type KitchenLevel } from "./levels";
import { DURATION_MS } from "./rules";

const BASE_INSTRUCTIONS = [
   "Turn the ingredient wheel with Left/Right, A/D, swipes or the ◀ ▶ buttons.",
   "Toss (Space, Enter or tap an ingredient) what the bubble asks, in order, into the cauldron.",
   "A wrong toss burps: the order restarts and patience drops. Serve them before they storm off!",
];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "The cave Snack Bar, 90 seconds. The second monster waits until late in the shift.",
   2: "The Monster Café (tables, bakery, menu board): the second hatch opens sooner, orders grow longer.",
   3: "The Busy Kitchen (prep counters, pizza ovens): both hatches, and the wheel drifts while you cook.",
   4: "Dinner Rush by lantern light: monsters lose patience faster, and a wrong toss costs more.",
   5: "The Grand Feast (banquet table, bunting): two hatches, a fast drift and short patience.",
};

/** Replaces the start-card lines when the level adds a mechanic. Level 1 keeps BASE_INSTRUCTIONS. */
const INSTRUCTIONS: Record<LevelId, string[] | undefined> = {
   1: undefined,
   2: [...BASE_INSTRUCTIONS, "A second monster steps up halfway through. Cook both bubbles."],
   3: [...BASE_INSTRUCTIONS, "The wheel drifts on its own. Keep the next ingredient at the front."],
   4: [...BASE_INSTRUCTIONS, "Patience drains faster, and a wrong toss costs more. Serve them quickly."],
   5: [...BASE_INSTRUCTIONS, "Both hatches open early, the wheel drifts, and patience is short."],
};

const ENVIRONMENTS: Record<LevelId, LevelSpec<KitchenLevel>["environment"]> = {
   1: undefined,
   2: { background: "#78716c", fog: ["#78716c", 16, 42], lighting: "day" },
   3: { background: "#7c2d12", fog: ["#7c2d12", 14, 36], lighting: "sunset" },
   4: { background: "#0c0a09", fog: ["#0c0a09", 10, 28], lighting: "night" },
   5: { background: "#431407", fog: ["#9a3412", 12, 32], lighting: "sunset" },
};

const SERVED: NonNullable<GameDefinition["hudStats"]> = [{ key: "served", label: "Served" }];

const definition: GameDefinition<KitchenLevel> = {
   slug: "monster-kitchen",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   lives: 3,
   // only the first frame uses this: Scene's CameraRig refits the README's area every size/banner change
   camera: { position: [-0.7, 3.2, 8], fov: 42, lookAt: [-0.7, 1.0, -0.55] },
   environment: { background: "#3f3f46", fog: ["#3f3f46", 16, 42], lighting: "indoor" },
   // the swipe control renders no buttons; the two side arrows are the game-local ones in Hud.tsx
   touchControls: ["swipe", "tap"],
   hudStats: SERVED,
   // the storm-off (or the last tip + confetti) is seen before the result
   resultDelayMs: 1200,
   instructions: BASE_INSTRUCTIONS,
   levels: LEVEL_IDS.map((id): LevelSpec<KitchenLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: INSTRUCTIONS[id],
         environment: ENVIRONMENTS[id],
         durationMs: level.durationMs,
         hudStats: SERVED,
      };
   }),
};

export default definition;
