// Models for Tiny Escape Room. Plain data. Only urls in core/modelManifest.ts are fetched.
// Measured GLBs (w x h x d), longest side about 1.9, standing on y = 0:
//   desk 1.90 x 1.47 x 0.92, tabletop at y = 0.55
//   chair 1.21 x 1.90 x 1.24
//   battery 1.02 x 1.90 x 1.01
// Station bodies are 1.2 x 1.4 and at most 1.4 tall; chairs are 0.8 x 0.8. The door leaf,
// when a GLB exists, is 1.4 x 2.0 x 0.12. Fallbacks are authored at those sizes and ignore scale.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const local = (id: string, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/escape-room/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
});

export const ASSETS = {
   runner: { ...SHARED_ASSETS.runner },
   // long side (model x, 1.90) runs along the station's z (1.4). Tabletop y 0.55 stays put;
   // height 1.47 is squeezed to the 1.4 cap. Model z (0.92) becomes the 1.2 body width.
   desk: {
      ...SHARED_ASSETS.desk,
      rotationY: Math.PI / 2,
      stretch: [1.4 / 1.9, 1.4 / 1.47, 1.2 / 0.92],
   },
   // footprint 0.8 x 0.8: the 1.24 depth is the widest horizontal side.
   chair: { ...SHARED_ASSETS.chair, scale: 0.8 / 1.24 },
   // a shelf pickup, not a 1.9 m prop. 0.32 tall.
   battery: { ...SHARED_ASSETS.battery, scale: 0.32 / 1.9 },
   key: local("key", "box", "#eab308"),
   book: local("book", "box", "#b91c1c"),
   // longest side of a future leaf is the 2 m height. Until the GLB exists the primitive is exact.
   door: { ...local("door", "box", "#b45309"), scale: 2 / 1.9, stretch: [1.4 / 2, 1, 0.12 / 2] },
} satisfies Record<string, ModelAsset>;
