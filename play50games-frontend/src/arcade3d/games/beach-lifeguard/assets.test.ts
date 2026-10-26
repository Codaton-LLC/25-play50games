// Fits of the ready Hyper3D GLBs on the real meshes (public/models/3d/beach-lifeguard), and the manifest.
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { PROP_HALF, TOWER } from "./rules";

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

const OWN = ["lifeguard", "swimmer", "tower", "rescueFloat", "jetSki", "chair", "cooler", "sandcastle", "hut"] as const;

describe("beach-lifeguard GLBs", () => {
   it("every model of the game is in the manifest (and so is fetched)", () => {
      for (const asset of Object.values(ASSETS) as ModelAsset[]) expect(hasModel(asset.url)).toBe(true);
   });

   it("the recorded raw bounds are the real meshes', pivots on the floor", async () => {
      for (const key of OWN) {
         const asset = ASSETS[key];
         const id = asset.id as keyof typeof GLB_SIZE;
         const b = await bounds(asset.url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
      }
   });

   it("draws each at its size in metres", () => {
      expect(GLB_SIZE.charLifeguard.height * ASSETS.lifeguard.scale).toBeCloseTo(FIT.lifeguard, 6);
      expect(GLB_SIZE.beachgoerNpc.height * ASSETS.swimmer.scale).toBeCloseTo(FIT.swimmer, 6);
      expect(GLB_SIZE.lifeguardTower.height * ASSETS.tower.scale).toBeCloseTo(FIT.tower, 6);
      expect(GLB_SIZE.rescueFloat.depth * ASSETS.rescueFloat.scale).toBeCloseTo(FIT.float, 6);
      expect(GLB_SIZE.rescueJetSki.depth * ASSETS.jetSki.scale).toBeCloseTo(FIT.jetSki, 6);
      expect(GLB_SIZE.umbrella.height * ASSETS.umbrella.scale).toBeCloseTo(FIT.umbrellaHeight, 6);
   });

   it("the solid footprints cover the drawn tower and props (quarter turns only)", () => {
      const k = ASSETS.tower.scale;
      expect(TOWER.halfX * 2).toBeGreaterThanOrEqual(GLB_SIZE.lifeguardTower.width * k - 1e-9);
      expect(TOWER.halfZ * 2).toBeGreaterThanOrEqual(GLB_SIZE.lifeguardTower.depth * k - 0.02);
      const covers = (kind: keyof typeof PROP_HALF, w: number, d: number) => {
         expect(PROP_HALF[kind].x * 2).toBeGreaterThanOrEqual(w - 0.05);
         expect(PROP_HALF[kind].z * 2).toBeGreaterThanOrEqual(d - 0.05);
      };
      covers("chair", GLB_SIZE.beachChair.width * ASSETS.chair.scale, GLB_SIZE.beachChair.depth * ASSETS.chair.scale);
      covers("cooler", GLB_SIZE.beachCooler.width * ASSETS.cooler.scale, GLB_SIZE.beachCooler.depth * ASSETS.cooler.scale);
      covers("sandcastle", GLB_SIZE.sandcastle.width * ASSETS.sandcastle.scale, GLB_SIZE.sandcastle.depth * ASSETS.sandcastle.scale);
   });

   it("decor is fitted to 1 m tall, so the spot's scale alone sets the size", () => {
      expect(GLB_SIZE.beachHut.height * ASSETS.hut.scale).toBeCloseTo(1, 9);
      expect(REUSED_GLB_SIZE.palm.height * ASSETS.palm.scale).toBeCloseTo(1, 9);
   });
});
