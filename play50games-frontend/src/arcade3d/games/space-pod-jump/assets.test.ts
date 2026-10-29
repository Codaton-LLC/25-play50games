// Space Pod Jump's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to the
// real (meshopt-decoded) meshes with their feet on y = 0, the planetoid and the Warden round enough to
// stand for the rules' spheres, and the definition's levels.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, GLB_SIZE } from "./assets";
import { spacePodJumpMeta } from "./meta";
import definition from "./index";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

/** The GLB's triangle count from its JSON chunk (indices / 3 per primitive). */
function glbTriangles(file: string): number {
   const bytes = readFileSync(file);
   const len = bytes.readUInt32LE(12);
   const json = JSON.parse(bytes.subarray(20, 20 + len).toString("utf8")) as {
      meshes: Array<{ primitives: Array<{ indices?: number; attributes: { POSITION: number } }> }>;
      accessors: Array<{ count: number }>;
   };
   let tris = 0;
   for (const m of json.meshes) for (const p of m.primitives) tris += json.accessors[p.indices ?? p.attributes.POSITION].count / 3;
   return tris;
}

describe("space-pod-jump models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte and triangle budgets`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const file = path.join(PUBLIC, asset.url);
         expect(statSync(file).size).toBeLessThanOrEqual(asset.budget.bytes);
         expect(glbTriangles(file)).toBeLessThanOrEqual(asset.budget.tris);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3) {
            for (let k = 0; k < 3; k++) {
               min[k] = Math.min(min[k], cloud[i + k]);
               max[k] = Math.max(max[k], cloud[i + k]);
            }
         }
         expect(max[0] - min[0]).toBeCloseTo(size.x, 2);
         expect(max[1] - min[1]).toBeCloseTo(size.y, 2);
         expect(max[2] - min[2]).toBeCloseTo(size.z, 2);
         expect(min[1]).toBeCloseTo(0, 2);
      });
   }

   it("the planetoid and the Warden are round enough to draw the rules' spheres (every axis within 4 % of their mean)", () => {
      for (const g of [GLB_SIZE.planetoid]) {
         const mean = (g.x + g.y + g.z) / 3;
         for (const v of [g.x, g.y, g.z]) expect(Math.abs(v - mean) / mean).toBeLessThan(0.04);
      }
      const w = GLB_SIZE.warden;
      const wm = (w.x + w.y) / 2;
      expect(Math.abs(w.x - w.y) / wm).toBeLessThan(0.04);
   });

   it("the definition's five levels match meta and are valid", () => {
      expect(definitionLevelProblems(spacePodJumpMeta, definition as never)).toEqual([]);
   });
});
