// The cleaner's pickup and cheer weights (poseWeights.ts), pure: their shape over time, and the cheer
// built as the Scene builds it (core walkPose + idlePose + cheerPose, resolvePose on the cleaner's
// landmarks) sweeps the arms through level quickly: both arms within 20° of the T-pose for under
// 0.1 s per map clear (a linear fade over CHEER_S held them there for about 0.25 s).
import { describe, expect, it } from "vitest";
import { BONE, BONE_COUNT, POSE_MASK, blendPoses, cheerPose, createPose, idlePose, resolvePose, walkPose } from "@/arcade3d/core/rig";
import { CLEANER_LANDMARKS } from "./assets";
import { CHEER_IN_S, CHEER_OUT_S, CHEER_S, REACH_HOLD_S, REACH_IN_S, REACH_S, cheerWeight, reachWeight } from "./poseWeights";

const DT = 1 / 600;

describe("clean-city reachWeight (poseWeights.ts)", () => {
   it("eases in over REACH_IN_S, holds at 1 to REACH_HOLD_S, eases out to 0 at REACH_S (the pickup window); 0 before any pickup; no jump anywhere", () => {
      expect(REACH_S).toBe(0.45);
      expect(REACH_IN_S).toBeLessThan(REACH_HOLD_S);
      expect(REACH_HOLD_S).toBeLessThan(REACH_S);
      expect(reachWeight(0)).toBe(0);
      expect(reachWeight(REACH_IN_S / 2)).toBeCloseTo(0.5, 12);
      for (let s = REACH_IN_S; s <= REACH_HOLD_S; s += 0.01) expect(reachWeight(s), `${s.toFixed(2)} s`).toBe(1);
      expect(reachWeight((REACH_HOLD_S + REACH_S) / 2)).toBeCloseTo(0.5, 12);
      expect(reachWeight(REACH_S)).toBe(0);
      expect(reachWeight(10)).toBe(0);
      // before any pickup (the Scene's mark starts 10 s back) and for nonsense input
      expect(reachWeight(-1)).toBe(0);
      expect(reachWeight(Number.NaN)).toBe(0);
      let prev = 0;
      let jump = 0;
      for (let s = 0; s < REACH_S + 0.1; s += 0.001) {
         const w = reachWeight(s);
         jump = Math.max(jump, Math.abs(w - prev));
         prev = w;
      }
      // the steepest smoothstep (1.5 / REACH_IN_S per s) moves at most 0.015 a millisecond: no one-frame snap into the stoop
      expect(jump).toBeLessThan(0.016);
   });
});

describe("clean-city cheerWeight (poseWeights.ts)", () => {
   it("eases in over CHEER_IN_S, holds at 1, eases out over the last CHEER_OUT_S of CHEER_S, then 0; no jump anywhere", () => {
      expect(cheerWeight(0, false)).toBe(0);
      expect(cheerWeight(CHEER_IN_S / 2, false)).toBeCloseTo(0.5, 12);
      for (let s = CHEER_IN_S; s <= CHEER_S - CHEER_OUT_S; s += 0.01) expect(cheerWeight(s, false), `${s.toFixed(2)} s`).toBe(1);
      expect(cheerWeight(CHEER_S - CHEER_OUT_S / 2, false)).toBeCloseTo(0.5, 12);
      expect(cheerWeight(CHEER_S, false)).toBe(0);
      expect(cheerWeight(5, false)).toBe(0);
      // before any map clear (the Scene's mark starts 10 s back) and for nonsense input
      expect(cheerWeight(-0.5, false)).toBe(0);
      expect(cheerWeight(Number.NaN, false)).toBe(0);
      let prev = 0;
      let jump = 0;
      for (let s = 0; s < CHEER_S + 0.1; s += 0.001) {
         const w = cheerWeight(s, false);
         jump = Math.max(jump, Math.abs(w - prev));
         prev = w;
      }
      // the steepest smoothstep (1.5 / CHEER_IN_S per s) moves at most 0.015 a millisecond
      expect(jump).toBeLessThan(0.016);
   });

   it("on the win it eases in and then holds at 1 (through the result delay)", () => {
      expect(cheerWeight(0, true)).toBe(0);
      expect(cheerWeight(CHEER_IN_S / 2, true)).toBeCloseTo(0.5, 12);
      for (const s of [CHEER_IN_S, 0.5, CHEER_S, 3, 60]) expect(cheerWeight(s, true)).toBe(1);
   });
});

describe("clean-city cheer as the Scene drives it: the arms cross level quickly", () => {
   const resolved = new Float32Array(BONE_COUNT * 4);

   /** The upper arm's angle (rad) from its T-pose direction in the chest's frame (clavicle x upper arm, resolved). */
   function fromTPose(side: 1 | -1): number {
      const c = (side > 0 ? BONE.clavicleL : BONE.clavicleR) * 4;
      const u = (side > 0 ? BONE.upperArmL : BONE.upperArmR) * 4;
      const [ax, ay, az, aw] = [resolved[c], resolved[c + 1], resolved[c + 2], resolved[c + 3]];
      const [bx, by, bz, bw] = [resolved[u], resolved[u + 1], resolved[u + 2], resolved[u + 3]];
      const y = aw * by - ax * bz + ay * bw + az * bx;
      const z = aw * bz + ax * by - ay * bx + az * bw;
      // the bone's outward axis (±x) after the rotation, against ±x
      return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (y * y + z * z))));
   }

   /** Seconds with both arms within `limit` rad of the T-pose, over a map clear's cheer at walkPose `amount`. */
   function nearTPose(weight: (since: number) => number, amount: number, limit: number): number {
      const p = createPose();
      const scratch = createPose();
      let near = 0;
      for (let s = -0.3; s < CHEER_S + 0.4; s += DT) {
         const t = 20 + s;
         // as Scene.tsx Cleaner: the walk, the idle's upper body when slow, then the cheer over all of it
         walkPose(t * 8.5, amount, p);
         blendPoses(p, idlePose(t, scratch), 1 - Math.min(1, amount * 5), p, POSE_MASK.upper);
         const cheer = s < 0 ? 0 : weight(s);
         if (cheer > 0.001) blendPoses(p, cheerPose(t, scratch), cheer, p);
         resolvePose(p, CLEANER_LANDMARKS.armSpread!, resolved);
         if (Math.max(fromTPose(1), fromTPose(-1)) < limit) near += DT;
      }
      return near;
   }

   const linear = (s: number) => Math.max(0, 1 - s / CHEER_S);
   const deg20 = (20 * Math.PI) / 180;

   it("both arms within 20° of the T-pose for under 0.1 s per cheer standing, walking or running (a linear fade over CHEER_S: over 0.2 s)", () => {
      for (const amount of [0, 0.5, 1]) {
         const now = nearTPose((s) => cheerWeight(s, false), amount, deg20);
         expect(now, `amount ${amount}`).toBeLessThan(0.1);
         expect(nearTPose(linear, amount, deg20), `amount ${amount}, linear`).toBeGreaterThan(0.2);
      }
   });

   it("with the arms down, walking and in the held cheer they are far from the T-pose (the measure sees no level arm outside the sweeps)", () => {
      expect(nearTPose(() => 0, 0, deg20)).toBe(0);
      expect(nearTPose(() => 0, 1, deg20)).toBe(0);
      expect(nearTPose(() => 1, 0, deg20)).toBe(0);
   });
});
