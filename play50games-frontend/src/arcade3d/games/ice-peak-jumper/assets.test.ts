// The models as Ice Peak Jumper draws them: listed in the manifest, on disk, within budget, GLB_SIZE
// equal to the real (meshopt-decoded) meshes, the fitted sizes, and the definition's levels.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, GLB_SIZE, GOLEM_H, SLIME_H, YETI_H } from "./assets";
import { icePeakJumperMeta } from "./meta";
import definition from "./index";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

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

describe("ice-peak-jumper models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      if (key === "hero") continue;
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.05);
      });
   }

   it("the fits: a 9 m golem, a 2.6 m yeti, a 0.9 m slime", () => {
      expect(GLB_SIZE.golem.y * (GOLEM_H / GLB_SIZE.golem.y)).toBeCloseTo(9, 6);
      expect(YETI_H).toBeGreaterThan(2);
      expect(SLIME_H).toBeLessThan(1.2);
   });

   it("the definition: five levels, Menu 2 meta, Jump / Power buttons", () => {
      expect(definitionLevelProblems(icePeakJumperMeta, definition)).toEqual([]);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(icePeakJumperMeta.collection).toBe("rollheroes");
      expect(icePeakJumperMeta.status).toBe("dev");
      expect(icePeakJumperMeta.order).toBe(75);
   });
});
