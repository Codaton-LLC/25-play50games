// The auto-rig on the station worker (public/models/3d/train-station-rush/charStationWorker.glb,
// 2026-10-25): the committed WORKER_LANDMARKS match what the heuristics find, his poses keep the feet on
// the floor, the hands clear of the hips and the head (with its peaked cap) rigid
// (core/rig/characterChecks.ts), the carry keeps his hands in front of the chest, and his scale draws
// him 1.78 m tall. A new GLB must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { carryPose, createPose } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, GLB_SIZE, WORKER_HEIGHT, WORKER_LANDMARKS, WORKER_SCALE } from "./assets";

describe("train-station-rush charStationWorker.glb", () => {
   describeCharacter("worker", {
      asset: ASSETS.worker,
      landmarks: WORKER_LANDMARKS,
      height: GLB_SIZE.charStationWorker.height,
      reach: GLB_SIZE.charStationWorker.width / 2,
      estimate: {
         // set by eye (assets.ts): no cloth bridges the legs (the estimate's 0.592 hem is the close inner thighs)
         tolerance: { hemY: 0.2, armRadius: 0.01 },
      },
      // the head joint 1.461 + its 0.027 blend: the face and the cap above it are rigid
      headFrom: 1.49,
      hipHalfWidth: 0.25,
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(WORKER_LANDMARKS.hemY).toBe(WORKER_LANDMARKS.crotchY);
   });

   describe("on the real mesh", () => {
      let worker: RiggedCharacter;
      beforeAll(async () => {
         worker = await rigCharacter(ASSETS.worker);
      });

      it("is drawn 1.78 m tall with his soles on the floor", () => {
         let top = -Infinity;
         let low = Infinity;
         const cloud = worker.glb.cloud;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(low).toBeCloseTo(0, 4);
         expect(top * WORKER_SCALE).toBeCloseTo(WORKER_HEIGHT, 3);
         expect(ASSETS.worker.scale).toBe(WORKER_SCALE);
      });

      it("carries a bag at the chest: the hands come forward, between the hips' height and the shoulders", () => {
         const world = worker.posed(carryPose(0, createPose()));
         let front = -Infinity;
         let frontY = 0;
         for (let i = 0; i < world.length; i += 3) {
            if (Math.abs(world[i]) > WORKER_LANDMARKS.shoulderX + 0.2) continue;
            if (world[i + 2] > front) {
               front = world[i + 2];
               frontY = world[i + 1];
            }
         }
         // the forearms reach well in front of the chest (its front is about 0.19)
         expect(front).toBeGreaterThan(0.35);
         expect(frontY).toBeGreaterThan(WORKER_LANDMARKS.hipY);
         expect(frontY).toBeLessThan(WORKER_LANDMARKS.shoulderY + 0.1);
      });
   });
});
