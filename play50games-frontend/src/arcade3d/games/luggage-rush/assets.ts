// Models for Airport Luggage Rush. Plain data: GameShell frees the GLBs, the scene draws them.
// Suitcase and plane are already imported (EXPANSION_ASSETS). The handler is the shared runner.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** Office-escape's runner height: 0.825 draws the 1.886 GLB at 1.556 m. */
export const HANDLER_SCALE = 0.825;

/** The shared plane fit is 8 m long. This bay draws it at 3.2 m so the hall fit stays on the belts. */
export const PLANE_LENGTH = 3.2;

export const ASSETS = {
   // A near-white shell. The flight tint multiplies this colour; the GLB's own dark albedo turned yellow brown and red maroon.
   suitcase: { ...EXPANSION_ASSETS.suitcase, material: { color: "#f8fafc", roughness: 0.4, metalness: 0.02 } },
   plane: { ...EXPANSION_ASSETS.plane, scale: PLANE_LENGTH / EXPANSION_GLB_SIZE.plane.depth },
   handler: { ...SHARED_ASSETS.runner, scale: HANDLER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
} satisfies Record<string, ModelAsset>;
