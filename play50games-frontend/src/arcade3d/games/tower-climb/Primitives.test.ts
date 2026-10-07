import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { applyHumanoidPose, bodyLift, createPose, soleHeight, walkPose, jumpPose, cheerPose } from "@/arcade3d/core/rig";
import { createTowerParts, disposeTowerParts } from "./Primitives";

describe("tower-climb fallback resources and animated runner", () => {
   it("pins the rendering-table parts and owns/disposes only its own resources across repeated retries", () => {
      for (let mount = 0; mount < 10; mount++) {
         const parts = createTowerParts();
         expect([parts.slab.length, parts.moving.length, parts.ledge.length, parts.intact.length,
            parts.cracked.length, parts.coin.length, parts.flag.length, parts.tower.length]).toEqual([2, 2, 2, 2, 2, 1, 2, 2]);
         let geometries = 0, materials = 0;
         for (const geometry of parts.geometries) geometry.addEventListener("dispose", () => geometries++);
         for (const material of parts.materials) material.addEventListener("dispose", () => materials++);
         disposeTowerParts(parts);
         expect(geometries).toBe(parts.geometries.length); expect(materials).toBe(parts.materials.length);
         // A Strict Mode cleanup/re-setup can still pose the same objects; GPU uploads are rebuilt by Three.
         applyHumanoidPose(parts.runner, walkPose(1, 1, createPose()), false);
         disposeTowerParts(parts);
         expect(geometries).toBe(parts.geometries.length * 2); expect(materials).toBe(parts.materials.length * 2);
      }
   });

   it("the fallback is floor-pivoted, one metre in bind pose, and takes the exact core pose data", () => {
      const parts = createTowerParts(), pose = createPose(), point = new Vector3();
      try {
         expect(parts.runnerHeight).toBeCloseTo(1, 6);
         for (const phase of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
            walkPose(phase, 0.5, pose); applyHumanoidPose(parts.runner, pose, true);
            expect(Math.min(soleHeight(pose, parts.runner.landmarks, 1), soleHeight(pose, parts.runner.landmarks, -1))).toBeCloseTo(0, 6);
            expect(bodyLift(pose, parts.runner.landmarks)).toBeGreaterThan(-0.1);
         }
         jumpPose(1, pose); applyHumanoidPose(parts.runner, pose, false);
         expect(pose.ground).toBe(0);
         const jump = parts.runner.bones[11].quaternion.clone();
         walkPose(0, 0, pose); applyHumanoidPose(parts.runner, pose, false);
         expect(parts.runner.bones[11].quaternion.angleTo(jump)).toBeGreaterThan(0.1);
         cheerPose(1, pose); applyHumanoidPose(parts.runner, pose, false);
         expect(new Box3().setFromObject(parts.runner.root).getSize(point).y).toBeGreaterThan(0.8);
      } finally { disposeTowerParts(parts); }
   });
});
