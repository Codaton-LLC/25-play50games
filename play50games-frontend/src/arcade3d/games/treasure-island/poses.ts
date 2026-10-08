// The explorer's poses on the core auto-rig: the game-local dig, and the blend of walk / idle / dig /
// cheer the Scene drives every frame. Pure, no three.js, no allocation per call (scratch poses are
// passed in). Tested on the real runner mesh in poses.test.ts (rig/characterChecks rigCharacter).
import {
   BONE,
   POSE_MASK,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   gaitPhaseStep,
   idlePose,
   levelFoot,
   setBoneEuler,
   turnBone,
   walkPose,
   wrapPhase,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { EXPLORER_SCALE } from "./assets";
import { EXPLORER } from "./rules";

/** Scoops a second while digging. */
export const DIG_RATE = 2.5;
/** walkPose's amount at top speed: the full run, whose own stride (1.26 m) keeps 5 m/s under the cadence cap. */
export const RUN_AMOUNT = 1;
/** The legs beat at most this many strides a second (core gaitPhaseStep). */
export const MAX_CADENCE = 4;

/** walkPose's amount for a speed (m/s). */
export const gaitAmount = (speed: number) => RUN_AMOUNT * Math.min(1, Math.max(0, speed) / EXPLORER.maxSpeed);

/** The walk phase step (rad) for `amount` at `speed` over `dt` (0 standing still). */
export function explorerPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, RUNNER_LANDMARKS, EXPLORER_SCALE, speed, dt, MAX_CADENCE);
}

const TAU = Math.PI * 2;
/** The dig's crouch (rad): thighs forward, knees bent (the feet stay under the hips). */
export const CROUCH = { thigh: 0.5, knee: 0.95 } as const;
/** The dig's forward bend (rad, turnBone on top of the hanging pose). */
export const BEND = { spine: 0.55, chest: 0.35, head: -0.3 } as const;

/**
 * Digging in front of the feet: a crouch (thighs forward, knees bent, soles flat), the trunk bent
 * forward (BEND) and both arms reaching down and forward to the sand, scooping at DIG_RATE. Built
 * from aimArm (each arm segment its shortest turn, no wrung shoulder) and turnBone.
 */
export function digPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   setBoneEuler(out.q, BONE.upperLegL, -CROUCH.thigh, 0, 0);
   setBoneEuler(out.q, BONE.upperLegR, -CROUCH.thigh, 0, 0);
   setBoneEuler(out.q, BONE.lowerLegL, CROUCH.knee, 0, 0);
   setBoneEuler(out.q, BONE.lowerLegR, CROUCH.knee, 0, 0);
   turnBone(out, BONE.spine, BEND.spine, 0, 0);
   turnBone(out, BONE.chest, BEND.chest, 0, 0);
   turnBone(out, BONE.head, BEND.head, 0, 0);
   // the scoop, in the bent chest's frame (its "forward" points at the sand in front of the feet):
   // the forearms swing between reaching forward and pulling down
   const k = Math.sin(t * DIG_RATE * TAU);
   aimArm(out, 1, 0.15, -0.25, 0.97, 0, -0.6 - 0.2 * k, 0.8 - 0.25 * k);
   aimArm(out, -1, 0.15, -0.25, 0.97, 0, -0.6 - 0.2 * k, 0.8 - 0.25 * k);
   levelFoot(out, 1);
   levelFoot(out, -1);
   return out;
}

/** What the explorer is doing this frame (looks only). */
export interface ExplorerLook {
   /** walkPose's amount, eased (0 standing) */
   amount: number;
   phase: number;
   /** 0..1, eased in while a dig is held */
   dig: number;
   /** 0..1, eased in on the win */
   cheer: number;
}

const smooth = (v: number) => {
   const t = v < 0 ? 0 : v > 1 ? 1 : v;
   return t * t * (3 - 2 * t);
};

/**
 * The explorer's pose: the walk (the idle's breath in the upper body when still), the dig blended in
 * through the forearms-forward carry first (blending a hanging arm straight into an aimed one swings
 * it out through the T-pose: core/README "Blending an aimed arm"), the cheer on the win. `a` and `b`
 * are scratch poses. Allocates nothing.
 */
export function explorerPose(look: ExplorerLook, now: number, out: HumanoidPose, a: HumanoidPose, b: HumanoidPose): HumanoidPose {
   walkPose(look.phase, look.amount, out);
   blendPoses(out, idlePose(now, a), 1 - Math.min(1, look.amount * 5), out, POSE_MASK.upper);
   if (look.dig > 0.001) {
      blendPoses(out, carryPose(0, a), Math.min(1, 3 * look.dig), out, POSE_MASK.arms);
      blendPoses(out, digPose(now, b), smooth(look.dig), out);
      levelFoot(out, 1);
      levelFoot(out, -1);
   }
   if (look.cheer > 0.001) blendPoses(out, cheerPose(now, a), look.cheer, out);
   return out;
}

/** Advances the walk phase (a wrapped angle). */
export const advancePhase = (phase: number, step: number) => wrapPhase(phase + step);
