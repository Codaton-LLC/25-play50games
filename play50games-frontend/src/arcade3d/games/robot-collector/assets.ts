// Models used by Robot Collector. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Until a GLB is listed in core/modelManifest.ts it is never fetched and the game draws its own
// primitives (<Model fallback>, useModelFailed), so swapping in a model is the assets PR (file +
// manifest line) plus at most a scale tweak here, never a scene change.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/*.glb).
   // The robot GLB is 1.72 tall (T-pose, feet on y = 0): 0.82 draws it 1.4 m, the height the
   // original 1.4 was written for (a GLB "about 1 unit tall") and about the stand-in's (its head
   // top is at 1.38 m). At 1.4 it stood 2.4 m tall over the 1.2 m crates.
   robot: { ...SHARED_ASSETS.robot, scale: 0.82 },
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
