import { beforeAll, describe, expect, it } from "vitest";
import type { Object3D } from "three";
import { createTowerParts, disposeTowerParts } from "./Primitives";
import { armsDownPose, bodyLift, cheerPose, createPose, jumpPose, walkPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, RUNNER_SCALE } from "./assets";
import { RUNNER } from "./rules";

/** The posed cloud's y range (GLB units, before the asset's scale). */
function heights(cloud: Float32Array): { low: number; high: number } {
   let low = Infinity, high = -Infinity;
   for (let i = 1; i < cloud.length; i += 3) { low = Math.min(low, cloud[i]); high = Math.max(high, cloud[i]); }
   return { low, high };
}

describe("tower-climb shared runner on the real runner.glb", () => {
   let runner: RiggedCharacter;
   beforeAll(async () => { runner = await rigCharacter(ASSETS.runner); });

   it("is the shared runner with only its scale changed, drawn RUNNER.height (0.55 m) tall", () => {
      expect(hasModel(ASSETS.runner.url)).toBe(true);
      expect({ ...ASSETS.runner, scale: undefined }).toEqual({ ...SHARED_ASSETS.runner, scale: undefined });
      expect(ASSETS.runner.scale).toBe(RUNNER_SCALE);
      const { low, high } = heights(runner.posed(armsDownPose(createPose())));
      expect(low).toBeCloseTo(0, 3);
      expect(high * RUNNER_SCALE).toBeCloseTo(RUNNER.height, 2);
   });

   it("nothing in the rig resets three's group render order, so the runner draws after the depth reset", () => {
      // three takes a mesh's group order from its nearest Group ancestor: <HumanoidModel renderOrder> is
      // that Group only while the rig itself has none (README "Known issues")
      runner.rig.root.traverse(object => expect((object as Object3D & { isGroup?: boolean }).isGroup).toBeFalsy());
      const parts = createTowerParts();
      try { expect(runner.skin.renderOrder).toBeGreaterThan(parts.depthReset.renderOrder); } finally { disposeTowerParts(parts); }
   });

   it("keeps its soles on or above the floor in the walk, the jump and the cheer it is drawn with (bodyLift on its group)", () => {
      const pose = createPose();
      for (let phase = 0; phase < Math.PI * 2; phase += Math.PI / 8) for (const amount of [0.3, 0.7, 1]) {
         walkPose(phase, amount, pose);
         const { low } = heights(runner.posed(pose, false));
         expect(low + bodyLift(pose, RUNNER_LANDMARKS)).toBeGreaterThan(-0.01);
      }
      cheerPose(0.3, pose);
      expect(heights(runner.posed(pose, false)).low + bodyLift(pose, RUNNER_LANDMARKS)).toBeGreaterThan(-0.01);
      jumpPose(1, pose);
      expect(heights(runner.posed(pose, false)).low).toBeGreaterThan(0.02);
   });
});
