// The ready GLBs on the real meshes: raw bounds, drawn sizes, the manifest, and the auto-rigged rider.
import { describe, expect, it } from "vitest";
import { hasModel } from "../../core/modelManifest";
import { describeCharacter } from "../../core/rig/characterChecks";
import { readCharacterGlb } from "../../core/rig/robotGlb";
import { REUSED_GLB_SIZE } from "../../core/sharedAssets";
import { ASSETS, FIT, GLB_SIZE, RIDER_LANDMARKS, RIDER_SCALE } from "./assets";
import { BUILDING_HEIGHT, PITCH_RAD, shopSpot } from "./looks";
import { BARRIER, BLOCK_HALF, CAR, createRun } from "./rules";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) { const a = i % 3; min[a] = Math.min(min[a], cloud[i]); max[a] = Math.max(max[a], cloud[i]); }
   return { min, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}

describe("burger-delivery-scooter GLBs", () => {
   it("every model is in the manifest and measures what assets.ts says (floor pivot)", async () => {
      for (const id of Object.keys(GLB_SIZE) as Array<keyof typeof GLB_SIZE>) {
         const url = id === "trafficCone" ? "/models/3d/shared/trafficCone.glb" : `/models/3d/burger-delivery-scooter/${id}.glb`;
         expect(hasModel(url), url).toBe(true);
         const b = await bounds(url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
      }
      for (const a of Object.values(ASSETS)) expect(hasModel(a.url), a.url).toBe(true);
   });

   it("draws each prop at its size in metres; the dressing is fitted to 1 m (scaled once, by its spot)", () => {
      const s = (a: { scale?: number }) => a.scale ?? 1;
      expect(GLB_SIZE.charScooterRider.height * RIDER_SCALE).toBeCloseTo(FIT.riderHeight, 6);
      expect(GLB_SIZE.deliveryScooter.depth * s(ASSETS.scooter)).toBeCloseTo(FIT.scooterLength, 6);
      expect(GLB_SIZE.deliveryBoxV2.height * s(ASSETS.box)).toBeCloseTo(FIT.boxHeight, 6);
      // the barrier GLB fills the rules' barrier rect
      expect(GLB_SIZE.roadBarrier.width * s(ASSETS.barrier)).toBeCloseTo(2 * BARRIER.hx, 6);
      expect(GLB_SIZE.roadBarrier.depth * s(ASSETS.barrier)).toBeLessThanOrEqual(2 * BARRIER.hz + 0.01);
      // parked cars fill the car rect
      expect(REUSED_GLB_SIZE.car.depth * s(ASSETS.car)).toBeCloseTo(2 * CAR.hz, 6);
      expect(REUSED_GLB_SIZE.car.width * s(ASSETS.car)).toBeLessThanOrEqual(2 * CAR.hx + 0.05);
      // dressing: 1 m tall (the bench and food box 1 m across)
      expect(GLB_SIZE.burgerBag.height * s(ASSETS.bag)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.foodBoxV2.width * s(ASSETS.food)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.trafficCone.height * s(ASSETS.cone)).toBeCloseTo(1, 6);
      expect(REUSED_GLB_SIZE.lamp.height * s(ASSETS.lamp)).toBeCloseTo(1, 6);
      expect(REUSED_GLB_SIZE.bench.width * s(ASSETS.bench)).toBeCloseTo(1, 6);
   });

   it("nothing tall hides the street from the 50° chase camera", () => {
      // a wall h tall hides h / tan(50°) of street north of it; the street's centre is 3 m from a block
      expect(BUILDING_HEIGHT / Math.tan(PITCH_RAD)).toBeLessThan(3 - 0.4);
      // the shop stands north of its pad and its shadow ends inside its own block
      const run = createRun(1, 1);
      const shopH = GLB_SIZE.burgerShopI.height * (ASSETS.shop.scale ?? 1);
      const depth = GLB_SIZE.burgerShopI.depth * (ASSETS.shop.scale ?? 1);
      const at = shopSpot(run, FIT.shopWidth, depth);
      const block = run.buildings[0];
      expect(at.z + depth / 2).toBeLessThan(run.shop.z - 3);
      expect(at.z - depth / 2 - shopH / Math.tan(PITCH_RAD)).toBeGreaterThan(block.z - BLOCK_HALF);
      expect(at.x - FIT.shopWidth / 2).toBeGreaterThan(block.x - BLOCK_HALF);
      expect(at.x + FIT.shopWidth / 2).toBeLessThan(block.x + BLOCK_HALF);
   });
});

describe("burger-delivery-scooter rider", () => {
   describeCharacter("charScooterRider", {
      asset: ASSETS.rider,
      landmarks: RIDER_LANDMARKS,
      height: 1.8483,
      reach: 0.9459,
      // joggers: separate legs, so hemY = crotchY (the estimate's 0.60 is the close thighs)
      estimate: { tolerance: { hemY: 0.14 } },
      headFrom: 1.45,
      hipHalfWidth: 0.2,
   });
});
