import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS, KITCHEN_RANGE_SPOTS, kitchenRangeSpots } from "./assets";

async function ovenBox() {
   const { local, node } = await readCharacterGlb(ASSETS.kitchenRangeOven.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, ASSETS.kitchenRangeOven);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const point = new Vector3();
   for (let i = 0; i < local.length; i += 3) {
      box.expandByPoint(point.fromArray(local, i).applyMatrix4(parts[0].matrix));
   }
   geometry.dispose();
   return box;
}

describe("food-catcher kitchen range decor", () => {
   it("has an existing GLB registered in the manifest", () => {
      const url = ASSETS.kitchenRangeOven.url;
      expect(url).toBe("/models/3d/food-catcher/kitchenRangeOven.glb");
      expect(hasModel(url)).toBe(true);
      expect(existsSync(resolve("public", url.slice(1)))).toBe(true);
   });

   it("fits the real GLB to a grounded 1.2 m kitchen range", async () => {
      const box = await ovenBox();
      const size = box.getSize(new Vector3());
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(size.y).toBeCloseTo(1.2, 3);
      expect(size.x).toBeCloseTo(1.089, 3);
      expect(size.z).toBeCloseTo(0.607, 3);
   });

   it("keeps every oven silhouette outside the play bounds and counter", async () => {
      const box = await ovenBox();
      expect(KITCHEN_RANGE_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(KITCHEN_RANGE_SPOTS.length).toBeLessThanOrEqual(4);
      for (const spot of KITCHEN_RANGE_SPOTS) {
         const world = box.clone().translate(new Vector3(...spot));
         // PLAY spans x [-4.2, 4.2]; the counter extends farther, to +/-4.7.
         expect(world.max.x < -4.7 || world.min.x > 4.7).toBe(true);
         expect(world.min.y).toBeCloseTo(0, 3);
      }
   });

   it("shows the ovens only in Speed Kitchen and Master Catch", () => {
      for (const level of [1, 2, 3]) expect(kitchenRangeSpots(level)).toHaveLength(0);
      for (const level of [4, 5]) expect(kitchenRangeSpots(level)).toBe(KITCHEN_RANGE_SPOTS);
   });
});
