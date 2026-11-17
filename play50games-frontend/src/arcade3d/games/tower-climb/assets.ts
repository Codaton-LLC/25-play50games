import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, SHARED_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/**
 * The shared runner GLB (v2) is 1.886 tall (T-pose and arms down alike): 0.2916 draws it 0.55 m,
 * RUNNER.height (README "Scene and camera"; runner.test.ts measures it on the real mesh). Its stride and
 * body lift (runnerGait.ts, Scene.tsx) use the same scale. The stand-in (Primitives.tsx) is authored 0.55 m tall.
 */
export const RUNNER_SCALE = 0.2916;

/**
 * The shared coin GLB (group D) is 1.899 x 1.861 x 0.492 (COIN_GLB_SIZE), standing on its edge on
 * y = 0, its faces along ±z, about 0.33 deep at the rim. COIN_SCALE (about 0.316) draws it 0.60
 * across, the stand-in disc's diameter (2 x COIN.radius), 0.59 tall; yOffset centres it on the
 * coin's point, so writeCoin's spin and bob place it like the disc and its 0.294 half-height stays
 * inside COIN.radius (writeCoin's "whole inside the column" margin); stretch z 0.7 thins the rim to
 * 0.074, the disc's 0.08.
 */
export const COIN_SCALE = 0.6 / COIN_GLB_SIZE.width;

/** stormCloud.glb (tower-climb, Hyper3D 2026-10-25) raw bounds, measured on the mesh (assets.test.ts): floor pivot, centred on x/z. */
export const STORM_CLOUD_GLB = { width: 1.8963, height: 1.587, depth: 1.3466 } as const;
/** Drawn 2.4 m wide, a storm puff beside the 4.6 m column; each spot scales it 0.85-1.25. */
export const STORM_CLOUD_WIDTH = 2.4;
export const STORM_CLOUD_SCALE = STORM_CLOUD_WIDTH / STORM_CLOUD_GLB.width;
export const STORM_CLOUD_DRAWN = {
   width: STORM_CLOUD_WIDTH,
   height: STORM_CLOUD_GLB.height * STORM_CLOUD_SCALE,
   depth: STORM_CLOUD_GLB.depth * STORM_CLOUD_SCALE,
} as const;
/**
 * The clouds' wrap band (m), matched to the fitted column: viewBottomY spans 0..6 up to the column
 * top (maxHeight + 4). The pool sinks each cloud slowly down the band and wraps it to the top.
 */
export const STORM_CLOUD_BAND = 6;
export interface StormCloudSpot { readonly x: number; readonly y: number; readonly z: number; readonly s: number; readonly rotY: number }
/**
 * Levels 4-5 (Storm Tower, Sky Tower) side decor. Every spot's full x footprint stays clear of the
 * camera guard box (x ±2.3, z ±0.6), so a cloud can never cover the runner, a slab or a prop;
 * z sits behind the play plane and the tower panels (z = -0.52).
 */
export const STORM_CLOUD_SPOTS: readonly StormCloudSpot[] = [
   { x: -3.7, y: 0.4, z: -1.05, s: 1.0, rotY: 0.3 },
   { x: 4.1, y: 1.9, z: -1.25, s: 1.25, rotY: 2.4 },
   { x: -3.9, y: 3.4, z: -0.9, s: 0.85, rotY: 1.1 },
   { x: 3.7, y: 4.6, z: -1.15, s: 1.0, rotY: 4.0 },
] as const;

const primitive = (id: string, color: string): ModelAsset => ({
   id, url: `/models/3d/tower-climb/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   runner: { ...SHARED_ASSETS.runner, scale: RUNNER_SCALE },
   slab: primitive("slab", "#38c9df"),
   movingSlab: primitive("moving-slab", "#a58bec"),
   ledge: primitive("ledge", "#32aeac"),
   spur: primitive("spur", "#ffa862"),
   coin: { ...SHARED_ASSETS.coin, scale: COIN_SCALE, stretch: [1, 1, 0.7], yOffset: (-COIN_SCALE * COIN_GLB_SIZE.height) / 2 },
   flag: {
      id: "checkpoint-flag", url: "/models/3d/tower-climb/checkpoint-flag.glb",
      scale: 0.8 / 1.9, fallback: "box", fallbackColor: "#ffd35d", budget: PROP_BUDGET,
   },
   // No GLB yet: the url is absent from the model manifest, so nothing is fetched.
   // The world pickup uses this asset with the bevelled fallback parts; Claude swaps the file in later.
   rocket: {
      id: "rocket", url: "/models/3d/tower-climb/rocket.glb", scale: 1,
      fallback: "box", fallbackColor: "#e8eef2", budget: PROP_BUDGET,
   },
   stormCloud: {
      id: "stormCloud", url: "/models/3d/tower-climb/stormCloud.glb", scale: STORM_CLOUD_SCALE,
      fallback: "sphere", fallbackColor: "#5a6a80", budget: PROP_BUDGET,
   },
};
