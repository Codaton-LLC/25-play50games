// The chef's poses (pure, no allocation; core/README "Driving a character"): the reach-and-throw over
// the wheel's back arc and the cheer blend, built from the core rig helpers. The aim directions are a
// two-bone solve for the measured chef landmarks (CHEF_LANDMARKS): the right arm's upper segment swings
// out and down, the forearm folds back so the hand hovers over the back-slot ring above the disc, then
// the throw points the arm at the cauldron mouth. Checked on the real mesh in poses.test.ts.
import {
   BONE,
   POSE_MASK,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   idlePose,
   turnBone,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { WHEEL } from "./rules";

/** Where the chef stands (m), behind the wheel, facing the cauldron. */
export const CHEF_POS = { x: -2.0, y: 0, z: -0.75 };
/** The chef faces the cauldron mouth: +x and a touch +z. */
export const CHEF_YAW = Math.atan2(2, 0.65);
/** The wheel's back-slot ring the reach reads over (m, world); the hand hovers just above it. */
export const BACK_SLOT_RING = { x: WHEEL.x, y: WHEEL.y + 0.13, z: -0.7 };

const smooth01 = (v: number): number => {
   const t = v < 0 ? 0 : v > 1 ? 1 : v;
   return t * t * (3 - 2 * t);
};

// reach: upper arm out-down, forearm folded back; throw: the arm swings up-forward at the pot.
// aimArm mirrors x for the right arm internally (side -1), so these are the mirrored conventions.
const REACH_U = { x: 0.9379, y: -0.3463, z: -0.0046 };
const REACH_F = { x: -0.9994, y: 0.0057, z: 0.0049 };
const THROW_U = { x: -0.1192, y: 0.237, z: 0.9643 };
const THROW_F = { x: -0.12, y: 0.28, z: 0.95 };

/**
 * The throw at progress k (0..1) into `out`: 0..0.45 reaches the wheel's back arc, 0.45..1 follows
 * through toward the cauldron. `scratch` is a second pose for the blend. The spine leans with the arm.
 */
export function reachThrowPose(k: number, out: HumanoidPose, scratch: HumanoidPose): void {
   const t = k < 0 ? 0 : k > 1 ? 1 : k;
   armsDownPose(out);
   aimArm(out, -1, REACH_U.x, REACH_U.y, REACH_U.z, REACH_F.x, REACH_F.y, REACH_F.z);
   if (t <= 0.45) {
      turnBone(out, BONE.spine, 0.14 * smooth01(t / 0.45), 0, 0);
      return;
   }
   const w = smooth01((t - 0.45) / 0.55);
   armsDownPose(scratch);
   aimArm(scratch, -1, THROW_U.x, THROW_U.y, THROW_U.z, THROW_F.x, THROW_F.y, THROW_F.z);
   blendPoses(out, scratch, w, out, POSE_MASK.arms);
   turnBone(out, BONE.spine, 0.14 + (-0.06 - 0.14) * w, 0, 0);
}

export interface ChefLook {
   /** 0..1 through the throw, or < 0 when the chef is not throwing */
   throwK: number;
   /** 0..1 cheer blend after a serve */
   cheer: number;
}

/**
 * The chef's pose this frame: idle, the throw blended in over its envelope (through the
 * forearms-forward carry first, so the arm never swings out level past the T reach), then the cheer.
 * `reach`, `carry` and `cheer` are scratch poses (createPose).
 */
export function chefPose(look: ChefLook, now: number, out: HumanoidPose, reach: HumanoidPose, carry: HumanoidPose, cheer: HumanoidPose): void {
   idlePose(now, out);
   if (look.throwK >= 0) {
      const w = 1 - (2 * look.throwK - 1) ** 2;
      blendPoses(out, carryPose(0.3, carry), Math.min(1, 3 * w), out, POSE_MASK.arms);
      reachThrowPose(look.throwK, reach, cheer);
      blendPoses(out, reach, w, out, POSE_MASK.arms);
      turnBone(out, BONE.spine, 0.14 * w, 0, 0);
   }
   if (look.cheer > 0.001) blendPoses(out, cheerPose(now, cheer), look.cheer, out, POSE_MASK.arms);
}
