// Ultimate Color Trial's GLBs: listed in the manifest, on disk, within their budgets, GLB_SIZE equal
// to the real (meshopt-decoded) meshes with their feet on y = 0; the fits in metres; the definition.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { assetScale } from "@/arcade3d/core/assets";
import { ASSETS, BEACON_H, BOSS_H, CORE_L, EMITTER_L, GEM_W, GLB_SIZE, ORB_W, PEDESTAL_H, SWITCH_W } from "./assets";
import { ORB_R } from "./course";
import { ultimateColorTrialMeta } from "./meta";
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

describe("ultimate-color-trial models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte and triangle budgets`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const file = path.join(PUBLIC, asset.url);
         expect(statSync(file).size).toBeLessThanOrEqual(asset.budget.bytes);
         expect(glbTriangles(file)).toBeLessThanOrEqual(asset.budget.tris);
      });
   }

   it("the game's own models never use the stone minion or any ninja / turtle / shell asset", () => {
      for (const asset of Object.values(ASSETS)) {
         expect(asset.url).not.toMatch(/StoneMinion|ninja|turtle|shell/i);
      }
      expect(Object.values(ASSETS).filter((a) => a.url.startsWith("/models/3d/ultimate-color-trial/"))).toHaveLength(10);
   });

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

   it("the fits match the rules: the Sentinel's and beacon's heights, the switch across, the orb's diameter, the core's length, the pedestal's height, the emitter's length, the gem across", () => {
      const fit = (key: keyof typeof GLB_SIZE) => {
         const s = assetScale(ASSETS[key]);
         return { x: GLB_SIZE[key].x * s[0], y: GLB_SIZE[key].y * s[1], z: GLB_SIZE[key].z * s[2] };
      };
      expect(fit("boss").y).toBeCloseTo(BOSS_H, 6);
      expect(fit("beacon").y).toBeCloseTo(BEACON_H, 6);
      expect(fit("switch").x).toBeCloseTo(SWITCH_W, 6);
      expect(fit("orb").x).toBeCloseTo(ORB_W, 6);
      expect(ORB_W).toBeCloseTo(ORB_R * 2, 6);
      expect(fit("core").z).toBeCloseTo(CORE_L, 6);
      expect(fit("pedestal").y).toBeCloseTo(PEDESTAL_H, 6);
      expect(fit("emitter").z).toBeCloseTo(EMITTER_L, 6);
      expect(fit("gem").x).toBeCloseTo(GEM_W, 6);
   });

   it("the definition is a dev time game with five levels, an intro and no shell clock, order 100", () => {
      expect(definition.levels).toHaveLength(5);
      expect(definitionLevelProblems(ultimateColorTrialMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(ultimateColorTrialMeta.scoring.kind).toBe("time");
      expect(ultimateColorTrialMeta.order).toBe(100);
      expect(ultimateColorTrialMeta.status).toBe("live");
      expect(ultimateColorTrialMeta.collection).toBe("rollheroes");
   });
});
