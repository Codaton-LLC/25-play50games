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
};
