// The stand-in runner's limbs follow the rig's bones: a cheer is a V over the head (not arms
// crossed on the chest), a reach goes out on its own side, a walk swings the legs and arms.
import { describe, expect, it } from "vitest";
import { armsDownPose, cheerPose, createPose, idlePose, reachPose, walkPose } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { armDirection, legDirection, reachSide, type Dir3 } from "./standIn";

const SPREAD = ROBOT_LANDMARKS.armSpread;
const d = (): Dir3 => ({ x: 0, y: 0, z: 0 });

describe("escape-room stand-in limbs", () => {
   it("arms hang a little out from the body when they are down", () => {
      const pose = armsDownPose(createPose());
      for (const side of [1, -1] as const) {
         const arm = armDirection(pose, side, SPREAD, d());
         expect(Math.hypot(arm.x, arm.y, arm.z)).toBeCloseTo(1, 6);
         expect(arm.y).toBeLessThan(-0.9);
         expect(arm.x * side).toBeGreaterThan(0.1);
      }
      const idle = idlePose(1.3, createPose());
      for (const side of [1, -1] as const) expect(armDirection(idle, side, SPREAD, d()).y).toBeLessThan(-0.85);
   });

   it("the win cheer raises both arms up and out in a V, each on its own side, whatever the wave", () => {
      for (let t = 0; t < 1; t += 0.05) {
         const pose = cheerPose(t, createPose());
         for (const side of [1, -1] as const) {
            const arm = armDirection(pose, side, SPREAD, d());
            expect(arm.y, `t ${t} side ${side}`).toBeGreaterThan(0.6);
            expect(arm.x * side, `t ${t} side ${side}`).toBeGreaterThan(0.45);
         }
      }
      // and the arms wave: the angle changes over time
      const a = armDirection(cheerPose(0, createPose()), 1, SPREAD, d()).x;
      const b = armDirection(cheerPose(Math.PI / 18, createPose()), 1, SPREAD, d()).x;
      expect(Math.abs(a - b)).toBeGreaterThan(0.05);
   });

   it("a reach lifts the arm on that side out and up; the other one hangs", () => {
      for (const side of [1, -1] as const) {
         const pose = reachPose(side, 0.55, createPose());
         const reach = armDirection(pose, side, SPREAD, d());
         expect(reach.x * side).toBeGreaterThan(0.8);
         expect(reach.y).toBeGreaterThan(0.2);
         const other = armDirection(pose, side > 0 ? -1 : 1, SPREAD, d());
         expect(other.y).toBeLessThan(-0.9);
      }
   });

   it("a walk swings the left leg forward at phase pi/2 and the left arm back, mirrored half a stride on", () => {
      const pose = walkPose(Math.PI / 2, 0.6, createPose());
      expect(legDirection(pose, 1, d()).z).toBeGreaterThan(0.15);
      expect(legDirection(pose, -1, d()).z).toBeLessThan(-0.1);
      expect(armDirection(pose, 1, SPREAD, d()).z).toBeLessThan(-0.1);
      expect(armDirection(pose, -1, SPREAD, d()).z).toBeGreaterThan(0.1);
      const half = walkPose((3 * Math.PI) / 2, 0.6, createPose());
      expect(legDirection(half, 1, d()).z).toBeLessThan(-0.1);
      expect(legDirection(half, -1, d()).z).toBeGreaterThan(0.15);
      for (const side of [1, -1] as const) expect(legDirection(pose, side, d()).y).toBeLessThan(-0.85);
   });

   it("reaches with the arm on the target's side (L = +x local), for every heading", () => {
      // facing +z (heading 0) the runner's left is +x; facing -z it is -x; facing +x it is -z
      expect(reachSide(0, 1, 0)).toBe(1);
      expect(reachSide(0, -1, 0)).toBe(-1);
      expect(reachSide(Math.PI, 1, 0)).toBe(-1);
      expect(reachSide(Math.PI / 2, 0, -1)).toBe(1);
      expect(reachSide(Math.PI / 2, 0, 1)).toBe(-1);
      for (let h = -Math.PI; h < Math.PI; h += 0.1) {
         // the runner's local +x in the world, as three.js rotation.y turns it
         const lx = Math.cos(h);
         const lz = -Math.sin(h);
         expect(reachSide(h, lx * 0.8, lz * 0.8)).toBe(1);
         expect(reachSide(h, -lx * 0.8, -lz * 0.8)).toBe(-1);
      }
   });
});
