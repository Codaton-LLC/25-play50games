import { describe, expect, it, vi } from "vitest";
import { Box3, Matrix4, Vector3, type Material, type WebGLRenderer } from "three";
import { RUNNER } from "./rules";
import { createRunnerGait } from "./runnerGait";
import { RUNNER_ORDER, STAND_IN, createTowerParts, disposeTowerParts, standInLimbs } from "./Primitives";

describe("tower-climb fallback resources and the runner stand-in", () => {
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
         // a Strict Mode cleanup / re-setup may dispose twice; three rebuilds GPU uploads on the next draw
         disposeTowerParts(parts);
         expect(geometries).toBe(parts.geometries.length * 2); expect(materials).toBe(parts.materials.length * 2);
      }
   });

   it("slab and spur bodies are clipped at the danger line (their tops decide visibility, visuals.ts)", () => {
      const parts = createTowerParts();
      try {
         for (const pool of [parts.slab, parts.moving, parts.ledge, parts.intact, parts.cracked, parts.tower]) {
            for (const piece of pool) expect((piece.material as Material).clippingPlanes).toBe(parts.planes);
         }
         // planes[0] keeps y >= viewBottomY once the Scene sets its constant to -viewBottomY
         parts.planes[0].constant = -3.35;
         expect(parts.planes[0].distanceToPoint(new Vector3(0, 3.3, 0))).toBeLessThan(0);
         expect(parts.planes[0].distanceToPoint(new Vector3(0, 3.4, 0))).toBeGreaterThan(0);
      } finally { disposeTowerParts(parts); }
   });

   it("the depth reset draws first in the runner's render group and clears depth right before the runner", () => {
      const parts = createTowerParts();
      try {
         expect(parts.depthReset.renderOrder).toBeLessThan(0);
         expect(parts.depthReset.frustumCulled).toBe(false);
         expect(RUNNER_ORDER).toBeGreaterThan(0);
         const material = parts.depthReset.material as { colorWrite: boolean; depthWrite: boolean; depthTest: boolean };
         expect([material.colorWrite, material.depthWrite, material.depthTest]).toEqual([false, false, false]);
         const setMask = vi.fn(), clearDepth = vi.fn();
         const renderer = { state: { buffers: { depth: { setMask } } }, clearDepth } as unknown as WebGLRenderer;
         (parts.depthReset.onBeforeRender as (r: WebGLRenderer) => void)(renderer);
         expect(setMask).toHaveBeenCalledWith(true); expect(clearDepth).toHaveBeenCalledTimes(1);
         expect(setMask.mock.invocationCallOrder[0]).toBeLessThan(clearDepth.mock.invocationCallOrder[0]);
      } finally { disposeTowerParts(parts); }
   });

   it("the stand-in stands RUNNER.height tall on y = 0 with its limbs at their pivots", () => {
      const parts = createTowerParts(), box = new Box3(), piece = new Box3(), size = new Vector3();
      try {
         expect(STAND_IN.height).toBe(RUNNER.height);
         parts.runnerTrunk.computeBoundingBox(); box.copy(parts.runnerTrunk.boundingBox!);
         parts.runnerLeg.computeBoundingBox(); parts.runnerArm.computeBoundingBox();
         for (const side of [1, -1]) {
            box.union(piece.copy(parts.runnerLeg.boundingBox!).applyMatrix4(new Matrix4().makeTranslation(side * STAND_IN.hipX, STAND_IN.hipY, 0)));
            box.union(piece.copy(parts.runnerArm.boundingBox!).applyMatrix4(new Matrix4().makeTranslation(side * STAND_IN.shoulderX, STAND_IN.shoulderY, 0)));
         }
         expect(box.min.y).toBeCloseTo(0, 6);
         expect(box.getSize(size).y).toBeCloseTo(RUNNER.height, 2);
         // the legs reach the floor from the hips, the hanging arms stay above the hips' height
         expect(parts.runnerLeg.boundingBox!.min.y).toBeCloseTo(-STAND_IN.hipY, 6);
         expect(STAND_IN.shoulderY + parts.runnerArm.boundingBox!.min.y).toBeGreaterThan(STAND_IN.hipY - 0.05);
      } finally { disposeTowerParts(parts); }
   });

   it("the stand-in's limbs follow the gait: a stride, a tuck in the air, arms up on a cheer", () => {
      const gait = createRunnerGait(), limbs = { legL: 0, legR: 0, armL: 0, armR: 0, raise: 0 };
      standInLimbs(gait, limbs);
      for (const angle of Object.values(limbs)) expect(Math.abs(angle)).toBeLessThan(1e-12);
      gait.amount = 1; gait.phase = Math.PI / 2;           // the core walk: left leg forward here
      standInLimbs(gait, limbs);
      expect(limbs.legL).toBeLessThan(-0.5); expect(limbs.legR).toBeGreaterThan(0.5);
      expect(limbs.armL).toBeGreaterThan(0.3); expect(limbs.armR).toBeLessThan(-0.3);
      gait.phase += Math.PI; standInLimbs(gait, limbs);
      expect(limbs.legL).toBeGreaterThan(0.5); expect(limbs.legR).toBeLessThan(-0.5);
      gait.air = 1; gait.tuck = 1; standInLimbs(gait, limbs);
      expect(limbs.legL).toBeCloseTo(limbs.legR, 12); expect(limbs.legL).toBeLessThan(-1);
      expect(limbs.armL).toBeLessThan(-1);
      gait.air = 0; gait.cheer = 1; standInLimbs(gait, limbs);
      expect(limbs.raise).toBeGreaterThan(2);
   });
});
