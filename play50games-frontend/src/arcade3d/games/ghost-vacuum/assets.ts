import type { ModelAsset } from "@/arcade3d/core/types";
import { GHOST_GLB_SCALE, GHOST_GLB_Y_OFFSET } from "./suck";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_ASSETS, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const HUNTER_SCALE = 1.56 / 1.886;
export const VACUUM_SCALE = 0.55 / EXPANSION_GLB_SIZE.vacuum.height;
/** The runner's upper back (shoulder blades, y ~1.40 GLB) sits 6.3 cm behind the mid-back strip the pack is aligned to, so the pack keeps this extra gap (measured on the posed mesh in poses.test.ts). */
export const BACK_CLEARANCE = 0.07;
export const PACK_OFFSET = [0, -EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE, EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE - 0.01 - BACK_CLEARANCE] as const;
export const ASSETS = {
   hunter: { ...SHARED_ASSETS.runner, scale: HUNTER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
   vacuum: { ...EXPANSION_ASSETS.vacuum, scale: VACUUM_SCALE, rotationY: Math.PI },
   desk: { ...SHARED_ASSETS.desk, material: { color: "#765038", roughness: 0.9 }, scale: 1.6 / 1.90155, stretch: [1, 1, 0.8 / (0.91617 * (1.6 / 1.90155))] },
   chair: { ...SHARED_ASSETS.chair, scale: 0.6 / 1.21227, stretch: [1, 1, 0.6 / (1.23750 * (0.6 / 1.21227))] },
   book: { ...REUSED_ASSETS.book, scale: 0.25 / 1.89505, rotationY: -Math.PI / 2, yOffset: -0.125 },
   door: { ...REUSED_ASSETS.door, scale: 2.2 / 1.89286 },
   /** Hyper3D sheet ghost (2500 tris, 59 KB): 1.35 m tall, middle on the frame's body centre y0.8. */
   ghost: { id: "ghost", url: "/models/3d/ghost-vacuum/ghost.glb", scale: GHOST_GLB_SCALE, yOffset: GHOST_GLB_Y_OFFSET, fallback: "sphere", fallbackColor: "#e0e7ff", budget: { tris: 5000, bytes: 300000 } },
} satisfies Record<string, ModelAsset>;
