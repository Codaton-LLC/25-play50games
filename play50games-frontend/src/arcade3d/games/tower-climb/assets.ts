import type { ModelAsset } from "@/arcade3d/core/types";
import { SHARED_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

const primitive = (id: string, color: string): ModelAsset => ({
   id, url: `/models/3d/tower-climb/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   runner: SHARED_ASSETS.runner,
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
