// Models used by Robot Collector. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Until a GLB is listed in core/modelManifest.ts it is never fetched and the game draws its own
// primitives (<Model fallback>, useModelFailed), so swapping in a model is the assets PR (file +
// manifest line) plus at most a scale tweak here, never a scene change.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/*.glb).
   // scale/yOffset assume a GLB about 1 unit tall standing on y = 0; tune them in the assets PR.
   robot: { ...SHARED_ASSETS.robot, scale: 1.4 },
   battery: { ...SHARED_ASSETS.battery, scale: 0.7 },
   crate: { ...SHARED_ASSETS.crate, scale: 1.2 },
   // this game only (./assets.spec.json -> public/models/3d/robot-collector/barrel.glb)
   barrel: {
      id: "barrel",
      url: "/models/3d/robot-collector/barrel.glb",
      fallback: "cylinder",
      fallbackColor: "#2563eb",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
