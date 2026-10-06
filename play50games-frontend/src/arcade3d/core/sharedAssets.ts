// Models shared by several games (public/models/3d/shared/<id>.glb). Plain data, no three.js.
// Mirrors src/arcade3d/assets/shared.spec.json. Owned by Claude: games reuse these entries
// (spread them to change scale/rotation) but never edit this file.
import type { ModelAsset } from "./types";
import type { HumanoidLandmarks } from "./rig/humanoid";

export type SharedAssetId = "runner" | "robot" | "battery" | "crate" | "tinCan" | "banana" | "desk" | "chair";

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

export const SHARED_ASSETS: Record<SharedAssetId, ModelAsset> = {
   // Rodin characters come as static T-poses: the core auto-rig (core/rig) animates them. The
   // runner's landmarks are estimated until runner.glb exists (then measured like the robot's).
   runner: {
      id: "runner",
      url: shared("runner"),
      humanoid: {},
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
};
