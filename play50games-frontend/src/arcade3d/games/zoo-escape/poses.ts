// The keeper's poses (pure, no allocation; tested on the real mesh in poses.test.ts): a walk with the
// right arm holding the torch forward and a little down, the idle breath when still, and the
// look-around of a wait carried by the chest and head so the torch and the face follow the cone.
import { BONE, POSE_MASK, aimArm, armsDownPose, blendPoses, cheerPose, gaitPhaseStep, idlePose, turnBone, walkPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { ZOO_KEEPER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { KEEPER_SCALE } from "./assets";

/** The walk's amount at a speed (m/s): 1.3 m/s patrol = 0.43, 2.0 investigating = 0.67. */
export const keeperAmount = (speed: number) => Math.min(1, speed / 3);
/** Cadence cap (strides per second). */
export const KEEPER_CADENCE = 4;
/** Shares of the look-around turn (agent yaw - body yaw) taken by the chest and the head. */
export const LOOK_SHARE = { chest: 0.4, head: 0.6 } as const;

export function keeperPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, ZOO_KEEPER_LANDMARKS, KEEPER_SCALE, speed, dt, KEEPER_CADENCE);
}

/** The torch arm alone (right arm forward and a little down, forearm level-ish), into `out`. */
export function torchArm(out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   aimArm(out, -1, 0.18, -0.72, 0.62, 0.02, -0.28, 1);
   return out;
}

/**
 * The keeper this frame: walk by `phase` / `amount`, the idle breath blended in as it stops, the torch
 * arm always, the look-around `look` (rad, the cone's yaw minus the body's) through chest and head,
 * or the cheer (`cheer` 0..1, a caught panda) over the upper body. `scratch` is a second pose.
 */
export function keeperPose(phase: number, amount: number, look: number, t: number, cheer: number, out: HumanoidPose, scratch: HumanoidPose): HumanoidPose {
   walkPose(phase, amount, out);
   // a hurrying keeper strides, it never flies: one sole always on the floor
   out.ground = 1;
   out.lift = 0;
   const still = 1 - Math.min(1, amount * 5);
   if (still > 0) blendPoses(out, idlePose(t, scratch), still, out, POSE_MASK.upper);
   blendPoses(out, torchArm(scratch), 1, out, POSE_MASK.arms);
   if (cheer > 0) blendPoses(out, cheerPose(t, scratch), cheer, out, POSE_MASK.arms);
   turnBone(out, BONE.chest, 0, LOOK_SHARE.chest * look, 0);
   turnBone(out, BONE.head, 0, LOOK_SHARE.head * look, 0);
   return out;
}
