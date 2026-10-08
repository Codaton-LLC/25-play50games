// Models used by Warehouse Rush. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Only urls listed in core/modelManifest.ts are fetched. All four are there; the instanced stand-ins
// (Primitives.tsx) stay as the fallback while a GLB loads or if it fails.
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
   // this game only (./assets.spec.json -> public/models/3d/warehouse-rush/*.glb, group A 2026-10-06)
   // The rack GLB is 0.41 x 1.61 x 1.90, long along its z: turned a quarter so it runs along x, and
   // each 3.6 m rack is two copies (Primitives.tsx RACK_MODEL_SPOTS) of 1.8 x 1.1 x 0.9.
   shelfRack: {
      id: "shelfRack",
      url: "/models/3d/warehouse-rush/shelfRack.glb",
      rotationY: Math.PI / 2,
      stretch: [2.2, 0.683, 0.947],
      fallback: "box",
      fallbackColor: "#fb923c",
      budget: { ...PROP_BUDGET },
   },
   // 1.90 x 0.52 x 1.90 -> 1.2 x 0.18 x 1.2 (rules PALLET_HALF, PALLET_HEIGHT: boxes sit on its top)
   pallet: {
      id: "pallet",
      url: "/models/3d/warehouse-rush/pallet.glb",
      scale: 0.632,
      stretch: [1, 0.55, 1],
      fallback: "box",
      fallbackColor: "#d6a46b",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** The box on a pallet (crate GLB at scale 0.53, or the stand-in): width x height x depth, m. */
export const BOX = { width: 1.0, height: 0.71, depth: 0.96 } as const;
/** The lid letter: a square decal this size (m), this high over the box's feet (just above the crate's 0.708 m lid). */
export const LID_LETTER = { size: 0.56, y: BOX.height + 0.012 } as const;
