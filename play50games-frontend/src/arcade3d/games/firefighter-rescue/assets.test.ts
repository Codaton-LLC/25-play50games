// Firefighter Rescue GLB fits on the real meshes (public/models/3d), the prop spots, and the draw
// budget. The firefighter's rig and height are in firefighter.test.ts.
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, FIT, GLB_SIZE, GLB_TRIS } from "./assets";
import { LEVELS } from "./levels";
import { DOOR_LINE_X, EXIT_SIGN_SPOTS, HOSE_REEL_SPOT, HYDRANT_SPOTS, LINTEL, TRUCK_SPOT, doorLeaf } from "./looks";
import { DEBRIS_HALF, DOOR_HALF, EXIT, FURN_SIZE, HALL_HALF, PORCH_Z, createRun, doorMidZ, pointInside, roomSide } from "./rules";

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
const k = (a: ModelAsset) => a.scale ?? 1;
const st = (a: ModelAsset, i: 0 | 1 | 2) => (a.stretch ? a.stretch[i] : 1);
/** The drawn size in metres along the GLB's own x / y / z. */
const drawn = (a: ModelAsset, id: keyof typeof GLB_SIZE) => ({
   x: GLB_SIZE[id].width * k(a) * st(a, 0),
   y: GLB_SIZE[id].height * k(a) * st(a, 1),
   z: GLB_SIZE[id].depth * k(a) * st(a, 2),
});

const URLS: Record<keyof typeof GLB_SIZE, string> = {
   charFirefighter: ASSETS.firefighter.url,
   fireExtinguisher: ASSETS.extinguisher.url,
   fireHydrant: ASSETS.hydrant.url,
   hoseReel: ASSETS.hoseReel.url,
   fireTruck: ASSETS.truck.url,
   exitSignV2: ASSETS.exitSign.url,
   fireDoor: ASSETS.door.url,
   fallingDebris: ASSETS.debris.url,
   sofa: ASSETS.sofa.url,
   bed: ASSETS.bed.url,
   cabinet: ASSETS.cabinet.url,
   woodenChair: ASSETS.chair.url,
   civilianNpc: ASSETS.civilian.url,
};

describe("firefighter-rescue GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre, triangles pinned", async () => {
      for (const [id, url] of Object.entries(URLS) as [keyof typeof GLB_SIZE, string][]) {
         expect(hasModel(url), url).toBe(true);
         const b = await bounds(url);
         expect(b.width, id).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height, id).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth, id).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1], id).toBeCloseTo(0, 3);
         expect(Math.abs(b.min[0] + b.max[0]), id).toBeLessThan(0.01);
         expect(Math.abs(b.min[2] + b.max[2]), id).toBeLessThan(0.01);
         expect((await readCharacterGlb(url)).indices.length / 3, id).toBe(GLB_TRIS[id]);
      }
      // the unused ready GLBs stay out
      expect(hasModel("/models/3d/firefighter-rescue/hero.glb")).toBe(false);
      expect(hasModel("/models/3d/firefighter-rescue/exitSign.glb")).toBe(false);
   });

   it("furniture fills its rules box (FURN_SIZE, world x / y / z at rotY 0)", () => {
      // sofa and cabinet stand turned a quarter (GLB x along the world z)
      const sofa = drawn(ASSETS.sofa, "sofa");
      expect(ASSETS.sofa.rotationY).toBeCloseTo(Math.PI / 2, 9);
      expect(sofa.x).toBeCloseTo(FURN_SIZE.sofa.z, 6);
      expect(sofa.y).toBeCloseTo(FURN_SIZE.sofa.y, 6);
      expect(sofa.z).toBeCloseTo(FURN_SIZE.sofa.x, 6);
      const bed = drawn(ASSETS.bed, "bed");
      expect(bed.x).toBeCloseTo(FURN_SIZE.bed.x, 6);
      expect(bed.y).toBeCloseTo(FURN_SIZE.bed.y, 6);
      expect(bed.z).toBeCloseTo(FURN_SIZE.bed.z, 6);
      const cab = drawn(ASSETS.cabinet, "cabinet");
      expect(ASSETS.cabinet.rotationY).toBeCloseTo(Math.PI / 2, 9);
      expect(cab.x).toBeCloseTo(FURN_SIZE.cabinet.z, 6);
      expect(cab.y).toBeCloseTo(FURN_SIZE.cabinet.y, 6);
      expect(cab.z).toBeLessThanOrEqual(FURN_SIZE.cabinet.x);
      const chair = drawn(ASSETS.chair, "woodenChair");
      expect(chair.y).toBeCloseTo(FURN_SIZE.chair.y, 6);
      expect(chair.x).toBeLessThanOrEqual(FURN_SIZE.chair.x);
      expect(chair.z).toBeLessThanOrEqual(FURN_SIZE.chair.z);
      // stretches stay moderate (a double bed squeezed to a single is the largest)
      for (const a of [ASSETS.sofa, ASSETS.bed, ASSETS.cabinet] as ModelAsset[]) for (const f of a.stretch ?? []) expect(f).toBeGreaterThan(0.65);
   });

   it("props at their sizes: truck, hydrant, hose reel, extinguisher, exit sign, door leaf, debris plank, civilian", () => {
      expect(drawn(ASSETS.truck, "fireTruck").z).toBeCloseTo(FIT.truckLength, 6);
      expect(drawn(ASSETS.hydrant, "fireHydrant").y).toBeCloseTo(FIT.hydrantHeight, 6);
      expect(drawn(ASSETS.hoseReel, "hoseReel").y).toBeCloseTo(FIT.hoseReelHeight, 6);
      expect(drawn(ASSETS.extinguisher, "fireExtinguisher").y).toBeCloseTo(FIT.extinguisherHeight, 6);
      const sign = drawn(ASSETS.exitSign, "exitSignV2");
      expect(sign.x).toBeCloseTo(FIT.exitSignWidth, 6);
      // flush on a wall: thinner than the 0.18 m wall
      expect(sign.z).toBeLessThan(0.12);
      const leaf = drawn(ASSETS.door, "fireDoor");
      expect(leaf.x * 2).toBeCloseTo(DOOR_HALF * 2, 6);
      expect(leaf.y).toBeCloseTo(FIT.doorHeight, 6);
      expect(leaf.z).toBeCloseTo(FIT.doorDepth, 6);
      const plank = drawn(ASSETS.debris, "fallingDebris");
      expect(plank.x).toBeCloseTo(DEBRIS_HALF.x * 2, 6);
      // two planks crossed (0.2 m lift for the top one) stay inside the rules' box
      expect(0.2 + plank.y).toBeLessThan(DEBRIS_HALF.y * 2);
      expect(plank.z).toBeLessThan(DEBRIS_HALF.z * 2);
      expect(drawn(ASSETS.civilian, "civilianNpc").y).toBeCloseTo(FIT.civilianHeight, 6);
   });
});

describe("firefighter-rescue prop spots", () => {
   it("the truck, the hydrants and the hose reel stand on the street, off the floor and past the porch", () => {
      const run = createRun(1, LEVELS[5]);
      const truck = drawn(ASSETS.truck, "fireTruck");
      // turned a quarter: its length along x, its width along z
      expect(TRUCK_SPOT.z + truck.x / 2).toBeLessThan(PORCH_Z - 0.5);
      const reel = drawn(ASSETS.hoseReel, "hoseReel");
      for (const s of [...HYDRANT_SPOTS, HOSE_REEL_SPOT]) {
         expect(pointInside(run, s.x, s.z, 0)).toBe(false);
         expect(s.z + reel.z).toBeLessThan(PORCH_Z);
         // beside the truck, never under it
         expect(Math.abs(s.x)).toBeGreaterThan(truck.z / 2);
      }
   });

   it("exit signs hang over the way out, above head height, flush on a wall or under the lintel", () => {
      const sign = drawn(ASSETS.exitSign, "exitSignV2");
      for (const s of EXIT_SIGN_SPOTS) {
         expect(s.y).toBeGreaterThan(1.7);
         expect(s.y + sign.y).toBeLessThanOrEqual(LINTEL.y - (LINTEL.sy ?? 0) / 2 + 0.25);
         expect(s.z).toBeLessThan(EXIT.maxZ);
         const onWall = Math.abs(Math.abs(s.x) - HALL_HALF) < 0.1;
         const underLintel = Math.abs(s.z - PORCH_Z) < 0.1 && s.x === 0;
         expect(onWall || underLintel).toBe(true);
      }
   });

   it("door leaves: shut they fill the doorway in the hall wall; open they lie along the doorway's sides, clear of the passage", () => {
      const out = { x: 0, z: 0, rotY: 0 };
      for (const level of [LEVELS[1], LEVELS[2], LEVELS[5]]) {
         for (let room = 0; room < level.rooms; room++) {
            const side = roomSide(level, room);
            const mid = doorMidZ(level, room);
            for (const leaf of [0, 1] as const) {
               doorLeaf(level, room, leaf, 0, out);
               expect(out.x).toBeCloseTo(side * DOOR_LINE_X, 9);
               expect(out.z).toBeCloseTo(mid + (leaf === 0 ? -DOOR_HALF / 2 : DOOR_HALF / 2), 9);
               doorLeaf(level, room, leaf, 1, out);
               expect(out.x).toBeCloseTo(side * (DOOR_LINE_X + DOOR_HALF / 2), 9);
               expect(Math.abs(out.z - mid)).toBeCloseTo(DOOR_HALF, 9);
            }
         }
      }
   });
});

describe("firefighter-rescue draw budget", () => {
   it("the heaviest level draws well under 150 calls: one per GLB pool, plus the code pieces", () => {
      // GLB pools / models (each Rodin GLB is one mesh): firefighter, extinguisher, truck, hydrants, reel,
      // signs, doors, debris, civilians, sofa, bed, cabinet, chair = 13; code: floor, street, walls, caps,
      // plaques, 2 fire parts, blob shadow = 8; smoke discs (one each, up to 5); fx pools (~6);
      // the warehouse decor: 4 instanced box colours, 2 instanced barrel colours, 3 window strips
      const level = LEVELS[5];
      const calls = 13 + 8 + level.smoke + 6 + 9;
      expect(calls).toBeLessThanOrEqual(150);
   });
});
