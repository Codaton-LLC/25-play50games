// The worker on runner.glb: 1.556 m, soles and the hat within 1 cm.
import { beforeAll, describe, expect, it } from "vitest";
import { Vector3, type Group } from "three";
import { bodyLift, createAnchorGroup, createPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, WORKER_SCALE } from "./assets";
import { workerPose } from "./poses";

const CM = 0.01 / WORKER_SCALE;

describe("construction-worker character", () => {
   let runner: RiggedCharacter;
   let hat: Group;

   beforeAll(async () => {
      runner = await rigCharacter(ASSETS.worker);
      hat = createAnchorGroup(runner.rig, "head", [WORKER_SCALE, WORKER_SCALE, WORKER_SCALE]);
      runner.rig.bones[runner.rig.anchors.head.bone].add(hat);
   }, 30_000);

   const poses = () => [
      ["idle", workerPose(false, 0, false, 0.4, createPose())],
      ["point", workerPose(true, 0, false, 0.4, createPose())],
      ["cheer", workerPose(false, 1, false, 0.6, createPose())],
   ] as const;

   it("is drawn 1.556 m tall", () => {
      expect(runner.rig.anchors.head.y * WORKER_SCALE).toBeCloseTo(1.556, 2);
   });

   it("keeps the lower sole on the floor within 1 cm", () => {
      for (const [name, pose] of poses()) {
         const world = runner.posed(pose, true);
         let low = Infinity;
         for (let i = 0; i < world.length; i += 3) low = Math.min(low, world[i + 1]);
         expect(low, name).toBeGreaterThan(-CM);
         expect(low, name).toBeLessThan(CM);
         expect(bodyLift(pose, RUNNER_LANDMARKS), name).toBeGreaterThan(-0.02);
      }
   });

   it("keeps the hat on the head bone within 1 cm across poses", () => {
      const at = new Vector3();
      const boneAt = new Vector3();
      const bone = runner.rig.bones[runner.rig.anchors.head.bone];
      const distances: number[] = [];
      for (const [, pose] of poses()) {
         runner.posed(pose, true);
         bone.getWorldPosition(boneAt);
         hat.getWorldPosition(at);
         distances.push(at.distanceTo(boneAt));
      }
      const span = Math.max(...distances) - Math.min(...distances);
      expect(span).toBeLessThan(CM);
   });
});
