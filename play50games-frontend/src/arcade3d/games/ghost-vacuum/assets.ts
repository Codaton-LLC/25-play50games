import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_ASSETS, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const HUNTER_SCALE = 1.56 / 1.886;
export const VACUUM_SCALE = 0.55 / EXPANSION_GLB_SIZE.vacuum.height;
export const PACK_OFFSET = [0, -EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE, EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE - 0.01] as const;
export const ASSETS = {
   hunter: { ...SHARED_ASSETS.runner, scale: HUNTER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
   vacuum: { ...EXPANSION_ASSETS.vacuum, scale: VACUUM_SCALE, rotationY: Math.PI },
   desk: SHARED_ASSETS.desk, chair: SHARED_ASSETS.chair, book: REUSED_ASSETS.book, door: REUSED_ASSETS.door,
} satisfies Record<string, ModelAsset>;
