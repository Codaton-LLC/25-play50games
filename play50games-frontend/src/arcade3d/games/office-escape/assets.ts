// Models used by Office Escape. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// The desk, chair, printer, coffee cart and water cooler GLBs are in core/modelManifest.ts (group A,
// 2026-10-06), the shared runner since group B. Swapping a model in is the assets PR (file +
// manifest line) plus the scale here, never a scene change. Collision never comes from a model
// (rules.ts hitboxes).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const own = (id: string) => `/models/3d/office-escape/${id}.glb`;

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/*.glb).
   // The runner GLB (v2, a 1.886-tall static T-pose, animated by the core auto-rig in Scene.tsx)
   // faces +z by convention and this game runs towards -z, so it is turned round; 0.825 draws it
   // 1.556 m, the RunnerPrimitive's height (camera.ts RUNNER_DRAWN; crash.test.ts measures it).
   runner: { ...SHARED_ASSETS.runner, scale: 0.825, rotationY: Math.PI },
   // Prop GLBs face +z (towards the oncoming runner) and stand on y = 0. Scales come from the GLBs'
   // measured bounds (w x h x d) and give about the README "Obstacles" drawn sizes:
   // desk 1.90 x 1.47 x 0.92 (top at 0.55) -> 1.62 x 1.25 x 0.78, top at 0.47, monitor below 0.9
   // (only the lamps at the two ends reach 1.25, outside a lane-centred runner's path);
   // chair 1.21 x 1.90 x 1.24 -> 0.90 x 1.41 x 0.92.
   desk: { ...SHARED_ASSETS.desk, scale: 0.85 },
   chair: { ...SHARED_ASSETS.chair, scale: 0.74 },
   // this game only (./assets.spec.json -> public/models/3d/office-escape/*.glb)
   printer: {
      id: "printer",
      url: own("printer"),
      // 1.57 x 1.23 x 1.89 -> 1.00 x 0.60 x 0.80
      scale: 0.55,
      stretch: [1.16, 0.89, 0.77],
      fallback: "box",
      fallbackColor: "#e5e7eb",
      budget: { ...PROP_BUDGET },
   },
   coffeeCart: {
      id: "coffeeCart",
      url: own("coffeeCart"),
      // 1.05 x 1.90 x 1.90 -> 1.09 x 1.41 x 1.41 (widened to cover the 1.1 m wide hitbox)
      scale: 0.74,
      stretch: [1.4, 1, 1],
      fallback: "box",
      fallbackColor: "#dc2626",
      budget: { ...PROP_BUDGET },
   },
   waterCooler: {
      id: "waterCooler",
      url: own("waterCooler"),
      // 0.82 x 1.90 x 0.85 -> 0.69 x 1.60 x 0.71
      scale: 0.84,
      fallback: "cylinder",
      fallbackColor: "#60a5fa",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
