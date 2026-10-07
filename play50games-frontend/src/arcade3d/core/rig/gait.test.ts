// Ground contact and stride (pure forward kinematics of the legs, no three.js): the lower sole on
// the floor, the body's height, and the stride the planted foot needs.
import { describe, expect, it } from "vitest";
import { ROBOT_LANDMARKS } from "../sharedAssets";
import { MIN_GAIT_STRIDE, bodyLift, footPoint, gaitPhaseStep, groundLift, soleHeight, walkStride } from "./gait";
import { BONE, estimateHumanoidLandmarks } from "./humanoid";
import { armsDownPose, createPose, idlePose, jumpPose, restPose, setBoneEuler, walkPose } from "./poses";
import { HUMAN_FEET, HUMAN_PARTS, buildShape } from "./testShapes";

const human = estimateHumanoidLandmarks(buildShape([...HUMAN_PARTS, HUMAN_FEET]));
const BODIES = [
   ["robot", ROBOT_LANDMARKS],
   ["human", human],
] as const;
const PHASES = [0, 0.5, Math.PI / 2, 2.2, Math.PI, 4, (3 * Math.PI) / 2, 5.5];

describe("groundLift and bodyLift", () => {
   it("straight legs stand on the floor: 0 for the rest pose, arms down, idle", () => {
      for (const [, l] of BODIES) {
         for (const pose of [restPose(createPose()), armsDownPose(createPose()), idlePose(2.3, createPose())]) expect(groundLift(pose, l)).toBeCloseTo(0, 9);
      }
   });

   it("a walk lowers the body at the long stride (straight legs apart), barely at mid-stance", () => {
      for (const [, l] of BODIES) {
         const legLength = l.hipY - l.ankleY;
         const stride = walkPose(Math.PI / 2, 0.5, createPose());
         // both legs straight at ±0.36 rad: the hips are legLength (1 - cos 0.36) lower
         expect(groundLift(stride, l)).toBeCloseTo(-legLength * (1 - Math.cos(0.36)), 2);
         expect(Math.abs(groundLift(walkPose(Math.PI, 0.5, createPose()), l))).toBeLessThan(0.002);
      }
   });

   it("after bodyLift, the lower sole is on the floor and the other one is not below it", () => {
      for (const [, l] of BODIES) {
         for (const amount of [0.2, 0.5]) {
            for (const phase of PHASES) {
               const p = walkPose(phase, amount, createPose());
               const left = soleHeight(p, l, 1);
               const right = soleHeight(p, l, -1);
               expect(Math.min(left, right)).toBeCloseTo(0, 9);
               expect(Math.max(left, right)).toBeGreaterThanOrEqual(-1e-9);
            }
         }
      }
   });

   it("bodyLift = ground x groundLift + lift x hip height; a jump (ground 0) keeps only its lift", () => {
      const l = ROBOT_LANDMARKS;
      const p = walkPose(Math.PI / 2, 0.5, createPose());
      const contact = groundLift(p, l);
      expect(bodyLift(p, l)).toBeCloseTo(contact, 9);
      p.ground = 0.25;
      p.lift = 0.1;
      expect(bodyLift(p, l)).toBeCloseTo(0.25 * contact + 0.1 * l.hipY, 9);
      const jump = jumpPose(1, createPose());
      expect(groundLift(jump, l)).toBeLessThan(-0.01); // tucked legs would pull the body down...
      expect(bodyLift(jump, l)).toBe(0); // ...but a jump is in the air
   });

   it("a tipped foot touches with its toe or heel: the sole's ends count, not the ankle", () => {
      for (const [, l] of BODIES) {
         // the left foot alone pitched toes-down by 0.3 rad (the leg straight)
         const p = armsDownPose(createPose());
         setBoneEuler(p.q, BONE.footL, 0.3, 0, 0);
         const toeDrop = -(Math.sin(0.3) * (l.toeZ - l.hipZ) - l.ankleY * (1 - Math.cos(0.3)));
         expect(groundLift(p, l)).toBeCloseTo(-toeDrop, 4);
         // and heels-down by the heel's lever
         setBoneEuler(p.q, BONE.footL, -0.3, 0, 0);
         const heelDrop = -(Math.sin(0.3) * (l.hipZ - l.heelZ) - l.ankleY * (1 - Math.cos(0.3)));
         expect(groundLift(p, l)).toBeCloseTo(-heelDrop, 4);
      }
   });
});

describe("walkStride", () => {
   it("0 standing, longer with the amount, about 4 x leg length x sin(swing) at a walk", () => {
      for (const [, l] of BODIES) {
         expect(walkStride(0, l)).toBeCloseTo(0, 9);
         let last = 0;
         for (const amount of [0.1, 0.3, 0.5, 0.7, 1]) {
            const stride = walkStride(amount, l);
            expect(stride).toBeGreaterThan(last);
            last = stride;
         }
         // a straight leg swept ±0.36 rad from the hip (plus the hips' turn, which adds a little)
         const legLength = l.hipY - l.ankleY;
         const walk = walkStride(0.5, l);
         expect(walk).toBeGreaterThan(4 * legLength * Math.sin(0.36));
         expect(walk).toBeLessThan(4 * legLength * Math.sin(0.36) * 1.25);
         // out of range clamps
         expect(walkStride(2, l)).toBeCloseTo(walkStride(1, l), 9);
      }
   });
});

describe("gaitPhaseStep", () => {
   const TAU = Math.PI * 2;

   it("0 standing still (or for no time); otherwise the distance over the walk's own stride x scale, so the planted foot stays put", () => {
      for (const [, l] of BODIES) {
         expect(gaitPhaseStep(0.5, l, 0.8, 0, 1 / 60, 4)).toBe(0);
         expect(gaitPhaseStep(0.5, l, 0.8, 1.2, 0, 4)).toBe(0);
         for (const [amount, scale, speed] of [
            [0.3, 0.8, 0.6],
            [0.5, 0.96, 1.4],
            [0.5, 0.82, 1.1],
         ] as const) {
            const step = gaitPhaseStep(amount, l, scale, speed, 0.02, 4);
            // the stride it implies is the walk's own (well under the cadence cap at these speeds)
            expect((speed * 0.02 * TAU) / step).toBeCloseTo(walkStride(amount, l) * scale, 9);
         }
      }
   });

   it("never beats faster than maxCadence strides a second (the stride stretches), and never steps on a stride under minStride", () => {
      for (const [, l] of BODIES) {
         for (const speed of [5, 9, 16]) {
            const dt = 1 / 60;
            const cadence = gaitPhaseStep(1, l, 0.82, speed, dt, 4) / TAU / dt;
            expect(cadence).toBeLessThanOrEqual(4 + 1e-9);
            // capped exactly where the walk's own stride would beat faster
            if (speed / 4 > walkStride(1, l) * 0.82) expect(cadence).toBeCloseTo(4, 9);
         }
         // a creep at amount 0 (walkStride 0): the default shortest stride, or the given one
         expect((0.05 * 0.1 * TAU) / gaitPhaseStep(0, l, 1, 0.05, 0.1)).toBeCloseTo(MIN_GAIT_STRIDE, 9);
         expect((0.05 * 0.1 * TAU) / gaitPhaseStep(0, l, 1, 0.05, 0.1, Infinity, 0.3)).toBeCloseTo(0.3, 9);
      }
   });
});

describe("footPoint", () => {
   it("the ankle under the hip joint in the T-pose, the sole on the floor; its sole y plus bodyLift is soleHeight", () => {
      for (const [, l] of BODIES) {
         const out = new Float64Array(4);
         expect(footPoint(armsDownPose(createPose()), l, 1, out)).toBe(out);
         expect(out[0]).toBeCloseTo(l.hipX, 9);
         expect(out[1]).toBeCloseTo(l.ankleY, 9);
         expect(out[2]).toBeCloseTo(l.hipZ, 9);
         expect(out[3]).toBeCloseTo(0, 9);
         const p = walkPose(1, 0.6, createPose());
         for (const side of [1, -1] as const) expect(footPoint(p, l, side)[3] + bodyLift(p, l)).toBeCloseTo(soleHeight(p, l, side), 9);
         expect(footPoint(p, l, -1)[0]).toBeLessThan(0);
      }
   });
});
