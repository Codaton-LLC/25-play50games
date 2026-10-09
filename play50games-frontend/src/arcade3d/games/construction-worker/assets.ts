// Shared runner, reused pallet and van, shared crate. This game owns no GLB.
import type { ModelAsset } from "@/arcade3d/core/types";
import { REUSED_ASSETS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** Office-escape's runner scale: 0.825 draws the mesh 1.556 m tall. */
export const WORKER_SCALE = 0.825;

export const ASSETS = {
   worker: { ...SHARED_ASSETS.runner, scale: WORKER_SCALE },
   // warehouse pallet is 1.90 x 0.52 x 1.90; this site wants 1.2 x 0.15 x 0.8
   pallet: { ...REUSED_ASSETS.pallet, scale: 0.632, stretch: [1, 0.456, 0.667] as const },
   crate: { ...SHARED_ASSETS.crate, scale: 0.8 / 1.88 },
   // pigeon van is 1.17 x 1.04 x 1.89; ~4.5 m along its long axis
   van: { ...REUSED_ASSETS.van, scale: 4.5 / 1.89 },
} satisfies Record<string, ModelAsset>;
