import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, GLB_SIZE } from "./assets";
import { colorOrbDefenseMeta } from "./meta";
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

describe("color-orb-defense models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed and within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }
   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE matches the mesh, feet on y = 0`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
      });
   }
});

describe("definition", () => {
   it("five levels, the intro, its own clock, joystick + Jump + Power, dev at order 99", () => {
      expect(definitionLevelProblems(colorOrbDefenseMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchLabels).toEqual({ action: "Power" });
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(colorOrbDefenseMeta.status).toBe("dev");
      expect(colorOrbDefenseMeta.collection).toBe("rollheroes");
      expect(colorOrbDefenseMeta.order).toBe(99);
      expect(colorOrbDefenseMeta.owner).toBe("claude");
   });
});
