// Models shared by several games (public/models/3d/shared/<id>.glb). Plain data, no three.js.
// Mirrors src/arcade3d/assets/shared.spec.json. Owned by Claude: games reuse these entries
// (spread them to change scale/rotation) but never edit this file.
import type { ModelAsset } from "./types";
import type { HumanoidLandmarks } from "./rig/humanoid";

export type SharedAssetId = "runner" | "robot" | "battery" | "crate" | "tinCan" | "banana" | "desk" | "chair" | "coin";

/** Budgets after `optimize` (platform-plan §4). */
export const CHARACTER_BUDGET = { tris: 20000, bytes: 1_500_000 } as const;
export const PROP_BUDGET = { tris: 5000, bytes: 300_000 } as const;

const shared = (id: SharedAssetId) => `/models/3d/shared/${id}.glb`;

/**
 * The robot's joints (GLB units: 1.90 x 1.72 x 0.60 T-pose, faces +z), measured once from
 * robot.glb (2026-10-06, core/README "Measuring a character") and checked in the rig preview.
 * estimateHumanoidLandmarks finds most of them within 3 cm (rig/robot.test.ts pins the rest):
 * - shoulderX 0.30 (estimate 0.292): the joint on the outer edge of the shoulder caps;
 * - armSpread 0.28 rad = 16° (estimate 0.162 = 9°): raised by eye so the hanging arms clear the body;
 * - elbowX / wristX on the model's own joints (5 cm inside the estimate), the hips 3 cm lower;
 * - hipZ 0.033 (estimate -0.022, the shins' middle; the robot's calves reach back): the thighs' and
 *   knees' middle; legDepth is measured about it;
 * - neckY 1.15, headY 1.18, neckBlend 0.015 (estimate 1.179 / 1.193 / 0.007): the head joint at the
 *   top of the neck, so the whole helmet (from 1.195 up) is rigid on the head bone;
 * - ankleY 0.17 with a 0.03 blend (estimate 0.177 / 0.034): the boots (up to about 0.14) are rigid feet;
 * - nothing bridges its legs: hemY = crotchY (no skirt weights).
 */
export const ROBOT_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.079,
   shoulderX: 0.3,
   shoulderZ: 0.031,
   armRadius: 0.093,
   clavicleX: 0.15,
   elbowX: 0.47,
   wristX: 0.7,
   armSpread: 0.28,
   crotchY: 0.65,
   hipY: 0.71,
   hipX: 0.172,
   hipZ: 0.033,
   kneeY: 0.355,
   ankleY: 0.17,
   toeZ: 0.29,
   heelZ: -0.218,
   legDepth: 0.203,
   legOuterX: 0.322,
   hemY: 0.65,
   spineY: 0.821,
   chestY: 0.931,
   neckY: 1.15,
   headY: 1.18,
   spineZ: 0.057,
   shoulderBlend: 0.056,
   elbowBlend: 0.046,
   hipBlend: 0.071,
   kneeBlend: 0.053,
   ankleBlend: 0.03,
   crotchBlend: 0.063,
   spineBlend: 0.033,
   neckBlend: 0.015,
};

/**
 * The runner's joints (GLB units: 1.90 x 1.886 x 0.52 T-pose, the arm span the longest side; faces
 * +z, stylised: a big head with glasses and a beard, hoodie, joggers, sneakers), measured from the
 * v2 runner.glb (2026-10-07, the same recipe as the robot's; rig/runner.test.ts). The estimate finds
 * most of them; set by eye:
 * - armRadius 0.095 (estimate 0.076) about shoulderY 1.35: the thick sleeve's top (its stripe, up to
 *   about 1.44 at the shoulder) and underside are in the arm band, so they go down with the arm
 *   instead of staying out as fins;
 * - headY 1.53 / neckY 1.49 (estimate 1.599 / 1.56): there is no neck to see in front (the beard
 *   reaches the hood's collar), so the estimate's narrowest bands are the beard and the mouth and its
 *   head joint fell at the mouth; at the top of the collar the face, glasses and beard turn as one
 *   (the hood's top behind the head, up to 1.535, follows the head a little);
 * - hipZ -0.035 (estimate -0.058, the shins' middle): between the thighs' middle (about -0.005) and
 *   the knees' (-0.05), so the legs swing about their own axis; legDepth widened with it;
 * - ankleY 0.205 with a 0.025 blend (estimate 0.169 / 0.043): the sneakers (up to about 0.19) are
 *   rigid, the ankle bends in the sock;
 * - hemY = crotchY: nothing bridges the legs (the estimate agrees).
 */
export const RUNNER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.35,
   shoulderX: 0.275,
   shoulderZ: -0.033,
   armRadius: 0.095,
   clavicleX: 0.138,
   elbowX: 0.511,
   wristX: 0.747,
   armSpread: 0.164,
   crotchY: 0.747,
   hipY: 0.827,
   hipX: 0.157,
   hipZ: -0.035,
   kneeY: 0.414,
   ankleY: 0.205,
   toeZ: 0.258,
   heelZ: -0.139,
   legDepth: 0.1,
   legOuterX: 0.269,
   hemY: 0.747,
   spineY: 0.983,
   chestY: 1.139,
   neckY: 1.49,
   headY: 1.53,
   spineZ: 0.003,
   shoulderBlend: 0.045,
   elbowBlend: 0.038,
   hipBlend: 0.083,
   kneeBlend: 0.062,
   ankleBlend: 0.025,
   crotchBlend: 0.076,
   spineBlend: 0.047,
   neckBlend: 0.02,
};

export const SHARED_ASSETS: Record<SharedAssetId, ModelAsset> = {
   // Rodin characters come as static T-poses: the core auto-rig (core/rig) animates them. The
   // runner is 1.886 tall in GLB units (its arm span, 1.90, is the longest side): a game sets
   // `scale` for its own drawn height (office-escape 0.825 = 1.556 m, obstacle-race 0.795 = 1.50 m).
   // There is deliberately no default: drawn as is (`SHARED_ASSETS.runner.scale ?? 1`) it stands
   // 1.886 m tall. A game draws `{ ...SHARED_ASSETS.runner, scale }` from its own assets.ts and
   // derives its stride and lift scale from that asset (clean-city 0.503 = 0.95 m; escape-room 0.744
   // = 1.40 m, its stand-in's height; tower-climb 0.2916 = 0.55 m); RUNNER_LANDMARKS are complete,
   // so no ROBOT_LANDMARKS spread.
   runner: {
      id: "runner",
      url: shared("runner"),
      humanoid: { landmarks: RUNNER_LANDMARKS },
      fallback: "capsule",
      fallbackColor: "#f97316",
      budget: { ...CHARACTER_BUDGET },
   },
   robot: {
      id: "robot",
      url: shared("robot"),
      humanoid: { landmarks: ROBOT_LANDMARKS },
      fallback: "capsule",
      fallbackColor: "#2dd4bf",
      budget: { ...CHARACTER_BUDGET },
   },
   battery: {
      id: "battery",
      url: shared("battery"),
      fallback: "cylinder",
      fallbackColor: "#4ade80",
      budget: { ...PROP_BUDGET },
   },
   crate: {
      id: "crate",
      url: shared("crate"),
      fallback: "box",
      fallbackColor: "#b45309",
      budget: { ...PROP_BUDGET },
   },
   tinCan: {
      id: "tinCan",
      url: shared("tinCan"),
      fallback: "cylinder",
      fallbackColor: "#94a3b8",
      budget: { ...PROP_BUDGET },
   },
   banana: {
      id: "banana",
      url: shared("banana"),
      fallback: "capsule",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
   desk: {
      id: "desk",
      url: shared("desk"),
      fallback: "box",
      fallbackColor: "#a16207",
      budget: { ...PROP_BUDGET },
   },
   chair: {
      id: "chair",
      url: shared("chair"),
      fallback: "box",
      fallbackColor: "#475569",
      budget: { ...PROP_BUDGET },
   },
   // A gold coin with a raised star on both faces (group D, 2026-10-07), COIN_GLB_SIZE below. Like
   // the runner, no default scale: a game spreads it with its own `scale` and `yOffset`.
   coin: {
      id: "coin",
      url: shared("coin"),
      fallback: "cylinder",
      fallbackColor: "#fbbf24",
      budget: { ...PROP_BUDGET },
   },
};

/**
 * SHARED_ASSETS.coin's measured bounds in GLB units: it stands on its edge on y = 0 (centre at
 * y 0.93), its faces along ±z, about 0.33 deep at the rim. A game fits it from these, never from
 * copies of the numbers: `scale` = its diameter / width and, for a coin placed by its centre,
 * `yOffset` = -scale x height / 2 (office-escape, tower-climb; office-escape/coin.test.ts checks
 * them against the real mesh).
 */
export const COIN_GLB_SIZE = { width: 1.899, height: 1.861, depth: 0.492 } as const;
