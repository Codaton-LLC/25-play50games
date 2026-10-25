import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import type { ModelAsset } from "@/arcade3d/core/types";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, BRANCH_UPRIGHT, FIT, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { SOUTH_DECOR_MAX_H, decorSpots } from "./looks";
import { TUNING } from "./rules";

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

describe("bee-garden GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre", async () => {
      const urls: Record<keyof typeof GLB_SIZE, string> = {
         bee: ASSETS.bee.url,
         beehive: ASSETS.beehive.url,
         flowerA: ASSETS.flowerA.url,
         flowerB: ASSETS.flowerB.url,
         flowerC: ASSETS.flowerC.url,
         nectarOrb: ASSETS.nectarOrb.url,
         bigLeaf: ASSETS.bigLeaf.url,
         branchV2: ASSETS.branch.url,
         spiderWeb: ASSETS.spiderWeb.url,
         vegetablePlanter: ASSETS.planter.url,
         wateringCan: ASSETS.wateringCan.url,
         gardenMushroom: ASSETS.mushroom.url,
      };
      for (const [id, url] of Object.entries(urls) as [keyof typeof GLB_SIZE, string][]) {
         expect(hasModel(url)).toBe(true);
         const b = await bounds(url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
         expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 2);
         expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(0, 2);
      }
      expect(ASSETS.branch.url).toBe("/models/3d/bee-garden/branchV2.glb");
      expect(hasModel("/models/3d/bee-garden/branch.glb")).toBe(false);
   });

   it("gameplay sizes: an 0.8 m bee centred on its flight point, a 0.85 m hive (under the bee) inside its solid box, blooms under the flight height", () => {
      const k = ASSETS.bee.scale!;
      expect(GLB_SIZE.bee.width * k).toBeCloseTo(FIT.beeSpan, 6);
      expect(ASSETS.bee.yOffset! + (GLB_SIZE.bee.height * k) / 2).toBeCloseTo(0, 6);
      // the drawn bee (its body; the wings are thin) fits the 0.3 m collision radius within its span
      expect((GLB_SIZE.bee.depth * k) / 2).toBeLessThan(TUNING.beeRadius + 0.05);
      expect(GLB_SIZE.beehive.height * ASSETS.beehive.scale!).toBeCloseTo(FIT.hiveHeight, 6);
      expect(FIT.hiveHeight).toBeLessThan(TUNING.altitude + ASSETS.bee.yOffset!);
      expect((Math.max(GLB_SIZE.beehive.width, GLB_SIZE.beehive.depth) * ASSETS.beehive.scale!) / 2).toBeLessThanOrEqual(TUNING.hiveSolid);
      for (const f of ["flowerA", "flowerB", "flowerC"] as const) {
         expect(GLB_SIZE[f].height * ASSETS[f].scale!).toBeCloseTo(FIT.flowerHeight, 6);
         expect(FIT.flowerHeight).toBeLessThan(TUNING.altitude);
         // the bloom fits inside the pickup reach, so the bee touches the flower it drinks from
         expect((Math.max(GLB_SIZE[f].width, GLB_SIZE[f].depth) * ASSETS[f].scale!) / 2).toBeLessThan(TUNING.flowerReach + TUNING.beeRadius);
      }
      expect(GLB_SIZE.nectarOrb.height * ASSETS.nectarOrb.scale!).toBeCloseTo(FIT.orbSize, 6);
      // the orb sits at the flight height
      expect(FIT.orbY + FIT.orbSize / 2).toBeCloseTo(TUNING.altitude, 1);
   });

   it("hazards match their circles: the upright branch over the flight height, the web across it", () => {
      const k = ASSETS.branch.scale!;
      expect(GLB_SIZE.branchV2.width * k).toBeCloseTo(FIT.branchLength, 6);
      expect(FIT.branchLength).toBeGreaterThan(TUNING.altitude + 0.3);
      // stood up, its leafy spread is the solid circle's diameter within 10 %
      expect(GLB_SIZE.branchV2.height * k).toBeGreaterThan(2 * TUNING.branchRadius * 0.9);
      expect(GLB_SIZE.branchV2.height * k).toBeLessThan(2 * TUNING.branchRadius * 1.1);
      // standing on the floor, centred: lifted half its length, moved back half its spread
      expect(BRANCH_UPRIGHT.position[1]).toBeCloseTo(FIT.branchLength / 2, 6);
      expect(BRANCH_UPRIGHT.position[0]).toBeCloseTo((GLB_SIZE.branchV2.height * k) / 2, 6);
      const w = ASSETS.spiderWeb.scale!;
      expect(GLB_SIZE.spiderWeb.width * w).toBeCloseTo(2 * TUNING.webRadius + 0.1, 6);
      expect(ASSETS.spiderWeb.yOffset!).toBeLessThan(TUNING.altitude);
      expect(ASSETS.spiderWeb.yOffset! + GLB_SIZE.spiderWeb.height * w).toBeGreaterThan(TUNING.altitude + 0.3);
   });

   it("decor GLBs are fitted to 1 m, so a decor spot's scale is its size (never scaled twice)", () => {
      expect(GLB_SIZE.bigLeaf.height * ASSETS.bigLeaf.scale!).toBeCloseTo(1, 6);
      expect(GLB_SIZE.vegetablePlanter.width * ASSETS.planter.scale!).toBeCloseTo(1, 6);
      expect(GLB_SIZE.wateringCan.height * ASSETS.wateringCan.scale!).toBeCloseTo(1, 6);
      expect(GLB_SIZE.gardenMushroom.height * ASSETS.mushroom.scale!).toBeCloseTo(1, 6);
      expect(EXPANSION_GLB_SIZE.leafyTree.height * ASSETS.leafyTree.scale!).toBeCloseTo(1, 6);
      for (const a of [ASSETS.bigLeaf, ASSETS.planter, ASSETS.wateringCan, ASSETS.mushroom, ASSETS.leafyTree] as ModelAsset[]) expect(a.stretch).toBeUndefined();
   });
});

describe("bee-garden decor spots", () => {
   const heightOf = { leaves: 1, mushrooms: 1, planters: GLB_SIZE.vegetablePlanter.height / GLB_SIZE.vegetablePlanter.width, cans: 1, trees: 1 } as const;
   for (const id of LEVEL_IDS) {
      it(`L${id}: outside the fly rectangle, short on the camera side, trees only from L4 and never south`, () => {
         const hx = LEVELS[id].width / 2;
         const hz = LEVELS[id].depth / 2;
         const d = decorSpots(id);
         expect(JSON.stringify(decorSpots(id))).toBe(JSON.stringify(d));
         for (const [kind, spots] of Object.entries(d) as [keyof typeof heightOf, typeof d.leaves][]) {
            for (const s of spots) {
               // the kerb is at the edge; nothing stands inside the garden
               expect(Math.abs(s.x) > hx + 0.3 || Math.abs(s.z) > hz + 0.3).toBe(true);
               const h = (s.scale ?? 1) * heightOf[kind];
               if (s.z > hz) expect(h).toBeLessThanOrEqual(SOUTH_DECOR_MAX_H);
               expect(s.sx ?? s.sy ?? s.sz).toBeUndefined();
            }
         }
         expect(d.trees.length > 0).toBe(id >= 4);
         for (const t of d.trees) expect(t.z).toBeLessThan(hz - 3);
      });
   }
});
