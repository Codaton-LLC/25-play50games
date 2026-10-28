// Plate Surf's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to the
// real (meshopt-decoded) meshes with their feet on y = 0, the plate's deck height, and the definition's levels.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, GLB_SIZE, PLATE_DECK, PLATE_LENGTH } from "./assets";
import { plateSurfMeta } from "./meta";
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

function bounds(cloud: Float32Array) {
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i += 3) {
      for (let k = 0; k < 3; k++) {
         min[k] = Math.min(min[k], cloud[i + k]);
         max[k] = Math.max(max[k], cloud[i + k]);
      }
   }
   return { min, max, size: max.map((v, k) => v - min[k]) };
}

describe("plate-surf models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte and triangle budgets`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const file = path.join(PUBLIC, asset.url);
         expect(statSync(file).size).toBeLessThanOrEqual(asset.budget.bytes);
         expect(glbTriangles(file)).toBeLessThanOrEqual(asset.budget.tris);
      });
   }

   const BY_KEY: Record<string, string> = { orb: "orb", plate: "plate", buoy: "buoy", rock: "rock", cliff: "cliff", ring: "ring", jelly: "jelly", crab: "crab", gull: "gull", beacon: "beacon" };
   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[BY_KEY[key]].url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
      });
   }

   it("the plate is drawn 1.7 m long; its deck (mid-board) is where the hero's feet go", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.plate.url);
      let top = -Infinity;
      for (let i = 0; i < cloud.length; i += 3) if (Math.abs(cloud[i + 2]) < 0.15 && Math.abs(cloud[i]) < 0.15) top = Math.max(top, cloud[i + 1]);
      expect(top).toBeCloseTo(GLB_SIZE.plate.deck, 2);
      expect(PLATE_DECK).toBeCloseTo((GLB_SIZE.plate.deck * PLATE_LENGTH) / GLB_SIZE.plate.z, 6);
   });

   it("the definition's five levels match meta and are valid", () => {
      expect(definitionLevelProblems(plateSurfMeta, definition as never)).toEqual([]);
   });
});
