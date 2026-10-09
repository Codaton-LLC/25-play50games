import { describe, expect, it } from "vitest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, HUNTER_SCALE, PACK_OFFSET, VACUUM_SCALE } from "./assets";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], cloud[i]); max[axis] = Math.max(max[axis], cloud[i]); }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
describe("real GLB fits (run by Claude outside the meshopt-restricted sandbox)", () => {
   it("fits the runner to 1.56m and the strap-free vacuum to 0.55m", async () => {
      const runner = await bounds(ASSETS.hunter.url), vacuum = await bounds(ASSETS.vacuum.url);
      expect(runner.height * HUNTER_SCALE).toBeCloseTo(1.56, 2);
      expect(vacuum.height * VACUUM_SCALE).toBeCloseTo(0.55, 2);
      expect(vacuum.width * VACUUM_SCALE).toBeCloseTo(0.270, 2);
      expect(vacuum.depth * VACUUM_SCALE).toBeCloseTo(0.384, 2);
      expect(EXPANSION_GLB_SIZE.vacuum).toEqual({ width: 0.7937, height: 1.6149, depth: 1.1261 });
      expect(EXPANSION_GLB_POINTS.vacuumBack).toEqual({ x: 0, y: 0.75, z: -0.546 });
      expect(EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE + PACK_OFFSET[1]).toBeCloseTo(0, 10);
      expect(-EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE + PACK_OFFSET[2]).toBeCloseTo(-0.01, 10);
   });
   it("records the missing shared prop measurements and checks the required fits", async () => {
      const desk = await bounds(ASSETS.desk.url), chair = await bounds(ASSETS.chair.url);
      const book = await bounds(ASSETS.book.url), door = await bounds(ASSETS.door.url);
      console.info("ghost-vacuum shared prop raw bounds", { desk, chair, book, door });
      expect(desk.width * (ASSETS.desk.scale ?? 1)).toBeCloseTo(1.6, 2);
      expect(chair.width * (ASSETS.chair.scale ?? 1)).toBeCloseTo(0.6, 2);
      expect(desk.depth * ASSETS.desk.scale * ASSETS.desk.stretch[2]).toBeCloseTo(0.8, 2);
      expect(chair.depth * ASSETS.chair.scale * ASSETS.chair.stretch[2]).toBeCloseTo(0.6, 2);
      // These declared assets remain upright; a lying book needs an x-rotated parent.
      expect(book.height * ASSETS.book.scale).toBeCloseTo(0.25, 2);
      expect(door.height * ASSETS.door.scale).toBeCloseTo(2.2, 2);
   });
});
