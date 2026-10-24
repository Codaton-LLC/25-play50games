// The finished robot's walk-off (looks only): pure poses on the core auto-rig, shared by Scene and
// poses.test.ts. It walks from the cradle to the door in WALK.DURATION, waving its camera-side
// (right) arm, then steps through the door; on a win it cheers on the cradle.
import { BONE, BONE_COUNT, blendPoses, cheerPose, gaitPhaseStep, reachPose, walkPose, wrapPhase, type HumanoidPose, type PoseMask } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ROBOT_SCALE } from "./assets";
import { WALK } from "./rules";

/** m/s: cradle to door in 0.70 s. */
export const WALK_SPEED = (WALK.TO.x - WALK.FROM.x) / WALK.DURATION;
/** s: after reaching the door it keeps walking this long, through the opening, then is gone. */
export const THROUGH_DOOR = 0.35;
/** The walk's amount (0.5 = a walk: the stance foot stays planted; a run would fly). */
export const WALK_AMOUNT = 0.5;
/** Strides a second at most. */
export const WALK_CADENCE = 3.2;

const RIGHT_ARM: PoseMask = Array.from({ length: BONE_COUNT }, (_v, i) => (i === BONE.clavicleR || i === BONE.upperArmR || i === BONE.lowerArmR ? 1 : 0));

/** Where the robot stands `t` s after its blueprint was finished (x along the walk; null = gone). */
export function walkOffX(t: number): number | null {
   if (t < 0 || t > WALK.DURATION + THROUGH_DOOR) return null;
   return WALK.FROM.x + WALK_SPEED * t;
}

/** The walk phase `t` s into the walk-off: distance over the stride, so the planted foot stays put. */
export function walkOffPhase(t: number): number {
   return wrapPhase(gaitPhaseStep(WALK_AMOUNT, ROBOT_LANDMARKS, ROBOT_SCALE, WALK_SPEED, Math.max(0, t), WALK_CADENCE) + Math.PI / 2);
}

/** The walk-off pose at `t` (s): walking, the right arm waving at the camera over the first half second. */
export function robotWalkOffPose(t: number, scratch: HumanoidPose, out: HumanoidPose): HumanoidPose {
   walkPose(walkOffPhase(t), WALK_AMOUNT, out);
   const wave = Math.max(0, Math.sin(Math.min(1, t / 0.6) * Math.PI));
   reachPose(-1, 0.75 + 0.2 * Math.sin(t * 14), scratch);
   return blendPoses(out, scratch, wave * 0.9, out, RIGHT_ARM);
}

/** The win: arms up on the cradle. */
export function robotCheerPose(t: number, out: HumanoidPose): HumanoidPose {
   return cheerPose(t, out);
}
