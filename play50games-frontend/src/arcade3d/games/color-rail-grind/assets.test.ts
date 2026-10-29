// Color Rail Grind's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to the
// real (meshopt-decoded) meshes with their feet on y = 0, the fits the rules rely on (a wagon a jump
// clears, two wagons the length a train bumps over, the Express's roof at the rules' roof height, a ring
// a grinder passes through), and the definition's levels.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, EXPRESS_SCALE, GLB_SIZE, RING_SCALE, WAGON_SCALE } from "./assets";
import { EXPRESS, HERO, RING_TOP, TRAIN, V_JUMP, G } from "./rules";
import { colorRailGrindMeta } from "./meta";
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

describe("color-rail-grind models", () => {
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

   it("the fits the rules rely on: a jump clears a wagon, two wagons make a train's length, the roof at the rules' height, a ring a grinder passes through", () => {
      const apex = (V_JUMP * V_JUMP) / (2 * G);
      expect(GLB_SIZE.wagon.y * WAGON_SCALE).toBeLessThanOrEqual(TRAIN.roof + 0.01);
      expect(apex).toBeGreaterThan(TRAIN.roof);
      expect(GLB_SIZE.wagon.z * WAGON_SCALE * 2).toBeLessThanOrEqual(TRAIN.half * 2 + 0.2);
      const h = GLB_SIZE.express.y * EXPRESS_SCALE;
      expect(h).toBeGreaterThan(EXPRESS.roofY);
      expect(h * 0.6).toBeLessThan(EXPRESS.roofY);
      // the ring stands over the rail: a grinder's head (HERO.height) passes under its top, and RING_TOP sits inside it
      expect(GLB_SIZE.ring.x * RING_SCALE).toBeGreaterThan(HERO.height + 0.6);
      expect(RING_TOP).toBeLessThan(GLB_SIZE.ring.x * RING_SCALE);
   });

   it("the definition's five levels match meta and are valid", () => {
      expect(definitionLevelProblems(colorRailGrindMeta, definition as never)).toEqual([]);
   });
});
