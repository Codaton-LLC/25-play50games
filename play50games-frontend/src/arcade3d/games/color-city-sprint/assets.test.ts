// Color City Sprint's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to
// the real (meshopt-decoded) meshes with their feet on y = 0; the fits in metres; the definition.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { assetScale } from "@/arcade3d/core/assets";
import { ASSETS, GLB_SIZE } from "./assets";
import { BUS_HALF_L, BUS_ROOF, RAMP_H, RAMP_LEN, TRUCK_HALF_L, TRUCK_ROOF } from "./city";
import { colorCitySprintMeta } from "./meta";
import definition from "./index";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

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

describe("color-city-sprint models", () => {
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
         for (let i = 0; i < cloud.length; i += 3) for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], cloud[i + k]);
            max[k] = Math.max(max[k], cloud[i + k]);
         }
         expect(max[0] - min[0]).toBeCloseTo(size.x, 2);
         expect(max[1] - min[1]).toBeCloseTo(size.y, 2);
         expect(max[2] - min[2]).toBeCloseTo(size.z, 2);
         expect(min[1]).toBeCloseTo(0, 2);
      });
   }

   it("the fits match the rules: bus 8.5 m long with its roof at BUS_ROOF, Greyout's box and roof, the ramp's length and lip", () => {
      const fit = (key: keyof typeof GLB_SIZE) => {
         const s = assetScale(ASSETS[key]);
         return { x: GLB_SIZE[key].x * s[0], y: GLB_SIZE[key].y * s[1], z: GLB_SIZE[key].z * s[2] };
      };
      expect(fit("bus").z).toBeCloseTo(BUS_HALF_L * 2, 6);
      expect(fit("bus").y).toBeCloseTo(BUS_ROOF, 6);
      expect(fit("boss").z).toBeCloseTo(TRUCK_HALF_L * 2, 6);
      expect(fit("boss").y).toBeCloseTo(TRUCK_ROOF, 6);
      expect(fit("ramp").z).toBeCloseTo(RAMP_LEN, 6);
      expect(fit("ramp").y).toBeCloseTo(RAMP_H, 6);
   });

   it("the definition is a dev time game with five levels, an intro and no shell clock", () => {
      expect(definition.levels).toHaveLength(5);
      expect(definitionLevelProblems(colorCitySprintMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(colorCitySprintMeta.scoring.kind).toBe("time");
      expect(colorCitySprintMeta.order).toBe(61);
      expect(colorCitySprintMeta.status).toBe("dev");
      expect(colorCitySprintMeta.collection).toBe("rollheroes");
   });
});
