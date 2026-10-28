import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, CAB_WHEELS, CAR_WHEELS, FIT, GLB_SIZE, HERO_VEHICLE_BUDGET } from "./assets";
import { LEVELS } from "./levels";
import { RIDER_SIDE, citySpots, coneSpots, lightPoles, stopBars } from "./looks";
import { BLOCK, CAR_L, CAR_W, HALF_STREET, INSET, PITCH, RADIUS, ROAD_HALF, STREET, U, createRun } from "./rules";

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
   trafficCar: ASSETS.trafficCar,
   townhouseBlock: ASSETS.townhouseBlock,
   cornerShop: ASSETS.cornerShop,
   busStop: ASSETS.busStop,
   trafficLight: ASSETS.trafficLight,
   trafficCone: ASSETS.trafficCone,
   travellerNpc: ASSETS.travellerNpc,
};

describe("taxi GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre (a cut-out wheel leaves the body above it)", async () => {
      for (const [id, asset] of Object.entries(ASSET_OF) as [keyof typeof GLB_SIZE, ModelAsset][]) {
         expect(hasModel(asset.url)).toBe(true);
         const b = await bounds(asset.url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.max[1]).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(GLB_SIZE[id].minY, 3);
         expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 2);
         expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(0, 2);
      }
   });

   it("a real car: the cab is 4.4-4.6 m long along +z, 1.8-1.9 m wide, about 1.5 m tall, within 0.25 design units of its collision circle", () => {
      const k = ASSETS.taxiCab.scale!;
      const [sx, sy] = FIT.cabStretch;
      expect(GLB_SIZE.taxiCab.depth * k).toBeCloseTo(FIT.cabLength, 6);
      expect(FIT.cabLength).toBeGreaterThanOrEqual(4.4);
      expect(FIT.cabLength).toBeLessThanOrEqual(4.6);
      expect(GLB_SIZE.taxiCab.width * k * sx).toBeGreaterThanOrEqual(1.8);
      expect(GLB_SIZE.taxiCab.width * k * sx).toBeLessThanOrEqual(1.9);
      expect(GLB_SIZE.taxiCab.height * k * sy).toBeGreaterThan(1.45);
      expect(GLB_SIZE.taxiCab.height * k * sy).toBeLessThan(1.6);
      expect(GLB_SIZE.taxiCab.depth).toBeGreaterThan(GLB_SIZE.taxiCab.width);
      expect((GLB_SIZE.taxiCab.depth * k) / 2 - RADIUS).toBeLessThanOrEqual(0.25 * U + 1e-9);
      expect((GLB_SIZE.taxiCab.width * k * sx) / 2).toBeLessThan(RADIUS);
      expect(ASSETS.taxiCab.budget.tris).toBe(HERO_VEHICLE_BUDGET.tris);
   });

   it("traffic cars are 4.3 m hatchbacks inside the rules' body box, on their one-way road; the rider is 1.75 m, a third of the cab's length", () => {
      const car = ASSETS.trafficCar;
      const [sx, sy] = FIT.carStretch;
      expect(GLB_SIZE.trafficCar.depth * car.scale!).toBeCloseTo(FIT.carLength, 6);
      expect(FIT.carLength).toBeLessThanOrEqual(2 * CAR_L);
      expect(GLB_SIZE.trafficCar.width * car.scale! * sx).toBeLessThanOrEqual(2 * CAR_W);
      expect(GLB_SIZE.trafficCar.width * car.scale! * sx).toBeGreaterThan(1.75);
      expect(GLB_SIZE.trafficCar.height * car.scale! * sy).toBeLessThan(1.7);
      expect(car.rotationY).toBeCloseTo(Math.PI, 9);
      // the one-way perimeter road: the drawn body (and its collision box) stays well inside the kerbs
      expect(CAR_W).toBeLessThan(ROAD_HALF - 1);
      expect(GLB_SIZE.travellerNpc.height * ASSETS.travellerNpc.scale!).toBeCloseTo(FIT.riderHeight, 6);
      expect(FIT.riderHeight).toBeGreaterThanOrEqual(1.7);
      expect(FIT.riderHeight / FIT.cabLength).toBeLessThan(0.4);
   });

   it("code wheels stand on the floor under the wheel arches, inside the body", () => {
      for (const [w, length, width] of [
         [CAB_WHEELS, FIT.cabLength, GLB_SIZE.taxiCab.width * ASSETS.taxiCab.scale! * FIT.cabStretch[0]],
         [CAR_WHEELS, FIT.carLength, GLB_SIZE.trafficCar.width * ASSETS.trafficCar.scale! * FIT.carStretch[0]],
      ] as const) {
         expect(w.radius).toBeGreaterThan(0.28);
         expect(w.radius).toBeLessThan(0.4);
         expect(w.front).toBeGreaterThan(0);
         expect(w.rear).toBeLessThan(0);
         expect(w.front + w.radius).toBeLessThan(length / 2);
         expect(-w.rear + w.radius).toBeLessThan(length / 2);
         expect(w.x + w.width / 2).toBeLessThanOrEqual(width / 2 + 0.02);
      }
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

/** Triangles of a GLB: every primitive's index count / 3 (read from the GLB's JSON). */
function glbTris(url: string): number {
   const glb = readFileSync(path.join(process.cwd(), "public", url));
   const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as { meshes: { primitives: { indices: number }[] }[]; accessors: { count: number }[] };
   return json.meshes.reduce((sum, m) => sum + m.primitives.reduce((t, p) => t + json.accessors[p.indices].count / 3, 0), 0);
}

describe("taxi triangle budget (<= 250k per frame on every level, every decor copy drawn)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}`, () => {
         const level = LEVELS[id];
         const city = citySpots(id);
         const run = createRun(3, level);
         const tri = (a: ModelAsset) => glbTris(a.url);
         const glb =
            tri(ASSETS.taxiCab) +
            tri(ASSETS.travellerNpc) +
            level.traffic * tri(ASSETS.trafficCar) +
            city.houses.length * tri(ASSETS.townhouseBlock) +
            city.shops.length * tri(ASSETS.cornerShop) +
            city.busStops.length * tri(ASSETS.busStop) +
            city.lamps.length * tri(ASSETS.lamp) +
            city.trees.length * tri(ASSETS.tree) +
            lightPoles(run).length * tri(ASSETS.trafficLight) +
            coneSpots(run).length * tri(ASSETS.trafficCone);
         // code geometry: 12 triangles a box, the bulbs' spheres (12 x 10), the pad ring, the ground, the sky dome (generous)
         const boxes = city.boxes[0].length + city.boxes[1].length + city.boxes[2].length + city.roofs.length + city.slabs.length + city.courts.length + city.dashes.length + city.edges.length + city.zebras.length + stopBars(run).length;
         // the vehicles' code parts: 4 wheels each (428 triangles, Vehicles.tsx), lamps, shadows, beams; 10 code coins (72 each); the guide arrow
         const vehicles = 1 + level.traffic;
         const code = 12 * boxes + lightPoles(run).length * 240 + 160 + 2 + 8000 + vehicles * (4 * 428 + 4 * 12 + 2 + 2) + 10 * 72 + 10 + city.arrows.length * 6;
         expect(glb + code).toBeLessThanOrEqual(250_000);
         // the heavy pieces are GLBs on the playable blocks only
         expect(tri(ASSETS.townhouseBlock)).toBeLessThanOrEqual(3000);
      });
   }
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
         for (const k of [0, 1, 2] as const) for (const s of city.boxes[k]) expect(insideABlock({ minX: s.x - s.sx! / 2, maxX: s.x + s.sx! / 2, minZ: s.z - s.sz! / 2, maxZ: s.z + s.sz! / 2 })).toBe(true);
         // the playable blocks plus the ring: (bx + 2) x (bz + 2) blocks of 12 cells; GLBs only on the playable ones
         const blocks = (level.blocksX + 2) * (level.blocksZ + 2);
         const playable = level.blocksX * level.blocksZ;
         expect(city.slabs.length).toBe(blocks);
         expect(city.shops.length).toBe(playable);
         expect(city.houses.length + city.busStops.length).toBe(playable);
         expect(city.busStops.length).toBe(1);
         expect(city.boxes[0].length + city.boxes[1].length + city.boxes[2].length).toBe(12 * blocks - 2 * playable);
         expect(city.roofs.length).toBe(12 * blocks - 2 * playable);
         expect(city.lamps.length).toBe(playable);
         expect(city.trees.length).toBe(playable);
         // buildings stay low enough that a 48° camera never loses a street behind them for more than 3 m
         expect(Math.max(FIT.houseHeight, FIT.shopHeight, FIT.busStopHeight) / Math.tan((48 * Math.PI) / 180)).toBeLessThan(3.2 * U);
      });
      it(`L${id}: poles, cones and lamps stand on the pavement, off the road; the rider on the pavement`, () => {
         const run = createRun(7, LEVELS[id]);
         for (const s of [...lightPoles(run), ...coneSpots(run), ...citySpots(id).lamps]) {
            // nearest street centreline: past the kerb (the road is ROAD_HALF either side)
            let lat = Infinity;
            for (let i = -1; i <= run.level.blocksX + 1; i++) lat = Math.min(lat, Math.abs(s.x - (i * PITCH + HALF_STREET)));
            let latZ = Infinity;
            for (let j = -1; j <= run.level.blocksZ + 1; j++) latZ = Math.min(latZ, Math.abs(s.z - (j * PITCH + HALF_STREET)));
            expect(Math.max(lat, latZ)).toBeGreaterThan(ROAD_HALF + 0.3);
         }
         // the rider waits beside the pad on the pavement, short of the facades
         expect(RIDER_SIDE).toBeGreaterThan(ROAD_HALF + 0.5);
         expect(RIDER_SIDE).toBeLessThan(HALF_STREET + INSET - 0.4);
      });
   }
});
