// Models used by Warehouse Rush. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Only urls listed in core/modelManifest.ts are fetched. The robot and the crate are there; the
// shelf rack and the pallet are not yet, so they draw their instanced stand-ins (Primitives.tsx)
// and make no request until the assets PR adds the GLB and its manifest line.
// Scales come from the GLBs' measured bounds (README "Assets"): the robot is 1.90 x 1.72 x 0.60
// (T-pose), so 0.7 makes it 1.2 tall; the crate is 1.88 x 1.34 x 1.81, so 0.53 gives the
// 1.0 x 0.71 x 0.96 box on a pallet. Collision never comes from a model (rules.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/*.glb)
   robot: { ...SHARED_ASSETS.robot, scale: 0.7 },
   // recoloured per box colour in Scene.tsx (albedo map dropped, README "Colour, not tint")
   crate: { ...SHARED_ASSETS.crate, scale: 0.53 },
   // this game only (./assets.spec.json -> public/models/3d/warehouse-rush/*.glb), not generated yet
   shelfRack: {
      id: "shelfRack",
      url: "/models/3d/warehouse-rush/shelfRack.glb",
      fallback: "box",
      fallbackColor: "#fb923c",
      budget: { ...PROP_BUDGET },
   },
   pallet: {
      id: "pallet",
      url: "/models/3d/warehouse-rush/pallet.glb",
      fallback: "box",
      fallbackColor: "#d6a46b",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** The box on a pallet (crate GLB at scale 0.53, or the stand-in): width x height x depth, m. */
export const BOX = { width: 1.0, height: 0.71, depth: 0.96 } as const;
