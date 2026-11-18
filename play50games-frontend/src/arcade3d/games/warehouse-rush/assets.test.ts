// Warehouse Rush's fits on the real, meshopt-decoded GLBs (through core modelParts, what
// <InstancedModel> draws): every model is in the manifest and its file exists; the adopted
// forkliftTruck GLB draws at its fitted size and every parked spot sits outside the play bounds.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, FORKLIFT_DRAWN, FORKLIFT_GLB, FORKLIFT_SPOTS, YARD, YARD_TOP } from "./assets";
import { ARENA } from "./rules";

async function drawnBox(asset: ModelAsset): Promise<Box3> {
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

const rawBox = (asset: ModelAsset) => drawnBox({ ...asset, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });

describe("warehouse-rush models", () => {
   it("are all in the manifest", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.forkliftTruck.url).toBe("/models/3d/warehouse-rush/forkliftTruck.glb");
   });

   it("has a GLB file on disk for every model", () => {
      for (const asset of Object.values(ASSETS)) expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
   });

   it("measures the forkliftTruck GLB and draws it at the fitted real size", async () => {
      const raw = await rawBox(ASSETS.forkliftTruck);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(FORKLIFT_GLB.width, 3);
      expect(raw.max.y - raw.min.y).toBeCloseTo(FORKLIFT_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(FORKLIFT_GLB.depth, 3);
      // drawn: 2.0 m tall (a real counterbalance forklift), the forks' length along x (asset rotationY)
      const drawn = await drawnBox(ASSETS.forkliftTruck);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(FORKLIFT_DRAWN.length, 2);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(FORKLIFT_DRAWN.height, 2);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(FORKLIFT_DRAWN.width, 2);
   });

   it("parks every forklift outside the play bounds, on the yard slab", () => {
      expect(FORKLIFT_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(FORKLIFT_SPOTS.length).toBeLessThanOrEqual(4);
      for (const spot of FORKLIFT_SPOTS) {
         // the footprint's half-extents once the spot's rotY is applied to the drawn length x width
         const r = spot.rotY ?? 0;
         const halfX = (FORKLIFT_DRAWN.length / 2) * Math.abs(Math.cos(r)) + (FORKLIFT_DRAWN.width / 2) * Math.abs(Math.sin(r));
         const halfZ = (FORKLIFT_DRAWN.length / 2) * Math.abs(Math.sin(r)) + (FORKLIFT_DRAWN.width / 2) * Math.abs(Math.cos(r));
         // clear of the arena (the play bounds, |x| ≤ 10, |z| ≤ 6): the whole footprint, not just the centre
         const clear =
            spot.x - halfX > ARENA.halfX ||
            spot.x + halfX < -ARENA.halfX ||
            spot.z - halfZ > ARENA.halfZ ||
            spot.z + halfZ < -ARENA.halfZ;
         expect(clear, `forklift at ${spot.x}, ${spot.z}`).toBe(true);
         // feet on the yard slab, and the whole footprint still on it
         expect(spot.y).toBeCloseTo(YARD_TOP, 6);
         expect(Math.abs(spot.x) + halfX).toBeLessThanOrEqual(YARD.halfX);
         expect(Math.abs(spot.z) + halfZ).toBeLessThanOrEqual(YARD.halfZ);
      }
   });
});
