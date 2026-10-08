import type { ModelAsset } from "@/arcade3d/core/types";
import { SHARED_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/**
 * The shared runner GLB (v2) is 1.886 tall (T-pose and arms down alike): 0.2916 draws it 0.55 m,
 * RUNNER.height (README "Scene and camera"; runner.test.ts measures it on the real mesh). Its stride and
 * body lift (runnerGait.ts, Scene.tsx) use the same scale. The stand-in (Primitives.tsx) is authored 0.55 m tall.
 */
export const RUNNER_SCALE = 0.2916;

const primitive = (id: string, color: string): ModelAsset => ({
   id, url: `/models/3d/tower-climb/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   runner: { ...SHARED_ASSETS.runner, scale: RUNNER_SCALE },
   slab: primitive("slab", "#38c9df"),
   movingSlab: primitive("moving-slab", "#a58bec"),
   ledge: primitive("ledge", "#32aeac"),
   spur: primitive("spur", "#ffa862"),
   coin: primitive("coin", "#ffd35d"),
   flag: {
      id: "checkpoint-flag", url: "/models/3d/tower-climb/checkpoint-flag.glb",
      scale: 0.8 / 1.9, fallback: "box", fallbackColor: "#ffd35d", budget: PROP_BUDGET,
   },
};
