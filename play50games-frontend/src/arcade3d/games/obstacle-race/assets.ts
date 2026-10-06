// Models used by Obstacle Race. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx renders them.
// Neither GLB is in core/modelManifest.ts yet, so none is fetched: the scene draws its own stand-ins
// (Primitives.tsx RunnerPrimitive, FinishArchPrimitive). Swapping a model in is the assets PR (file +
// manifest line) plus the scale / yOffset here, never a scene change. Collision never comes from a
// model: the arch's posts are circles in rules.ts, the course is primitives sized from rules.ts.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/runner.glb).
   // The runner GLB faces +z by convention and this game runs towards -z, so it is turned round.
   runner: { ...SHARED_ASSETS.runner, rotationY: Math.PI },
   // this game only (./assets.spec.json -> public/models/3d/obstacle-race/finishArch.glb): 8 m wide,
   // 4.2 m tall, facing +z, standing on y = 0. The assets PR sets scale / yOffset from its bounds.
   finishArch: {
      id: "finishArch",
      url: "/models/3d/obstacle-race/finishArch.glb",
      fallback: "box",
      fallbackColor: "#ef4444",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
