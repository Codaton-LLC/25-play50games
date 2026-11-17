import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { OUTER_GAP, SOUTH_DECOR_MAX_H, decorSpots, floorSpots, outerWallSpots, roomFloor, rugSpots, wallSpots } from "./looks";
import { CLUTTER_H, CLUTTER_HALF, FURN_SIZE, HALL_HALF, RADIUS, ROOM_LEN, VAC_R } from "./rules";

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

/** The drawn size (x, y, z in the GLB's own axes) of a fitted asset. */
function drawn(asset: ModelAsset, g: { width: number; height: number; depth: number }) {
   const s = asset.scale ?? 1;
   const [sx, sy, sz] = asset.stretch ?? [1, 1, 1];
   return { x: g.width * s * sx, y: g.height * s * sy, z: g.depth * s * sz };
}

describe("cat-vs-robot-vacuum GLB fits (real meshes)", () => {
   const all: [ModelAsset, keyof typeof GLB_SIZE][] = [
      [ASSETS.cat, "cat"], [ASSETS.vacuum, "robotVacuum"], [ASSETS.treat, "catTreatFish"], [ASSETS.toy, "catToyPlush"],
      [ASSETS.clutter, "catBox"], [ASSETS.catTree, "catTreeR"], [ASSETS.bed, "bed"], [ASSETS.table, "table"],
      [ASSETS.bookshelf, "bookshelfFull"], [ASSETS.chair, "woodenChair"], [ASSETS.sofa, "sofa"],
   ];
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre", async () => {
      for (const [asset, id] of all) {
         expect(hasModel(asset.url)).toBe(true);
         expect(asset.url.endsWith(`/${id}.glb`)).toBe(true);
         const b = await bounds(asset.url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
      }
      // the flagged originals stay out (spec: catTreeR, the regenerated treat / toy / full shelf)
      for (const old of ["catTree", "catTreat", "catToy"]) expect(hasModel(`/models/3d/cat-vs-robot-vacuum/${old}.glb`)).toBe(false);
      // the shelf is the full-shelves regeneration (another game may list the old shared shelf)
      expect(ASSETS.bookshelf.url).toBe("/models/3d/shared/bookshelfFull.glb");
   });

   it("the cat, the vacuum and the pickups at their play sizes", () => {
      const cat = drawn(ASSETS.cat, GLB_SIZE.cat);
      expect(cat.z).toBeCloseTo(FIT.catLength, 6);
      expect(cat.x / 2).toBeLessThan(RADIUS);
      const vac = drawn(ASSETS.vacuum, GLB_SIZE.robotVacuum);
      expect(vac.x).toBeCloseTo(2 * VAC_R, 6);
      expect(vac.z / 2).toBeLessThanOrEqual(VAC_R);
      expect(vac.y).toBeLessThan(0.25);
      expect(drawn(ASSETS.treat, GLB_SIZE.catTreatFish).z).toBeCloseTo(FIT.treatLength, 6);
      expect(drawn(ASSETS.toy, GLB_SIZE.catToyPlush).z).toBeCloseTo(FIT.toyLength, 6);
      const box = drawn(ASSETS.clutter, GLB_SIZE.catBox);
      expect(box.z).toBeCloseTo(2 * CLUTTER_HALF, 6);
      expect(box.x).toBeLessThanOrEqual(2 * CLUTTER_HALF);
      expect(box.y).toBeCloseTo(CLUTTER_H, 2);
   });

   it("furniture fills its solid box (turned pieces: GLB x along the hall)", () => {
      const sofa = drawn(ASSETS.sofa, GLB_SIZE.sofa);
      expect([sofa.z, sofa.y, sofa.x].map((v) => +v.toFixed(4))).toEqual([FURN_SIZE.sofa.x, FURN_SIZE.sofa.y, FURN_SIZE.sofa.z]);
      const table = drawn(ASSETS.table, GLB_SIZE.table);
      expect([table.z, table.y, table.x].map((v) => +v.toFixed(4))).toEqual([FURN_SIZE.table.x, FURN_SIZE.table.y, FURN_SIZE.table.z]);
      const shelf = drawn(ASSETS.bookshelf, GLB_SIZE.bookshelfFull);
      expect([shelf.z, shelf.y, shelf.x].map((v) => +v.toFixed(4))).toEqual([FURN_SIZE.bookshelf.x, FURN_SIZE.bookshelf.y, FURN_SIZE.bookshelf.z]);
      const bed = drawn(ASSETS.bed, GLB_SIZE.bed);
      expect([bed.x, bed.y, bed.z].map((v) => +v.toFixed(4))).toEqual([FURN_SIZE.bed.x, FURN_SIZE.bed.y, FURN_SIZE.bed.z]);
      for (const k of Object.keys(FURN_SIZE) as (keyof typeof FURN_SIZE)[]) for (const v of Object.values(ASSETS[k].stretch ?? [1, 1, 1])) expect(Math.abs(v - 1)).toBeLessThan(0.4);
   });

   it("decor GLBs are fitted to 1 m: a spot's scale is its height (never scaled twice)", () => {
      expect(drawn(ASSETS.catTree, GLB_SIZE.catTreeR).y).toBeCloseTo(1, 6);
      expect(drawn(ASSETS.chair, GLB_SIZE.woodenChair).y).toBeCloseTo(1, 6);
      expect(ASSETS.catTree.stretch).toBeUndefined();
      expect(ASSETS.chair.stretch).toBeUndefined();
   });
});

describe("cat-vs-robot-vacuum decor spots", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: outside the hall walls, short on the camera side`, () => {
         const zEnd = LEVELS[id].rooms * ROOM_LEN;
         const d = decorSpots(id);
         expect(JSON.stringify(decorSpots(id))).toBe(JSON.stringify(d));
         for (const s of [...d.catTrees, ...d.chairs]) {
            expect(Math.abs(s.x) > HALL_HALF + 0.3 || s.z < -0.5 || s.z > zEnd + 0.5).toBe(true);
            if (s.z > zEnd) expect(s.scale ?? 1).toBeLessThanOrEqual(SOUTH_DECOR_MAX_H);
            expect(s.sx ?? s.sy ?? s.sz).toBeUndefined();
         }
         expect(d.catTrees.length).toBeGreaterThan(0);
      });
   }

   for (const id of LEVEL_IDS) {
      it(`L${id}: the house: one floor per room, rugs in the lane, low hall walls, outer walls only on the far and side edges`, () => {
         const level = LEVELS[id];
         const zEnd = level.rooms * ROOM_LEN;
         const floors = floorSpots(id);
         const all = [...floors.woodLight, ...floors.woodWarm, ...floors.tile];
         expect(all.length).toBe(level.rooms);
         expect(all.map((f) => f.z).sort((a, b) => a - b)).toEqual(Array.from({ length: level.rooms }, (_, i) => i * ROOM_LEN + ROOM_LEN / 2));
         // neighbouring rooms differ, so each room reads as its own
         for (let i = 1; i < level.rooms; i++) expect(roomFloor(id, i)).not.toBe(roomFloor(id, i - 1));
         for (const r of rugSpots(level)) expect(Math.abs(r.x) + (r.sx ?? 1) / 2).toBeLessThanOrEqual(1.0);
         const walls = wallSpots(level);
         for (const w of [...walls.body, ...walls.cap]) expect(w.y + (w.sy ?? 1) / 2).toBeLessThanOrEqual(0.6 + 1e-9);
         const outer = outerWallSpots(level);
         for (const w of outer.body) {
            const south = w.z - (w.sz ?? 1) / 2;
            const isSide = Math.abs(w.x) >= HALL_HALF + OUTER_GAP;
            // a side wall is beyond the decor strip; the end wall is north of the hall: none crosses the camera side
            if (isSide) expect(Math.abs(w.x) - (w.sx ?? 1) / 2).toBeGreaterThanOrEqual(HALL_HALF + OUTER_GAP - 1e-9);
            else expect(w.z + (w.sz ?? 1) / 2).toBeLessThan(-OUTER_GAP);
            void south;
         }
         const d = decorSpots(id);
         for (const s of [...d.catTrees, ...d.chairs]) expect(Math.abs(s.x)).toBeLessThan(HALL_HALF + OUTER_GAP - 0.4);
         void zEnd;
      });
   }
});
