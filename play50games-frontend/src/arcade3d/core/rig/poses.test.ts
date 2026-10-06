// Procedural poses: shapes, symmetry, blending, the arm drop and the clavicles' shrug, the feet,
// checked as pure rotations.
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { BONE, BONE_COUNT } from "./humanoid";
import {
   CLAVICLE_SHARE,
   POSE_MASK,
   REACH_TOP,
   WALK_LEG_SWING,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   copyPose,
   createPose,
   idlePose,
   jumpPose,
   levelFoot,
   mirrorPose,
   reachPose,
   resolvePose,
   restPose,
   setBoneEuler,
   turnBone,
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
   expect(a.ground).toBeCloseTo(b.ground, digits);
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
const Z = new Vector3(0, 0, 1);
/** The bone chains from the root of each arm (the clavicle carries the upper arm). */
const ARM_L = [BONE.chest, BONE.clavicleL, BONE.upperArmL];
const ARM_R = [BONE.chest, BONE.clavicleR, BONE.upperArmR];
const FORE_L = [...ARM_L, BONE.lowerArmL];
const FORE_R = [...ARM_R, BONE.lowerArmR];

describe("basics", () => {
   it("createPose is the rest pose: every bone unrotated, arms out", () => {
      const p = createPose();
      for (let b = 0; b < BONE_COUNT; b++) expect(Array.from(p.q.subarray(b * 4, b * 4 + 4))).toEqual([0, 0, 0, 1]);
      expect([p.dropL, p.dropR, p.lift, p.ground]).toEqual([0, 0, 0, 1]);
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
         () => levelFoot(out, -1, 0.5),
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
      expect(chainDir(rest, ARM_L, X).distanceTo(X)).toBeLessThan(1e-6);
      const down = resolved(armsDownPose(createPose()));
      const left = chainDir(down, ARM_L, X);
      const right = chainDir(down, ARM_R, NX);
      expect(left.x).toBeCloseTo(Math.sin(SPREAD), 6);
      expect(left.y).toBeCloseTo(-Math.cos(SPREAD), 6);
      expect(left.z).toBeCloseTo(0, 6);
      expect(right.x).toBeCloseTo(-Math.sin(SPREAD), 6);
      expect(right.y).toBeCloseTo(-Math.cos(SPREAD), 6);
      // the rig's spread is what decides it: another body hangs its arms further out
      expect(chainDir(resolved(armsDownPose(createPose()), 0.5), ARM_L, X).x).toBeCloseTo(Math.sin(0.5), 6);
   });

   it("armsDown bends the elbows a little forward (+z), both sides alike", () => {
      const down = resolved(armsDownPose(createPose()));
      const foreL = chainDir(down, FORE_L, X);
      const foreR = chainDir(down, FORE_R, NX);
      expect(foreL.z).toBeGreaterThan(0.05);
      expect(foreR.z).toBeCloseTo(foreL.z, 6);
      expect(foreL.y).toBeLessThan(-0.9);
   });

   it("only the arms and the clavicles are the rig's; everything else is the pose's own rotation", () => {
      const p = walkPose(1.1, 0.7, createPose());
      p.q[BONE.clavicleL * 4] = 0.3; // whatever a pose holds there, the rig decides the clavicles
      const r = resolved(p);
      const rig: number[] = [BONE.upperArmL, BONE.upperArmR, BONE.clavicleL, BONE.clavicleR];
      for (let b = 0; b < BONE_COUNT; b++) {
         if (rig.includes(b)) continue;
         expect(Array.from(r.subarray(b * 4, b * 4 + 4))).toEqual(Array.from(p.q.subarray(b * 4, b * 4 + 4)));
      }
      // arms at or below level: the clavicles stay put
      for (const pose of [p, armsDownPose(createPose()), restPose(createPose())]) {
         const q = resolved(pose);
         for (const c of [BONE.clavicleL, BONE.clavicleR]) expect(quat(q, c).angleTo(new Quaternion())).toBeLessThan(1e-6);
      }
   });

   it("a raised arm shrugs its clavicle up by CLAVICLE_SHARE of its elevation and keeps its own direction", () => {
      expect(CLAVICLE_SHARE).toBeGreaterThan(0.3);
      for (const side of [1, -1] as const) {
         const p = armsDownPose(createPose());
         // the arm 40° above level, out to the side and a little forward
         const e = 0.7;
         aimArm(p, side, Math.cos(e), Math.sin(e), 0.2, Math.cos(e), Math.sin(e), 0.2);
         const r = resolved(p);
         const clavicle = side > 0 ? BONE.clavicleL : BONE.clavicleR;
         const out = side > 0 ? X : NX;
         // the clavicle's own outward axis rises (both sides: up, not down)
         const shoulder = chainDir(r, [BONE.chest, clavicle], out);
         const elevation = Math.asin(new Vector3(Math.cos(e), Math.sin(e), 0.2).normalize().y);
         expect(shoulder.y).toBeCloseTo(Math.sin(CLAVICLE_SHARE * elevation), 5);
         expect(shoulder.z).toBeCloseTo(0, 6);
         // and the arm still points where aimArm sent it
         const arm = chainDir(r, side > 0 ? ARM_L : ARM_R, out);
         expect(arm.distanceTo(new Vector3(side * Math.cos(e), Math.sin(e), 0.2).normalize())).toBeLessThan(1e-5);
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
      const armL = chainDir(r, ARM_L, X);
      const armR = chainDir(r, ARM_R, NX);
      expect(armL.z).toBeLessThan(-0.1);
      expect(armR.z).toBeGreaterThan(0.1);
      // and the stride grows with the amount
      const wide = resolved(walkPose(Math.PI / 2, 1, createPose()));
      expect(chainDir(wide, [BONE.hips, BONE.upperLegL], DOWN).z).toBeGreaterThan(legL.z);
   });

   it("the thighs reach exactly WALK_LEG_SWING x amount at the long stride, both ways", () => {
      for (const amount of [0.3, 0.6]) {
         const r = resolved(walkPose(Math.PI / 2, amount, createPose()));
         // the thigh in the hips' frame (its small outward turn does not change its pitch)
         const pitch = (bone: number) => {
            const d = chainDir(r, [bone], DOWN);
            return Math.atan2(d.z, -d.y);
         };
         expect(pitch(BONE.upperLegL)).toBeCloseTo(WALK_LEG_SWING * amount, 2);
         expect(pitch(BONE.upperLegR)).toBeCloseTo(-WALK_LEG_SWING * amount, 2);
      }
   });

   it("the knee folds only in the swing, most in its middle; straight on the ground and at the long stride", () => {
      // (a walk: amount 0.5, before a run starts bending the reaching knee)
      const knee = (phase: number) => 2 * Math.acos(Math.min(1, Math.abs(walkPose(phase, 0.5, createPose()).q[BONE.lowerLegL * 4 + 3])));
      const shinAt = (phase: number) => chainDir(resolved(walkPose(phase, 1, createPose())), [BONE.lowerLegL], DOWN);
      // a bend only ever takes the foot back (-z)
      for (const phase of PHASES) expect(shinAt(phase).z).toBeLessThanOrEqual(1e-6);
      // the left leg swings from -π/2 to π/2: folded at -π/4 and at 0, straight again at both ends
      expect(knee(-Math.PI / 4)).toBeGreaterThan(0.3);
      expect(knee(0)).toBeGreaterThan(0.4);
      for (const phase of [Math.PI / 2, (3 * Math.PI) / 2, Math.PI, 2.3, 4]) expect(knee(phase)).toBeLessThan(1e-4);
   });

   it("the soles stay flat: hips x thigh x shin x foot only turns about the vertical, every phase and amount", () => {
      for (const amount of [0.2, 0.6, 1]) {
         for (const phase of PHASES) {
            const p = walkPose(phase, amount, createPose());
            for (const [thigh, shin, foot] of [
               [BONE.upperLegL, BONE.lowerLegL, BONE.footL],
               [BONE.upperLegR, BONE.lowerLegR, BONE.footR],
            ]) {
               const sole = chainDir(p.q, [BONE.hips, thigh, shin, foot], new Vector3(0, 1, 0));
               expect(sole.y).toBeCloseTo(1, 6);
               // and the toes still point where the hips do (forward, turned by their twist only)
               const toes = chainDir(p.q, [BONE.hips, thigh, shin, foot], Z);
               expect(toes.distanceTo(chainDir(p.q, [BONE.hips], Z))).toBeLessThan(1e-5);
            }
         }
      }
   });

   it("levelFoot k blends from rigid on the shin (0) to flat (1)", () => {
      const p = jumpPose(1, createPose());
      const rigid = levelFoot(levelFoot(copyPose(p, createPose()), 1, 1), 1, 0);
      expect(quat(rigid.q, BONE.footL).angleTo(new Quaternion())).toBeLessThan(1e-6);
      const flat = levelFoot(copyPose(p, createPose()), 1, 1);
      expect(chainDir(flat.q, [BONE.hips, BONE.upperLegL, BONE.lowerLegL, BONE.footL], new Vector3(0, 1, 0)).y).toBeCloseTo(1, 6);
      const half = levelFoot(copyPose(p, createPose()), 1, 0.5);
      const angle = quat(flat.q, BONE.footL).angleTo(new Quaternion());
      expect(quat(half.q, BONE.footL).angleTo(new Quaternion())).toBeCloseTo(angle / 2, 2);
      // the hips lean forward: the foot still ends flat
      const leaning = jumpPose(0.5, createPose());
      setBoneEuler(leaning.q, BONE.hips, 0.4, 0.3, 0);
      levelFoot(leaning, -1);
      expect(chainDir(leaning.q, [BONE.hips, BONE.upperLegR, BONE.lowerLegR, BONE.footR], new Vector3(0, 1, 0)).y).toBeCloseTo(1, 6);
   });

   it("a walk keeps its ground contact (ground 1, no lift); a run lets go with its legs apart and flies a little", () => {
      for (const phase of PHASES) {
         const walk = walkPose(phase, 0.5, createPose());
         expect(walk.ground).toBe(1);
         expect(walk.lift).toBe(0);
         const run = walkPose(phase, 1, createPose());
         expect(run.ground).toBeGreaterThanOrEqual(0);
         expect(run.ground).toBeLessThanOrEqual(1);
         expect(run.lift).toBeGreaterThanOrEqual(0);
         expect(run.ground).toBeCloseTo(walkPose(phase + Math.PI, 1, createPose()).ground, 9);
      }
      // planted at mid-stance (legs together), in the air at the long stride
      expect(walkPose(0, 1, createPose()).ground).toBeCloseTo(1, 9);
      expect(walkPose(Math.PI / 2, 1, createPose()).ground).toBeCloseTo(0, 9);
      expect(walkPose(Math.PI / 2, 1, createPose()).lift).toBeGreaterThan(0.01);
      expect(walkPose(0, 1, createPose()).lift).toBeCloseTo(0, 9);
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
      const upperL = chainDir(up, ARM_L, X);
      const foreL = chainDir(up, FORE_L, X);
      expect(upperL.y).toBeGreaterThan(0.6);
      expect(upperL.x).toBeGreaterThan(0.6); // out, past the head
      expect(foreL.y).toBeGreaterThan(0.99); // then straight up beside it
      expect(Math.abs(foreL.x)).toBeLessThan(0.1);
      const foreR = chainDir(up, FORE_R, NX);
      expect(foreR.x).toBeCloseTo(-foreL.x, 5);
      // the hand's flat side (the T-pose's front, +z) faces forward, not across the head
      expect(chainDir(up, FORE_L, Z).z).toBeGreaterThan(0.9);
      expect(chainDir(up, FORE_R, Z).z).toBeGreaterThan(0.9);
      const front = resolved(carryPose(0, createPose()));
      const foreFront = chainDir(front, FORE_L, X);
      expect(foreFront.z).toBeGreaterThan(0.9);
      expect(chainDir(front, ARM_L, X).y).toBeLessThan(-0.6);
   });

   it("aimArm points the upper arm and the forearm exactly, for either side", () => {
      const p = armsDownPose(createPose());
      aimArm(p, 1, 0.3, 0.5, 0.8, -0.2, 0.9, 0.4);
      aimArm(p, -1, 0.3, 0.5, 0.8, -0.2, 0.9, 0.4);
      for (const spread of [0.1, 0.4]) {
         const r = resolved(p, spread);
         const u = new Vector3(0.3, 0.5, 0.8).normalize();
         const f = new Vector3(-0.2, 0.9, 0.4).normalize();
         expect(chainDir(r, ARM_L, X).distanceTo(u)).toBeLessThan(1e-5);
         expect(chainDir(r, FORE_L, X).distanceTo(f)).toBeLessThan(1e-5);
         expect(chainDir(r, ARM_R, NX).distanceTo(new Vector3(-u.x, u.y, u.z))).toBeLessThan(1e-5);
         expect(chainDir(r, FORE_R, NX).distanceTo(new Vector3(-f.x, f.y, f.z))).toBeLessThan(1e-5);
      }
      expect([p.dropL, p.dropR]).toEqual([0, 0]);
      // a straight arm along +z, or straight back along the arm, still gives a valid rotation
      aimArm(p, 1, 0, 0, 1, 0, 0, 1);
      expect(chainDir(resolved(p), ARM_L, X).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-5);
      aimArm(p, -1, -1, 0, 0, -1, 0, 0);
      expect(chainDir(resolved(p), ARM_R, NX).distanceTo(X)).toBeLessThan(1e-5);
   });

   it("aimArm turns each segment the shortest way: neither wrings about its own axis (the shoulder is not crushed)", () => {
      const u = new Vector3(0.75, 0.65, 0.1).normalize();
      const f = new Vector3(0.04, 1, 0.08).normalize();
      for (const side of [1, -1] as const) {
         const p = armsDownPose(createPose());
         aimArm(p, side, u.x, u.y, u.z, f.x, f.y, f.z);
         const r = resolved(p);
         const out = side > 0 ? X : NX;
         const arm = side > 0 ? ARM_L : ARM_R;
         const fore = side > 0 ? FORE_L : FORE_R;
         const dir = new Vector3(side * u.x, u.y, u.z);
         // the shortest turn from the rest axis to the arm keeps the axis between them fixed
         const axis = out.clone().cross(dir).normalize();
         expect(chainDir(r, arm, axis).distanceTo(axis)).toBeLessThan(1e-5);
         // the forearm's turn (in the upper arm's frame) has no part about its own rest axis (x)
         expect(Math.abs(r[(side > 0 ? BONE.lowerArmL : BONE.lowerArmR) * 4])).toBeLessThan(1e-6);
         expect(chainDir(r, fore, out).distanceTo(new Vector3(side * f.x, f.y, f.z))).toBeLessThan(1e-5);
      }
   });

   it("reach: level at 0 and REACH_TOP above level at 1, out on the reaching side, for every body; the other arm hangs", () => {
      expect(REACH_TOP).toBeLessThan(Math.PI / 2 - 0.25); // never straight up into a wide head
      for (const spread of [0.1, 0.5]) {
         const level = resolved(reachPose(1, 0, createPose()), spread);
         expect(chainDir(level, ARM_L, X).distanceTo(X)).toBeLessThan(1e-6);
         const up = resolved(reachPose(-1, 1, createPose()), spread);
         expect(chainDir(up, ARM_R, NX).distanceTo(new Vector3(-Math.cos(REACH_TOP), Math.sin(REACH_TOP), 0))).toBeLessThan(1e-6);
         expect(chainDir(up, ARM_L, X).y).toBeLessThan(-0.8);
      }
      expectSamePose(reachPose(-1, 0.6, createPose()), mirrorPose(reachPose(1, 0.6, createPose()), createPose()));
   });

   it("cheer has both arms up in a V, the forearms more upright; jump pulls both knees up and leaves the ground", () => {
      const c = resolved(cheerPose(0.3, createPose()));
      for (const [arm, fore, out] of [
         [ARM_L, FORE_L, X],
         [ARM_R, FORE_R, NX],
      ] as const) {
         const upper = chainDir(c, arm, out);
         expect(upper.y).toBeGreaterThan(0.6);
         expect(upper.x * out.x).toBeGreaterThan(0.3); // out to its own side
         expect(chainDir(c, fore, out).y).toBeGreaterThan(upper.y);
      }
      const j = resolved(jumpPose(1, createPose()));
      expect(chainDir(j, [BONE.hips, BONE.upperLegL], DOWN).z).toBeGreaterThan(0.5);
      expect(chainDir(j, [BONE.hips, BONE.upperLegR], DOWN).z).toBeGreaterThan(0.5);
      expect(jumpPose(0.5, createPose()).ground).toBe(0);
      // tuck 0 is the standing pose, but in the air
      expectSamePose(jumpPose(0, createPose()), { ...armsDownPose(createPose()), ground: 0 });
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
