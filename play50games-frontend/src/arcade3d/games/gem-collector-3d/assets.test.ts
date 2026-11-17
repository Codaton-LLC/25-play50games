// Gem Collector 3D's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal to
// the real (meshopt-decoded) meshes with their feet on y = 0; the fits in metres; the definition.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { assetScale } from "@/arcade3d/core/assets";
import { ASSETS, BEACON_H, BOSS_DRAWN_R, BOSS_H, GEM_H, GLB_SIZE } from "./assets";
import { CHEST_R, PED_R } from "./arena";
import { BOSS_R } from "./rules";
import { gemCollector3dMeta } from "./meta";
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

describe("gem-collector-3d models", () => {
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

   it("the fits match the rules: the gem's height, the beacon's, the pedestal's and chest's width, the Glutton's body", () => {
      const fit = (key: keyof typeof GLB_SIZE) => {
         const s = assetScale(ASSETS[key]);
         return { x: GLB_SIZE[key].x * s[0], y: GLB_SIZE[key].y * s[1], z: GLB_SIZE[key].z * s[2] };
      };
      expect(fit("gem").y).toBeCloseTo(GEM_H, 6);
      expect(fit("beacon").y).toBeCloseTo(BEACON_H, 6);
      expect(fit("pedestal").x).toBeCloseTo(PED_R * 2, 6);
      expect(fit("chest").x).toBeCloseTo(CHEST_R * 2, 6);
      expect(fit("gummy").y).toBeCloseTo(BOSS_H, 6);
      // his drawn body is within 15 cm of the rules' body radius
      expect(Math.abs(BOSS_DRAWN_R - BOSS_R)).toBeLessThan(0.15);
   });

   it("the definition is a dev points game with five levels, an intro and no shell clock", () => {
      expect(definition.levels).toHaveLength(5);
      expect(definitionLevelProblems(gemCollector3dMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(gemCollector3dMeta.scoring.kind).toBe("points");
      expect(gemCollector3dMeta.order).toBe(81);
      expect(gemCollector3dMeta.status).toBe("dev");
      expect(gemCollector3dMeta.collection).toBe("rollheroes");
   });
});
