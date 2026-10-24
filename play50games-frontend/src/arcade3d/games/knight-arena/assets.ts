// ModelAsset entries and measured dimensions for knight-arena. Plain data, no three.js.
import {
   EXPANSION_ASSETS,
   EXPANSION_CHARACTER_HEIGHT,
   EXPANSION_CHARACTERS,
   PROP_BUDGET,
} from "../../core/sharedAssets";
import type { ModelAsset } from "../../core/types";

export const KNIGHT_HEIGHT = EXPANSION_CHARACTER_HEIGHT.knight; // 1.75 m (Q4 Decision)
export const DUMMY_HEIGHT = 1.5;
export const TOWER_HEIGHT = 6;
export const TREE_HEIGHT = 3.5;

export const SWORD_LENGTH = 0.85;
export const SWORD_BLADE_AHEAD = 0.70;
export const SWORD_HILT_BACK = 0.15;
export const SHIELD_HEIGHT = 0.55;

/**
 * Raw bounds of the knight-arena prop GLBs (GLB units, before scale), measured from
 * `/models/3d/knight-arena/sword.glb` and `shield.glb` (checked in `assets.test.ts`).
 * - `sword.glb`: point-down along y (blade tip at y = 0, crossguard at y = 1.389,
 *   grip at y = 1.562, pommel at y = 1.8964). At `SWORD_LENGTH = 0.85 m`, the grip sits
 *   at `y = 0.70 m` above the tip (`SWORD_BLADE_AHEAD`) and `0.15 m` below the pommel.
 * - `shield.glb`: heater shield standing along y (point at y = 0, top edge at y = 1.9017,
 *   front boss toward +z).
 */
export const SWORD_GLB_SIZE = {
   width: 0.559,
   height: 1.8964,
   depth: 0.1612,
} as const;

export const SHIELD_GLB_SIZE = {
   width: 1.44,
   height: 1.9017,
   depth: 0.3398,
} as const;

export type KnightArenaAssetId =
   | "knight"
   | "dummy"
   | "castleTower"
   | "leafyTree"
   | "sword"
   | "shield";

export const ASSETS: Record<KnightArenaAssetId, ModelAsset> = {
   knight: EXPANSION_CHARACTERS.knight,
   dummy: EXPANSION_ASSETS.dummy,
   castleTower: EXPANSION_ASSETS.castleTower,
   leafyTree: EXPANSION_ASSETS.leafyTree,
   sword: {
      id: "sword",
      url: "/models/3d/knight-arena/sword.glb",
      scale: SWORD_LENGTH / SWORD_GLB_SIZE.height,
      fallback: "box",
      fallbackColor: "#e2e8f0",
      budget: { tris: 1500, bytes: PROP_BUDGET.bytes },
   },
   shield: {
      id: "shield",
      url: "/models/3d/knight-arena/shield.glb",
      scale: SHIELD_HEIGHT / SHIELD_GLB_SIZE.height,
      fallback: "box",
      fallbackColor: "#2563eb",
      budget: { tris: 1500, bytes: PROP_BUDGET.bytes },
   },
};
