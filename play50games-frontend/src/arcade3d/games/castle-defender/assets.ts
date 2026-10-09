import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_ASSETS, REUSED_GLB_SIZE, expansionPoint } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   goblin: { ...EXPANSION_ASSETS.goblin, scale: 1.6 / EXPANSION_GLB_SIZE.goblin.height },
   tower: EXPANSION_ASSETS.castleTower,
   cannon: { ...EXPANSION_ASSETS.cannon, rotationY: Math.PI },
   rock: EXPANSION_ASSETS.rock,
   tree: EXPANSION_ASSETS.leafyTree,
   gate: { ...REUSED_ASSETS.door, scale: 3 / REUSED_GLB_SIZE.door.height },
} satisfies Record<string, ModelAsset>;

const muzzle = expansionPoint(ASSETS.cannon, EXPANSION_GLB_POINTS.cannonMuzzle);
export const MUZZLE = { x: muzzle.x, y: muzzle.y + 1.2, z: muzzle.z + 3 };
