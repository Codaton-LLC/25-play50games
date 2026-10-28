import { describe, expect, it } from "vitest";
import { BONE, createPose } from "../../core/rig";
import { HAND_HEIGHT, RIDE_LIFT, hangPose } from "./Hero";
import { HANG } from "./layout";
import { TROLLEY_CABLE_Y, TROLLEY_GRIP_Y } from "./assets";

describe("the hang pose", () => {
   it("hangs in the air with both arms aimed exactly (no arm drop)", () => {
      const p = hangPose(0, 0, 0, createPose());
      expect(p.ground).toBe(0);
      expect(p.lift).toBe(0);
      expect(p.dropL).toBe(0);
      expect(p.dropR).toBe(0);
   });
   it("tucks the knees up and leans back on the brake", () => {
      const rest = hangPose(0, 0, 0, createPose());
      const tuck = hangPose(1, 0, 0, createPose());
      const knee = (q: Float32Array) => Math.abs(q[BONE.lowerLegL * 4]);
      expect(knee(tuck.q)).toBeGreaterThan(knee(rest.q) + 0.4);
      const brake = hangPose(0, 0, 1, createPose());
      expect(brake.q[BONE.spine * 4]).not.toBeCloseTo(rest.q[BONE.spine * 4], 3);
      for (const v of tuck.q) expect(Number.isFinite(v)).toBe(true);
   });
   it("puts the hands on the trolley grip: feet + lift + hand height = cable - cable-to-grip", () => {
      expect(RIDE_LIFT + HAND_HEIGHT).toBeCloseTo(HANG - TROLLEY_CABLE_Y + TROLLEY_GRIP_Y, 9);
      expect(RIDE_LIFT).toBeGreaterThan(0);
      expect(RIDE_LIFT).toBeLessThan(0.8);
   });
});
