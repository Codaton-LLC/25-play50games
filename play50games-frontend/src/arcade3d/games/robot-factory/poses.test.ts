// The walk-off and the cheer on the real robot mesh (CPU-skinned like the shader): soles on the
// floor within 1 cm, the waving arm up and out on the camera side, everything inside the bay.
import { beforeAll, describe, expect, it } from "vitest";
import { createPose, gaitPhaseStep, walkStride } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, ROBOT_SCALE } from "./assets";
import { THROUGH_DOOR, WALK_AMOUNT, WALK_CADENCE, WALK_SPEED, robotCheerPose, robotWalkOffPose, walkOffX } from "./poses";
import { WALK } from "./rules";

let robot: RiggedCharacter;
beforeAll(async () => {
   robot = await rigCharacter(ASSETS.robot);
});

/** The lowest vertex, the highest, and the lowest hand vertex per side (m; hands: rest |x| beyond the wrist). */
function extent(world: Float32Array) {
   const rest = robot.glb.cloud;
   let low = Infinity;
   let high = -Infinity;
   let handL = Infinity;
   let handR = Infinity;
   for (let i = 0; i < world.length; i += 3) {
      low = Math.min(low, world[i + 1]);
      high = Math.max(high, world[i + 1]);
      if (rest[i] > ROBOT_LANDMARKS.wristX) handL = Math.min(handL, world[i + 1]);
      if (rest[i] < -ROBOT_LANDMARKS.wristX) handR = Math.min(handR, world[i + 1]);
   }
   const m = ROBOT_SCALE;
   return { low: low * m, high: high * m, handL: handL * m, handR: handR * m };
}
const SHOULDER = ROBOT_LANDMARKS.shoulderY * ROBOT_SCALE;

describe("robot-factory robot poses", () => {
   it("walks 1.05 m from the cradle to the door in 0.70 s, then is gone through it", () => {
      expect(WALK_SPEED).toBeCloseTo(1.5, 9);
      expect(walkOffX(0)).toBe(WALK.FROM.x);
      expect(walkOffX(WALK.DURATION)).toBeCloseTo(WALK.TO.x, 9);
      expect(walkOffX(WALK.DURATION + THROUGH_DOOR + 0.01)).toBeNull();
      expect(walkOffX(-0.01)).toBeNull();
   });

   it("steps on its own stride (the planted foot stays put), at most 3.2 strides a second", () => {
      const own = walkStride(WALK_AMOUNT, ROBOT_LANDMARKS) * ROBOT_SCALE;
      const step = gaitPhaseStep(WALK_AMOUNT, ROBOT_LANDMARKS, ROBOT_SCALE, WALK_SPEED, 1, WALK_CADENCE);
      expect((WALK_SPEED * Math.PI * 2) / step).toBeCloseTo(Math.max(own, WALK_SPEED / WALK_CADENCE), 9);
      expect(WALK_SPEED / own).toBeLessThan(WALK_CADENCE + 0.5);
   });

   it("keeps the soles on the floor within 1 cm through the walk-off and the wave", () => {
      const scratch = createPose();
      const pose = createPose();
      let waved = 0;
      for (let t = 0; t <= WALK.DURATION + THROUGH_DOOR; t += 0.025) {
         const e = extent(robot.posed(robotWalkOffPose(t, scratch, pose)));
         expect(e.low, `t ${t.toFixed(3)}`).toBeGreaterThan(-0.005);
         expect(e.low, `t ${t.toFixed(3)}`).toBeLessThan(0.01);
         expect(e.high).toBeLessThan(1.6);
         expect(e.handL).toBeLessThan(SHOULDER);
         if (t > 0.2 && t < 0.4) waved = Math.max(waved, e.handR);
      }
      // mid-wave the whole right hand is above the shoulder
      expect(waved).toBeGreaterThan(SHOULDER);
   });

   it("cheers with both arms up and the feet on the floor", () => {
      const pose = createPose();
      for (const t of [0, 0.3, 0.7, 1.1]) {
         const e = extent(robot.posed(robotCheerPose(t, pose)));
         expect(e.low).toBeGreaterThan(-0.005);
         expect(e.low).toBeLessThan(0.01);
         expect(Math.min(e.handL, e.handR)).toBeGreaterThan(SHOULDER);
      }
   });
});
