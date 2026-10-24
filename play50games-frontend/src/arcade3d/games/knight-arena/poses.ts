// Pure pose builders for knight-arena (core/rig). No React.
import { bodyLift } from "../../core/rig/gait";
import { BONE } from "../../core/rig/humanoid";
import {
   aimArm,
   blendPoses,
   cheerPose,
   createPose,
   idlePose,
   POSE_MASK,
   turnBone,
   walkPose,
   type HumanoidPose,
} from "../../core/rig/poses";
import { KNIGHT_LANDMARKS } from "../../core/sharedAssets";
import { ASSETS, SHIELD_HEIGHT, SWORD_BLADE_AHEAD } from "./assets";

export type StrikeDir = "up" | "down" | "left" | "right";

export const KNIGHT_SCALE = ASSETS.knight.scale ?? 1;
export const LUNGE_STEP_M = 1.0;

/**
 * Mount transform for `ASSETS.sword` inside the `handR` attachment group.
 * `sword.glb` has its blade tip at `y = 0`, grip at `y = 0.70 m` (`SWORD_BLADE_AHEAD`),
 * and pommel at `y = 0.85 m`. Rotating `-90°` around Z aligns the blade with `handR`'s
 * local `-x` axis, and shifting `-0.70 m` along `x` places the grip at `(0, 0, 0)` and
 * the blade tip at `(-0.70, 0, 0)`.
 */
export const SWORD_MOUNT = {
   position: [-SWORD_BLADE_AHEAD, 0, 0] as [number, number, number],
   rotation: [0, 0, -Math.PI / 2] as [number, number, number],
} as const;

/**
 * Mount transform for `ASSETS.shield` inside the `handL` attachment group.
 * Centers the heater shield (`0.55 m` tall) on the left forearm with the boss facing outward.
 */
export const SHIELD_MOUNT = {
   position: [0.04, -SHIELD_HEIGHT * 0.45, 0.06] as [number, number, number],
   rotation: [0, 0, 0] as [number, number, number],
} as const;

const scratchGuard = createPose();
const scratchStrike = createPose();

/**
 * Ready combat stance: breathing idle with shield raised on the left forearm
 * and sword poised at the right side.
 */
export function guardPose(t: number, out: HumanoidPose = createPose()): HumanoidPose {
   idlePose(t, out);
   turnBone(out, BONE.spine, 0.04, -0.06, 0);
   turnBone(out, BONE.chest, 0.02, -0.04, 0);
   // Left arm (side = 1): upper arm slightly out/down/forward, forearm forward-inward holding shield
   aimArm(out, 1, 0.35, -0.45, 0.35, -0.20, 0.08, 0.90, 0);
   // Right arm (side = -1): upper arm at side, forearm angled forward holding sword ready
   aimArm(out, -1, 0.30, -0.55, 0.25, -0.10, 0.12, 0.92, 0);
   return out;
}

/**
 * Four distinct directional sword slashes (`up`, `down`, `left`, `right`) over `u in [0, 1]`.
 * Peak contact is at `u = 0.5`, where the right arm and torso extend forward so the sword tip
 * reaches `~1.28 m` in front of the knight's root (`~2.28 m` with the `1.00 m` far lunge step),
 * while staying at or below shoulder height (`y <= 1.80 m`) and clear of the head.
 */
export function slashPose(
   direction: StrikeDir,
   u: number,
   isFar: boolean,
   out: HumanoidPose = createPose(),
): HumanoidPose {
   const clampedU = Math.max(0, Math.min(1, u));
   const envelope = Math.sin(Math.PI * clampedU); // 0 -> 1 at u = 0.5 -> 0
   const sweep = Math.cos(Math.PI * clampedU); // +1 at u = 0 -> 0 at u = 0.5 -> -1 at u = 1

   if (isFar) {
      walkPose(clampedU * Math.PI * 2, envelope, out);
   } else {
      idlePose(0, out);
   }
   guardPose(0, scratchGuard);
   idlePose(0, scratchStrike);

   // Torso leans forward and twists left (+y twist turns right shoulder forward toward +z).
   const spinePitch = direction === "down" ? 0.20 : direction === "up" ? 0.12 : 0.16;
   const torsoTwist = 0.30 + (direction === "left" ? -0.14 * sweep : direction === "right" ? 0.14 * sweep : 0.06 * sweep);
   turnBone(scratchStrike, BONE.spine, spinePitch, torsoTwist * 0.55, 0);
   turnBone(scratchStrike, BONE.chest, spinePitch * 0.5, torsoTwist * 0.45, 0);
   turnBone(scratchStrike, BONE.neck, -spinePitch * 0.4, -torsoTwist * 0.5, 0);

   // Counter-balance left shield arm outward during the right-hand slash
   aimArm(scratchStrike, 1, 0.45, -0.35, 0.25, 0.10, 0.05, 0.88, 0);

   // Right arm (side = -1): in the twisted chest frame, ux = +0.24, fx = +0.28 cancels the lateral
   // chest twist so at u = 0.5 (sweep = 0) the sword tip lands at x ~ 0, z ~ 1.28 m (and 2.28 m on far lunge).
   let ux = 0.24;
   let uy = -0.02;
   const uz = 0.96;
   let fx = 0.28;
   let fy = 0.0;
   const fz = 0.96;

   if (direction === "up") {
      // High shoulder-level slash: sweeps upper-right to upper-left, peak at y ~ 1.38 m
      ux = 0.24 + 0.35 * sweep;
      uy = 0.12 + 0.05 * sweep;
      fx = 0.28 + 0.45 * sweep;
      fy = 0.18 + 0.08 * sweep;
   } else if (direction === "down") {
      // Low horizontal cleave: sweeps lower-left to lower-right, peak at y ~ 0.90 m
      ux = 0.24 - 0.35 * sweep;
      uy = -0.22 - 0.05 * sweep;
      fx = 0.28 - 0.42 * sweep;
      fy = -0.24 - 0.08 * sweep;
   } else if (direction === "left") {
      // Cross-body slash from right (-x, fx > 0) through centre (u = 0.5) to left (+x, fx < 0)
      ux = 0.24 + 0.48 * sweep;
      uy = -0.02 + 0.04 * sweep;
      fx = 0.28 + 0.62 * sweep;
      fy = 0.02 + 0.04 * sweep;
   } else {
      // Outward backhand slash from left (+x, fx < 0) through centre (u = 0.5) to right (-x, fx > 0)
      ux = 0.24 - 0.48 * sweep;
      uy = -0.04 - 0.04 * sweep;
      fx = 0.28 - 0.62 * sweep;
      fy = -0.02 - 0.04 * sweep;
   }

   aimArm(scratchStrike, -1, ux, uy, uz, fx, fy, fz, 0);
   blendPoses(scratchGuard, scratchStrike, envelope, out, POSE_MASK.upper);
   return out;
}

/**
 * Spin attack pose (`0.40 s`, `u in [0, 1]`): the knight holds a wide horizontal cleave at
 * chest height while the root yaw spins `0 -> 2*pi`.
 */
export function spinPose(u: number, out: HumanoidPose = createPose()): HumanoidPose {
   const clampedU = Math.max(0, Math.min(1, u));
   const envelope = Math.sin(Math.PI * clampedU);
   idlePose(0, out);
   guardPose(0, scratchGuard);
   idlePose(0, scratchStrike);
   turnBone(scratchStrike, BONE.spine, 0.08, 0.25, 0);
   turnBone(scratchStrike, BONE.chest, 0.04, 0.20, 0);
   aimArm(scratchStrike, 1, 0.65, -0.20, 0.35, 0.45, 0.0, 0.80, 0);
   aimArm(scratchStrike, -1, 0.25, -0.08, 0.92, 0.15, -0.02, 0.98, 0);
   blendPoses(scratchGuard, scratchStrike, envelope, out, POSE_MASK.upper);
   return out;
}

/**
 * Celebration pose on run finish (`cheerPose`).
 */
export function victoryPose(t: number, out: HumanoidPose = createPose()): HumanoidPose {
   return cheerPose(t, out);
}

/**
 * Root yaw offset (`0 -> 2*pi` radians) during the `0.40 s` spin attack.
 */
export function spinYawOffset(u: number): number {
   const clampedU = Math.max(0, Math.min(1, u));
   const smooth = clampedU * clampedU * (3 - 2 * clampedU);
   return smooth * Math.PI * 2;
}

/**
 * World-space root offset (`x, y, z` in metres) for the knight:
 * - During a far lunge (`isFar === true`), translates `1.00 m` out and back along `postYaw`
 *   via `sin(pi * u)`.
 * - Always applies `bodyLift(pose, KNIGHT_LANDMARKS) * KNIGHT_SCALE` on `y` so the knight's
 *   soles stay planted on `y = 0` when `<HumanoidModel applyLift={false}>` is used.
 */
export function lungeStepOffset(
   u: number,
   isFar: boolean,
   postYaw: number,
   pose: HumanoidPose,
): { x: number; y: number; z: number } {
   const step = isFar ? Math.sin(Math.PI * Math.max(0, Math.min(1, u))) * LUNGE_STEP_M : 0;
   const liftM = bodyLift(pose, KNIGHT_LANDMARKS) * KNIGHT_SCALE;
   return {
      x: Math.sin(postYaw) * step,
      y: liftM,
      z: Math.cos(postYaw) * step,
   };
}
