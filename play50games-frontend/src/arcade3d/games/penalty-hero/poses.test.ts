// The striker's and the keeper's poses: shapes and ground contact, as pure rotations and on the
// real GLBs' landmarks (no WebGL).
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { bodyLift, soleHeight } from "@/arcade3d/core/rig/gait";
import { BONE, BONE_COUNT } from "@/arcade3d/core/rig/humanoid";
import { createPose, resolvePose, type HumanoidPose } from "@/arcade3d/core/rig/poses";
import { KEEPER_LANDMARKS, STRIKER_LANDMARKS } from "./assets";
import { KICK_SIDE, keeperDivePose, keeperReadyPose, kickPose } from "./poses";

const quat = (q: Float32Array, bone: number) => new Quaternion(q[bone * 4], q[bone * 4 + 1], q[bone * 4 + 2], q[bone * 4 + 3]);
const resolved = (pose: HumanoidPose, spread: number) => resolvePose(pose, spread, new Float32Array(BONE_COUNT * 4));
/** Where the rest direction `dir` of a bone chain points after the resolved rotations (parent frames). */
function chainDir(r: Float32Array, bones: number[], dir: Vector3): Vector3 {
   const v = dir.clone();
   for (let i = bones.length - 1; i >= 0; i--) v.applyQuaternion(quat(r, bones[i]));
   return v;
}
const DOWN = new Vector3(0, -1, 0);
const X = new Vector3(1, 0, 0);
const NX = new Vector3(-1, 0, 0);
const KICK_THIGH = [BONE.hips, KICK_SIDE > 0 ? BONE.upperLegL : BONE.upperLegR];
const PLANT_THIGH = [BONE.hips, KICK_SIDE > 0 ? BONE.upperLegR : BONE.upperLegL];

describe("kickPose", () => {
   it("swings the kicking leg from behind (knee folded) to out in front (knee nearly straight); the planted leg stays under the body", () => {
      const back = resolved(kickPose(0, createPose()), STRIKER_LANDMARKS.armSpread);
      const front = resolved(kickPose(1, createPose()), STRIKER_LANDMARKS.armSpread);
      expect(chainDir(back, KICK_THIGH, DOWN).z).toBeLessThan(-0.4);
      expect(chainDir(front, KICK_THIGH, DOWN).z).toBeGreaterThan(0.75);
      // the shin folds back from the thigh at the backswing, not at the follow-through
      const shin = KICK_SIDE > 0 ? BONE.lowerLegL : BONE.lowerLegR;
      const foldBack = chainDir(back, [...KICK_THIGH, shin], DOWN).z - chainDir(back, KICK_THIGH, DOWN).z;
      const foldFront = chainDir(front, [...KICK_THIGH, shin], DOWN).z - chainDir(front, KICK_THIGH, DOWN).z;
      expect(foldBack).toBeLessThan(-0.4);
      expect(Math.abs(foldFront)).toBeLessThan(0.2);
      expect(Math.abs(chainDir(front, PLANT_THIGH, DOWN).z)).toBeLessThan(0.2);
      expect(kickPose(0.5, createPose()).ground).toBe(1);
   });

   it("keeps the planted sole on the floor and nothing below it through the swing, on the striker's landmarks", () => {
      const p = createPose();
      for (let k = 0; k <= 20; k++) {
         kickPose(k / 20, p);
         const planted = soleHeight(p, STRIKER_LANDMARKS, KICK_SIDE > 0 ? -1 : 1);
         const kicking = soleHeight(p, STRIKER_LANDMARKS, KICK_SIDE > 0 ? 1 : -1);
         expect(planted, `u ${k / 20}`).toBeLessThan(0.01);
         expect(planted, `u ${k / 20}`).toBeGreaterThan(-0.005);
         expect(kicking, `u ${k / 20}`).toBeGreaterThan(-0.005);
      }
   });

   it("the opposite arm swings forward for balance, the kicking side's arm back", () => {
      const r = resolved(kickPose(1, createPose()), STRIKER_LANDMARKS.armSpread);
      const opposite = KICK_SIDE > 0 ? [BONE.chest, BONE.clavicleR, BONE.upperArmR] : [BONE.chest, BONE.clavicleL, BONE.upperArmL];
      const same = KICK_SIDE > 0 ? [BONE.chest, BONE.clavicleL, BONE.upperArmL] : [BONE.chest, BONE.clavicleR, BONE.upperArmR];
      expect(chainDir(r, opposite, KICK_SIDE > 0 ? NX : X).z).toBeGreaterThan(0.5);
      expect(chainDir(r, same, KICK_SIDE > 0 ? X : NX).z).toBeLessThan(-0.2);
   });
});

describe("keeperReadyPose", () => {
   it("crouches on flat soles (both on the floor once lifted), gloves forward and below the shoulders, leaning forward", () => {
      const p = keeperReadyPose(1.3, createPose());
      expect(p.ground).toBe(1);
      // the crouch lowers the body: the lift is negative, both soles on the floor
      expect(bodyLift(p, KEEPER_LANDMARKS)).toBeLessThan(-0.05);
      for (const side of [1, -1] as const) {
         expect(Math.abs(soleHeight(p, KEEPER_LANDMARKS, side))).toBeLessThan(0.01);
      }
      const r = resolved(p, KEEPER_LANDMARKS.armSpread);
      for (const [chain, out] of [
         [[BONE.chest, BONE.clavicleL, BONE.upperArmL, BONE.lowerArmL], X],
         [[BONE.chest, BONE.clavicleR, BONE.upperArmR, BONE.lowerArmR], NX],
      ] as const) {
         const fore = chainDir(r, [...chain], out);
         expect(fore.z).toBeGreaterThan(0.6);
         expect(chainDir(r, chain.slice(0, 3), out).y).toBeLessThan(-0.3);
      }
      expect(chainDir(r, [BONE.hips, BONE.spine], new Vector3(0, 1, 0)).z).toBeGreaterThan(0.2);
   });

   it("breathes: it changes with t and stays unit length", () => {
      const a = keeperReadyPose(0, createPose());
      const b = keeperReadyPose(0.8, createPose());
      expect(Math.abs(quat(a.q, BONE.chest).dot(quat(b.q, BONE.chest)))).toBeLessThan(0.99999);
      for (let bone = 0; bone < BONE_COUNT; bone++) expect(quat(b.q, bone).length()).toBeCloseTo(1, 6);
   });
});

describe("keeperDivePose", () => {
   it("to a side: in the air, the near arm reaches out and up on that side, the far arm up, the spine bent towards the ball", () => {
      for (const side of [1, -1] as const) {
         for (const row of [0, 1] as const) {
            const p = keeperDivePose(side, row, createPose());
            expect(p.ground).toBe(0);
            const r = resolved(p, KEEPER_LANDMARKS.armSpread);
            const near = side > 0 ? [BONE.chest, BONE.clavicleL, BONE.upperArmL] : [BONE.chest, BONE.clavicleR, BONE.upperArmR];
            const far = side > 0 ? [BONE.chest, BONE.clavicleR, BONE.upperArmR] : [BONE.chest, BONE.clavicleL, BONE.upperArmL];
            const nearDir = chainDir(r, near, side > 0 ? X : NX);
            expect(nearDir.x * side).toBeGreaterThan(0.3);
            if (row === 1) expect(nearDir.y).toBeGreaterThan(0.5);
            else expect(Math.abs(nearDir.y)).toBeLessThan(0.6);
            expect(chainDir(r, far, side > 0 ? NX : X).y).toBeGreaterThan(0.7);
            // the spine tips towards the dive side
            expect(chainDir(r, [BONE.hips, BONE.spine], new Vector3(0, 1, 0)).x * side).toBeGreaterThan(0.1);
            for (let bone = 0; bone < BONE_COUNT; bone++) expect(quat(p.q, bone).length()).toBeCloseTo(1, 6);
         }
      }
   });

   it("in the middle: both arms up for a high ball, forward in a crouch for a low one", () => {
      const high = resolved(keeperDivePose(0, 1, createPose()), KEEPER_LANDMARKS.armSpread);
      const low = resolved(keeperDivePose(0, 0, createPose()), KEEPER_LANDMARKS.armSpread);
      for (const [chain, out] of [
         [[BONE.chest, BONE.clavicleL, BONE.upperArmL], X],
         [[BONE.chest, BONE.clavicleR, BONE.upperArmR], NX],
      ] as const) {
         expect(chainDir(high, [...chain], out).y).toBeGreaterThan(0.5);
         expect(chainDir(low, [...chain], out).z).toBeGreaterThan(0.3);
      }
      // the low crouch folds both knees
      expect(chainDir(low, [BONE.hips, BONE.upperLegL, BONE.lowerLegL], DOWN).z).toBeLessThan(-0.4);
      expect(keeperDivePose(0, 0, createPose()).ground).toBe(0);
   });
});
