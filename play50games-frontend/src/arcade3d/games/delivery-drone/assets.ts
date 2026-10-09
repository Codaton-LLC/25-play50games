import type { ModelAsset } from "@/arcade3d/core/types";
import { DRONE_ROTORS_GLB, EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, REUSED_ASSETS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const DRONE_SCALE = 0.9 / EXPANSION_GLB_SIZE.drone.width;
export const DRONE_HOOK = EXPANSION_GLB_POINTS.droneHook;
export const BODY_OFFSET = [-DRONE_HOOK.x * DRONE_SCALE, 0, -DRONE_HOOK.z * DRONE_SCALE] as const;
export const ROTORS = DRONE_ROTORS_GLB.map((p) => ({ x: (p.x - DRONE_HOOK.x) * DRONE_SCALE, y: (p.y - DRONE_HOOK.y) * DRONE_SCALE, z: (p.z - DRONE_HOOK.z) * DRONE_SCALE }));
export const ASSETS = {
   drone: { ...EXPANSION_ASSETS.drone, scale: DRONE_SCALE, yOffset: -DRONE_HOOK.y * DRONE_SCALE },
   car: { ...REUSED_ASSETS.car, scale: 1.6 / 1.9 },
   taxi: { ...REUSED_ASSETS.taxi, scale: 1.6 / 1.9 },
   van: { ...REUSED_ASSETS.van, scale: 2 / 1.9 },
   pigeon: { ...REUSED_ASSETS.pigeon, scale: 0.6 / 0.99 },
   crate: { ...SHARED_ASSETS.crate, scale: 0.8 / 1.88 },
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: 3 / EXPANSION_GLB_SIZE.leafyTree.height },
} satisfies Record<string, ModelAsset>;
