// Each level's own room dressing (README "Levels"): the Snack Bar is today's cave kitchen; the Monster
// Café adds café tables, chairs, a bakery stand and a menu board; the Busy Kitchen adds prep counters
// and two pizza ovens; the Dinner Rush hangs lanterns and lays a candlelit table; the Grand Feast lays
// a long banquet with gourds, a top hat, jars and candles under bunting. Pure data: reused Hyper3D
// GLBs (one InstancedModel per kind) plus a few code-built pieces. Every spot stands outside
// PLAY_BOUNDS and off every camera line to the play (sets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { LevelId } from "@/arcade3d/types";

/** Raw GLB bounds (width x, height y, depth z), measured 2026-10-29 (sets.test.ts re-measures them). */
export const SET_GLB = {
   table: { url: "/models/3d/shared/table.glb", width: 1.896, height: 0.8729, depth: 0.9264 },
   chair: { url: "/models/3d/shared/woodenChair.glb", width: 0.9054, height: 1.8967, depth: 1.0048 },
   prepCounter: { url: "/models/3d/pizza-kitchen-3d/prepCounterR.glb", width: 1.5933, height: 1.8967, depth: 1.1 },
   oven: { url: "/models/3d/pizza-kitchen-3d/pizzaOven.glb", width: 1.8882, height: 1.568, depth: 1.4866 },
   lantern: { url: "/models/3d/magic-carpet-ride/hangingLantern.glb", width: 0.8719, height: 1.9077, depth: 0.8242 },
   candle: { url: "/models/3d/wizard-potion-lab/candle.glb", width: 1.6364, height: 1.9055, depth: 1.6393 },
   gourd: { url: "/models/3d/alien-farm/gourd.glb", width: 1.7987, height: 1.8942, depth: 1.1177 },
   potionJar: { url: "/models/3d/monster-kitchen/potionJar.glb", width: 1.0797, height: 1.889, depth: 1.2071 },
   topHat: { url: "/models/3d/monster-kitchen/monsterTopHat.glb", width: 1.5248, height: 1.1396, depth: 1.9014 },
   bakery: { url: "/models/3d/shopping-cart/bakeryStand.glb", width: 1.478, height: 1.8913, depth: 1.5569 },
} as const;

export type SetKind = keyof typeof SET_GLB;

/** One GLB at unit height: a spot's scale is its drawn height (m); `wide` stretches it along x. */
export const SET_ASSETS = Object.fromEntries(
   (Object.keys(SET_GLB) as SetKind[]).map((kind) => [
      kind,
      { id: `kitchen-set-${kind}`, url: SET_GLB[kind].url, scale: 1 / SET_GLB[kind].height, fallback: "box", fallbackColor: "#78716c", budget: { tris: 12000, bytes: PROP_BUDGET.bytes * 4 } } satisfies ModelAsset,
   ]),
) as Record<SetKind, ModelAsset>;

export interface SetSpot {
   kind: SetKind;
   x: number;
   /** height of its base over the floor (on a table: 0.75) */
   y: number;
   z: number;
   /** drawn height (m) */
   h: number;
   rotY?: number;
   /** extra stretch along its own x (a long banquet table) */
   wide?: number;
}

/** The code-built pieces a level adds: a café menu board, bunting over the feast, warm lantern light. */
export interface LevelExtras {
   menu: boolean;
   bunting: boolean;
   lanternLight: boolean;
}

const T = 0.75; // a table top

// Everything stands in the two side strips the camera sees past the hatch wall (x <= -3.2 and
// x >= 1.8, z -1.1 .. -3.4, in front of the rock wall at z -3.38), clear of today's crates, barrels
// and shelves; lanterns hang above the strips.
export const SETS: Record<LevelId, { spots: readonly SetSpot[]; extras: LevelExtras }> = {
   // Snack Bar: today's cave kitchen
   1: { spots: [], extras: { menu: false, bunting: false, lanternLight: false } },
   // Monster Café: a café table with two chairs on the left, a bakery stand and a small table on the right
   2: {
      spots: [
         { kind: "table", x: -4.2, y: 0, z: -2.4, h: T },
         { kind: "chair", x: -4.95, y: 0, z: -2.4, h: 0.95, rotY: Math.PI / 2 },
         { kind: "chair", x: -3.5, y: 0, z: -2.4, h: 0.95, rotY: -Math.PI / 2 },
         { kind: "potionJar", x: -4.2, y: T, z: -2.4, h: 0.32 },
         { kind: "bakery", x: 3.1, y: 0, z: -2.7, h: 1.5 },
         { kind: "table", x: 2.6, y: 0, z: -1.5, h: T, wide: 0.6 },
         { kind: "candle", x: 2.6, y: T, z: -1.5, h: 0.28 },
      ],
      extras: { menu: true, bunting: false, lanternLight: false },
   },
   // Busy Kitchen: a pizza oven on the left, a prep counter and a second oven on the right
   3: {
      spots: [
         { kind: "oven", x: -4.2, y: 0, z: -2.5, h: 1.2, rotY: Math.PI / 2 },
         { kind: "prepCounter", x: 2.3, y: 0, z: -2.2, h: 1.0, rotY: -Math.PI / 2 },
         { kind: "oven", x: 3.4, y: 0, z: -2.5, h: 1.2, rotY: -Math.PI / 2 },
         { kind: "potionJar", x: 2.3, y: 1.0, z: -1.8, h: 0.3 },
         { kind: "potionJar", x: 2.3, y: 1.0, z: -2.6, h: 0.26, rotY: 1 },
      ],
      extras: { menu: false, bunting: false, lanternLight: false },
   },
   // Dinner Rush: lanterns over both strips and candlelit tables under them
   4: {
      spots: [
         { kind: "lantern", x: -3.7, y: 2.2, z: -1.4, h: 0.6 },
         { kind: "lantern", x: -4.4, y: 2.3, z: -2.8, h: 0.6 },
         { kind: "lantern", x: 2.5, y: 2.2, z: -1.4, h: 0.6 },
         { kind: "lantern", x: 3.3, y: 2.3, z: -2.8, h: 0.6 },
         { kind: "table", x: -4.2, y: 0, z: -2.3, h: T, rotY: Math.PI / 2 },
         { kind: "table", x: 2.9, y: 0, z: -2.3, h: T, rotY: Math.PI / 2 },
         { kind: "candle", x: -4.2, y: T, z: -2.0, h: 0.3 },
         { kind: "candle", x: -4.2, y: T, z: -2.6, h: 0.34 },
         { kind: "candle", x: 2.9, y: T, z: -2.0, h: 0.34 },
         { kind: "candle", x: 2.9, y: T, z: -2.6, h: 0.3 },
      ],
      extras: { menu: false, bunting: false, lanternLight: true },
   },
   // Grand Feast: two long banquet tables laden with gourds, a top hat, jars and candles, bunting above
   5: {
      spots: [
         { kind: "table", x: -4.2, y: 0, z: -2.4, h: T, rotY: Math.PI / 2, wide: 1.25 },
         { kind: "table", x: 2.9, y: 0, z: -2.3, h: T, rotY: Math.PI / 2, wide: 1.3 },
         { kind: "gourd", x: -4.2, y: T, z: -1.6, h: 0.4, rotY: 0.4 },
         { kind: "topHat", x: -4.2, y: T, z: -2.3, h: 0.26, rotY: 1.2 },
         { kind: "potionJar", x: -4.2, y: T, z: -2.9, h: 0.32 },
         { kind: "gourd", x: 2.9, y: T, z: -2.9, h: 0.36, rotY: -0.8 },
         { kind: "potionJar", x: 2.9, y: T, z: -2.2, h: 0.3, rotY: 2 },
         { kind: "candle", x: 2.9, y: T, z: -1.6, h: 0.32 },
         { kind: "candle", x: -4.2, y: T, z: -3.2, h: 0.28 },
         { kind: "lantern", x: -3.7, y: 2.2, z: -1.6, h: 0.6 },
         { kind: "lantern", x: 2.5, y: 2.2, z: -1.6, h: 0.6 },
      ],
      extras: { menu: false, bunting: true, lanternLight: true },
   },
};
