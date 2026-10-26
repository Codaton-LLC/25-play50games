// The real GLBs behind assets.ts, meshopt-decoded without a loader (core/rig/robotGlb, as
// delivery-drone/assets.test.ts): the committed sizes are the measured bounds, every fit lands on its
// target in metres, the liquid disc sits inside the measured rolled rim, and the monster's head anchor
// is on the head through its profile. The slimeCake decor GLB (levels 4 and 5) is in the manifest,
// its file exists, its fit lands on the measured bounds and its spots stay outside the play bounds.
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import {
   APPLE_GLB_LONGEST,
   ASSETS,
   BANANA_GLB_LONGEST,
   BURGER_GLB_LONGEST,
   CAULDRON_SCALE,
   CHEF_GLB_HEIGHT,
   INGREDIENT_LONGEST,
   LIQUID_R,
   LIQUID_Y,
   MONSTER_HEAD_ANCHOR_GLB,
   SLIME_CAKE_DIAMETER,
   SLIME_CAKE_GLB,
   SLIME_CAKE_SCALE,
   SOCK_GLB_LONGEST,
   STOVE_TOP,
   TIN_CAN_GLB_LONGEST,
} from "./assets";
import { PLAY_BOUNDS, SLIME_CAKE_SPOTS, inPlayArea } from "./looks";

/** Decode the real meshopt vertices in root space, without textures, fetch or a DOM. */
async function bounds(url: string): Promise<Box3> {
   const { cloud, positionType } = await readCharacterGlb(url);
   expect(positionType).toBe(5126);
   const box = new Box3();
   const point = new Vector3();
   for (let i = 0; i < cloud.length; i += 3) {
      point.fromArray(cloud, i);
      expect(Number.isFinite(point.x + point.y + point.z), url).toBe(true);
      box.expandByPoint(point);
   }
   return box;
}

const longest = (b: Box3) => {
   const s = b.getSize(new Vector3());
   return Math.max(s.x, s.y, s.z);
};

describe("monster-kitchen real GLB fits (assets.ts)", () => {
   it("fits the six reused/shared ingredients to INGREDIENT_LONGEST (0.36 m) on their committed measured sizes", async () => {
      for (const [asset, glbLongest, name] of [
         [ASSETS.apple, APPLE_GLB_LONGEST, "apple"],
         [ASSETS.burger, BURGER_GLB_LONGEST, "burger"],
         [ASSETS.sock, SOCK_GLB_LONGEST, "sock"],
         [ASSETS.banana, BANANA_GLB_LONGEST, "banana"],
         [ASSETS.tinCan, TIN_CAN_GLB_LONGEST, "tinCan"],
      ] as const) {
         const size = longest(await bounds(asset.url));
         expect(size, name).toBeCloseTo(glbLongest, 2);
         expect(size * (asset.scale ?? 1), name).toBeCloseTo(INGREDIENT_LONGEST, 2);
      }
      // the fish is an expansion asset with the manifest's default fit: 0.35 m long (z)
      const fish = (await bounds(ASSETS.fish.url)).getSize(new Vector3());
      expect(fish.z * (ASSETS.fish.scale ?? 1)).toBeCloseTo(0.35, 2);
   });

   it("fits the chef to the measured 1.82 m (the GLB's longest side is the arm span, not the height)", async () => {
      const b = await bounds(ASSETS.chef.url);
      const s = b.getSize(new Vector3());
      expect(s.y).toBeCloseTo(CHEF_GLB_HEIGHT, 2);
      expect(2 * Math.max(-b.min.x, b.max.x)).toBeGreaterThan(s.y);
      expect(s.y * (ASSETS.chef.scale ?? 1)).toBeCloseTo(1.82, 2);
   });

   it("fits the monster 1.4 m tall, the cauldron 0.9 m wide and the mushroom 0.5 m tall", async () => {
      const monster = (await bounds(ASSETS.monster.url)).getSize(new Vector3());
      expect(monster.y * (ASSETS.monster.scale ?? 1)).toBeCloseTo(1.4, 2);
      const cauldron = (await bounds(ASSETS.cauldron.url)).getSize(new Vector3());
      expect(cauldron.x * CAULDRON_SCALE).toBeCloseTo(0.9, 2);
      const mushroom = (await bounds(ASSETS.mushroom.url)).getSize(new Vector3());
      expect(mushroom.y * (ASSETS.mushroom.scale ?? 1)).toBeCloseTo(0.5, 2);
   });

   it("keeps the liquid disc inside the measured rolled rim, just under its inner edge", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.cauldron.url);
      // the rim band, GLB units (scratch measurement 2026-10-09: r 0.734..0.855 at y 1.19..1.29)
      let rMin = Infinity;
      let rMax = 0;
      for (let i = 0; i < cloud.length / 3; i++) {
         const y = cloud[i * 3 + 1];
         if (y < 1.19 || y >= 1.29) continue;
         const r = Math.hypot(cloud[i * 3], cloud[i * 3 + 2]);
         rMin = Math.min(rMin, r);
         rMax = Math.max(rMax, r);
      }
      expect(rMax).toBeGreaterThan(0.8);
      expect(LIQUID_R).toBeLessThan(rMax * CAULDRON_SCALE);
      expect(LIQUID_R).toBeGreaterThan(rMin * CAULDRON_SCALE - 0.05);
      // the disc's surface sits below the rolled rim (the inner edge maps to ≈ 1.484 m), above the inner floor
      expect(LIQUID_Y).toBeLessThan(STOVE_TOP + 1.235 * CAULDRON_SCALE - 0.02);
      expect(LIQUID_Y).toBeGreaterThan(STOVE_TOP + 0.263 * CAULDRON_SCALE);
      expect(STOVE_TOP + 1.235 * CAULDRON_SCALE - LIQUID_Y).toBeCloseTo(0.03, 6);
   });

   it("keeps the monster's head anchor on the head (the cap right above the eyes)", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.monster.url);
      // the head band at the anchor's height: every vertex within 8 cm of the anchor radially
      const a = MONSTER_HEAD_ANCHOR_GLB;
      let count = 0;
      for (let i = 0; i < cloud.length / 3; i++) {
         const y = cloud[i * 3 + 1];
         if (y < a.y - 0.05 || y > a.y + 0.05) continue;
         count++;
         expect(Math.hypot(cloud[i * 3] - a.x, cloud[i * 3 + 2] - a.z)).toBeLessThan(0.4);
      }
      expect(count).toBeGreaterThan(50);
      // ...and the anchor is near the head's top, not inside the body
      let top = 0;
      for (let i = 1; i < cloud.length; i += 3) top = Math.max(top, cloud[i]);
      expect(top - a.y).toBeGreaterThan(0.05);
      expect(top - a.y).toBeLessThan(0.25);
   });
});

describe("slimeCake decor GLB (drawn only on levels 4 and 5)", () => {
   it("is in the manifest and the file exists", () => {
      expect(hasModel(ASSETS.slimeCake.url)).toBe(true);
      expect(ASSETS.slimeCake.url).toBe("/models/3d/monster-kitchen/slimeCake.glb");
      expect(existsSync(resolve("public", ASSETS.slimeCake.url.slice(1)))).toBe(true);
   });

   it("measures the committed GLB bounds and draws the cake 0.6 m across on the floor", async () => {
      const b = await bounds(ASSETS.slimeCake.url);
      const s = b.getSize(new Vector3());
      expect(b.min.y).toBeCloseTo(0, 2);
      expect(s.x).toBeCloseTo(SLIME_CAKE_GLB.width, 2);
      expect(s.y).toBeCloseTo(SLIME_CAKE_GLB.height, 2);
      expect(s.z).toBeCloseTo(SLIME_CAKE_GLB.depth, 2);
      const scale = ASSETS.slimeCake.scale ?? 1;
      expect(scale).toBeCloseTo(SLIME_CAKE_SCALE, 6);
      expect(s.z * scale).toBeCloseTo(SLIME_CAKE_DIAMETER, 2);
      // a round cake: the width lands on the same diameter, the height just under it
      expect(s.x * scale).toBeCloseTo(SLIME_CAKE_DIAMETER, 2);
      expect(s.y * scale).toBeLessThan(SLIME_CAKE_DIAMETER);
      // feet (GLB y 0) on the ground: no lift
      expect(ASSETS.slimeCake.yOffset ?? 0).toBe(0);
      expect(b.min.y * scale + (ASSETS.slimeCake.yOffset ?? 0)).toBeCloseTo(0, 2);
   });

   it("places every slime-cake spot outside the play bounds", () => {
      const r = SLIME_CAKE_DIAMETER / 2;
      for (const spot of SLIME_CAKE_SPOTS) {
         expect(inPlayArea(spot.x, spot.z), `spot ${spot.x},${spot.z}`).toBe(false);
         // the whole footprint clears the bounds, not just the centre
         const clear =
            spot.x + r < PLAY_BOUNDS.xMin ||
            spot.x - r > PLAY_BOUNDS.xMax ||
            spot.z + r < PLAY_BOUNDS.zMin ||
            spot.z - r > PLAY_BOUNDS.zMax;
         expect(clear, `spot ${spot.x},${spot.z}`).toBe(true);
      }
   });
});
