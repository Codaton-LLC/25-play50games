import { aimArm, cheerPose, walkPose, type HumanoidPose } from "@/arcade3d/core/rig";
export function hunterPose(phase: number, amount: number, cheer: boolean, time: number, out: HumanoidPose): void {
   if (cheer) { cheerPose(time, out); return; }
   walkPose(phase, amount, out);
   aimArm(out, -1, -0.28, -0.6, 0.65, 0, -0.15, 1);
   aimArm(out, 1, 0.25, -0.7, 0.55, 0.15, -0.25, 0.95);
}
