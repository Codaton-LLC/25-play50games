import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { citySpots, coneSpots, lightPoles } from "./looks";
import { BLOCK, CAR_L, CAR_W, HALF_STREET, INSET, PAD_R, PITCH, RADIUS, STREET, createRun } from "./rules";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) {
      const a = i % 3;
      min[a] = Math.min(min[a], cloud[i]);
      max[a] = Math.max(max[a], cloud[i]);
   }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}

const ASSET_OF: Record<keyof typeof GLB_SIZE, ModelAsset> = {
   taxiCab: ASSETS.taxiCab,
   townhouseBlock: ASSETS.townhouseBlock,
   cornerShop: ASSETS.cornerShop,
   busStop: ASSETS.busStop,
   trafficLight: ASSETS.trafficLight,
   trafficCone: ASSETS.trafficCone,
   travellerNpc: ASSETS.travellerNpc,
};

describe("taxi GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre", async () => {
      for (const [id, asset] of Object.entries(ASSET_OF) as [keyof typeof GLB_SIZE, ModelAsset][]) {
         expect(hasModel(asset.url)).toBe(true);
         const b = await bounds(asset.url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
         expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 2);
         expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(0, 2);
      }
   });

   it("the cab is 2.8 m long along its heading (+z) and stays within 0.25 m of its collision circle", () => {
      const k = ASSETS.taxiCab.scale!;
      expect(GLB_SIZE.taxiCab.depth * k).toBeCloseTo(FIT.cabLength, 6);
      expect(GLB_SIZE.taxiCab.depth).toBeGreaterThan(GLB_SIZE.taxiCab.width);
      expect((GLB_SIZE.taxiCab.depth * k) / 2 - RADIUS).toBeLessThanOrEqual(0.25 + 1e-9);
      expect((GLB_SIZE.taxiCab.width * k) / 2).toBeLessThan(RADIUS);
   });

   it("traffic cars match the rules' 3.10 x 1.40 m body; the rider is 1.75 m", () => {
      const car = ASSETS.car;
      expect(REUSED_GLB_SIZE.car.depth * car.scale!).toBeCloseTo(2 * CAR_L, 6);
      expect(REUSED_GLB_SIZE.car.width * car.scale! * car.stretch[0]).toBeCloseTo(2 * CAR_W, 6);
      expect(GLB_SIZE.travellerNpc.height * ASSETS.travellerNpc.scale!).toBeCloseTo(FIT.riderHeight, 6);
   });

   it("city pieces are fitted to 1 m, so a spot's scale is the piece's height (never scaled twice)", () => {
      for (const id of ["townhouseBlock", "cornerShop", "busStop", "trafficLight", "trafficCone"] as const) {
         expect(GLB_SIZE[id].height * ASSET_OF[id].scale!).toBeCloseTo(1, 6);
         expect(ASSET_OF[id].stretch).toBeUndefined();
      }
      expect(REUSED_GLB_SIZE.lamp.height * ASSETS.lamp.scale!).toBeCloseTo(1, 6);
      expect(EXPANSION_GLB_SIZE.leafyTree.height * ASSETS.tree.scale!).toBeCloseTo(1, 6);
   });
});

describe("taxi city layout", () => {
   const footprint = (w: number, d: number, s: { x: number; z: number; rotY?: number; scale?: number }) => {
      const k = s.scale ?? 1;
      const quarter = Math.abs(Math.sin(s.rotY ?? 0)) > 0.5;
      const hx = ((quarter ? d : w) * k) / 2;
      const hz = ((quarter ? w : d) * k) / 2;
      return { minX: s.x - hx, maxX: s.x + hx, minZ: s.z - hz, maxZ: s.z + hz };
   };
   const insideABlock = (f: { minX: number; maxX: number; minZ: number; maxZ: number }) => {
      // block c spans [STREET + c * PITCH + INSET, + BLOCK - 2 INSET] in x (any c, the ring included)
      const c = Math.floor((f.minX - STREET + 0.01) / PITCH);
      const r = Math.floor((f.minZ - STREET + 0.01) / PITCH);
      const x0 = STREET + c * PITCH + INSET - 0.01;
      const z0 = STREET + r * PITCH + INSET - 0.01;
      return f.minX >= x0 && f.maxX <= x0 + BLOCK - 2 * INSET + 0.02 && f.minZ >= z0 && f.maxZ <= z0 + BLOCK - 2 * INSET + 0.02;
   };
   for (const id of LEVEL_IDS) {
      it(`L${id}: every building stands inside a block (never on a street), a ring of blocks closes the edges`, () => {
         const city = citySpots(id);
         const level = LEVELS[id];
         for (const s of city.houses) {
            expect(s.scale).toBeGreaterThan(FIT.houseHeight * 0.9);
            expect(s.scale).toBeLessThanOrEqual(FIT.houseHeight);
            expect(insideABlock(footprint(GLB_SIZE.townhouseBlock.width / GLB_SIZE.townhouseBlock.height, GLB_SIZE.townhouseBlock.depth / GLB_SIZE.townhouseBlock.height, s))).toBe(true);
         }
         for (const s of city.shops) expect(insideABlock(footprint(GLB_SIZE.cornerShop.width / GLB_SIZE.cornerShop.height, GLB_SIZE.cornerShop.depth / GLB_SIZE.cornerShop.height, s))).toBe(true);
         for (const s of city.busStops) expect(insideABlock(footprint(GLB_SIZE.busStop.width / GLB_SIZE.busStop.height, GLB_SIZE.busStop.depth / GLB_SIZE.busStop.height, s))).toBe(true);
         // the playable blocks plus the ring: (bx + 2) x (bz + 2) blocks, 4 shops each
         expect(city.shops.length).toBe(4 * (level.blocksX + 2) * (level.blocksZ + 2));
         expect(city.slabs.length).toBe((level.blocksX + 2) * (level.blocksZ + 2));
         // buildings stay low enough that a 48° camera never loses a street behind them for more than 3 m
         expect(Math.max(FIT.houseHeight, FIT.shopHeight, FIT.busStopHeight) / Math.tan((48 * Math.PI) / 180)).toBeLessThan(3.2);
      });
      it(`L${id}: poles, cones and lamps stand off the cab's path; the rider on the pavement`, () => {
         const run = createRun(7, LEVELS[id]);
         for (const s of [...lightPoles(run), ...coneSpots(run), ...citySpots(id).lamps]) {
            // nearest street centreline: at least the cab's radius away, unless it is a cone on the road edge
            let lat = Infinity;
            for (let i = -1; i <= run.level.blocksX + 1; i++) lat = Math.min(lat, Math.abs(s.x - (i * PITCH + HALF_STREET)));
            let latZ = Infinity;
            for (let j = -1; j <= run.level.blocksZ + 1; j++) latZ = Math.min(latZ, Math.abs(s.z - (j * PITCH + HALF_STREET)));
            expect(Math.max(lat, latZ)).toBeGreaterThan(RADIUS + 1.0);
         }
         // the rider waits beside the pad, on the pavement strip, outside the pad ring's reach of the cab
         expect(HALF_STREET + 0.2).toBeGreaterThan(PAD_R - 0.35);
         expect(HALF_STREET + 0.2).toBeLessThan(HALF_STREET + INSET);
      });
   }
});
