import { describe, expect, it } from "vitest";
import {
   BIRDS, COLORS, CLOUD_DRIFT, DECOR, FIELD, FOG, LANES, ROAD, WATER,
   birdPosition, blockFrontZ, contrastRatio, farFieldDistance, hillHeight, hillMesh, inField, roadMesh, wallBlocks,
} from "./looks";

describe("castle look", () => {
   it("keeps every decor instance outside the field", () => {
      expect(DECOR.length).toBeGreaterThan(40);
      for (const spot of DECOR) {
         expect(inField(spot.x, spot.z), `${spot.kind} ${spot.x.toFixed(2)},${spot.z.toFixed(2)}`).toBe(false);
      }
   });

   it("keeps the flock and the drifting clouds off the field", () => {
      for (let i = 0; i < BIRDS.count; i++) {
         for (let k = 0; k < 8; k++) {
            const p = birdPosition(i, (k / 8) * Math.PI * 2);
            expect(inField(p.x, p.z)).toBe(false);
         }
      }
      for (const cloud of DECOR.filter((spot) => spot.kind === "cloud")) {
         expect(inField(cloud.x - CLOUD_DRIFT, cloud.z)).toBe(false);
         expect(inField(cloud.x + CLOUD_DRIFT, cloud.z)).toBe(false);
      }
   });

   it("starts the fog beyond the far field edge", () => {
      expect(FOG.near).toBeGreaterThan(farFieldDistance());
      expect(FOG.far).toBeGreaterThan(FOG.near);
      expect(WATER.x + WATER.width / 2).toBeLessThan(FIELD.x0);
   });

   it("contrasts each goblin tint with the grass", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
      expect(contrastRatio(COLORS.grass, COLORS.grass)).toBeCloseTo(1, 5);
      for (const tint of Object.values(COLORS.goblin)) {
         expect(contrastRatio(tint, COLORS.grass), tint).toBeGreaterThanOrEqual(3);
      }
   });

   it("keeps the wall front at z 2.5 and the arch in front of it", () => {
      const blocks = wallBlocks();
      expect(blocks.filter((block) => block.kind === "wall").length).toBeGreaterThan(0);
      for (const block of blocks) {
         const front = blockFrontZ(block);
         if (block.kind === "wall") expect(front).toBeCloseTo(2.5, 5);
         if (block.kind === "cap" || block.kind === "merlon") expect(front).toBeGreaterThanOrEqual(2.5);
         if (block.kind === "arch") {
            expect(front).toBeGreaterThan(2.15);
            expect(front).toBeLessThan(2.5);
         }
      }
   });

   it("leaves the field flat and points the hill and road faces upward", () => {
      for (const x of [-5.6, -3, 0, 3, 5.6]) {
         for (const z of [-7.3, -6, -2, 0, 2, 3.5]) expect(hillHeight(x, z)).toBe(0);
      }
      const hills = hillMesh();
      expect(hills.triangles).toBeGreaterThan(200);
      expect(hills.triangles).toBeLessThan(6000);
      for (let i = 0; i < hills.positions.length; i += 3) {
         if (inField(hills.positions[i], hills.positions[i + 2])) expect(hills.positions[i + 1]).toBeLessThanOrEqual(0.001);
      }
      const roads = roadMesh();
      expect(roads.triangles).toBe(LANES.length * 6);
      expect(upward(roads.positions)).toBe(true);
      expect(upward(hills.positions)).toBe(true);
      expect(ROAD.z0).toBe(-6.8);
      expect(ROAD.z1).toBe(2);
   });
});

/** True when every triangle's normal points up (the meadow-facing side). */
function upward(positions: Float32Array): boolean {
   for (let i = 0; i < positions.length; i += 9) {
      const ax = positions[i + 3] - positions[i];
      const ay = positions[i + 4] - positions[i + 1];
      const az = positions[i + 5] - positions[i + 2];
      const bx = positions[i + 6] - positions[i];
      const by = positions[i + 7] - positions[i + 1];
      const bz = positions[i + 8] - positions[i + 2];
      const ny = az * bx - ax * bz;
      if (!(ny > 0) || !Number.isFinite(ay + by)) return false;
   }
   return positions.length > 0;
}
