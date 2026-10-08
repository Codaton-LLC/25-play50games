// Models used by Penalty Hero. Plain data, no three.js. Until a GLB is listed in
// core/modelManifest.ts it is never fetched and the scene draws the fallback primitive.
// The goal, net and pitch are always code primitives; the ball is a GLB (group D, 2026-10-07) fitted
// to BallPrimitive's sphere, its fallback (ball.test.ts). Both characters are static T-pose
// GLBs (group B, 2026-10-06): the core auto-rig animates them (Scene.tsx, poses.ts).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/**
 * The striker's joints (GLB units: 1.90 x 1.88 x 0.39 T-pose, the arm span the longest side, faces
 * +z; a stylised player with a big head, glasses and a beard, a short-sleeved shirt with the number
 * 10, shorts, socks, boots), measured from striker.glb (v2, 2026-10-07; core/README "Measuring a
 * character"; striker.test.ts). The estimate finds the trunk, the arms and the head; set by eye in
 * posed previews:
 * - armRadius 0.085 (estimate 0.06): the band (1.25-1.42) covers the short sleeves, which otherwise
 *   stay out as trunk wings when the arm drops; armSpread 0.16 (estimate 0.1): the hands clear the
 *   shorts;
 * - kneeY 0.5 (estimate 0.431, half the hip height): the knee joint behind the lower kneecap, just
 *   under the shorts' hem; lower, the leg folds inside the sock;
 * - hemY = crotchY: the shorts are two tubes, not a skirt (the estimate's hem 0.594 is their hem,
 *   where the inner sides part; skirt weights draw them the same in every game pose);
 * - hipZ -0.065 (estimate -0.076, the shins' middle): the knees' and ankles' middle; hipX 0.155:
 *   between the thighs (0.13) and the knees (0.17);
 * - ankleY 0.185 with a 0.03 blend: the boots (to about 0.155) are rigid;
 * - the head joint is the estimate's, at the top of the short neck (1.489): the beard's lower edge
 *   bends with the neck, so it stays on the collar when the head turns.
 */
export const STRIKER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.337,
   shoulderX: 0.267,
   shoulderZ: -0.049,
   armRadius: 0.085,
   clavicleX: 0.134,
   elbowX: 0.506,
   wristX: 0.745,
   armSpread: 0.16,
   crotchY: 0.782,
   hipY: 0.862,
   hipX: 0.155,
   hipZ: -0.065,
   kneeY: 0.5,
   ankleY: 0.185,
   toeZ: 0.194,
   heelZ: -0.161,
   legDepth: 0.076,
   legOuterX: 0.256,
   hemY: 0.782,
   spineY: 1.004,
   chestY: 1.147,
   neckY: 1.466,
   headY: 1.489,
   spineZ: -0.019,
   shoulderBlend: 0.036,
   elbowBlend: 0.03,
   hipBlend: 0.086,
   kneeBlend: 0.065,
   ankleBlend: 0.03,
   crotchBlend: 0.089,
   spineBlend: 0.043,
   neckBlend: 0.012,
};

/**
 * The keeper's joints (GLB units: 1.89 x 1.82 x 0.37 T-pose, the arm span the longest side, faces
 * +z; the same stylised face, a long-sleeved jersey, big gloves, shorts, socks, boots; its legs sit
 * about 2 cm to its right, the rig's are symmetric), measured from keeper.glb (v2, 2026-10-07;
 * keeper.test.ts). Set by eye in posed previews:
 * - armRadius 0.085 (estimate 0.066): the band (1.25-1.42) covers the thick upper arms;
 *   armSpread 0.16 (estimate 0.1): the gloves clear the shorts;
 * - kneeY 0.48 (estimate 0.399): the knee joint behind the lower kneecap (the crouch and the dive's
 *   tuck fold the leg at the knee, not inside the sock);
 * - hemY = crotchY: shorts, no skirt (the estimate's hem 0.59 is their hem);
 * - hipZ -0.08 (estimate -0.089): the knees' and ankles' middle; hipX 0.16: the legs' middle
 *   between the two sides' centres (0.15 and 0.19 at the knees);
 * - ankleY 0.195 with a 0.03 blend: rigid boots (to about 0.165);
 * - the head joint is the estimate's (1.494), as for the striker.
 */
export const KEEPER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.338,
   shoulderX: 0.27,
   shoulderZ: -0.051,
   armRadius: 0.085,
   clavicleX: 0.135,
   elbowX: 0.507,
   wristX: 0.744,
   armSpread: 0.16,
   crotchY: 0.719,
   hipY: 0.799,
   hipX: 0.16,
   hipZ: -0.08,
   kneeY: 0.48,
   ankleY: 0.195,
   toeZ: 0.179,
   heelZ: -0.169,
   legDepth: 0.075,
   legOuterX: 0.26,
   hemY: 0.719,
   spineY: 0.961,
   chestY: 1.122,
   neckY: 1.456,
   headY: 1.494,
   spineZ: -0.029,
   shoulderBlend: 0.04,
   elbowBlend: 0.033,
   hipBlend: 0.08,
   kneeBlend: 0.06,
   ankleBlend: 0.03,
   crotchBlend: 0.08,
   spineBlend: 0.049,
   neckBlend: 0.019,
};

/** The football's radius (m): BallPrimitive's sphere, and rules.ts BALL_SPOT.y (it rests on the grass). */
export const BALL_RADIUS = 0.11;
/**
 * ball.glb's bounds (GLB units, measured on the optimized file: 1500 tris, 73 KB, floor pivot,
 * centred on x and z). Rodin made it about 3 % flat in y (an ellipsoid fit agrees), so the asset's
 * stretch rounds it.
 */
export const BALL_GLB_SIZE = [1.8898, 1.8512, 1.9066] as const;

export const ASSETS = {
   striker: {
      id: "striker",
      url: "/models/3d/penalty-hero/striker.glb",
      fallback: "capsule",
      fallbackColor: "#2563eb",
      // the GLB is 1.876 tall (its arm span, 1.90, is the longest side): 0.93 draws it 1.745 m, the
      // height the first GLB had at 0.92 (the README's 1.75 m striker, StrikerPrimitive's height),
      // turned to face -z (towards the goal).
      scale: 0.93,
      rotationY: Math.PI,
      humanoid: { landmarks: STRIKER_LANDMARKS },
      budget: { ...CHARACTER_BUDGET },
   },
   keeper: {
      id: "keeper",
      url: "/models/3d/penalty-hero/keeper.glb",
      fallback: "capsule",
      fallbackColor: "#16a34a",
      // the GLB is 1.8155 tall (its arm span, 1.89, is the longest side): 1.02 draws it 1.852 m, the
      // height the first GLB had at 0.98 (KeeperPrimitive's 1.85 m), facing +z (towards the striker).
      scale: 1.02,
      humanoid: { landmarks: KEEPER_LANDMARKS },
      budget: { ...CHARACTER_BUDGET },
   },
   ball: {
      id: "ball",
      url: "/models/3d/penalty-hero/ball.glb",
      fallback: "sphere",
      fallbackColor: "#f8fafc",
      // BallPrimitive's sphere: 2 x BALL_RADIUS = 0.22 m across on every axis (the stretch makes the
      // flat GLB round, so it does not wobble as it spins) and centred on the group origin, the
      // pivot Scene.tsx spins the ball about: the floor pivot lowered by the radius.
      scale: (2 * BALL_RADIUS) / BALL_GLB_SIZE[2],
      stretch: [BALL_GLB_SIZE[2] / BALL_GLB_SIZE[0], BALL_GLB_SIZE[2] / BALL_GLB_SIZE[1], 1],
      yOffset: -BALL_RADIUS,
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
