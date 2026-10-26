import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BAKERY_DRAWN, BAKERY_HEIGHT, BAKERY_SPOTS, PRODUCT_KINDS, RUNNER_SCALE, SCRUBBER_DRAWN, SCRUBBER_GLB, SCRUBBER_HEIGHT, SCRUBBER_SPOTS, SHELF_BAY, SHELF_BAYS, SHELF_GLB } from "./assets";
import { PLAY_BOUNDS } from "./looks";
import { SHELVES } from "./rules";

async function fitted(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return box;
}

describe("shopping-cart model assets", () => {
   it("all models used by the game exist in the model manifest", () => {
      for (const [name, asset] of Object.entries(ASSETS)) {
         expect(hasModel(asset.url), `${name}: ${asset.url}`).toBe(true);
      }
   });

   it("has valid scale configuration for pusher runner", () => {
      expect(RUNNER_SCALE).toBeCloseTo(0.825, 3);
      expect(ASSETS.pusher.scale).toBe(RUNNER_SCALE);
      expect(ASSETS.pusher.humanoid).toBeDefined();
   });

   it("contains all 10 product kinds with valid model URLs", () => {
      expect(PRODUCT_KINDS).toHaveLength(10);
      for (const kind of PRODUCT_KINDS) {
         expect(ASSETS[kind]).toBeDefined();
         expect(typeof ASSETS[kind].url).toBe("string");
         expect(ASSETS[kind].url.length).toBeGreaterThan(0);
         expect(hasModel(ASSETS[kind].url)).toBe(true);
      }
   });

   it("defines all shopper NPC characters and cart", () => {
      expect(hasModel(ASSETS.cart.url)).toBe(true);
      expect(hasModel(ASSETS.shopperA.url)).toBe(true);
      expect(hasModel(ASSETS.shopperB.url)).toBe(true);
      expect(hasModel(ASSETS.shopperC.url)).toBe(true);
   });
});

describe("shopping-cart adopted shelves and bakery stalls", () => {
   it("keeps the shelf GLB on disk, in the manifest, and fitted inside each aisle box", async () => {
      expect(existsSync(resolve("public", ASSETS.shelf.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.shelf.url)).toBe(true);
      const box = await fitted(ASSETS.shelf);
      expect(box.min.y).toBeCloseTo(0, 2);
      expect(box.max.x - box.min.x).toBeCloseTo(SHELF_BAY.width, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(SHELF_BAY.height, 2);
      expect(box.max.z - box.min.z).toBeCloseTo(SHELF_BAY.depth, 2);
      const raw = await fitted({ ...ASSETS.shelf, scale: 1, stretch: undefined });
      expect(raw.max.x - raw.min.x).toBeCloseTo(SHELF_GLB.width, 2);
      expect(raw.max.y - raw.min.y).toBeCloseTo(SHELF_GLB.height, 2);
      expect(raw.max.z - raw.min.z).toBeCloseTo(SHELF_GLB.depth, 2);
      expect(SHELF_BAYS).toHaveLength(24);
      for (const bay of SHELF_BAYS) {
         const shelf = SHELVES.find((s) => bay.x > s.min.x && bay.x < s.max.x);
         expect(shelf, `bay x ${bay.x}`).toBeDefined();
         expect(bay.x - SHELF_BAY.width / 2).toBeGreaterThanOrEqual(shelf!.min.x - 1e-6);
         expect(bay.x + SHELF_BAY.width / 2).toBeLessThanOrEqual(shelf!.max.x + 1e-6);
         expect(bay.z - SHELF_BAY.depth / 2).toBeGreaterThanOrEqual(shelf!.min.z - 1e-6);
         expect(bay.z + SHELF_BAY.depth / 2).toBeLessThanOrEqual(shelf!.max.z + 1e-6);
         expect(SHELF_BAY.height).toBeLessThanOrEqual(shelf!.max.y);
      }
   });

   it("stands the bakery stalls north of the play box", async () => {
      expect(existsSync(resolve("public", ASSETS.bakery.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.bakery.url)).toBe(true);
      const box = await fitted(ASSETS.bakery);
      expect(box.min.y).toBeCloseTo(0, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(BAKERY_HEIGHT, 2);
      expect(box.max.x - box.min.x).toBeCloseTo(BAKERY_DRAWN.width, 2);
      expect(box.max.z - box.min.z).toBeCloseTo(BAKERY_DRAWN.depth, 2);
      const reach = Math.hypot(BAKERY_DRAWN.width, BAKERY_DRAWN.depth) / 2;
      for (const spot of BAKERY_SPOTS) {
         const outside = spot.x - reach > PLAY_BOUNDS.x1 || spot.x + reach < PLAY_BOUNDS.x0 || spot.z + reach < PLAY_BOUNDS.z0 || spot.z - reach > PLAY_BOUNDS.z1;
         expect(outside, `${spot.x},${spot.z}`).toBe(true);
      }
   });
});

describe("shopping-cart level 4-5 floor scrubbers", () => {
   it("keeps the scrubber GLB on disk, in the manifest, and fitted to a real machine size", async () => {
      expect(existsSync(resolve("public", ASSETS.scrubber.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.scrubber.url)).toBe(true);
      const box = await fitted(ASSETS.scrubber);
      expect(box.min.y).toBeCloseTo(0, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(SCRUBBER_HEIGHT, 2);
      expect(box.max.x - box.min.x).toBeCloseTo(SCRUBBER_DRAWN.width, 2);
      expect(box.max.z - box.min.z).toBeCloseTo(SCRUBBER_DRAWN.depth, 2);
      const raw = await fitted({ ...ASSETS.scrubber, scale: 1 });
      expect(raw.max.x - raw.min.x).toBeCloseTo(SCRUBBER_GLB.width, 2);
      expect(raw.max.y - raw.min.y).toBeCloseTo(SCRUBBER_GLB.height, 2);
      expect(raw.max.z - raw.min.z).toBeCloseTo(SCRUBBER_GLB.depth, 2);
   });

   it("parks 2-4 scrubbers outside the play box", () => {
      expect(SCRUBBER_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(SCRUBBER_SPOTS.length).toBeLessThanOrEqual(4);
      const reach = Math.hypot(SCRUBBER_DRAWN.width, SCRUBBER_DRAWN.depth) / 2;
      for (const spot of SCRUBBER_SPOTS) {
         expect(spot.y).toBe(0);
         const outside = spot.x - reach > PLAY_BOUNDS.x1 || spot.x + reach < PLAY_BOUNDS.x0 || spot.z + reach < PLAY_BOUNDS.z0 || spot.z - reach > PLAY_BOUNDS.z1;
         expect(outside, `${spot.x},${spot.z}`).toBe(true);
      }
   });
});
