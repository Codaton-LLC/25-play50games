// Procedural poses: shapes, symmetry, blending and the arm drop, checked as pure rotations.
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { BONE, BONE_COUNT } from "./humanoid";
import {
   POSE_MASK,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   copyPose,
   createPose,
   idlePose,
   jumpPose,
   mirrorPose,
   reachPose,
   resolvePose,
   restPose,
   walkPose,
   wrapPhase,
   type HumanoidPose,
} from "./poses";

const SPREAD = 0.25;
const PHASES = [0, 0.4, Math.PI / 2, 2, Math.PI, 4.1, (3 * Math.PI) / 2, 5.9];

const quat = (q: Float32Array, bone: number) => new Quaternion(q[bone * 4], q[bone * 4 + 1], q[bone * 4 + 2], q[bone * 4 + 3]);

/** Same rotation (q and -q are the same), per bone, and the same drops and lift. */
function expectSamePose(a: HumanoidPose, b: HumanoidPose, digits = 6): void {
   for (let bone = 0; bone < BONE_COUNT; bone++) {
      const dot = Math.abs(quat(a.q, bone).dot(quat(b.q, bone)));
      expect(dot, `bone ${bone}`).toBeCloseTo(1, digits);
   }
   expect(a.dropL).toBeCloseTo(b.dropL, digits);
   expect(a.dropR).toBeCloseTo(b.dropR, digits);
   expect(a.lift).toBeCloseTo(b.lift, digits);
}

/** Where the rest direction `dir` of a bone points after the chain of resolved rotations (parent frames). */
function chainDir(resolved: Float32Array, bones: number[], dir: Vector3): Vector3 {
   const v = dir.clone();
   // innermost (child) first, then each parent: v_world = q_parent ... q_child v
   for (let i = bones.length - 1; i >= 0; i--) v.applyQuaternion(quat(resolved, bones[i]));
   return v;
}

const resolved = (pose: HumanoidPose, spread = SPREAD) => resolvePose(pose, spread, new Float32Array(BONE_COUNT * 4));
const X = new Vector3(1, 0, 0);
const NX = new Vector3(-1, 0, 0);
const DOWN = new Vector3(0, -1, 0);

describe("basics", () => {
   it("createPose is the rest pose: every bone unrotated, arms out", () => {
      const p = createPose();
      for (let b = 0; b < BONE_COUNT; b++) expect(Array.from(p.q.subarray(b * 4, b * 4 + 4))).toEqual([0, 0, 0, 1]);
      expect([p.dropL, p.dropR, p.lift]).toEqual([0, 0, 0]);
   });

   it("every builder writes into `out`, returns it and keeps its array (no allocation)", () => {
      const out = createPose();
      const q = out.q;
      const builders: Array<() => HumanoidPose> = [
         () => restPose(out),
         () => armsDownPose(out),
         () => idlePose(1.3, out),
         () => walkPose(1, 0.6, out),
         () => carryPose(0.7, out),
         () => reachPose(-1, 0.4, out),
         () => cheerPose(2, out),
         () => jumpPose(0.5, out),
         () => mirrorPose(out, out),
         () => blendPoses(out, armsDownPose(createPose()), 0.5, out),
         () => copyPose(createPose(), out),
      ];
      for (const build of builders) {
         expect(build()).toBe(out);
         expect(out.q).toBe(q);
      }
   });

   it("every builder gives unit quaternions", () => {
      const p = createPose();
      const check = () => {
         for (let b = 0; b < BONE_COUNT; b++) expect(quat(p.q, b).length()).toBeCloseTo(1, 6);
      };
      for (const t of [0, 0.7, 3.3]) {
         idlePose(t, p);
         check();
         cheerPose(t, p);
         check();
      }
      for (const k of [0, 0.3, 1]) {
         carryPose(k, p);
         check();
         jumpPose(k, p);
         check();
         reachPose(1, k, p);
         check();
         for (const phase of PHASES) {
            walkPose(phase, k, p);
            check();
         }
      }
   });

   it("wrapPhase wraps into [0, 2π)", () => {
      expect(wrapPhase(0)).toBe(0);
      expect(wrapPhase(7)).toBeCloseTo(7 - 2 * Math.PI, 12);
      expect(wrapPhase(-1)).toBeCloseTo(2 * Math.PI - 1, 12);
   });
});

describe("the arm drop (resolvePose)", () => {
   it("drop 0 keeps the T-pose; drop 1 hangs each arm armSpread out from straight down, on its own side", () => {
      const rest = resolved(restPose(createPose()));
      expect(chainDir(rest, [BONE.chest, BONE.upperArmL], X).distanceTo(X)).toBeLessThan(1e-6);
      const down = resolved(armsDownPose(createPose()));
      const left = chainDir(down, [BONE.chest, BONE.upperArmL], X);
      const right = chainDir(down, [BONE.chest, BONE.upperArmR], NX);
      expect(left.x).toBeCloseTo(Math.sin(SPREAD), 6);
      expect(left.y).toBeCloseTo(-Math.cos(SPREAD), 6);
      expect(left.z).toBeCloseTo(0, 6);
      expect(right.x).toBeCloseTo(-Math.sin(SPREAD), 6);
      expect(right.y).toBeCloseTo(-Math.cos(SPREAD), 6);
      // the rig's spread is what decides it: another body hangs its arms further out
      expect(chainDir(resolved(armsDownPose(createPose()), 0.5), [BONE.upperArmL], X).x).toBeCloseTo(Math.sin(0.5), 6);
   });

   it("armsDown bends the elbows a little forward (+z), both sides alike", () => {
      const down = resolved(armsDownPose(createPose()));
      const foreL = chainDir(down, [BONE.upperArmL, BONE.lowerArmL], X);
      const foreR = chainDir(down, [BONE.upperArmR, BONE.lowerArmR], NX);
      expect(foreL.z).toBeGreaterThan(0.05);
      expect(foreR.z).toBeCloseTo(foreL.z, 6);
      expect(foreL.y).toBeLessThan(-0.9);
   });

   it("only the upper arms are lowered; everything else is the pose's own rotation", () => {
      const p = walkPose(1.1, 0.7, createPose());
      const r = resolved(p);
      for (let b = 0; b < BONE_COUNT; b++) {
         if (b === BONE.upperArmL || b === BONE.upperArmR) continue;
         expect(Array.from(r.subarray(b * 4, b * 4 + 4))).toEqual(Array.from(p.q.subarray(b * 4, b * 4 + 4)));
      }
   });
});

describe("walkPose", () => {
   it("amount 0 is armsDownPose exactly, whatever the phase", () => {
      const down = armsDownPose(createPose());
      for (const phase of PHASES) expect(walkPose(phase, 0, createPose())).toEqual(down);
   });

   it("half a stride later is the mirror image (left and right swap)", () => {
      for (const amount of [0.3, 0.5, 1]) {
         for (const phase of PHASES) {
            const later = walkPose(phase + Math.PI, amount, createPose());
            const mirrored = mirrorPose(walkPose(phase, amount, createPose()), createPose());
            expectSamePose(later, mirrored);
         }
      }
   });

   it("at π/2 the left leg is forward and the right one back; the arms swing the other way", () => {
      const r = resolved(walkPose(Math.PI / 2, 0.6, createPose()));
      const legL = chainDir(r, [BONE.hips, BONE.upperLegL], DOWN);
      const legR = chainDir(r, [BONE.hips, BONE.upperLegR], DOWN);
      expect(legL.z).toBeGreaterThan(0.2);
      expect(legR.z).toBeLessThan(-0.2);
      const armL = chainDir(r, [BONE.chest, BONE.upperArmL], X);
      const armR = chainDir(r, [BONE.chest, BONE.upperArmR], NX);
      expect(armL.z).toBeLessThan(-0.1);
      expect(armR.z).toBeGreaterThan(0.1);
      // and the stride grows with the amount
      const wide = resolved(walkPose(Math.PI / 2, 1, createPose()));
      expect(chainDir(wide, [BONE.hips, BONE.upperLegL], DOWN).z).toBeGreaterThan(legL.z);
   });

   it("the knee folds the shin backwards, most on the back swing", () => {
      const shinAt = (phase: number) => {
         const r = resolved(walkPose(phase, 1, createPose()));
         // the shin relative to its thigh: positive z bend = the foot goes back (-z)
         return chainDir(r, [BONE.lowerLegL], DOWN);
      };
      for (const phase of PHASES) expect(shinAt(phase).z).toBeLessThanOrEqual(1e-6);
      // leg fully forward (π/2): nearly straight; between push-off and mid-swing (-π/4): folded
      expect(-shinAt(-Math.PI / 4).z).toBeGreaterThan(0.8);
      expect(-shinAt(Math.PI / 2).z).toBeLessThan(0.3);
   });

   it("the lift bobs at or below 0, twice a stride, deeper with the amount", () => {
      const lift = (phase: number, amount: number) => walkPose(phase, amount, createPose()).lift;
      for (const phase of PHASES) {
         expect(lift(phase, 0.5)).toBeLessThanOrEqual(0);
         expect(lift(phase, 0.5)).toBeCloseTo(lift(phase + Math.PI, 0.5), 9);
      }
      // a walk is highest with the legs together (0), a run in its flight (legs apart, π/2)
      expect(lift(0, 0.5)).toBeGreaterThan(lift(Math.PI / 2, 0.5));
      expect(lift(Math.PI / 2, 1)).toBeGreaterThan(lift(0, 1));
      expect(Math.min(lift(0, 1), lift(Math.PI / 2, 1))).toBeLessThan(Math.min(lift(0, 0.3), lift(Math.PI / 2, 0.3)));
   });
});

describe("other poses", () => {
   it("idle stays close to armsDown (a breath, a glance)", () => {
      const down = armsDownPose(createPose());
      for (const t of [0, 1, 2.5]) {
         const idle = idlePose(t, createPose());
         for (let b = 0; b < BONE_COUNT; b++) expect(Math.abs(quat(idle.q, b).dot(quat(down.q, b)))).toBeGreaterThan(0.99);
         expect(idle.dropL).toBe(1);
         expect(Math.abs(idle.lift)).toBeLessThan(0.01);
      }
   });

   it("carry 1 raises both arms past the head, forearms up and hands edge-on; carry 0 holds them forward at the chest", () => {
      const up = resolved(carryPose(1, createPose()));
      const upperL = chainDir(up, [BONE.chest, BONE.upperArmL], X);
      const foreL = chainDir(up, [BONE.chest, BONE.upperArmL, BONE.lowerArmL], X);
      expect(upperL.y).toBeGreaterThan(0.6);
      expect(upperL.x).toBeGreaterThan(0.6); // out, past the head
      expect(foreL.y).toBeGreaterThan(0.99); // then straight up beside it
      expect(Math.abs(foreL.x)).toBeLessThan(0.1);
      const foreR = chainDir(up, [BONE.chest, BONE.upperArmR, BONE.lowerArmR], NX);
      expect(foreR.x).toBeCloseTo(-foreL.x, 5);
      // the hand's flat side (the T-pose's front, +z) faces forward, not across the head
      const Z = new Vector3(0, 0, 1);
      expect(chainDir(up, [BONE.chest, BONE.upperArmL, BONE.lowerArmL], Z).z).toBeGreaterThan(0.9);
      expect(chainDir(up, [BONE.chest, BONE.upperArmR, BONE.lowerArmR], Z).z).toBeGreaterThan(0.9);
      const front = resolved(carryPose(0, createPose()));
      const foreFront = chainDir(front, [BONE.chest, BONE.upperArmL, BONE.lowerArmL], X);
      expect(foreFront.z).toBeGreaterThan(0.9);
      expect(chainDir(front, [BONE.chest, BONE.upperArmL], X).y).toBeLessThan(-0.6);
   });

   it("aimArm points the upper arm and the forearm exactly, for either side", () => {
      const p = armsDownPose(createPose());
      aimArm(p, 1, 0.3, 0.5, 0.8, -0.2, 0.9, 0.4);
      aimArm(p, -1, 0.3, 0.5, 0.8, -0.2, 0.9, 0.4);
      for (const spread of [0.1, 0.4]) {
         const r = resolved(p, spread);
         const u = new Vector3(0.3, 0.5, 0.8).normalize();
         const f = new Vector3(-0.2, 0.9, 0.4).normalize();
         expect(chainDir(r, [BONE.upperArmL], X).distanceTo(u)).toBeLessThan(1e-5);
         expect(chainDir(r, [BONE.upperArmL, BONE.lowerArmL], X).distanceTo(f)).toBeLessThan(1e-5);
         expect(chainDir(r, [BONE.upperArmR], NX).distanceTo(new Vector3(-u.x, u.y, u.z))).toBeLessThan(1e-5);
         expect(chainDir(r, [BONE.upperArmR, BONE.lowerArmR], NX).distanceTo(new Vector3(-f.x, f.y, f.z))).toBeLessThan(1e-5);
      }
      expect([p.dropL, p.dropR]).toEqual([0, 0]);
      // a straight arm along +z still gives a valid rotation
      aimArm(p, 1, 0, 0, 1, 0, 0, 1);
      expect(chainDir(resolved(p), [BONE.upperArmL], X).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-5);
   });

   it("reach: level at 0 and straight up at 1 on the reaching side, for every body; the other arm hangs", () => {
      for (const spread of [0.1, 0.5]) {
         const level = resolved(reachPose(1, 0, createPose()), spread);
         expect(chainDir(level, [BONE.upperArmL], X).distanceTo(X)).toBeLessThan(1e-6);
         const up = resolved(reachPose(-1, 1, createPose()), spread);
         expect(chainDir(up, [BONE.upperArmR], NX).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6);
         expect(chainDir(up, [BONE.upperArmL], X).y).toBeLessThan(-0.8);
      }
      expectSamePose(reachPose(-1, 0.6, createPose()), mirrorPose(reachPose(1, 0.6, createPose()), createPose()));
   });

   it("cheer has both arms up; jump pulls both knees up", () => {
      const c = resolved(cheerPose(0.3, createPose()));
      expect(chainDir(c, [BONE.chest, BONE.upperArmL], X).y).toBeGreaterThan(0.5);
      expect(chainDir(c, [BONE.chest, BONE.upperArmR], NX).y).toBeGreaterThan(0.5);
      const j = resolved(jumpPose(1, createPose()));
      expect(chainDir(j, [BONE.hips, BONE.upperLegL], DOWN).z).toBeGreaterThan(0.5);
      expect(chainDir(j, [BONE.hips, BONE.upperLegR], DOWN).z).toBeGreaterThan(0.5);
      expectSamePose(jumpPose(0, createPose()), armsDownPose(createPose()));
   });
});

describe("blend, mirror, copy", () => {
   const a = walkPose(0.9, 0.8, createPose());
   const b = carryPose(1, createPose());

   it("blend 0 is a, blend 1 is b, in between stays unit length; in place works", () => {
      expectSamePose(blendPoses(a, b, 0, createPose()), a);
      expectSamePose(blendPoses(a, b, 1, createPose()), b);
      const mid = blendPoses(a, b, 0.5, createPose());
      for (let bone = 0; bone < BONE_COUNT; bone++) expect(quat(mid.q, bone).length()).toBeCloseTo(1, 6);
      expect(mid.dropL).toBeCloseTo((a.dropL + b.dropL) / 2, 9);
      const inPlace = copyPose(a, createPose());
      blendPoses(inPlace, b, 0.5, inPlace);
      expectSamePose(inPlace, mid);
   });

   it("a mask blends only its bones: arms take the carry, legs keep walking", () => {
      const out = blendPoses(a, b, 1, createPose(), POSE_MASK.arms);
      for (let bone = 0; bone < BONE_COUNT; bone++) {
         const from = POSE_MASK.arms[bone] ? b : a;
         expect(Math.abs(quat(out.q, bone).dot(quat(from.q, bone)))).toBeCloseTo(1, 6);
      }
      expect(out.dropL).toBe(b.dropL);
      expect(out.lift).toBe(a.lift);
      const legs = blendPoses(a, b, 1, createPose(), POSE_MASK.legs);
      expect(legs.lift).toBe(b.lift);
      expect(legs.dropL).toBe(a.dropL);
   });

   it("mirror twice is the identity; mirror swaps the drops; armsDown is its own mirror", () => {
      const p = reachPose(1, 0.3, createPose());
      expectSamePose(mirrorPose(mirrorPose(p, createPose()), createPose()), p);
      const m = mirrorPose(p, createPose());
      expect([m.dropL, m.dropR]).toEqual([p.dropR, p.dropL]);
      expectSamePose(mirrorPose(armsDownPose(createPose()), createPose()), armsDownPose(createPose()));
      // in place too
      const q = copyPose(p, createPose());
      mirrorPose(q, q);
      expectSamePose(q, m);
   });
});
