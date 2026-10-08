// Models used by Treasure Island. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes), Scene.tsx / Island.tsx draw them. No GLB of its own but the
// crab (assets.spec.json, already generated): the rest is shared (SHARED_ASSETS), reused from the
// original games (REUSED_ASSETS) or from the expansion batch (EXPANSION_ASSETS). Every fit is derived
// from measured GLB bounds (GLB units, w x h x d, the optimize step centres x and z, feet on y = 0)
// and checked on the real meshes in assets.test.ts.
import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, REUSED_ASSETS, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** The runner is 1.886 tall (T-pose): 0.825 draws it 1.556 m, office-escape's explorer height. */
export const EXPLORER_SCALE = 0.825;

/** palm.glb 1.775 x 1.903 x 1.782; its trunk leans: the base (y < 0.1) is centred at GLB (0, 0.19). */
export const PALM_GLB = { width: 1.775, height: 1.903, depth: 1.782, baseX: 0, baseZ: 0.19 } as const;
/** Drawn 3.0 m tall with a 2.4 m crown; the trunk base is about 0.54 m across (footprint r 0.3). */
export const PALM_SIZE = { height: 3, crown: 2.4 } as const;
const PALM_XZ = PALM_SIZE.crown / PALM_GLB.width;

/**
 * umbrella.glb 1.780 x 1.902 x 1.737, the pole about 0.09 across at the origin, the canopy's lowest
 * edge at GLB y 1.175. Drawn uniformly 2.8 m tall (canopy 2.62 across, its edge 1.73 m up), so the
 * hatted 1.56 m explorer walks under it; the design's 2.2 m put the canopy edge at its eyes.
 */
export const UMBRELLA_GLB = { height: 1.902, canopyEdge: 1.175 } as const;
export const UMBRELLA_HEIGHT = 2.8;

/** pigeon.glb 0.99 x 1.903 x 1.744, head at +z: a 0.8 m long seagull (0.6 m read as a speck from 4.5 m up). */
export const PIGEON_GLB_LENGTH = 1.744;
export const GULL_LENGTH = 0.8;

/** crate.glb 1.880 x 1.335 x 1.810: 0.8 m across (0.57 m tall). */
export const CRATE_GLB_WIDTH = 1.88;
export const CRATE_SIZE = 0.8;

/** The coin: 0.3 m across, its origin at its centre (it is laid flat in the piles). */
export const COIN_SIZE = 0.3;
const COIN_SCALE = COIN_SIZE / COIN_GLB_SIZE.width;

/** The crab: 0.5 m across its claws (the default fit's 0.35 is 9 px on a phone). */
export const CRAB_WIDTH = 0.5;

export const ASSETS = {
   explorer: { ...SHARED_ASSETS.runner, scale: EXPLORER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
   chest: EXPANSION_ASSETS.chest,
   rock: EXPANSION_ASSETS.rock,
   palm: { ...REUSED_ASSETS.palm, scale: PALM_XZ, stretch: [1, PALM_SIZE.height / PALM_GLB.height / PALM_XZ, PALM_SIZE.crown / PALM_GLB.depth / PALM_XZ] as const },
   umbrella: { ...REUSED_ASSETS.umbrella, scale: UMBRELLA_HEIGHT / UMBRELLA_GLB.height },
   crate: { ...SHARED_ASSETS.crate, scale: CRATE_SIZE / CRATE_GLB_WIDTH },
   coin: { ...SHARED_ASSETS.coin, scale: COIN_SCALE, yOffset: (-COIN_SCALE * COIN_GLB_SIZE.height) / 2 },
   gull: { ...REUSED_ASSETS.pigeon, id: "gull", scale: GULL_LENGTH / PIGEON_GLB_LENGTH, material: { color: "#f8fafc", roughness: 0.7 } },
   crab: { ...EXPANSION_ASSETS.crab, scale: CRAB_WIDTH / EXPANSION_GLB_SIZE.crab.width },
} satisfies Record<string, ModelAsset>;

/** Where a palm's footprint centre (its trunk base) is drawn from the model's origin, rotated by `yaw`. */
export function palmBaseOffset(yaw: number, size: number): { x: number; z: number } {
   const bx = PALM_GLB.baseX * PALM_XZ * size;
   const bz = PALM_GLB.baseZ * PALM_SIZE.crown / PALM_GLB.depth * size;
   const c = Math.cos(yaw);
   const s = Math.sin(yaw);
   return { x: bx * c + bz * s, z: -bx * s + bz * c };
}
