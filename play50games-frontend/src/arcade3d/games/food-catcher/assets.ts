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
 * The chef's joints (GLB units: 1.90 x 1.87 x 0.53 T-pose, faces +z; the v2 chef of 2026-10-07: a
 * big head with glasses and a beard sitting right on a stand-up collar, a double-breasted jacket
 * whose tunic skirt ends above the knees (front hem 0.543, sides 0.571, back 0.587), a belt,
 * trousers over chunky shoes, a toque; short chibi legs: hips at 0.69 for 1.87), measured from
 * chef.glb (core/README "Landmarks, and measuring a character"; chef.test.ts). The estimate, except
 * (set by eye in posed previews):
 * - neckY 1.25 / headY 1.27, neckBlend 0.012 (estimate 1.305 / 1.359 / 0.027): the beard reaches
 *   down to the collar (1.25 at the front) and hides the neck, so the head joint sits on the collar
 *   and the whole face, beard and toque turn rigidly (the estimate bent the beard with the neck);
 * - hemY 0.545 (estimate 0.499): the tunic's front hem; the estimate's 0.499 is where the close
 *   inner thighs touch below it, which would skirt-weight the bare thighs into a web.
 * The right shoe's sole sits 9 mm above the left one's in the mesh (the soles are not flat: heels
 * at 0.014, the balls at 0.000 / 0.009), so a planted right foot hovers up to 9 mm (chef.test.ts).
 */
export const CHEF_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.138,
   shoulderX: 0.27,
   shoulderZ: 0.021,
   armRadius: 0.089,
   clavicleX: 0.135,
   elbowX: 0.508,
   wristX: 0.746,
   armSpread: 0.142,
   crotchY: 0.623,
   hipY: 0.691,
   hipX: 0.134,
   hipZ: 0.013,
   kneeY: 0.346,
   ankleY: 0.158,
   toeZ: 0.258,
   heelZ: -0.096,
   legDepth: 0.105,
   legOuterX: 0.227,
   hemY: 0.545,
   spineY: 0.825,
   chestY: 0.959,
   neckY: 1.25,
   headY: 1.27,
   spineZ: 0.06,
   shoulderBlend: 0.053,
   elbowBlend: 0.044,
   hipBlend: 0.069,
   kneeBlend: 0.052,
   ankleBlend: 0.033,
   crotchBlend: 0.053,
   spineBlend: 0.04,
   neckBlend: 0.012,
};

export const ASSETS = {
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
