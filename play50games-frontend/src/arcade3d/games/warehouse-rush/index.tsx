"use client";

// Warehouse Rush: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the timer, pause and the score submit; the game owns
// Scene.tsx (frame loop + moving things), rules.ts (logic), Hud.tsx (the order panel) and
// assets.ts (models). Levels: one LevelSpec per meta.ts level, built from levels.ts.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import OrderHud from "./Hud";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type WarehouseLevel } from "./levels";
import { DURATION_MS, PROPOSED_LEVEL_LIMITS, capScore } from "./rules";

const INSTRUCTIONS = [
   "Read the order at the top: a box colour and its zone.",
   "Drive to a box of that colour and press Action (E or Space) to lift it.",
   "Drive into its zone and press Action again: +50. Wrong zone: -20.",
   "One box at a time. You have 60 seconds.",
];

/** Start-card lines for levels 2–5. Level 1 keeps INSTRUCTIONS exactly. */
function instructionsFor(level: WarehouseLevel): string[] {
   const lines = [
      "Read the order at the top: a box colour and its zone.",
      "Drive to a box of that colour and press Action (E or Space) to lift it.",
      "Drive into its zone and press Action again: +50. Wrong zone: -20.",
      "One box at a time.",
   ];
   if (level.slowZones > 0) lines.push("Blue and red floor lanes slow the robot.");
   if (level.extraRacks > 0) lines.push("Extra shelves stand in the side gates.");
   if (level.forklifts === 1) lines.push("A forklift crosses the north lane.");
   if (level.forklifts > 1) lines.push("Forklifts cross the north and south lanes.");
   if (level.orderMs > 0) lines.push(`Deliver each order within ${level.orderMs / 1000} seconds, or it expires for −20.`);
   lines.push(`You have ${level.durationMs / 1000} seconds.`);
   return lines;
}

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "60 seconds. Four pallets, four colour zones.",
   2: "75 seconds. Blue and red lanes slow the robot.",
   3: "90 seconds. Extra shelves narrow both side gates.",
   4: "Night shift, 105 seconds. A forklift crosses, and orders last 16 seconds.",
   5: "120 seconds. Two faster forklifts and a 12-second order limit.",
};

const ENVIRONMENTS: Record<LevelId, LevelSpec["environment"]> = {
   1: undefined,
   2: { background: "#102433", lighting: "day" },
   3: { background: "#2a1810", lighting: "sunset" },
   4: { background: "#070b14", fog: ["#070b14", 26, 52], lighting: "night" },
   5: { background: "#2a0c14", fog: ["#3b1020", 22, 46], lighting: "sunset" },
};

const definition: GameDefinition<WarehouseLevel> = {
   slug: "warehouse-rush",
   Scene,
   Hud: OrderHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // first frame only: Scene's CameraRig (core useFittedView) fits the warehouse, clear of the HUD,
   // the order panel, the joystick and the Action button
   camera: { position: [0, 17.3, 11.7], fov: FOV, lookAt: [0, 0, 0] },
   environment: { background: "#0b1220", lighting: "indoor" },
   touchControls: ["joystick", "action"],
   hudStats: [{ key: "delivered", label: "Delivered" }],
   instructions: INSTRUCTIONS,
   // safety net only: the level's own limits (level 1 is meta.scoring). README proves a real run stays under the cap.
   finalScore: (s) => {
      const id = ((s as { levelId?: LevelId }).levelId ?? 1) as LevelId;
      return { score: capScore(s.score, s.elapsedMs, PROPOSED_LEVEL_LIMITS[id] ?? PROPOSED_LEVEL_LIMITS[1]), durationMs: s.elapsedMs };
   },
   levels: LEVEL_IDS.map((id): LevelSpec<WarehouseLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      const spec: LevelSpec<WarehouseLevel> = {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         environment: ENVIRONMENTS[id],
         durationMs: level.durationMs,
      };
      if (level.orderMs > 0) {
         spec.hudStats = [
            { key: "delivered", label: "Delivered" },
            { key: "left", label: "Order", max: level.orderMs / 1000 },
         ];
      }
      return spec;
   }),
};

export default definition;
