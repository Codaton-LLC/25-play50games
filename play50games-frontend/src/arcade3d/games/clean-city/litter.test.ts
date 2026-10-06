// Baked litter clones: ten strict-mode restarts must not keep geometries past unmount,
// and must not dispose the loader-cache mesh.
import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material } from "three";
import { bakedEffect } from "./baked";

function watch<T extends BufferGeometry | Material>(item: T, live: Set<T>): void {
   live.add(item);
   item.addEventListener("dispose", () => live.delete(item));
}

describe("clean-city litter clones", () => {
   it("returns the geometry and material counts to the baseline after 10 strict-mode restarts", () => {
      const cacheGeo = new BoxGeometry(1, 1, 1);
      const cacheMat = new MeshStandardMaterial({ color: "#94a3b8" });
      const cachePositions = cacheGeo.getAttribute("position").array.slice();
      const scene = new Group();
      scene.add(new Mesh(cacheGeo, cacheMat));
      const asset = { scale: 0.5, rotationY: 0.4, yOffset: 0.1 };

      const geos = new Set<BufferGeometry>();
      const mats = new Set<Material>();
      watch(cacheGeo, geos);
      watch(cacheMat, mats);
      const baseline = { geos: geos.size, mats: mats.size };

      let published: { geo: BufferGeometry; mat: Material }[] | null = null;
      const publish = (parts: { geo: BufferGeometry; mat: Material }[] | null) => {
         if (parts) {
            for (const part of parts) {
               watch(part.geo, geos);
               watch(part.mat, mats);
            }
         }
         published = parts;
      };

      for (let restart = 0; restart < 10; restart++) {
         // React strict mode: effect, cleanup, effect, then a real unmount
         let stop = bakedEffect(scene, asset, publish);
         stop();
         stop = bakedEffect(scene, asset, publish);
         expect(published).not.toBeNull();
         stop();
      }

      expect(published).toBeNull();
      expect(geos.size).toBe(baseline.geos);
      expect(mats.size).toBe(baseline.mats);
      expect(geos.has(cacheGeo)).toBe(true);
      expect(mats.has(cacheMat)).toBe(true);
      expect(Array.from(cacheGeo.getAttribute("position").array)).toEqual(Array.from(cachePositions));
   });
});
