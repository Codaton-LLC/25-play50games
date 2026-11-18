// The models as Dragon Cave Rush draws them: listed in the manifest, on disk, within budget, GLB_SIZE
// equal to the real (meshopt-decoded) meshes, the fitted sizes, and the definition's levels.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, CART_BED, CART_SCALE, DRAGON_BOSS, DRAGON_CHASE, GLB_SIZE, TRACK_LEN, TRACK_SCALE } from "./assets";
import { dragonCaveRushMeta } from "./meta";
import definition from "./index";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

function bounds(cloud: Float32Array) {
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i += 3) {
      for (let k = 0; k < 3; k++) {
         min[k] = Math.min(min[k], cloud[i + k]);
         max[k] = Math.max(max[k], cloud[i + k]);
      }
   }
   return { min, max, size: max.map((v, k) => v - min[k]) };
}

describe("dragon-cave-rush models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      if (key === "hero") continue;
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.05);
      });
   }

   it("the fits: a 1.5 x 1.35 x 2.25 m cart, 2.4 m rail pieces, an 8 m dragon (13 m on the loop)", () => {
      expect(GLB_SIZE.cart.x * CART_SCALE.x).toBeCloseTo(1.5, 6);
      expect(GLB_SIZE.cart.y * CART_SCALE.y).toBeCloseTo(1.35, 6);
      expect(GLB_SIZE.cart.z * CART_SCALE.z).toBeCloseTo(2.25, 6);
      expect(CART_BED).toBeGreaterThan(0.35);
      expect(CART_BED).toBeLessThan(0.5);
      expect(GLB_SIZE.track.x * TRACK_SCALE).toBeCloseTo(TRACK_LEN, 6);
      expect(GLB_SIZE.dragon.z * DRAGON_CHASE).toBeCloseTo(8, 6);
      expect(GLB_SIZE.dragon.z * DRAGON_BOSS).toBeCloseTo(13, 6);
   });

   it("the definition: five levels, Menu 2 meta, Hop / Power buttons and canvas swipes", () => {
      expect(definitionLevelProblems(dragonCaveRushMeta, definition)).toEqual([]);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action", "swipe"]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(dragonCaveRushMeta.collection).toBe("rollheroes");
      expect(dragonCaveRushMeta.status).toBe("dev");
      expect(dragonCaveRushMeta.order).toBe(66);
   });
});
