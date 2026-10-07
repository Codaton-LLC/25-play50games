// Clean the City drawn sizes: the litter stand-ins (the fallbackParts of the four
// <DynamicInstancedModel> pools), the group C litter GLBs fitted to them, and the runner's scale.
// Collision never comes from these (rules.ts).
import { describe, expect, it } from "vitest";
import { Box3, Vector3, type BufferGeometry, type Material } from "three";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { createLitterStandIns, disposeLitterStandIns } from "./Primitives";
import { LITTER_KINDS } from "./rules";

function bounds(geometry: BufferGeometry): Box3 {
   geometry.computeBoundingBox();
   return (geometry.boundingBox as Box3).clone();
}

/** The real GLB's box as the pool draws it: scale x stretch per GLB axis (no rotationY here), yOffset. */
async function drawnBox(asset: ModelAsset): Promise<Box3> {
   expect(asset.rotationY ?? 0).toBe(0);
   const { cloud } = await readCharacterGlb(asset.url);
   const s = asset.scale ?? 1, k = asset.stretch ?? [1, 1, 1], y = asset.yOffset ?? 0;
   const box = new Box3(), p = new Vector3();
   for (let i = 0; i < cloud.length; i += 3) box.expandByPoint(p.set(cloud[i] * s * k[0], cloud[i + 1] * s * k[1] + y, cloud[i + 2] * s * k[2]));
   return box;
}

describe("clean-city litter stand-ins", () => {
   it("one part per litter kind, standing on y = 0 at about the drawn size", () => {
      const kinds = createLitterStandIns();
      expect(kinds).toHaveLength(LITTER_KINDS.length);
      for (const parts of kinds) {
         expect(parts).toHaveLength(1);
         const box = bounds(parts[0].geometry);
         expect(box.min.y).toBeCloseTo(0, 6);
         const longest = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
         expect(longest).toBeGreaterThan(0.6);
         expect(longest).toBeLessThanOrEqual(1);
      }
      disposeLitterStandIns(kinds);
   });

   it("every Scene mount builds its own set, and disposing it frees every geometry and material", () => {
      const live = new Set<BufferGeometry | Material>();
      const watch = (item: BufferGeometry | Material) => {
         live.add(item);
         item.addEventListener("dispose", () => live.delete(item));
      };
      const seen = new Set<BufferGeometry | Material>();
      for (let restart = 0; restart < 10; restart++) {
         const kinds = createLitterStandIns();
         for (const parts of kinds) {
            for (const part of parts) {
               expect(seen.has(part.geometry)).toBe(false);
               seen.add(part.geometry);
               watch(part.geometry);
               for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
                  expect(seen.has(material)).toBe(false);
                  seen.add(material);
                  watch(material);
               }
            }
         }
         expect(live.size).toBe(LITTER_KINDS.length * 2);
         disposeLitterStandIns(kinds);
         expect(live.size).toBe(0);
      }
   });
});

describe("clean-city litter GLBs (group C)", () => {
   it("the bottle and the bag are drawn at their stand-in's footprint and height (within 5 %), centred on y = 0", async () => {
      const kinds = createLitterStandIns();
      try {
         for (const [k, asset] of [[LITTER_KINDS.indexOf("bottle"), ASSETS.bottle], [LITTER_KINDS.indexOf("paperBag"), ASSETS.bag]] as const) {
            const want = bounds(kinds[k][0].geometry).getSize(new Vector3());
            const box = await drawnBox(asset);
            const size = box.getSize(new Vector3());
            for (const axis of ["x", "y", "z"] as const) {
               expect(Math.abs(size[axis] / want[axis] - 1), `${asset.id} ${axis}: ${size[axis]} vs ${want[axis]}`).toBeLessThan(0.05);
            }
            expect(box.min.y, asset.id).toBeCloseTo(0, 2);
            const centre = box.getCenter(new Vector3());
            expect(Math.abs(centre.x), asset.id).toBeLessThan(0.02);
            expect(Math.abs(centre.z), asset.id).toBeLessThan(0.02);
         }
      } finally {
         disposeLitterStandIns(kinds);
      }
   });
});

describe("clean-city runner", () => {
   it("is the shared runner (runner.glb, measured) drawn about 1 unit tall, near its 0.90 stand-in", async () => {
      expect(ASSETS.runner.url).toBe(SHARED_ASSETS.runner.url);
      expect(ASSETS.runner.humanoid).toEqual(SHARED_ASSETS.runner.humanoid);
      const { cloud } = await readCharacterGlb(ASSETS.runner.url);
      let top = 0;
      for (let i = 1; i < cloud.length; i += 3) top = Math.max(top, cloud[i]);
      const drawn = top * (ASSETS.runner.scale ?? 1);
      expect(drawn).toBeGreaterThanOrEqual(0.9);
      expect(drawn).toBeLessThanOrEqual(1);
   });
});
