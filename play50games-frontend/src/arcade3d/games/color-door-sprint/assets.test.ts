// Color Door Sprint's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to
// the real (meshopt-decoded) meshes with their feet on y = 0, Flicker x4, and the definition's levels.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, DOOR_H, DOOR_W, GLB_SIZE, SPIRIT_SCALE } from "./assets";
import { DOOR, LANE_W } from "./halls";
import { colorDoorSprintMeta } from "./meta";
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

describe("color-door-sprint models", () => {
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

   it("a door fills its lane less the pillars and stands under the lintel; Flicker is drawn x4 (the card)", () => {
      expect(DOOR_W).toBeLessThan(LANE_W);
      expect(DOOR_H).toBeLessThan(DOOR.wallH);
      expect(DOOR_H).toBeGreaterThan(2.6);
      expect(SPIRIT_SCALE).toBe(4);
      expect(GLB_SIZE.spirit.y * SPIRIT_SCALE).toBeGreaterThan(DOOR.tallH);
   });

   it("the definition's five levels match meta and are valid", () => {
      expect(definitionLevelProblems(colorDoorSprintMeta, definition as never)).toEqual([]);
   });
});
