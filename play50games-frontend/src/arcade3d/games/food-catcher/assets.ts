// Models used by Food Catcher. Plain data, no three.js. Until a GLB is listed in
// core/modelManifest.ts it is never fetched and the scene draws the fallback primitive.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHEF_LANDMARKS, CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

// measured in this game, kept in core so other games reuse the character (REUSED_ASSETS)
export { CHEF_LANDMARKS };

// Every item GLB has a longest side of about 1.9 (Rodin normalises it) and stands on y = 0.
// ITEM_SCALE makes that 0.87, the size of the stand-ins (the apple is a 0.84 sphere), and
// `centre(h)` lowers a GLB of height h by half its scaled height, so it is centred on the item.
const ITEM_SCALE = 0.46;
const centre = (glbHeight: number) => ({ scale: ITEM_SCALE, yOffset: -(glbHeight * ITEM_SCALE) / 2 });

// measured GLB heights (group A, 2026-10-06): apple 1.90, burger 1.42, sock 1.69, banana 1.56, tin 1.69
const prop = (id: string, fallbackColor: string, glbHeight: number): ModelAsset => ({
   id,
   url: `/models/3d/food-catcher/${id}.glb`,
   fallback: "sphere",
   fallbackColor,
   ...centre(glbHeight),
   budget: { ...PROP_BUDGET },
});


// Two ranges flank the 9.4-wide counter, facing the side-on camera (+z).
export const KITCHEN_RANGE_SPOTS: readonly [number, number, number][] = [
   [-5.35, 0, 0.1],
   [5.35, 0, 0.1],
];

export const kitchenRangeSpots = (level: number) => level === 4 || level === 5 ? KITCHEN_RANGE_SPOTS : [];

export const ASSETS = {
   kitchenRangeOven: {
      id: "kitchenRangeOven",
      url: "/models/3d/food-catcher/kitchenRangeOven.glb",
      fallback: "box",
      fallbackColor: "#64748b",
      // Measured root bounds: 1.727175 x 1.903701 x 0.963655; min.y = 0.
      // Fit to 1.2 m tall (1.089 wide, 0.607 deep), with the base on y = 0.
      scale: 1.2 / 1.9037013053894043,
      rotationY: 0,
      yOffset: 0,
      budget: { ...PROP_BUDGET },
   },
   chef: {
      id: "chef",
      url: "/models/3d/food-catcher/chef.glb",
      fallback: "capsule",
      fallbackColor: "#f8fafc",
      // the GLB is 1.869 tall (toque included; its 1.90 longest side is the arm span): 0.975 draws
      // it 1.82 m, the ChefPrimitive's height (hat top at 1.83). A static T-pose: the core auto-rig
      // animates it (Scene.tsx <Chef>).
      scale: 0.975,
      humanoid: { landmarks: CHEF_LANDMARKS },
      budget: { ...CHARACTER_BUDGET },
   },
   apple: prop("apple", "#ef4444", 1.9),
   burger: prop("burger", "#f5c16c", 1.42),
   // the sock GLB is long along z (0.98 x 1.69 x 1.90): turned a quarter so the camera sees its profile
   sock: { ...prop("sock", "#9ca3af", 1.69), rotationY: Math.PI / 2 },
   banana: { ...SHARED_ASSETS.banana, ...centre(1.56) },
   tinCan: { ...SHARED_ASSETS.tinCan, ...centre(1.69) },
} satisfies Record<string, ModelAsset>;
