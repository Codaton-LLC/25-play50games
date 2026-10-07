// Clean the City drawn sizes: the litter stand-ins (the fallbackParts of the four
// <DynamicInstancedModel> pools) and the runner's scale. Collision never comes from these (rules.ts).
import { describe, expect, it } from "vitest";
import { Box3, type BufferGeometry, type Material } from "three";
import { SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";
import { createLitterStandIns, disposeLitterStandIns } from "./Primitives";
import { LITTER_KINDS } from "./rules";

/** runner.glb's height in GLB units (the shared cast's T-pose, longest side about 1.9) */
const RUNNER_GLB_HEIGHT = 1.9;

function bounds(geometry: BufferGeometry): Box3 {
   geometry.computeBoundingBox();
   return (geometry.boundingBox as Box3).clone();
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

describe("clean-city runner", () => {
   it("is the shared runner drawn about 1 unit tall once runner.glb is listed", () => {
      expect(ASSETS.runner.url).toBe(SHARED_ASSETS.runner.url);
      expect(ASSETS.runner.humanoid).toEqual(SHARED_ASSETS.runner.humanoid);
      const drawn = RUNNER_GLB_HEIGHT * (ASSETS.runner.scale ?? 1);
      expect(drawn).toBeGreaterThanOrEqual(0.9);
      expect(drawn).toBeLessThanOrEqual(1);
   });
});
