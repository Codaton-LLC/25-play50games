// Obstacle Race's runner on the real shared runner.glb: ASSETS.runner draws it RUNNER.height (1.50 m)
// tall, as the stand-in and the camera assume, and its soles stay on the floor in the run it is drawn
// with (Scene.tsx: walkPose by the ground covered, bodyLift x the asset's scale on its group). A new
// runner.glb changes this height, so the scale in assets.ts is re-derived from it (README "Runner").
import { beforeAll, describe, expect, it } from "vitest";
import { armsDownPose, bodyLift, cheerPose, createPose, jumpPose, walkPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";
import { RUNNER } from "./rules";

/** The posed cloud's y range (GLB units, before the asset's scale). */
function heights(cloud: Float32Array): { low: number; high: number } {
   let low = Infinity, high = -Infinity;
   for (let i = 1; i < cloud.length; i += 3) { low = Math.min(low, cloud[i]); high = Math.max(high, cloud[i]); }
   return { low, high };
}

describe("obstacle-race runner on the real runner.glb", () => {
   let runner: RiggedCharacter;
   beforeAll(async () => { runner = await rigCharacter(ASSETS.runner); });

   it("is the shared runner turned round with its own scale, drawn RUNNER.height (1.50 m) tall", () => {
      expect(hasModel(ASSETS.runner.url)).toBe(true);
      expect({ ...ASSETS.runner, scale: undefined, rotationY: undefined }).toEqual({ ...SHARED_ASSETS.runner, scale: undefined, rotationY: undefined });
      expect(ASSETS.runner.rotationY).toBe(Math.PI);
      const scale = ASSETS.runner.scale ?? 1;
      const { low, high } = heights(runner.posed(armsDownPose(createPose())));
      expect(low).toBeCloseTo(0, 3);
      expect(high * scale).toBeCloseTo(RUNNER.height, 2);
   });

   it("keeps its soles on or above the floor in the run and the cheer (bodyLift on its group), clear of it in the jump", () => {
      const pose = createPose();
      for (let phase = 0; phase < Math.PI * 2; phase += Math.PI / 8) for (const amount of [0.3, 0.7, 1]) {
         walkPose(phase, amount, pose);
         const { low } = heights(runner.posed(pose, false));
         expect(low + bodyLift(pose, RUNNER_LANDMARKS), `amount ${amount} phase ${phase.toFixed(2)}`).toBeGreaterThan(-0.01);
      }
      cheerPose(0.3, pose);
      expect(heights(runner.posed(pose, false)).low + bodyLift(pose, RUNNER_LANDMARKS)).toBeGreaterThan(-0.01);
      jumpPose(1, pose);
      expect(heights(runner.posed(pose, false)).low).toBeGreaterThan(0.02);
   });
});
