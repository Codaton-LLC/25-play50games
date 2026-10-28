import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS, FESTIVAL_STALL_SPOTS } from "./assets";
import { DECOR_KEEP_OUT } from "./decorSpots";

async function stallBox(): Promise<Box3> {
   const { local, node } = await readCharacterGlb(ASSETS.festivalStall.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, ASSETS.festivalStall);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const vertex = new Vector3();
   for (let i = 0; i < local.length; i += 3) {
      box.expandByPoint(vertex.fromArray(local, i).applyMatrix4(parts[0].matrix));
   }
   geometry.dispose();
   return box;
}

describe("festival stall decor", () => {
   it("registers the existing GLB in the manifest", () => {
      expect(ASSETS.festivalStall.url).toBe("/models/3d/clean-city/festivalStall.glb");
      expect(hasModel(ASSETS.festivalStall.url)).toBe(true);
      expect(existsSync(resolve("public", ASSETS.festivalStall.url.slice(1)))).toBe(true);
   });

   it("fits the real mesh to a grounded stall beside the 0.95-unit cleaner", async () => {
      const box = await stallBox();
      const size = box.getSize(new Vector3());
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(size.x).toBeCloseTo(1.61, 2);
      expect(size.y).toBeCloseTo(1.512, 2);
      expect(size.z).toBeCloseTo(1.075, 2);
   });

   it("keeps all three complete footprints beyond the far play bounds", async () => {
      const box = await stallBox();
      expect(FESTIVAL_STALL_SPOTS).toHaveLength(3);
      for (const spot of FESTIVAL_STALL_SPOTS) {
         expect(spot.z + box.max.z).toBeLessThan(-DECOR_KEEP_OUT);
         // Far-side placement keeps tall decor behind the player and litter from the +z camera.
         expect(spot.z + box.max.z).toBeLessThan(-16);
      }
   });
});
