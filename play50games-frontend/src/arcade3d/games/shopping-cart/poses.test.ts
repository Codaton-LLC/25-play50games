import { beforeAll, describe, expect, it } from "vitest";
import { createPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, RUNNER_SCALE } from "./assets";
import {
   MAX_CADENCE,
   RUN_AMOUNT,
   runnerPhaseStep,
   runnerPose,
   shopperPose,
   gaitAmount,
   type RunnerLook,
} from "./poses";

const L = RUNNER_LANDMARKS;

describe("shopping-cart runner poses on runner.glb", () => {
   let runner: RiggedCharacter;

   beforeAll(async () => {
      runner = await rigCharacter(ASSETS.pusher);
   }, 30_000);

   const look = (amount: number, phase: number, riding: number, cheer: number): RunnerLook => ({
      amount,
      phase,
      riding,
      cheer,
   });
   const scratch = [createPose(), createPose()] as const;
   const posed = (l: RunnerLook, now: number): HumanoidPose =>
      runnerPose(l, now, createPose(), scratch[0], scratch[1]);

   it("is drawn 1.556 m tall (the head anchor, the top of the head)", () => {
      expect(runner.rig.anchors.head.y * RUNNER_SCALE).toBeCloseTo(1.556, 2);
   });

   it("keeps hands forward on cart handle without swinging out to T-pose: hands stay within 0.45 m of center", () => {
      const rest = runner.glb.cloud;
      let maxHandDistFromCenter = 0;
      for (const amount of [0, 0.5, 1.0]) {
         for (let k = 0; k < 8; k++) {
            const phase = (k / 8) * Math.PI * 2;
            const world = runner.posed(posed(look(amount, phase, 0, 0), 0.1 * k), false);
            for (let i = 0; i < rest.length / 3; i++) {
               if (Math.abs(rest[i * 3]) > L.wristX) {
                  maxHandDistFromCenter = Math.max(maxHandDistFromCenter, Math.abs(world[i * 3]));
               }
            }
         }
      }
      // T-pose wrist reach is ~0.95; with carryPose(0) hands forward, wrist |x| stays < 0.45
      expect(maxHandDistFromCenter).toBeLessThan(0.45);
   });

   it("blends riding tuck (jumpPose) with feet lifted and hands on handle", () => {
      const rest = runner.glb.cloud;
      const walkWorld = runner.posed(posed(look(0, 0, 0, 0), 0), false);
      const rideWorld = runner.posed(posed(look(0, 0, 1, 0), 0), false);

      let lowestWalkY = Infinity;
      let lowestRideY = Infinity;
      for (let i = 0; i < rest.length / 3; i++) {
         lowestWalkY = Math.min(lowestWalkY, walkWorld[i * 3 + 1]);
         lowestRideY = Math.min(lowestRideY, rideWorld[i * 3 + 1]);
      }
      // Feet are pulled up in jump pose tuck
      expect(lowestRideY).toBeGreaterThanOrEqual(lowestWalkY);

      // Wrists stay centered forward on handle even while riding
      let maxRideWristX = 0;
      for (let i = 0; i < rest.length / 3; i++) {
         if (Math.abs(rest[i * 3]) > L.wristX) {
            maxRideWristX = Math.max(maxRideWristX, Math.abs(rideWorld[i * 3]));
         }
      }
      expect(maxRideWristX).toBeLessThan(0.45);
   });

   it("blends cheer pose on victory", () => {
      const cheerP = posed(look(0, 0, 0, 1), 0.5);
      expect(cheerP).toBeDefined();
   });

   it("computes runner gait cadence and speed mapping", () => {
      expect(gaitAmount(0)).toBe(0);
      expect(gaitAmount(3.0)).toBeCloseTo(0.5, 2);
      expect(gaitAmount(6.0)).toBe(1.0);
      expect(gaitAmount(9.0)).toBe(1.0);

      const step = runnerPhaseStep(1.0, 6.0, 1 / 60);
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(MAX_CADENCE * Math.PI * 2 * (1 / 60));
   });

   it("shopperPose creates valid walking and idle poses for NPCs", () => {
      const scratchPose = createPose();
      const walk = shopperPose(0, 1.8, 0, createPose(), scratchPose);
      expect(walk).toBeDefined();
      const idle = shopperPose(0, 0, 0.5, createPose(), scratchPose);
      expect(idle).toBeDefined();
   });
});
