// The worker stands, points at the crane while a piece is on the hook, and cheers a finished building.
import { aimArm, cheerPose, idlePose, type HumanoidPose } from "@/arcade3d/core/rig";

export function pointPose(out: HumanoidPose): HumanoidPose {
   idlePose(0, out);
   aimArm(out, 1, 0.2, 0.45, 0.85, 0.05, 0.9, 0.4, 0);
   return out;
}

export function workerPose(carrying: boolean, cheer: number, won: boolean, now: number, out: HumanoidPose): HumanoidPose {
   if (cheer > 0 || won) return cheerPose(now, out);
   if (carrying) return pointPose(out);
   return idlePose(now, out);
}
