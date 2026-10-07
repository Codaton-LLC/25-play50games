import type { ModelAsset } from "@/arcade3d/core/types";

const PROP_BUDGET = { tris: 5000, bytes: 300000 };

export const ASSETS = {
   // Claude's folded-wing GLB: 0.99 x 1.90 x 1.74 m, feet on y=0, facing +z.
   // The manifest owns availability; an unlisted URL goes straight to our primitive.
   pigeon: {
      id: "pigeon", url: "/models/3d/pigeon-crossing/pigeon.glb",
      scale: 0.658, stretch: [0.86, 1, 1], rotationY: Math.PI, rigged: false,
      fallback: "sphere", fallbackColor: "#8192a9", budget: { tris: 20000, bytes: 1500000 },
   },
   // Group C vehicles (2026-10-07), long along the GLB's z like the stand-ins' local frame (front at
   // +z, which the pool's facing quaternion turns to the travel direction). Each one is fitted to
   // its stand-in (Primitives.tsx: length x width x height incl. wheels), so it stays inside its
   // rules hit box and under the 1.5 m cover roof (assets.test.ts). Measured GLBs (w x h x l):
   // car 0.91 x 0.81 x 1.90, front at -z (turned round) -> 1.11 x 1.14 x 2.66 (hit box 2.80 x 1.15)
   // taxi 0.93 x 1.12 x 1.89, front at +z -> 1.16 x 1.29 x 2.95 (hit box 3.10 x 1.20)
   // van 1.17 x 1.04 x 1.89, front at +z -> 1.26 x 1.29 x 3.66 (hit box 3.80 x 1.30): a long van
   car: {
      id: "car", url: "/models/3d/pigeon-crossing/car.glb", scale: 1.4, stretch: [0.87, 1, 1], rotationY: Math.PI,
      fallback: "box", fallbackColor: "#f47967", budget: PROP_BUDGET,
   },
   taxi: {
      id: "taxi", url: "/models/3d/pigeon-crossing/taxi.glb", scale: 1.56, stretch: [0.795, 0.742, 1],
      fallback: "box", fallbackColor: "#ffd15b", budget: PROP_BUDGET,
   },
   van: {
      id: "van", url: "/models/3d/pigeon-crossing/van.glb", scale: 1.93, stretch: [0.56, 0.64, 1],
      fallback: "box", fallbackColor: "#e9edf3", budget: PROP_BUDGET,
   },
} satisfies Record<string, ModelAsset>;
