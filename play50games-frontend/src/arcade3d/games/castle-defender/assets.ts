import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_ASSETS, REUSED_GLB_SIZE, expansionPoint } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   goblin: { ...EXPANSION_ASSETS.goblin, scale: 1.6 / EXPANSION_GLB_SIZE.goblin.height },
   tower: EXPANSION_ASSETS.castleTower,
   cannon: { ...EXPANSION_ASSETS.cannon, rotationY: Math.PI },
   rock: EXPANSION_ASSETS.rock,
   tree: EXPANSION_ASSETS.leafyTree,
   // Measured root-space bounds: throne 1.002748 x 1.905249 x 0.884694;
   // catapult 1.527623 x 1.561427 x 1.905334. Both bases are already at y = 0.
   royalThrone: {
      id: "royalThrone", budget: PROP_BUDGET,
      url: "/models/3d/castle-defender/royalThrone.glb", fallback: "box",
      scale: 1.8 / 1.9052486419677734, rotationY: 0, yOffset: 0,
   },
   siegeCatapultT: {
      id: "siegeCatapultT", budget: PROP_BUDGET,
      url: "/models/3d/castle-defender/siegeCatapultT.glb", fallback: "box",
      scale: 1.7 / 1.90533447265625, rotationY: Math.PI, yOffset: 0,
   },
   gate: { ...REUSED_ASSETS.door, scale: 3 / REUSED_GLB_SIZE.door.height },
} satisfies Record<string, ModelAsset>;

const muzzle = expansionPoint(ASSETS.cannon, EXPANSION_GLB_POINTS.cannonMuzzle);
export const MUZZLE = { x: muzzle.x, y: muzzle.y + 1.2, z: muzzle.z + 3 };

// Flat side margins ahead of the towers: royal seats and parked siege engines.
export const THRONE_SPOTS = [{ x: -6.3, y: 0, z: -1.5 }, { x: 6.3, y: 0, z: -1.5 }];
export const CATAPULT_SPOTS = [{ x: -6.32, y: 0, z: -5.5 }, { x: 6.32, y: 0, z: -5.5 }];
export const hasRoyalDecor = (level: number): boolean => level === 4 || level === 5;
