// Every GLB fit on the real mesh (public/models/3d): the measured bounds in GLB_SIZE, and the drawn sizes.
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { assetScale } from "@/arcade3d/core/assets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { CHEST_TOP, DOOR_WIDTH, PROP_SIZE } from "./rules";
import { LOW_WALL_H } from "./looks";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) { const a = i % 3; min[a] = Math.min(min[a], cloud[i]); max[a] = Math.max(max[a], cloud[i]); }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}

const drawn = async (asset: ModelAsset) => {
   const b = await bounds(asset.url);
   const [sx, sy, sz] = assetScale(asset);
   return { b, w: b.width * sx, h: b.height * sy, d: b.depth * sz };
};

describe("haunted-mansion-keys GLB fits (real meshes)", () => {
   it("every asset is in the manifest and its measured bounds match GLB_SIZE (pivot on the floor centre)", async () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      for (const [id, size] of Object.entries(GLB_SIZE)) {
         const asset = Object.values(ASSETS).find((a) => a.id === id)!;
         const b = await bounds(asset.url);
         expect(b.width, id).toBeCloseTo(size.width, 3);
         expect(b.height, id).toBeCloseTo(size.height, 3);
         expect(b.depth, id).toBeCloseTo(size.depth, 3);
         expect(b.min[1], id).toBeCloseTo(0, 3);
      }
   });

   it("the door fills the doorway, 1.5 m tall and 0.22 m deep: a closed door never hides the detective", async () => {
      const { w, h, d } = await drawn(ASSETS.door);
      expect(w).toBeCloseTo(DOOR_WIDTH, 3);
      expect(h).toBeCloseTo(FIT.doorHeight, 3);
      expect(d).toBeCloseTo(FIT.doorDepth, 3);
      expect(h).toBeLessThan(FIT.detective);
      expect(LOW_WALL_H).toBeLessThan(FIT.detective * 0.6);
   });

   it("furniture is drawn on its solid footprint", async () => {
      const table = await drawn(ASSETS.table);
      expect(table.w).toBeCloseTo(PROP_SIZE.table.w, 3);
      expect(table.d).toBeCloseTo(PROP_SIZE.table.d, 3);
      const chest = await drawn(ASSETS.chest);
      expect(chest.w).toBeCloseTo(PROP_SIZE.chest.w, 3);
      expect(chest.h).toBeCloseTo(CHEST_TOP, 3);
      expect(chest.d).toBeCloseTo(PROP_SIZE.chest.d, 3);
      const chair = await drawn(ASSETS.chair);
      expect(chair.h).toBeCloseTo(FIT.chair, 3);
      expect(chair.w).toBeLessThanOrEqual(PROP_SIZE.chair.w + 0.01);
      expect(chair.d).toBeLessThanOrEqual(PROP_SIZE.chair.d + 0.04);
      const clock = await drawn(ASSETS.clock);
      expect(clock.h).toBeCloseTo(FIT.clock, 3);
      expect(clock.w).toBeLessThanOrEqual(PROP_SIZE.clock.w + 0.02);
      expect(clock.d).toBeLessThanOrEqual(PROP_SIZE.clock.d + 0.02);
      const shelf = await drawn(ASSETS.bookshelf);
      expect(shelf.h).toBeCloseTo(FIT.bookshelf, 3);
      expect(shelf.w).toBeLessThanOrEqual(PROP_SIZE.bookshelf.w + 0.02);
      expect(shelf.d).toBeLessThanOrEqual(PROP_SIZE.bookshelf.d + 0.02);
   });

   it("key, lever, painting and armour sizes", async () => {
      expect((await drawn(ASSETS.key)).h).toBeCloseTo(FIT.key, 3);
      expect((await drawn(ASSETS.lever)).h).toBeCloseTo(FIT.lever, 3);
      expect((await drawn(ASSETS.painting)).h).toBeCloseTo(FIT.painting, 3);
      const armour = await drawn(ASSETS.armour);
      expect(armour.h).toBeCloseTo(FIT.armour, 3);
      // the drawn armour stays within its 0.36 m hit circle by at most its arms
      expect(Math.max(armour.w, armour.d) / 2).toBeLessThan(0.42);
   });
});
