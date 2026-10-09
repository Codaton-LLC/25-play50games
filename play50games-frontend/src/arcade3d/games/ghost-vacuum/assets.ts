import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_ASSETS, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const HUNTER_SCALE = 1.56 / 1.886;
export const VACUUM_SCALE = 0.55 / EXPANSION_GLB_SIZE.vacuum.height;
export const PACK_OFFSET = [0, -EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE, EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE - 0.01] as const;
export const ASSETS = {
   hunter: { ...SHARED_ASSETS.runner, scale: HUNTER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
   vacuum: { ...EXPANSION_ASSETS.vacuum, scale: VACUUM_SCALE, rotationY: Math.PI },
   desk: { ...SHARED_ASSETS.desk, material: { color: "#765038", roughness: 0.9 }, scale: 1.6 / 1.90155, stretch: [1, 1, 0.8 / (0.91617 * (1.6 / 1.90155))] },
   chair: { ...SHARED_ASSETS.chair, scale: 0.6 / 1.21227, stretch: [1, 1, 0.6 / (1.23750 * (0.6 / 1.21227))] },
   book: { ...REUSED_ASSETS.book, scale: 0.25 / 1.89505, rotationY: -Math.PI / 2, yOffset: -0.125 },
   door: { ...REUSED_ASSETS.door, scale: 2.2 / 1.89286 },
} satisfies Record<string, ModelAsset>;
