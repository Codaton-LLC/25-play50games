// The striker's and the keeper's poses: shapes and ground contact, as pure rotations and on the
// real GLBs' landmarks (no WebGL).
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { bodyLift, footPoint, soleHeight } from "@/arcade3d/core/rig/gait";
import { BONE, BONE_COUNT } from "@/arcade3d/core/rig/humanoid";
import { createPose, resolvePose, type HumanoidPose } from "@/arcade3d/core/rig/poses";
import { ASSETS, KEEPER_LANDMARKS, STRIKER_LANDMARKS } from "./assets";
import { BACKSWING_FROM, KEEPER_SWAY, SPOT_Z, keeperDip, keeperSway, strikerPlacement } from "./layout";
import { KICK_SIDE, keeperDivePose, keeperReadyPose, kickPose } from "./poses";
import { BALL_SPOT } from "./rules";

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

   it("kicks with the leg on the ball's side: at the backswing and at contact the ball is in front of the striker, nearer KICK_SIDE's leg than the planted one and within a foot of it", () => {
      const L = STRIKER_LANDMARKS;
      const scale = ASSETS.striker.scale;
      const foot = L.toeZ - L.heelZ;
      const place = { x: 0, z: 0, yaw: 0 };
      // the run-up progress (smoothstep, Scene.tsx runupProgress) from the backswing's start to contact (1)
      const smooth = (u: number) => u * u * (3 - 2 * u);
      for (const e of [smooth(BACKSWING_FROM), smooth(0.85), smooth(0.95), 1]) {
         strikerPlacement(e, place);
         // the ball from the group, into the striker's own frame (the group's turn, then the asset's)
         const dx = BALL_SPOT.x - place.x;
         const dz = SPOT_Z - place.z;
         const turn = -(ASSETS.striker.rotationY + place.yaw);
         const localX = (dx * Math.cos(turn) + dz * Math.sin(turn)) / scale;
         const localZ = (-dx * Math.sin(turn) + dz * Math.cos(turn)) / scale;
         expect(Math.sign(localX), `e ${e.toFixed(3)}`).toBe(KICK_SIDE);
         expect(localZ, `e ${e.toFixed(3)}`).toBeGreaterThan(0);
         const kickLeg = Math.abs(localX - KICK_SIDE * L.hipX);
         const plantLeg = Math.abs(localX + KICK_SIDE * L.hipX);
         expect(kickLeg).toBeLessThan(plantLeg);
         expect(kickLeg).toBeLessThan(foot);
         expect(Math.abs(localX)).toBeLessThan(L.legOuterX + foot);
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

   it("without a shift or a dip: the stance as designed (thighs 0.4 forward and 0.12 out, knees 0.75)", () => {
      const p = keeperReadyPose(1.3, createPose());
      const r = resolved(p, KEEPER_LANDMARKS.armSpread);
      for (const side of [1, -1] as const) {
         const thigh = [BONE.hips, side > 0 ? BONE.upperLegL : BONE.upperLegR];
         const knee = chainDir(r, [...thigh, side > 0 ? BONE.lowerLegL : BONE.lowerLegR], DOWN);
         const dir = chainDir(r, thigh, DOWN);
         // down (0, -1, 0) turned out by 0.12 about z, then forward by 0.4 about x
         expect(dir.x).toBeCloseTo(side * Math.sin(0.12), 6);
         expect(dir.z).toBeCloseTo(Math.cos(0.12) * Math.sin(0.4), 6);
         expect(Math.acos(Math.max(-1, Math.min(1, dir.dot(knee))))).toBeCloseTo(0.75, 6);
      }
   });

   it("its weight shift: the group's sway moves the hips over planted feet (both soles stay where they stood, on the grass) and the knees bounce; the legs move, the hips stay between the feet", () => {
      const l = KEEPER_LANDMARKS;
      const scale = ASSETS.keeper.scale;
      const p = createPose();
      const foot = new Float64Array(4);
      const start: number[][] = [];
      let thighTurn = 0;
      let lowest = Infinity;
      let highest = -Infinity;
      keeperReadyPose(0, p);
      const thigh0 = quat(p.q, BONE.upperLegL);
      for (let k = 0; k <= 60; k++) {
         const t = k * 0.05;
         const sway = keeperSway(t, true);
         keeperReadyPose(t, p, sway / scale, keeperDip(t));
         const lift = bodyLift(p, l);
         lowest = Math.min(lowest, lift);
         highest = Math.max(highest, lift);
         for (const [i, side] of [
            [0, 1],
            [1, -1],
         ] as const) {
            footPoint(p, l, side, foot);
            // the drawn foot (m): the group's sway plus the scaled ankle, its sole on the grass
            const world = [sway + scale * foot[0], scale * foot[2]];
            start[i] ??= world;
            expect(Math.abs(world[0] - start[i][0]), `t ${t} side ${side}: x`).toBeLessThan(0.002);
            expect(Math.abs(world[1] - start[i][1]), `t ${t} side ${side}: z`).toBeLessThan(0.002);
            expect(Math.abs(soleHeight(p, l, side)), `t ${t} side ${side}: sole`).toBeLessThan(0.002);
            // the hips stay between the feet
            expect(side * (scale * foot[0])).toBeGreaterThan(0);
         }
         thighTurn = Math.max(thighTurn, 2 * Math.acos(Math.min(1, Math.abs(thigh0.dot(quat(p.q, BONE.upperLegL))))));
      }
      // the sway really moves the hips (the full KEEPER_SWAY) and the legs follow it, the knees bounce the body
      expect(KEEPER_SWAY.glb).toBeGreaterThan(0.1);
      expect(thighTurn).toBeGreaterThan(0.15);
      expect(highest - lowest).toBeGreaterThan(0.03);
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
