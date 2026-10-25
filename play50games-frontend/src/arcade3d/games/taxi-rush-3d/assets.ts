// Models for Taxi Rush 3D. Local urls are not in the manifest yet, so they draw their fallback.
// Traffic cars, lamps and benches are shared meshes that already live in the arcade.
// Claude's assets PR copies the GLBs, lists them, and replaces these placeholder scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/taxi-rush-3d/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

/** Traffic car about 3.1 m long, 1.5 m wide, 1.35 m tall (REUSED_GLB_SIZE.car, long side is depth). */
const CAR_LONG = 3.1;
const CAR_SCALE = CAR_LONG / REUSED_GLB_SIZE.car.depth;
const LAMP_SCALE = 3.2 / REUSED_GLB_SIZE.lamp.height;
const BENCH_SCALE = 1.6 / REUSED_GLB_SIZE.bench.width;

export const ASSETS = {
   taxiCab: local("taxiCab", "box", "#facc15"),
   townhouseBlock: local("townhouseBlock", "box", "#e7e5e4"),
   cornerShop: local("cornerShop", "box", "#f8fafc"),
   busStop: local("busStop", "box", "#1d4ed8"),
   trafficLight: local("trafficLight", "box", "#334155"),
   trafficCone: local("trafficCone", "cylinder", "#f97316"),
   travellerNpc: local("travellerNpc", "capsule", "#e7e5e4", CHARACTER_BUDGET),
   car: {
      ...REUSED_ASSETS.car,
      scale: CAR_SCALE,
   },
   lamp: {
      ...REUSED_ASSETS.lamp,
      scale: LAMP_SCALE,
   },
   bench: {
      ...REUSED_ASSETS.bench,
      scale: BENCH_SCALE,
   },
} satisfies Record<string, ModelAsset>;
