import {
   aimArm,
   BONE,
   blendPoses,
   carryPose,
   cheerPose,
   createPose,
   gaitPhaseStep,
   humanoidJoints,
   type HumanoidPose,
   idlePose,
   levelFoot,
   POSE_MASK,
   restPose,
   setBoneEuler,
   turnBone,
   walkPose,
   wrapPhase,
} from "@/arcade3d/core/rig";
import { mulQuat, rotateVec } from "@/arcade3d/core/rig/quat";
import { ALIEN_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ALIEN_SCALE } from "./assets";

export {
   ALIEN_LANDMARKS,
   aimArm,
   BONE,
   blendPoses,
   carryPose,
   cheerPose,
   createPose,
   idlePose,
   POSE_MASK,
   restPose,
   turnBone,
   walkPose,
   wrapPhase,
};

/** Max stride cadence (strides/s) for the 1.30 m alien farmer. */
export const ALIEN_MAX_CADENCE = 4;

/** Left-arm mask so carryPose(0) only drives the left arm (supporting the basket) while leaving the right arm free. */
export const LEFT_ARM_MASK = [
   0, // hips
   0, // spine
   0, // chest
   0, // neck
   0, // head
   1, // clavicleL
   1, // upperArmL
   1, // lowerArmL
   0, // clavicleR
   0, // upperArmR
   0, // lowerArmR
   0, // upperLegL
   0, // lowerLegL
   0, // footL
   0, // upperLegR
   0, // lowerLegR
   0, // footR
] as const;

/** Right-arm mask for blending the right arm between carry/idle and reach. */
export const RIGHT_ARM_MASK = [
   0, // hips
   0, // spine
   0, // chest
   0, // neck
   0, // head
   0, // clavicleL
   0, // upperArmL
   0, // lowerArmL
   1, // clavicleR
   1, // upperArmR
   1, // lowerArmR
   0, // upperLegL
   0, // lowerLegL
   0, // footL
   0, // upperLegR
   0, // lowerLegR
   0, // footR
] as const;

/**
 * Woven harvest basket position in farmer-local metres (held by the left hand in front of the left hip/waist).
 */
export const BASKET_LOCAL_POS = { x: 0.16, y: 0.55, z: 0.22 } as const;
export const BASKET_LEGACY_OFFSET = { x: -0.22, y: 0.55, z: 0.14 } as const;

const JOINTS = humanoidJoints(ALIEN_LANDMARKS);
const UPPER_ARM_LEN = (ALIEN_LANDMARKS.elbowX - ALIEN_LANDMARKS.shoulderX) * ALIEN_SCALE;
const FORE_HAND_LEN = (0.84 - ALIEN_LANDMARKS.elbowX) * ALIEN_SCALE;
const SCRATCH_CARRY = createPose();
const SCRATCH_REACH = createPose();
const Q_CHAIN = new Float64Array(12);
const V_TMP = new Float64Array(3);

/** Advances gait phase (rad) for the alien farmer moving at `speed` (m/s) over `dt` (s). */
export function alienPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(
      amount,
      ALIEN_LANDMARKS,
      ALIEN_SCALE,
      speed,
      dt,
      ALIEN_MAX_CADENCE,
   );
}

/** Walk pose for the alien farmer with planted soles (`ground = 1, lift = 0`) and rigid head/antennae. */
export function alienWalkPose(phase: number, amount: number, out: HumanoidPose): HumanoidPose {
   walkPose(phase, amount, out);
   out.ground = 1;
   out.lift = 0;
   setBoneEuler(out.q, BONE.head, 0, 0, 0);
   return out;
}

/** Layers carryPose(0) onto the left arm so the left hand supports the woven harvest basket. */
export function applyLeftBasketCarry(out: HumanoidPose): HumanoidPose {
   carryPose(0, SCRATCH_CARRY);
   aimArm(SCRATCH_CARRY, 1, 0.12, -0.82, 0.48, -0.22, -0.18, 0.96);
   blendPoses(out, SCRATCH_CARRY, 1, out, LEFT_ARM_MASK);
   return out;
}

/**
 * Computes the harvest channel envelope k in [0, 1] for elapsed channel time `elapsed` in [0, 0.30]:
 * - 0.00..0.10 s: smooth reach (0 -> 1)
 * - 0.10..0.20 s: hold/pluck at the leaf rim (1)
 * - 0.20..0.30 s: smooth retract (1 -> 0)
 */
export function harvestChannelEnvelope(elapsed: number, duration = 0.3): number {
   if (elapsed <= 0 || elapsed >= duration) return 0;
   const third = duration / 3;
   if (elapsed < third) {
      const u = elapsed / third;
      return u * u * (3 - 2 * u);
   }
   if (elapsed <= 2 * third) {
      return 1;
   }
   const u = Math.max(0, Math.min(1, (duration - elapsed) / third));
   return u * u * (3 - 2 * u);
}

/**
 * Target leaf/bulb rim point in farmer-local metres for a plot at `distanceToPlotCenter` (m)
 * directly ahead (+z) and crop height `cropHeight` (0.5..1.0 m).
 */
export function cropNearRimLocal(distanceToPlotCenter: number, cropHeight = 1.0): { x: number; y: number; z: number } {
   const d = Math.max(0.35, Math.min(0.9, distanceToPlotCenter));
   const h = Math.max(0.5, Math.min(1.0, cropHeight));
   const radialScale = Math.max(0.75, h);
   const rimRadius = 0.18 * radialScale;
   return {
      x: -0.02,
      y: 0.08 + 0.54 * h,
      z: Math.max(0.24, d - rimRadius),
   };
}

/**
 * Builds the alien farmer's harvest pose during the 0.30 s planted channel.
 * - Starts from a forearms-forward carry (`dropR = 0`) so the right arm never swings through the T-pose.
 * - Pitches `hips`, `spine`, and `chest` forward with `turnBone` (while counter-rotating both thighs by
 *   `-hipLean` and levelling both feet so the soles remain planted within <= 0.01 m of y = 0) and twists
 *   `spine` and `chest` (+y rotation advances the -x right shoulder forward in +z).
 * - Solves 2-bone IK in the chest's exact rotated frame toward the crop's near leaf/bulb rim so the right
 *   hand reaches within <= 0.05 m across all distances <= 0.90 m and heights 0.5..1.0 m.
 * - Keeps `BONE.head` unrotated relative to `BONE.neck` so the large eyes and antennae stay 100% rigid.
 */
export function harvestPose(
   elapsed: number,
   distanceToPlotCenter: number,
   cropHeight = 1.0,
   out: HumanoidPose = createPose(),
): HumanoidPose {
   idlePose(0, out);
   setBoneEuler(out.q, BONE.head, 0, 0, 0);
   applyLeftBasketCarry(out);

   // Forearms-forward starting posture for the right arm (dropR = 0, never T-pose)
   carryPose(0, SCRATCH_CARRY);
   aimArm(SCRATCH_CARRY, -1, 0.12, -0.75, 0.62, -0.18, 0.08, 0.98);
   blendPoses(out, SCRATCH_CARRY, 1, out, RIGHT_ARM_MASK);

   const k = harvestChannelEnvelope(elapsed);
   if (k <= 0) return out;

   const rim = cropNearRimLocal(distanceToPlotCenter, cropHeight);
   // Advance the right shoulder toward `rim` using forward waist lean (+x) and right-shoulder-forward twist (+y)
   const needZ = Math.max(0, rim.z - 0.24);
   const needDown = Math.max(0, 0.68 - rim.y);
   const totalLean = k * Math.min(1.65, 0.25 + needZ * 2.15 + needDown * 0.85);
   const totalTwist = k * Math.min(0.95, 0.20 + needZ * 1.35);

   const hipLean = totalLean * 0.45;
   const spineLean = totalLean * 0.30;
   const chestLean = totalLean * 0.25;
   const spineTwist = totalTwist * 0.55;
   const chestTwist = totalTwist * 0.45;

   // Pitch hips forward; counter-rotate thighs by -hipLean so legs stay vertical and soles stay flat on y = 0
   setBoneEuler(out.q, BONE.hips, hipLean, 0, 0);
   setBoneEuler(out.q, BONE.upperLegL, -hipLean, 0, 0);
   setBoneEuler(out.q, BONE.upperLegR, -hipLean, 0, 0);
   setBoneEuler(out.q, BONE.lowerLegL, 0, 0, 0);
   setBoneEuler(out.q, BONE.lowerLegR, 0, 0, 0);
   levelFoot(out, 1);
   levelFoot(out, -1);

   // Lean spine and chest toward the crop using turnBone
   setBoneEuler(out.q, BONE.spine, 0, 0, 0);
   setBoneEuler(out.q, BONE.chest, 0, 0, 0);
   turnBone(out, BONE.spine, spineLean, spineTwist, 0);
   turnBone(out, BONE.chest, chestLean, chestTwist, 0);

   // Keep head unrotated relative to neck so the head, eyes, and antennae are 100% rigid
   setBoneEuler(out.q, BONE.neck, -0.35 * totalLean, -0.35 * totalTwist, 0);
   setBoneEuler(out.q, BONE.head, 0, 0, 0);

   // Compute the exact world position of the right shoulder and exact world quaternion of `chest`
   const pHips = BONE.hips * 3;
   const pSpine = BONE.spine * 3;
   const pChest = BONE.chest * 3;
   const pShoulderR = BONE.upperArmR * 3;

   let sx = JOINTS[pHips];
   let sy = JOINTS[pHips + 1];
   let sz = JOINTS[pHips + 2];

   // hips -> spine
   rotateVec(
      out.q,
      BONE.hips * 4,
      JOINTS[pSpine] - JOINTS[pHips],
      JOINTS[pSpine + 1] - JOINTS[pHips + 1],
      JOINTS[pSpine + 2] - JOINTS[pHips + 2],
      V_TMP,
      0,
   );
   sx += V_TMP[0];
   sy += V_TMP[1];
   sz += V_TMP[2];

   // spine -> chest
   mulQuat(out.q, BONE.hips * 4, out.q, BONE.spine * 4, Q_CHAIN, 0);
   rotateVec(
      Q_CHAIN,
      0,
      JOINTS[pChest] - JOINTS[pSpine],
      JOINTS[pChest + 1] - JOINTS[pSpine + 1],
      JOINTS[pChest + 2] - JOINTS[pSpine + 2],
      V_TMP,
      0,
   );
   sx += V_TMP[0];
   sy += V_TMP[1];
   sz += V_TMP[2];

   // chest -> right shoulder
   mulQuat(Q_CHAIN, 0, out.q, BONE.chest * 4, Q_CHAIN, 4);
   rotateVec(
      Q_CHAIN,
      4,
      JOINTS[pShoulderR] - JOINTS[pChest],
      JOINTS[pShoulderR + 1] - JOINTS[pChest + 1],
      JOINTS[pShoulderR + 2] - JOINTS[pChest + 2],
      V_TMP,
      0,
   );
   sx = (sx + V_TMP[0]) * ALIEN_SCALE;
   sy = (sy + V_TMP[1]) * ALIEN_SCALE;
   sz = (sz + V_TMP[2]) * ALIEN_SCALE;

   // Vector from right shoulder to target rim in world metres, interpolated from forearms-forward carry
   const carryTargetX = sx - 0.02;
   const carryTargetY = sy - 0.14;
   const carryTargetZ = sz + 0.22;

   const wx = carryTargetX + (rim.x - carryTargetX) * k - sx;
   const wy = carryTargetY + (rim.y - carryTargetY) * k - sy;
   const wz = carryTargetZ + (rim.z - carryTargetZ) * k - sz;
   const dist = Math.hypot(wx, wy, wz) || 1e-6;

   // 2-bone IK in world space (upper arm UPPER_ARM_LEN, forearm+hand FORE_HAND_LEN, elbow bends downward/outward)
   const l1 = UPPER_ARM_LEN;
   const l2 = FORE_HAND_LEN;
   let uWorldX = wx / dist;
   let uWorldY = wy / dist;
   let uWorldZ = wz / dist;
   let fWorldX = uWorldX;
   let fWorldY = uWorldY;
   let fWorldZ = uWorldZ;

   if (dist < l1 + l2 - 1e-4 && dist > Math.abs(l1 - l2) + 1e-4) {
      const cosAlpha = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
      const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
      // Bend direction perpendicular to w, biased downward/right (-x, -y) so the elbow stays natural and low
      let bx = -0.5;
      let by = -0.85;
      let bz = 0;
      const dot = bx * uWorldX + by * uWorldY + bz * uWorldZ;
      bx -= dot * uWorldX;
      by -= dot * uWorldY;
      bz -= dot * uWorldZ;
      const bLen = Math.hypot(bx, by, bz) || 1;
      bx /= bLen;
      by /= bLen;
      bz /= bLen;

      const uxW = uWorldX * cosAlpha + bx * sinAlpha;
      const uyW = uWorldY * cosAlpha + by * sinAlpha;
      const uzW = uWorldZ * cosAlpha + bz * sinAlpha;
      const elbowX = uxW * l1;
      const elbowY = uyW * l1;
      const elbowZ = uzW * l1;
      fWorldX = (wx - elbowX) / l2;
      fWorldY = (wy - elbowY) / l2;
      fWorldZ = (wz - elbowZ) / l2;
      uWorldX = uxW;
      uWorldY = uyW;
      uWorldZ = uzW;
   }

   // Transform both uWorld and fWorld into chest's local frame using inverse of Q_CHAIN[4..7]
   Q_CHAIN[8] = -Q_CHAIN[4];
   Q_CHAIN[9] = -Q_CHAIN[5];
   Q_CHAIN[10] = -Q_CHAIN[6];
   Q_CHAIN[11] = Q_CHAIN[7];
   rotateVec(Q_CHAIN, 8, uWorldX, uWorldY, uWorldZ, V_TMP, 0);
   const ucx = -V_TMP[0];
   const ucy = V_TMP[1];
   const ucz = V_TMP[2];

   rotateVec(Q_CHAIN, 8, fWorldX, fWorldY, fWorldZ, V_TMP, 0);
   const fcx = -V_TMP[0];
   const fcy = V_TMP[1];
   const fcz = V_TMP[2];

   aimArm(SCRATCH_REACH, -1, ucx, ucy, ucz, fcx, fcy, fcz);
   blendPoses(out, SCRATCH_REACH, 1, out, RIGHT_ARM_MASK);
   return out;
}

/** Brief shrug pose when harvest attempt is on cooldown. */
export function applyCooldownShrug(out: HumanoidPose, amount: number): HumanoidPose {
   const k = Math.max(0, Math.min(1, amount));
   if (k <= 0) return out;
   turnBone(out, BONE.chest, -0.06 * k, 0, 0);
   aimArm(SCRATCH_REACH, -1, 0.45, -0.35, 0.45, 0.15, 0.35, 0.85);
   blendPoses(out, SCRATCH_REACH, k, out, RIGHT_ARM_MASK);
   return out;
}
