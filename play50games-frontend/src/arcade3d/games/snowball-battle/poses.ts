// Looks only. rules.ts owns position and speed; this writes a HumanoidPose for the snow kid.
import {
   BONE,
   POSE_MASK,
   aimArm,
   blendPoses,
   carryPose,
   cheerPose,
   flailPose,
   gaitPhaseStep,
   levelFoot,
   turnBone,
   walkPose,
   wrapPhase,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { SNOW_KID_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { KID_SCALE } from "./assets";

export const KID_CADENCE = 4;
export type KidLook = "walk" | "crouch" | "throw" | "cheer" | "flail";

export function stepKidPhase(phase: number, speed: number, dt: number): number {
   const amount = Math.min(1, speed / 4.5);
   return wrapPhase(phase + gaitPhaseStep(amount, SNOW_KID_LANDMARKS, KID_SCALE, speed, dt, KID_CADENCE, 0.05));
}

/** Walk, crouch, throw, cheer or flail into `out`. Feet stay on the floor (poses.test.ts). */
export function kidPose(phase: number, speed: number, look: KidLook, t: number, out: HumanoidPose, scratch: HumanoidPose): HumanoidPose {
   const amount = Math.min(1, speed / 4.5);
   walkPose(phase, look === "crouch" ? 0 : amount, out);
   if (look === "crouch") {
      turnBone(out, BONE.spine, 0.35, 0, 0);
      turnBone(out, BONE.chest, 0.25, 0, 0);
      turnBone(out, BONE.head, -0.2, 0, 0);
      turnBone(out, BONE.upperLegL, -0.9, 0, 0);
      turnBone(out, BONE.upperLegR, -0.9, 0, 0);
      turnBone(out, BONE.lowerLegL, 1.3, 0, 0);
      turnBone(out, BONE.lowerLegR, 1.3, 0, 0);
      levelFoot(out, 1);
      levelFoot(out, -1);
   } else if (look === "throw") {
      carryPose(0.85, scratch);
      aimArm(scratch, 1, 0.2, 0.85, 0.55, 0, 1, 0.2);
      blendPoses(out, scratch, 1, out, POSE_MASK.arms);
   } else if (look === "cheer") {
      cheerPose(t, scratch);
      blendPoses(out, scratch, 1, out, POSE_MASK.upper);
   } else if (look === "flail") {
      flailPose(t, scratch);
      blendPoses(out, scratch, 1, out, POSE_MASK.upper);
   }
   out.ground = 1;
   out.lift = 0;
   return out;
}
