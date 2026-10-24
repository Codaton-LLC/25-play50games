import { aimArm, BONE, blendPoses, carryPose, idlePose, POSE_MASK, turnBone, type HumanoidPose } from "@/arcade3d/core/rig";

export function floatPose(t: number, thrust: number, reach: number, wobble: number, won: boolean, reduced: boolean, out: HumanoidPose, scratch: HumanoidPose): void {
   idlePose(reduced ? 0 : t * 0.3, out);
   out.ground = 0; out.lift = 0;
   // Keep all arm blends in the same aimed (drop=0) representation. Interpolating
   // drop and rotation separately passes through a wide, near-T pose.
   aimArm(out, 1, 0.25, -1, 0.04, 0.2, -1, 0.16);
   aimArm(out, -1, 0.25, -1, 0.04, 0.2, -1, 0.16);
   const drift = reduced ? 0 : 0.04 * Math.sin(t * Math.PI * 0.6);
   turnBone(out, BONE.lowerLegL, 0.06 + drift, 0, 0);
   turnBone(out, BONE.lowerLegR, 0.06 - drift, 0, 0);
   const weight = Math.max(thrust * 0.65, reach);
   if (weight > 0) {
      carryPose(0, scratch);
      blendPoses(out, scratch, Math.min(1, weight * 3), out, POSE_MASK.arms);
      if (reach > 1 / 3) {
         aimArm(scratch, -1, -0.18, -0.75, 0.5, -0.05, -0.1, 1);
         blendPoses(out, scratch, (reach - 1 / 3) * 1.5, out, POSE_MASK.arms);
      }
   }
   turnBone(out, BONE.spine, -0.06 * thrust + (reduced ? 0 : wobble * 0.06 * Math.sin(t * 12)), 0, 0);
   if (won) {
      carryPose(0, scratch);
      const pump = reduced ? 0 : 0.06 * Math.sin(t * 3);
      aimArm(scratch, 1, 0.15, -0.65, 0.5, -0.1, 0.8 + pump, 0.5);
      aimArm(scratch, -1, 0.15, -0.65, 0.5, -0.1, 0.8 - pump, 0.5);
      blendPoses(out, scratch, 0.6, out, POSE_MASK.arms);
   }
}
