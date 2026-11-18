// Temple Coin Rush's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to
// the real (meshopt-decoded) meshes with their feet on y = 0, the fits the rules rely on (a block no
// taller than BLOCK_CLEAR, the gate over the hero, the beam over a rolling hero and under a standing
// one), and the definition's levels.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, BLOCK_H, GATE_H, GATE_W, GLB_SIZE, HEAD_SCALE } from "./assets";
import { LANE_W } from "./temples";
import { BLOCK_CLEAR, HERO } from "./rules";
import { templeCoinRushMeta } from "./meta";
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

describe("temple-coin-rush models", () => {
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

   it("the fits the rules rely on: the gate over its lane and the hero, a block no taller than its clearance, the beam between a rolling and a standing hero, Coilstone colossal", () => {
      expect(GATE_W).toBeLessThan(LANE_W);
      expect(GATE_H).toBeGreaterThan(HERO.height + 0.6);
      expect(BLOCK_H).toBeLessThanOrEqual(BLOCK_CLEAR);
      // Course.tsx draws the beam's underside at 0.95 m
      expect(0.95).toBeGreaterThan(HERO.rollHeight);
      expect(0.95).toBeLessThan(HERO.height);
      expect(GLB_SIZE.head.y * HEAD_SCALE).toBeGreaterThan(3);
   });

   it("the definition's five levels match meta and are valid", () => {
      expect(definitionLevelProblems(templeCoinRushMeta, definition as never)).toEqual([]);
   });
});
