// Poses for Crazy Shopping Cart: runner pushing/riding the cart, and patrolling shoppers.
// Pure and deterministic: no three.js, no allocation per call.
import {
   BONE,
   POSE_MASK,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   gaitPhaseStep,
   idlePose,
   jumpPose,
   setBoneEuler,
   turnBone,
   walkPose,
   wrapPhase,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";
import { CART } from "./rules";

export const MAX_CADENCE = 4;
export const RUN_AMOUNT = 1;

export const gaitAmount = (speed: number) =>
   RUN_AMOUNT * Math.min(1, Math.max(0, speed) / CART.maxWalkingSpeed);

export function runnerPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, RUNNER_LANDMARKS, RUNNER_SCALE, speed, dt, MAX_CADENCE);
}

export interface RunnerLook {
   amount: number;
   phase: number;
   riding: number; // 0..1 eased
   cheer: number;  // 0..1 eased
}

/**
 * Runner pose:
 * - Walking: feet walk, arms forward gripping the cart handle (carryPose(0)).
 * - Riding: tuck on cart base bar (jumpPose), hands on handle.
 * - Win: cheerPose.
 */
export function runnerPose(
   look: RunnerLook,
   now: number,
   out: HumanoidPose,
   scratchA: HumanoidPose,
   scratchB: HumanoidPose,
): HumanoidPose {
   // 1. Base walking / running animation
   walkPose(look.phase, look.amount, out);
   blendPoses(out, idlePose(now, scratchA), 1 - Math.min(1, look.amount * 4), out, POSE_MASK.upper);

   // 2. Arms forward gripping the handle across both walk and idle
   blendPoses(out, carryPose(0, scratchA), 0.95, out, POSE_MASK.arms);

   // 3. Riding tuck (jumpPose) blended in when holding Ride
   if (look.riding > 0.001) {
      jumpPose(1, scratchB);
      // Keep arms forward on handle even in jump pose
      blendPoses(scratchB, carryPose(0, scratchA), 0.9, scratchB, POSE_MASK.arms);
      blendPoses(out, scratchB, look.riding, out);
   }

   // 4. Cheering on win
   if (look.cheer > 0.001) {
      blendPoses(out, cheerPose(now, scratchA), look.cheer, out);
   }

   return out;
}

/** Standard walking pose for NPC shoppers. */
export function shopperPose(
   phase: number,
   speed: number,
   now: number,
   out: HumanoidPose,
   scratch: HumanoidPose,
): HumanoidPose {
   const amount = Math.min(1, speed / 1.8);
   walkPose(phase, amount, out);
   if (amount < 0.1) {
      blendPoses(out, idlePose(now, scratch), 1 - amount, out, POSE_MASK.upper);
   }
   return out;
}

export const advancePhase = (phase: number, step: number) => wrapPhase(phase + step);
