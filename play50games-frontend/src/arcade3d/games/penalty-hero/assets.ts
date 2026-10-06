// Models used by Penalty Hero. Plain data, no three.js. Until a GLB is listed in
// core/modelManifest.ts it is never fetched and the scene draws the fallback primitive.
// The ball, goal, net and pitch are always code primitives. Both characters are static T-pose
// GLBs (group B, 2026-10-06): the core auto-rig animates them (Scene.tsx, poses.ts).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";

/**
 * The striker's joints (GLB units: 1.83 x 1.90 x 0.35 T-pose, faces +z; short-sleeved shirt with
 * the number 10, shorts, socks, boots), measured from striker.glb (core/README "Measuring a
 * character"; striker.test.ts). The estimate loses the shoulders on this mesh (its flat, decimated
 * chest has too few vertices for the column heuristic: shoulderX 0.07 instead of 0.245, and the
 * arm spread with it), so the arm set is measured by hand:
 * - shoulderX 0.245 (the torso is 0.20 wide at the chest, the sleeve caps reach 0.33), the clavicle
 *   halfway, the elbow halfway to the wrist, the wrist at 70 % of the reach;
 * - shoulderY 1.375, armRadius 0.095: the band covers the short sleeves (1.30-1.47) so they turn
 *   with the arm instead of staying out as trunk;
 * - hemY = crotchY: the shorts are two tubes, not a skirt (the estimate saw their close inner
 *   sides as a hem at 0.648);
 * - hipZ -0.065 (estimate -0.095, the shins' middle): between the thighs' and the knees' middle;
 * - ankleY 0.19 with a 0.03 blend: the boots (to about 0.15) are rigid.
 */
export const STRIKER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.375,
   shoulderX: 0.245,
   shoulderZ: -0.027,
   armRadius: 0.095,
   clavicleX: 0.12,
   elbowX: 0.475,
   wristX: 0.715,
   armSpread: 0.16,
   crotchY: 0.81,
   hipY: 0.9,
   hipX: 0.155,
   hipZ: -0.065,
   kneeY: 0.45,
   ankleY: 0.19,
   toeZ: 0.177,
   heelZ: -0.169,
   legDepth: 0.069,
   legOuterX: 0.244,
   hemY: 0.81,
   spineY: 1.057,
   chestY: 1.2,
   neckY: 1.534,
   headY: 1.565,
   spineZ: -0.007,
   shoulderBlend: 0.04,
   elbowBlend: 0.03,
   hipBlend: 0.09,
   kneeBlend: 0.068,
   ankleBlend: 0.03,
   crotchBlend: 0.086,
   spineBlend: 0.043,
   neckBlend: 0.016,
};

/**
 * The keeper's joints (GLB units: 1.86 x 1.89 x 0.38 T-pose, faces +z; long-sleeved jersey with
 * raglan shoulders, big gloves, shorts, socks, boots), measured from keeper.glb (keeper.test.ts).
 * The estimate is close; set by eye:
 * - armRadius 0.095 (estimate 0.065), shoulderY 1.385: the band covers the thick upper arms and
 *   the raglan shoulder panels (1.29-1.48), which otherwise stay out as trunk when the arm drops;
 * - hemY = crotchY: shorts, no skirt (the estimate's hem 0.662 was their inner sides);
 * - hipZ -0.075 (estimate -0.104): between the thighs' and the knees' middle;
 * - ankleY 0.19 with a 0.03 blend: rigid boots;
 * - armSpread 0.16 rad (estimate 0.112): the gloves clear the shorts.
 */
export const KEEPER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.385,
   shoulderX: 0.23,
   shoulderZ: -0.044,
   armRadius: 0.095,
   clavicleX: 0.115,
   elbowX: 0.476,
   wristX: 0.722,
   armSpread: 0.16,
   crotchY: 0.8,
   hipY: 0.89,
   hipX: 0.155,
   hipZ: -0.075,
   kneeY: 0.45,
   ankleY: 0.19,
   toeZ: 0.157,
   heelZ: -0.184,
   legDepth: 0.074,
   legOuterX: 0.256,
   hemY: 0.8,
   spineY: 1.057,
   chestY: 1.204,
   neckY: 1.54,
   headY: 1.563,
   spineZ: -0.019,
   shoulderBlend: 0.045,
   elbowBlend: 0.035,
   hipBlend: 0.09,
   kneeBlend: 0.068,
   ankleBlend: 0.03,
   crotchBlend: 0.084,
   spineBlend: 0.044,
   neckBlend: 0.012,
};

export const ASSETS = {
   striker: {
      id: "striker",
      url: "/models/3d/penalty-hero/striker.glb",
      fallback: "capsule",
      fallbackColor: "#2563eb",
      // the GLB is 1.90 tall: 0.92 draws it 1.75 m (the README's striker, StrikerPrimitive's
      // height), turned to face -z (towards the goal).
      scale: 0.92,
      rotationY: Math.PI,
      humanoid: { landmarks: STRIKER_LANDMARKS },
      budget: { ...CHARACTER_BUDGET },
   },
   keeper: {
      id: "keeper",
      url: "/models/3d/penalty-hero/keeper.glb",
      fallback: "capsule",
      fallbackColor: "#16a34a",
      // the GLB is 1.89 tall: 0.98 draws it 1.85 m (KeeperPrimitive's height), facing +z (towards
      // the striker).
      scale: 0.98,
      humanoid: { landmarks: KEEPER_LANDMARKS },
      budget: { ...CHARACTER_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
