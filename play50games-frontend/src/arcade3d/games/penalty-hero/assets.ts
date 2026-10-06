// Models used by Penalty Hero. Plain data, no three.js. Until a GLB is listed in
// core/modelManifest.ts it is never fetched and the scene draws the fallback primitive.
// The ball, goal, net and pitch are always code primitives. scale assumes a GLB about 1 unit tall
// standing on y = 0; tune it in the assets PR.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   striker: {
      id: "striker",
      url: "/models/3d/penalty-hero/striker.glb",
      fallback: "capsule",
      fallbackColor: "#2563eb",
      // 1.75 m tall, turned to face -z (towards the goal).
      scale: 1.75,
      rotationY: Math.PI,
      budget: { ...CHARACTER_BUDGET },
   },
   keeper: {
      id: "keeper",
      url: "/models/3d/penalty-hero/keeper.glb",
      fallback: "capsule",
      fallbackColor: "#16a34a",
      // 1.85 m tall, facing +z (towards the striker).
      scale: 1.85,
      budget: { ...CHARACTER_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
