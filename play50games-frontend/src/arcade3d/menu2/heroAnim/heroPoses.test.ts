// The hero animation set on the rig's own forward kinematics (no mesh): the run plants its feet at
// heroStride, flies between steps without a jump in height, and every pose keeps the soles out of
// the floor. heroAnim.glb.test.ts checks the same poses on the five real meshes.
import { describe, expect, it } from "vitest";
import { bodyLift, footPoint, walkStride } from "@/arcade3d/core/rig/gait";
import { createPose, walkPose, type HumanoidPose } from "@/arcade3d/core/rig/poses";
import { HERO_LANDMARKS, HERO_SCALE, M2_HERO_IDS } from "@/arcade3d/menu2/heroModels";
import {
   RUN_DUTY,
   clearFloor,
   curlPose,
   dashPose,
   defeatPose,
   fallPose,
   flipPose,
   heroCheerPose,
   heroIdlePose,
   heroRunPose,
   heroStride,
   hurtPose,
   landPose,
   legContact,
   legPhase,
   lookAround,
   risePose,
   runDuty,
   takeoffPose,
} from "./heroPoses";

const L = HERO_LANDMARKS.riko;
const FOOT = new Float64Array(4);
const sole = (pose: HumanoidPose, side: 1 | -1) => footPoint(pose, L, side, FOOT)[3] + bodyLift(pose, L);

describe("the run's time warp", () => {
   it("is the walk up to amount 0.5 and plants each foot for RUN_DUTY of the cycle at a full run", () => {
      expect(runDuty(0)).toBe(0.5);
      expect(runDuty(0.5)).toBe(0.5);
      expect(runDuty(1)).toBeCloseTo(RUN_DUTY, 9);
      for (let k = 0; k < 32; k++) {
         const theta = (k / 32) * Math.PI * 2;
         expect(legPhase(theta, 0.5)).toBeCloseTo(((theta - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI)) + Math.PI / 2, 9);
      }
      // the stance (walk phase π/2 .. 3π/2) takes `duty` of the cycle
      expect(legPhase(Math.PI / 2, 0.3)).toBeCloseTo(Math.PI / 2, 9);
      expect(legPhase(Math.PI / 2 + 0.6 * Math.PI, 0.3)).toBeCloseTo((3 * Math.PI) / 2, 9);
      let planted = 0;
      for (let k = 0; k < 1000; k++) if (legContact((k / 1000) * Math.PI * 2, 0.3) > 0.5) planted++;
      expect(planted / 1000).toBeCloseTo(0.3, 2);
   });

   it("heroStride is walkStride at a walk and about walkStride / (2 x duty) at a run: about five strides a second at 6.5 m/s", () => {
      expect(heroStride(0.4, L)).toBeCloseTo(walkStride(0.4, L), 9);
      expect(heroStride(0.5, L)).toBeCloseTo(walkStride(0.5, L), 9);
      expect(heroStride(1, L) / (walkStride(1, L) / (2 * RUN_DUTY))).toBeGreaterThan(0.85);
      expect(heroStride(1, L) / (walkStride(1, L) / (2 * RUN_DUTY))).toBeLessThan(1.15);
      for (const id of M2_HERO_IDS) {
         const cadence = 6.5 / (heroStride(1, HERO_LANDMARKS[id]) * HERO_SCALE[id]);
         expect(cadence, id).toBeGreaterThan(4);
         expect(cadence, id).toBeLessThan(6);
      }
   });

   it("heroRunPose is walkPose exactly up to a walk", () => {
      const a = createPose();
      const b = createPose();
      for (const amount of [0, 0.3, 0.5]) {
         for (let k = 0; k < 8; k++) {
            heroRunPose(k, amount, L, a);
            walkPose(k, amount, b);
            expect(Array.from(a.q)).toEqual(Array.from(b.q));
            expect(a.ground).toBe(b.ground);
            expect(a.lift).toBe(b.lift);
         }
      }
   });
});

describe("the run on the rig (Riko's landmarks)", () => {
   for (const amount of [0.3, 0.5, 0.7, 0.85, 1]) {
      it(`amount ${amount}: with the surge, the planted foot slides under 3 mm per step at heroStride, the soles stay out of the floor and the body never jumps`, () => {
         const pose = createPose();
         const extras = { surge: 0 };
         let worstSurge = 0;
         let lastSurge = 0;
         let surgeJump = 0;
         const stride = heroStride(amount, L);
         const N = 720;
         const duty = runDuty(amount);
         let lastLift = NaN;
         let worstJump = 0;
         let worstSlide = 0;
         let low = Infinity;
         let stanceLow = Infinity;
         // two cycles, so every stance is seen whole
         let zMin = Infinity;
         let zMax = -Infinity;
         let inStance = false;
         for (let k = 0; k <= 2 * N; k++) {
            const theta = Math.PI / 2 - 0.3 + (k / N) * Math.PI * 2;
            heroRunPose(theta, amount, L, pose, extras);
            worstSurge = Math.max(worstSurge, Math.abs(extras.surge));
            if (k > 0) surgeJump = Math.max(surgeJump, Math.abs(extras.surge - lastSurge));
            lastSurge = extras.surge;
            const lift = bodyLift(pose, L);
            if (!Number.isNaN(lastLift)) worstJump = Math.max(worstJump, Math.abs(lift - lastLift));
            lastLift = lift;
            const travel = ((theta - Math.PI / 2) / (Math.PI * 2)) * stride;
            const left = sole(pose, 1);
            low = Math.min(low, left, sole(pose, -1));
            const planted = legContact(theta, duty) >= 0.999;
            if (planted) {
               stanceLow = Math.min(stanceLow, Math.abs(left));
               // the ankle in the world: the body moves +z by `travel`
               const z = footPoint(pose, L, 1, FOOT)[2] + travel + extras.surge;
               zMin = Math.min(zMin, z);
               zMax = Math.max(zMax, z);
               inStance = true;
            } else if (inStance) {
               worstSlide = Math.max(worstSlide, zMax - zMin);
               zMin = Infinity;
               zMax = -Infinity;
               inStance = false;
            }
         }
         // GLB units -> metres at the drawn scale
         const s = HERO_SCALE.riko;
         expect(worstSlide * s).toBeLessThan(0.003);
         // the surge is a few centimetres and smooth
         expect(worstSurge * s).toBeLessThan(0.06);
         expect(surgeJump * s).toBeLessThan(0.003);
         expect(low).toBeGreaterThan(-0.005);
         expect(stanceLow).toBeLessThan(0.012);
         // 720 frames a cycle: no step in height over 4 mm
         expect(worstJump * s).toBeLessThan(0.004);
      });
   }
});

describe("the other poses keep the soles out of the floor", () => {
   const standing: Array<[string, (p: HumanoidPose, t: number) => HumanoidPose]> = [
      ["idle", (p, t) => heroIdlePose(t, p)],
      ["land", (p, t) => landPose(t / 2, p)],
      ["hurt", (p, t) => hurtPose(t / 4, p)],
      ["cheer", (p, t) => heroCheerPose(t, p)],
      ["defeat", (p, t) => defeatPose(t, p)],
   ];
   const flying: Array<[string, (p: HumanoidPose, t: number) => HumanoidPose]> = [
      ["takeoff", (p, t) => takeoffPose(1 - t / 2, p)],
      ["rise", (p, t) => risePose(t / 2, p)],
      ["fall", (p, t) => fallPose(t, t / 2, p)],
      ["flip", (p) => flipPose(p)],
      ["curl", (p, t) => curlPose(t / 2, p)],
      ["dash", (p, t) => dashPose(t, p)],
   ];
   for (const [name, build] of standing) {
      it(`${name}: on its own (clearFloor changes nothing)`, () => {
         const p = createPose();
         for (let k = 0; k <= 20; k++) {
            build(p, (k / 20) * 2);
            expect(Math.min(sole(p, 1), sole(p, -1)), `${name} t ${(k / 10).toFixed(1)}`).toBeGreaterThan(-0.005);
            const lift = p.lift;
            clearFloor(p, L);
            expect(p.lift).toBeCloseTo(lift, 2);
            for (const v of p.q) expect(Number.isFinite(v)).toBe(true);
         }
      });
   }
   for (const [name, build] of flying) {
      it(`${name}: in the air, lifted by clearFloor so no toe dips under the hero's feet point`, () => {
         const p = createPose();
         for (let k = 0; k <= 20; k++) {
            build(p, (k / 20) * 2);
            expect(p.ground).toBe(0);
            clearFloor(p, L);
            expect(Math.min(sole(p, 1), sole(p, -1)), `${name} t ${(k / 10).toFixed(1)}`).toBeGreaterThan(-1e-6);
            for (const v of p.q) expect(Number.isFinite(v)).toBe(true);
         }
      });
   }

   it("standing poses (land, hurt, defeat) keep a sole on the floor; the flight poses do not touch it", () => {
      const p = createPose();
      for (const t of [0.2, 0.6, 1]) {
         expect(Math.min(sole(landPose(t, p), 1), sole(p, -1))).toBeLessThan(0.01);
         expect(Math.min(sole(defeatPose(t, p), 1), sole(p, -1))).toBeLessThan(0.01);
         expect(Math.min(sole(hurtPose(t / 4, p), 1), sole(p, -1))).toBeLessThan(0.01);
      }
      expect(flipPose(p).ground).toBe(0);
      expect(curlPose(1, p).ground).toBe(0);
      expect(dashPose(0, p).ground).toBe(0);
   });

   it("the land crouch lowers the body; the defeat squat lowers it further", () => {
      const p = createPose();
      const stand = bodyLift(landPose(0, p), L);
      const crouch = bodyLift(landPose(1, p), L);
      const squat = bodyLift(defeatPose(2, p), L);
      expect(crouch).toBeLessThan(stand - 0.05);
      expect(squat).toBeLessThan(crouch);
   });

   it("looks around: left, then right, then back to the centre on a 7 s loop", () => {
      expect(lookAround(0)).toBe(0);
      expect(lookAround(2.7)).toBeGreaterThan(0.5);
      expect(lookAround(4.6)).toBeLessThan(-0.4);
      expect(lookAround(6.5)).toBe(0);
      expect(lookAround(7 + 2.7)).toBeCloseTo(lookAround(2.7), 9);
   });
});
