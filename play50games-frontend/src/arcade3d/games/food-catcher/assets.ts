// Models used by Food Catcher. Plain data, no three.js. Until a GLB is listed in
// core/modelManifest.ts it is never fetched and the scene draws the fallback primitive.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const prop = (id: string, fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/food-catcher/${id}.glb`,
   fallback: "sphere",
   fallbackColor,
   // A ~0.9 tall prop standing on y = 0 is centred on the falling item.
   scale: 0.9,
   yOffset: -0.45,
   budget: { ...PROP_BUDGET },
});

export const ASSETS = {
   chef: {
      id: "chef",
      url: "/models/3d/food-catcher/chef.glb",
      fallback: "capsule",
      fallbackColor: "#f8fafc",
      scale: 1.6,
      budget: { ...CHARACTER_BUDGET },
   },
   apple: prop("apple", "#ef4444"),
   burger: prop("burger", "#f5c16c"),
   sock: prop("sock", "#9ca3af"),
   banana: { ...SHARED_ASSETS.banana, scale: 0.9, yOffset: -0.45 },
   tinCan: { ...SHARED_ASSETS.tinCan, scale: 0.9, yOffset: -0.45 },
} satisfies Record<string, ModelAsset>;
