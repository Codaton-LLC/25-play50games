// Models used by Office Escape. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// None of these GLBs is in core/modelManifest.ts yet, so none is fetched: the scene draws its own
// primitives (Primitives.tsx). Swapping a model in is the assets PR (file + manifest line) plus the
// scale here, never a scene change. Collision never comes from a model (rules.ts hitboxes).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const own = (id: string) => `/models/3d/office-escape/${id}.glb`;

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/*.glb).
   // The runner GLB faces +z by convention and this game runs towards -z, so it is turned round.
   runner: { ...SHARED_ASSETS.runner, rotationY: Math.PI },
   // Prop GLBs face +z (towards the oncoming runner) and stand on y = 0. The scales assume a GLB
   // about 1 unit tall and give the README "Obstacles" drawn heights; tune them in the assets PR.
   desk: { ...SHARED_ASSETS.desk, scale: 0.95 },
   chair: { ...SHARED_ASSETS.chair, scale: 1.4 },
   // this game only (./assets.spec.json -> public/models/3d/office-escape/*.glb)
   printer: {
      id: "printer",
      url: own("printer"),
      scale: 0.6,
      fallback: "box",
      fallbackColor: "#e5e7eb",
      budget: { ...PROP_BUDGET },
   },
   coffeeCart: {
      id: "coffeeCart",
      url: own("coffeeCart"),
      scale: 1.4,
      fallback: "box",
      fallbackColor: "#dc2626",
      budget: { ...PROP_BUDGET },
   },
   waterCooler: {
      id: "waterCooler",
      url: own("waterCooler"),
      scale: 1.55,
      fallback: "cylinder",
      fallbackColor: "#60a5fa",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
