import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { assetScale } from "@/arcade3d/core/assets";
import { REUSED_GLB_SIZE, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, COUNTER_TOP_GLB, FIT, GLB_SIZE } from "./assets";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) {
      const a = i % 3;
      min[a] = Math.min(min[a], cloud[i]);
      max[a] = Math.max(max[a], cloud[i]);
   }
   return { min, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}

const LOCAL = ["pizzaBase", "sauceBowl", "cheeseBowl", "mushroomBowlR", "oliveBowl", "pepperoni", "tomato", "onion", "pizzaOven", "pizzaPeelClean", "prepCounterR", "pizzaBoxClosed"] as const;

describe("pizza-kitchen-3d models (real GLBs)", () => {
   it("every GLB is listed, measured as recorded, and stands on its floor pivot", async () => {
      for (const id of LOCAL) {
         const url = `/models/3d/pizza-kitchen-3d/${id}.glb`;
         expect(hasModel(url)).toBe(true);
         const b = await bounds(url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
      }
   });

   it("draws each prop at its size in metres", () => {
      const size = (a: { scale?: number; stretch?: readonly [number, number, number] }, g: { width: number; height: number; depth: number }) => {
         const [sx, sy, sz] = assetScale(a as never);
         return { w: g.width * sx, h: g.height * sy, d: g.depth * sz };
      };
      expect(Math.max(size(ASSETS.pizzaBase, GLB_SIZE.pizzaBase).w, size(ASSETS.pizzaBase, GLB_SIZE.pizzaBase).d)).toBeCloseTo(FIT.base, 3);
      for (const [a, g] of [[ASSETS.sauceBowl, GLB_SIZE.sauceBowl], [ASSETS.cheeseBowl, GLB_SIZE.cheeseBowl], [ASSETS.mushroom, GLB_SIZE.mushroomBowlR], [ASSETS.olive, GLB_SIZE.oliveBowl]] as const) {
         const s = size(a, g);
         expect(Math.max(s.w, s.d)).toBeCloseTo(FIT.bowl, 3);
         expect(s.h).toBeLessThan(0.3);
      }
      expect(Math.max(size(ASSETS.oven, GLB_SIZE.pizzaOven).w, size(ASSETS.oven, GLB_SIZE.pizzaOven).d)).toBeCloseTo(FIT.ovenWidth, 3);
      expect(size(ASSETS.oven, GLB_SIZE.pizzaOven).h).toBeLessThan(1.4);
      // the counter's worktop at 0.95 m, counters meeting edge to edge 1.6 m apart
      const c = size(ASSETS.counter, GLB_SIZE.prepCounterR);
      expect(COUNTER_TOP_GLB * assetScale(ASSETS.counter)[1]).toBeCloseTo(FIT.counterTop, 6);
      expect(c.w).toBeCloseTo(FIT.counterWidth, 6);
      expect(c.d).toBeLessThan(1.0);
      expect(Math.max(size(ASSETS.peel, GLB_SIZE.pizzaPeelClean).w, size(ASSETS.peel, GLB_SIZE.pizzaPeelClean).d)).toBeCloseTo(FIT.peel, 3);
      expect(Math.max(size(ASSETS.box, GLB_SIZE.pizzaBoxClosed).w, size(ASSETS.box, GLB_SIZE.pizzaBoxClosed).d)).toBeCloseTo(FIT.box, 3);
      expect(Math.max(size(ASSETS.pepperoni, GLB_SIZE.pepperoni).w, size(ASSETS.pepperoni, GLB_SIZE.pepperoni).d)).toBeCloseTo(FIT.pepperoni, 3);
      expect(Math.max(size(ASSETS.pepperoniPile, GLB_SIZE.pepperoni).w, size(ASSETS.pepperoniPile, GLB_SIZE.pepperoni).d)).toBeCloseTo(FIT.pile, 3);
      expect(REUSED_GLB_SIZE.bin.height * (ASSETS.bin.scale ?? 1)).toBeCloseTo(FIT.bin, 6);
      expect(SHARED_GLB_SIZE.crate.width * (ASSETS.crate.scale ?? 1)).toBeCloseTo(FIT.crate, 6);
      // crate plus two boxes: a counter-high stack (about 0.9 m)
      const stack = SHARED_GLB_SIZE.crate.height * ASSETS.crate.scale! + 2 * GLB_SIZE.pizzaBoxClosed.height * ASSETS.box.scale!;
      expect(stack).toBeGreaterThan(0.75);
      expect(stack).toBeLessThan(1.0);
   });

   it("the worktop height is where the counter's dense band ends", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.counter.url);
      let below = 0;
      let above = 0;
      for (let i = 1; i < cloud.length; i += 3) {
         if (cloud[i] > COUNTER_TOP_GLB - 0.15 && cloud[i] <= COUNTER_TOP_GLB) below++;
         if (cloud[i] > COUNTER_TOP_GLB && cloud[i] <= COUNTER_TOP_GLB + 0.15) above++;
      }
      expect(below).toBeGreaterThan(4 * above);
   });

   it("the chef is the shared food-catcher chef at 1.82 m through the auto-rig", async () => {
      const b = await bounds(ASSETS.chef.url);
      expect(b.height * ASSETS.chef.scale!).toBeCloseTo(1.82, 1);
      expect(ASSETS.chef.humanoid?.landmarks).toBeDefined();
   });
});
