// The GLB robot's walk cycle (gait.ts): the amount follows the speed up at once and eases down, the
// stride is the contact stride at every speed (the cadence cap never binds), still when still, and
// on the real robot.glb the planted sole stays put at every speed and from rest.
import { beforeAll, describe, expect, it } from "vitest";
import { contactStride, walkStride } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { gaitSlide, meshFeet, type FeetOf } from "@/arcade3d/core/rig/stanceSlide";
import { ROBOT_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { AMOUNT_EASE_DOWN, ROBOT_MAX_CADENCE, ROBOT_MIN_STRIDE, ROBOT_SCALE, robotAmount, robotPhaseStep } from "./gait";
import { ROBOT } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
/** The steady amount at speed v (robotAmount's target). */
const amountAt = (v: number) => Math.min(1, v / ROBOT.maxSpeed);

describe("robot-collector robotPhaseStep / robotAmount", () => {
   it("standing still (or for no time) the phase does not advance", () => {
      expect(robotPhaseStep(0, 0, DT)).toBe(0);
      expect(robotPhaseStep(0.4, 0, DT)).toBe(0);
      expect(robotPhaseStep(0.4, 2, 0)).toBe(0);
   });

   it("the amount follows the speed up at once and eases down", () => {
      expect(robotAmount(0, 2.5, DT)).toBe(0.5);
      expect(robotAmount(0.2, 9, DT)).toBe(1);
      expect(robotAmount(1, 0, DT)).toBeCloseTo(Math.exp(-AMOUNT_EASE_DOWN * DT), 12);
   });

   it("at every speed the stride is the contact stride x the robot's scale (the walk's own at a walk): the legs beat at most 3.8 strides a second, so the cap never binds", () => {
      let peak = 0;
      for (let v = 0.05; v <= ROBOT.maxSpeed + 1e-9; v += 0.05) {
         const a = amountAt(v);
         const step = robotPhaseStep(a, v, DT);
         const own = contactStride(a, ROBOT_LANDMARKS) * ROBOT_SCALE;
         expect((v * DT * TAU) / step, `v ${v.toFixed(2)}`).toBeCloseTo(Math.max(ROBOT_MIN_STRIDE, own), 9);
         if (own > ROBOT_MIN_STRIDE) peak = Math.max(peak, step / TAU / DT);
         if (v <= 2.5 && own > ROBOT_MIN_STRIDE) expect(own / (walkStride(a, ROBOT_LANDMARKS) * ROBOT_SCALE), `walk v ${v.toFixed(2)}`).toBeCloseTo(1, 2);
      }
      expect(peak).toBeLessThan(3.85);
      expect(ROBOT_MAX_CADENCE).toBeGreaterThan(peak);
      // the 5 m/s top: the full run's 1.55 m contact stride, 3.2 strides a second (walkStride's 1.1 m would need 4.5)
      expect(robotPhaseStep(1, ROBOT.maxSpeed, DT) / TAU / DT).toBeCloseTo(3.23, 1);
   });
});

describe("robot-collector: the planted foot stays put (robot.glb's soles)", () => {
   let feet: FeetOf;
   beforeAll(async () => {
      feet = meshFeet((await rigCharacter(SHARED_ASSETS.robot)) as RiggedCharacter);
   });

   const drive = (speedAt: (t: number) => number) => {
      const g = { phase: 0, amount: 0 };
      return (dt: number, t: number) => {
         const v = speedAt(t);
         g.amount = robotAmount(g.amount, v, dt);
         g.phase += robotPhaseStep(g.amount, v, dt);
         return { phase: g.phase, amount: g.amount, speed: v };
      };
   };

   it("at steady speeds from 1 to 5 m/s its net travel per stance is under 3 % of the body's (the old walkStride + cap 4 slid it 26 % from 3.5 m/s)", () => {
      for (const v of [1, 2.5, 3.5, 5]) {
         const r = gaitSlide(ROBOT_LANDMARKS, ROBOT_SCALE, feet, drive(() => v));
         expect(r.stances, `v ${v}`).toBeGreaterThan(4);
         expect(r.net, `v ${v}`).toBeLessThan(0.03);
      }
   });

   it("speeding up from rest at the rules' 24 m/s² to the top speed, under 10 % (the stride's swing grows within the first stances; the old gait slid 28 %)", () => {
      const r = gaitSlide(ROBOT_LANDMARKS, ROBOT_SCALE, feet, drive((t) => Math.min(ROBOT.maxSpeed, ROBOT.accel * t)), 0.8, 0);
      expect(r.stances).toBeGreaterThan(2);
      expect(r.net).toBeLessThan(0.1);
   });
});
