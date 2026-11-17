import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { ASSETS, BACK_CLEARANCE, HUNTER_SCALE, PACK_OFFSET, ROOM_GLB, TRUNK_DRAWN, TRUNK_GLB, TRUNK_SCALE, TRUNK_SPOTS, VACUUM_SCALE } from "./assets";
import { inMansion, MANSION_BOUNDS } from "./looks";
import { FLOAT, SUCK } from "./suck";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], cloud[i]); max[axis] = Math.max(max[axis], cloud[i]); }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
describe("real GLB fits (run by Claude outside the meshopt-restricted sandbox)", () => {
   it("fits the hunter to 1.56m and the strap-free vacuum to 0.55m", async () => {
      const hunter = await bounds(ASSETS.hunter.url), vacuum = await bounds(ASSETS.vacuum.url);
      expect(hunter.height * HUNTER_SCALE).toBeCloseTo(1.56, 3);
      expect(hunter.min[1]).toBeCloseTo(0, 4); // feet on y = 0
      expect(vacuum.height * VACUUM_SCALE).toBeCloseTo(0.55, 2);
      expect(vacuum.width * VACUUM_SCALE).toBeCloseTo(0.270, 2);
      expect(vacuum.depth * VACUUM_SCALE).toBeCloseTo(0.384, 2);
      expect(EXPANSION_GLB_SIZE.vacuum).toEqual({ width: 0.7937, height: 1.6149, depth: 1.1261 });
      expect(EXPANSION_GLB_POINTS.vacuumBack).toEqual({ x: 0, y: 0.75, z: -0.546 });
      expect(EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE + PACK_OFFSET[1]).toBeCloseTo(0, 10);
      expect(-EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE + PACK_OFFSET[2]).toBeCloseTo(-(0.01 + BACK_CLEARANCE), 10);
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
   it("fits the Hyper3D candelabra to the old brass + wax + flames composition on the desks", async () => {
      const candelabra = await bounds(ASSETS.candelabra.url), k = ASSETS.candelabra.scale ?? 1;
      // Measured GLB bounds (root space): candles and small flame shapes are baked in.
      expect(candelabra.width).toBeCloseTo(1.51181, 4);
      expect(candelabra.height).toBeCloseTo(1.89846, 4);
      expect(candelabra.depth).toBeCloseTo(0.67328, 4);
      expect(candelabra.min[1]).toBeCloseTo(0, 4); // base at y=0, stands on the desk
      // Drawn 0.68 m tall: the old brass (0.38) + wax stalks (0.22) + flames on the desks.
      expect(candelabra.height * k).toBeCloseTo(0.68, 2);
      expect(candelabra.width * k).toBeCloseTo(0.54, 2);
      expect(hasModel(ASSETS.candelabra.url)).toBe(true);
   });
   it("fits the Hyper3D attic trunk to a 1.0 m steamer trunk standing on the ground", async () => {
      const trunk = await bounds(ASSETS.trunk.url), k = ASSETS.trunk.scale ?? 1;
      // Measured GLB bounds (root space): base at y = 0, centred in x/z.
      expect(trunk.width).toBeCloseTo(TRUNK_GLB.width, 4);
      expect(trunk.height).toBeCloseTo(TRUNK_GLB.height, 4);
      expect(trunk.depth).toBeCloseTo(TRUNK_GLB.depth, 4);
      expect(trunk.min[1]).toBeCloseTo(0, 4); // sits on the ground
      expect(trunk.width * k).toBeCloseTo(TRUNK_DRAWN.width, 3);
      expect(trunk.height * k).toBeCloseTo(TRUNK_DRAWN.height, 3);
      expect(trunk.depth * k).toBeCloseTo(TRUNK_DRAWN.depth, 3);
      // A sensible real steamer trunk: wider than tall, roughly as deep as tall.
      expect(TRUNK_DRAWN.height).toBeGreaterThan(0.5);
      expect(TRUNK_DRAWN.height).toBeLessThan(TRUNK_DRAWN.width);
      expect(hasModel(ASSETS.trunk.url)).toBe(true);
      expect(existsSync(resolve("public", ASSETS.trunk.url.slice(1)))).toBe(true);
   });
   it("keeps every attic trunk spot strictly outside the mansion play bounds", () => {
      // Worst-case footprint radius (a spot may rotate): half the w/d diagonal.
      const r = Math.hypot(TRUNK_DRAWN.width, TRUNK_DRAWN.depth) / 2;
      for (const spot of TRUNK_SPOTS) {
         expect(inMansion(spot.x, spot.z, r), `trunk at (${spot.x}, ${spot.z}) inside mansion`).toBe(false);
         const insideX = spot.x + r > MANSION_BOUNDS.x0 + 0.1 && spot.x - r < MANSION_BOUNDS.x1 - 0.1;
         const insideZ = spot.z + r > MANSION_BOUNDS.z0 + 0.1 && spot.z - r < MANSION_BOUNDS.z1 - 0.1;
         expect(insideX && insideZ, `trunk footprint at (${spot.x}, ${spot.z}) touches mansion interior`).toBe(false);
      }
   });
   it("fits the Hyper3D ghost to the approved 1.35 m sheet, centred on the body centre, floating", async () => {
      const ghost = await bounds(ASSETS.ghost.url), k = ASSETS.ghost.scale;
      expect(ghost.height).toBeCloseTo(FLOAT.glbHeight, 3);
      expect(ghost.min[1]).toBeCloseTo(0, 3); // floor pivot
      expect(ghost.height * k).toBeCloseTo(1.35, 3);
      // Middle of the drawn ghost on the frame's body centre (where the suck-in and ring aim).
      expect(ghost.min[1] * k + ASSETS.ghost.yOffset + ghost.height * k / 2).toBeCloseTo(SUCK.centreY, 3);
      // Arms out 1.29 m, body about 0.8 m: never wider than the old 1.0 m sheet by more than the arms.
      expect(ghost.width * k).toBeLessThan(1.35);
      expect(ghost.depth * k).toBeLessThan(0.8);
      // Floating: the lowest drawn point clears the floor by at least 0.35 m at the bottom of the bob.
      expect(FLOAT.hover - FLOAT.bob + ASSETS.ghost.yOffset + ghost.min[1] * k).toBeGreaterThanOrEqual(0.35);
   });
});

describe("ghost-vacuum room furniture (reused GLBs, RoomDressing.tsx)", () => {
   const units = [
      [ASSETS.bookshelf, ROOM_GLB.bookshelfFull],
      [ASSETS.table, ROOM_GLB.table],
      [ASSETS.counter, ROOM_GLB.prepCounterR],
      [ASSETS.stove, ROOM_GLB.stoveHearth],
      [ASSETS.crate, ROOM_GLB.crate],
      [ASSETS.web, ROOM_GLB.spiderWeb],
      [ASSETS.trunkBox, TRUNK_GLB],
   ] as const;

   it("every room GLB is in the manifest and fitted to a 1 m cube from its measured bounds", async () => {
      for (const [asset, size] of units) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const { cloud } = await readCharacterGlb(asset.url);
         const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], cloud[i + k]); mx[k] = Math.max(mx[k], cloud[i + k]); }
         expect(mx[0] - mn[0], asset.url).toBeCloseTo(size.width, 2);
         expect(mx[1] - mn[1], asset.url).toBeCloseTo(size.height, 2);
         expect(mx[2] - mn[2], asset.url).toBeCloseTo(size.depth, 2);
         expect(mn[1]).toBeCloseTo(0, 2);
         expect(asset.stretch).toEqual([1 / size.width, 1 / size.height, 1 / size.depth]);
      }
   });
});
