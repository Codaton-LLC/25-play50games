// Models used by Food Catcher. Plain data, no three.js. Until a GLB is listed in
// core/modelManifest.ts it is never fetched and the scene draws the fallback primitive.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

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

/**
 * The chef's joints (GLB units: 1.79 x 1.90 x 0.48 T-pose, faces +z; jacket, apron from the waist
 * to the knees, trousers, low shoes, a tall toque), measured from chef.glb (2026-10-06, core/README
 * "Measuring a character"; chef.test.ts). Set by eye over the estimate:
 * - hemY 0.53 (estimate 0.633): the apron's hem, where its sides and front end in the profile; the
 *   apron is skirt-weighted from the crotch down to it, so it hangs between the stepping legs;
 * - crotchY 0.75 / hipY 0.83 (estimate 0.791 / 0.865): the legs part at 0.75 in the mesh;
 * - shoulderY 1.245, armRadius 0.085 (estimate 1.237 / 0.071): the band covers the puffy sleeves;
 * - ankleY 0.13 with a 0.04 blend (estimate 0.146 / 0.051): the low shoes (to about 0.08) are rigid;
 * - armSpread 0.18 rad = 10° (estimate 0.143): the hanging hands clear the apron's sides (0.23).
 */
export const CHEF_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.245,
   shoulderX: 0.215,
   shoulderZ: 0.02,
   armRadius: 0.085,
   clavicleX: 0.108,
   elbowX: 0.454,
   wristX: 0.692,
   armSpread: 0.18,
   crotchY: 0.75,
   hipY: 0.83,
   hipX: 0.14,
   hipZ: 0.01,
   kneeY: 0.42,
   ankleY: 0.13,
   toeZ: 0.241,
   heelZ: -0.074,
   legDepth: 0.076,
   legOuterX: 0.233,
   hemY: 0.53,
   spineY: 0.977,
   chestY: 1.088,
   neckY: 1.42,
   headY: 1.443,
   spineZ: 0.057,
   shoulderBlend: 0.043,
   elbowBlend: 0.036,
   hipBlend: 0.08,
   kneeBlend: 0.065,
   ankleBlend: 0.04,
   crotchBlend: 0.054,
   spineBlend: 0.033,
   neckBlend: 0.012,
};

export const ASSETS = {
   chef: {
      id: "chef",
      url: "/models/3d/food-catcher/chef.glb",
      fallback: "capsule",
      fallbackColor: "#f8fafc",
      // the GLB is 1.90 tall (toque included): 0.96 draws it 1.82 m, the ChefPrimitive's height
      // (hat top at 1.83). A static T-pose: the core auto-rig animates it (Scene.tsx <Chef>).
      scale: 0.96,
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
