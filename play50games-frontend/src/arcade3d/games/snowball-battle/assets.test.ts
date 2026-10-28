import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { EXPANSION_CHARACTER_HEIGHT, EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import {
   ASSETS, SNOW_FORT_DRAWN, SNOW_FORT_GLB, SNOW_FORT_SCALE, SNOW_FORT_SPOTS, SNOW_FORT_WIDTH, IGLOO_DRAWN, IGLOO_GLB, IGLOO_SCALE, IGLOO_SPOTS, IGLOO_WIDTH, KID_SCALE, PINE_HEIGHT,
   SNOWMAN_BIG_DRAWN, SNOWMAN_BIG_GLB, SNOWMAN_BIG_HEIGHT, SNOWMAN_BIG_SCALE, SNOWMAN_BIG_SPOTS,
   SNOWMAN_GLB, SNOWMAN_HEIGHT, SNOWMAN_RADIUS, SNOWMAN_SCALE, SNOWMAN_STRETCH_XZ, VILLAGE_LEVEL_IDS,
} from "./assets";
import { YARD } from "./rules";

interface Glb {
   accessors: Array<{ min: number[]; max: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
   nodes: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
   scenes: Array<{ nodes: number[] }>; scene?: number;
}

function bounds(url: string): Box3 {
   const bytes = readFileSync(resolve("public", url.slice(1)));
   expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
   const glb: Glb = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
   const result = new Box3();
   function visit(index: number, parent: Matrix4) {
      const node = glb.nodes[index];
      const local = node.matrix
         ? new Matrix4().fromArray(node.matrix)
         : new Matrix4().compose(
            new Vector3().fromArray(node.translation ?? [0, 0, 0]),
            new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
            new Vector3().fromArray(node.scale ?? [1, 1, 1]),
         );
      const world = new Matrix4().multiplyMatrices(parent, local);
      if (node.mesh !== undefined) for (const primitive of glb.meshes[node.mesh].primitives) {
         const accessor = glb.accessors[primitive.attributes.POSITION];
         result.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world));
      }
      for (const child of node.children ?? []) visit(child, world);
   }
   for (const node of glb.scenes[glb.scene ?? 0].nodes) visit(node, new Matrix4());
   return result;
}

describe("snowball-battle model fits", () => {
   it("lists every asset url in the manifest with its GLB on disk", () => {
      for (const asset of Object.values(ASSETS)) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
      }
   });

   it("draws the snow kid at 1.30 m", () => {
      const box = bounds(ASSETS.kid.url);
      expect(box.getSize(new Vector3()).y * KID_SCALE).toBeCloseTo(EXPANSION_CHARACTER_HEIGHT.snowKid, 2);
      expect(EXPANSION_CHARACTER_HEIGHT.snowKid).toBe(1.3);
   });

   it("draws a pine at 4 m before the per-spot scale", () => {
      const box = bounds(ASSETS.pine.url);
      expect(box.getSize(new Vector3()).y).toBeCloseTo(EXPANSION_GLB_SIZE.pineTree.height, 3);
      expect(PINE_HEIGHT).toBeCloseTo(4, 3);
   });

   it("fits the snowman to 1.60 m tall and a 0.70 m base", () => {
      const box = bounds(ASSETS.snowman.url);
      const size = box.getSize(new Vector3());
      const radius = Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z);
      expect(size.y).toBeCloseTo(SNOWMAN_GLB.height, 2);
      expect(radius).toBeCloseTo(SNOWMAN_GLB.halfWidth, 2);
      expect(size.y * SNOWMAN_SCALE).toBeCloseTo(SNOWMAN_HEIGHT, 2);
      expect(radius * SNOWMAN_SCALE * SNOWMAN_STRETCH_XZ).toBeCloseTo(SNOWMAN_RADIUS, 2);
      expect(box.min.y).toBeCloseTo(0, 2);
   });

   it("draws the igloo 2.6 m across, sitting on the snow", () => {
      const box = bounds(ASSETS.igloo.url);
      const size = box.getSize(new Vector3());
      expect(size.x).toBeCloseTo(IGLOO_GLB.width, 3);
      expect(size.y).toBeCloseTo(IGLOO_GLB.height, 3);
      expect(size.z).toBeCloseTo(IGLOO_GLB.depth, 3);
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(size.x * IGLOO_SCALE).toBeCloseTo(IGLOO_WIDTH, 3);
      expect(IGLOO_DRAWN.height).toBeCloseTo(1.46, 2);
   });

   it("draws the big snowman 2.2 m tall, topping the yard's own snowman", () => {
      const box = bounds(ASSETS.snowmanBig.url);
      const size = box.getSize(new Vector3());
      expect(size.y).toBeCloseTo(SNOWMAN_BIG_GLB.height, 3);
      expect(size.x).toBeCloseTo(SNOWMAN_BIG_GLB.width, 3);
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(size.y * SNOWMAN_BIG_SCALE).toBeCloseTo(SNOWMAN_BIG_HEIGHT, 3);
      expect(SNOWMAN_BIG_HEIGHT).toBeGreaterThan(SNOWMAN_HEIGHT);
   });

   it("places every village decor spot outside the play area", () => {
      expect(VILLAGE_LEVEL_IDS).toEqual([4, 5]);
      const iglooR = Math.max(IGLOO_DRAWN.width, IGLOO_DRAWN.depth) / 2;
      for (const spot of IGLOO_SPOTS) {
         expect(Math.abs(spot.x) + iglooR).toBeLessThan(YARD.maxX);
         expect(spot.z + iglooR).toBeLessThan(YARD.minZ);
      }
      const snowmanR = Math.max(SNOWMAN_BIG_DRAWN.width, SNOWMAN_BIG_DRAWN.depth) / 2;
      for (const spot of SNOWMAN_BIG_SPOTS) {
         expect(Math.abs(spot.x) + snowmanR).toBeLessThan(YARD.maxX);
         expect(spot.z + snowmanR).toBeLessThan(YARD.minZ);
      }
   });

describe("snowball-battle side forts (Menu 1 adoption)", () => {
   it("draws the fort 3.2 m long on the snow and keeps every spot beyond the yard's fences", () => {
      expect(hasModel(ASSETS.snowFort.url)).toBe(true);
      expect(existsSync(resolve("public", ASSETS.snowFort.url.slice(1)))).toBe(true);
      const box = bounds(ASSETS.snowFort.url);
      const size = box.getSize(new Vector3());
      expect(size.x).toBeCloseTo(SNOW_FORT_GLB.width, 3);
      expect(size.y).toBeCloseTo(SNOW_FORT_GLB.height, 3);
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(size.x * SNOW_FORT_SCALE).toBeCloseTo(SNOW_FORT_WIDTH, 3);
      expect(SNOW_FORT_DRAWN.height).toBeLessThan(SNOWMAN_HEIGHT / 2);
      const reach = Math.hypot(SNOW_FORT_DRAWN.width, SNOW_FORT_DRAWN.depth) / 2;
      for (const spot of SNOW_FORT_SPOTS) expect(Math.abs(spot.x) - reach, `${spot.x},${spot.z}`).toBeGreaterThan(YARD.maxX - 1.5);
      // turned a quarter turn, the footprint's x extent is the depth
      for (const spot of SNOW_FORT_SPOTS) expect(Math.abs(spot.x) - SNOW_FORT_DRAWN.width / 2).toBeGreaterThan(YARD.maxX);
   });
});
});
