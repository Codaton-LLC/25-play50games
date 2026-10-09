import { aimArm, armsDownPose, blendPoses, cheerPose, createPose, POSE_MASK, walkPose, type HumanoidPose } from "@/arcade3d/core/rig";

const aiming = createPose();
export function hunterPose(phase: number, amount: number, cheer: boolean, time: number, out: HumanoidPose): void {
   if (cheer) { cheerPose(time, out); return; }
   walkPose(phase, amount, out);
   // The full-speed core pose includes run flight; this hunter always plants a sole.
   out.ground = 1;
   out.lift = 0;
   armsDownPose(aiming);
   aimArm(aiming, -1, -0.28, -0.6, 0.65, 0, -0.15, 1);
   aimArm(aiming, 1, 0.25, -0.7, 0.55, 0.15, -0.25, 0.95);
   blendPoses(out, aiming, 1, out, POSE_MASK.arms);
}
