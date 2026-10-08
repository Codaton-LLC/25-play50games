// The GLB chef's walk, lean and catch on the core auto-rig (core/rig). Pure, no three.js, no React,
// no allocation (each function writes into its arguments), so Scene.tsx runs it every frame and
// chef.test.ts checks it on the real chef.glb. Looks only: rules.ts owns the chef's position and speed.
import { turnTowards } from "@/arcade3d/core/math";
import {
   BONE,
   POSE_MASK,
   blendPoses,
   bodyLift,
   carryPose,
   gaitPhaseStep,
   idlePose,
   turnBone,
   walkPose,
   wrapPhase,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { ASSETS, CHEF_LANDMARKS } from "./assets";

/** The chef GLB's joints and its scale here: its stride and its height over its planted foot. */
const LEGS = CHEF_LANDMARKS;
export const CHEF_SCALE = ASSETS.chef.scale ?? 1;
/**
 * The phase never advances by more than a stride this short (m): standing still, the stride is 0.
 * The chef's own stride is longer from 0.07 m/s (a slow drag), so the planted foot stays put there.
 */
export const CHEF_MIN_STRIDE = 0.02;
/**
 * The stride the planted foot needs while it touches the floor (core contactStride x CHEF_SCALE:
 * the walk's own at a walk, 1.79 m at the full run) keeps it still. The chef dashes at up to 9 m/s
 * (the keyboard's speed): that takes 5.03 strides a second, the most at any speed, and the full run
 * is already the longest stride walkPose has. This cap is a safety just above it: it never binds at
 * a steady speed (chef.test.ts). The old cap of 4 stretched the dash's stride and slid the feet 19 %.
 */
export const CHEF_MAX_CADENCE = 5.1;
/**
 * The speed (m/s) of walkPose's full run (amount 1); slower, the amount is the speed over it. The
 * chef's short legs walk about 1.56 m per unit of amount (walkStride x CHEF_SCALE), so with the
 * amount at speed / 5 its stride covers the ground at about 3.2-3.3 strides a second at a walk and
 * 2.8-3.9 at a run up to 7 m/s; with the amount at speed / 7.5 (the long-legged v1 chef's) or
 * speed / 9 (the dash's top) slow walks would need over 4.
 */
export const CHEF_RUN_SPEED = 5;
/**
 * The GLB chef turns towards the way it runs by |v| / CHEF_TURN_SPEED (m/s) of a quarter turn (`v` its
 * eased speed, ChefGait.v), the whole quarter (±90°, side-on to the camera) at and above it, and back
 * to the camera when it stops. Turning by the speed keeps it continuous, so a finger jittering around
 * a slow drag moves the facing a little, never flips it, and even a slow drag turns the walk's stride
 * along the counter; the eased speed rides out a frame's hitch (one short or long step of the touch
 * drive). With the old all-or-nothing turn above 1 m/s the chef faced the camera on a slow drag and
 * slid sideways on flat feet (chef.test.ts: the planted foot's slip).
 */
export const CHEF_TURN_SPEED = 0.5;
/** A catch: the arms reach up towards the item for this long (s), then drop. */
export const REACH_S = 0.4;
/** The lean into the speed (rad per m/s): the stand-in's whole body (about its feet), the GLB's spine. */
export const CHEF_LEAN = 0.03;

/** The walk cycle (looks only) of the GLB chef: phase, eased amount, its facing, its lean and the body's height. */
export interface ChefGait {
   phase: number;
   amount: number;
   yaw: number;
   /** the chef's speed eased at 12/s (m/s, signed: > 0 towards +x): the facing and the lean follow it */
   v: number;
   /** the spine's lean into the run (rad, signed like the speed: > 0 towards +x): CHEF_LEAN x v */
   lean: number;
   /** the body's height over its planted foot this frame (m): core/rig bodyLift x CHEF_SCALE */
   lift: number;
}

export function createChefGait(): ChefGait {
   return { phase: 0, amount: 0, yaw: 0, v: 0, lean: 0, lift: 0 };
}

/**
 * One frame of the GLB chef's walk: the amount eases towards |v| / CHEF_RUN_SPEED (`v` the chef's
 * speed, signed, 0 when the run is not playing), the phase advances by the distance run over the
 * contact stride (so the planted foot stays put; CHEF_MAX_CADENCE never binds at a steady speed), the
 * speed eases (gait.v), the chef turns towards the way it runs by that speed (CHEF_TURN_SPEED) and
 * its spine leans into it. `dt` in seconds (0 while paused: nothing moves).
 */
export function stepChefGait(gait: ChefGait, v: number, dt: number): ChefGait {
   const speed = Math.abs(v);
   const ease = 1 - Math.exp(-12 * dt);
   gait.amount += (Math.min(1, speed / CHEF_RUN_SPEED) - gait.amount) * ease;
   gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, LEGS, CHEF_SCALE, speed, dt, CHEF_MAX_CADENCE, CHEF_MIN_STRIDE));
   gait.v += (v - gait.v) * ease;
   // face the way it runs: +x is the camera's right, a quarter turn to the chef's left (a share of it below CHEF_TURN_SPEED)
   const facing = (Math.PI / 2) * Math.max(-1, Math.min(1, gait.v / CHEF_TURN_SPEED));
   gait.yaw = turnTowards(gait.yaw, facing, 1 - Math.exp(-10 * dt));
   gait.lean = CHEF_LEAN * gait.v;
   return gait;
}

/**
 * The catch's reach (`k` 0..1 over REACH_S) blended into the arms of `p`: up towards the item and
 * down again. The reach's height grows with its weight, so the arms pass through the carry's
 * forearms-forward pose (carryPose 0) on the way up and down instead of swinging out through the
 * T-pose (the hanging arm's drop and carryPose's aimed arm blend separately: chef.test.ts).
 */
export function catchReach(p: HumanoidPose, k: number, scratch: HumanoidPose): HumanoidPose {
   if (!(k >= 0 && k < 1)) return p;
   const w = Math.sin(k * Math.PI);
   return blendPoses(p, carryPose(0.7 * w, scratch), Math.min(1, 3 * w), p, POSE_MASK.arms);
}

/**
 * The GLB chef's pose for this frame into `out` (after stepChefGait): the walk by the gait, the
 * idle's breath and glance in the upper body while nearly still, the spine's lean into the run
 * towards the world's travel direction in the chef's own (turned) frame, and the catch's reach
 * `sinceCatch` seconds after the last catch. Sets gait.lift. `t` in seconds (the game time).
 */
export function chefPose(gait: ChefGait, t: number, sinceCatch: number, out: HumanoidPose, scratch: HumanoidPose): HumanoidPose {
   walkPose(gait.phase, gait.amount, out);
   // nearly still: the idle's breath and glance in the upper body (the legs keep the walk's)
   blendPoses(out, idlePose(t, scratch), 1 - Math.min(1, gait.amount * 5), out, POSE_MASK.upper);
   // the lean towards the world's +x is a forward lean once the chef faces it (yaw π/2), a tilt to its
   // own left (+x) while it faces the camera (yaw 0): in the spine, so the feet stay on the floor
   turnBone(out, BONE.spine, gait.lean * Math.sin(gait.yaw), 0, -gait.lean * Math.cos(gait.yaw));
   catchReach(out, sinceCatch / REACH_S, scratch);
   gait.lift = bodyLift(out, LEGS) * CHEF_SCALE;
   return out;
}

/** The whole body's roll about its feet (rad): the stand-in leans into the speed this way; the GLB leans its spine (chefPose) and keeps 0. */
export function chefRootRoll(chefV: number, glb: boolean): number {
   return glb ? 0 : -chefV * CHEF_LEAN;
}
