import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ANCHOR_HEIGHT, ASSETS, DRONE_BUDGET, DRONE_WIDTH, GLB_SIZE, fit } from "./assets";
import { skyHookSwingMeta } from "./meta";
import definition from "./index";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

const MESH: Record<keyof typeof GLB_SIZE, string> = {
   airship: "airship",
   drone: "drone",
   post: "postOld",
   postV2: "post",
   pad: "pad",
   anchor: "anchorOld",
   anchorV2: "anchor",
   island: "island",
   windmill: "windmill",
};

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

describe("sky-hook-swing models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed and within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE matches the mesh`, async () => {
         const id = MESH[key as keyof typeof GLB_SIZE];
         const { cloud } = await readCharacterGlb(ASSETS[id].url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.02);
         expect(Math.abs(b.max[2] + b.min[2])).toBeLessThan(0.02);
      });
   }

   it("draws a drone at DRONE_WIDTH on the character budget, and a ring ANCHOR_HEIGHT tall", () => {
      expect(ASSETS.drone.budget).toEqual(DRONE_BUDGET);
      expect(fit(GLB_SIZE.drone.x, DRONE_WIDTH) * GLB_SIZE.drone.x).toBeCloseTo(DRONE_WIDTH, 5);
      expect(fit(GLB_SIZE.anchorV2.y, ANCHOR_HEIGHT) * GLB_SIZE.anchorV2.y).toBeCloseTo(ANCHOR_HEIGHT, 5);
   });
});

describe("definition", () => {
   it("has five levels, the intro, and its own clock", () => {
      expect(definitionLevelProblems(skyHookSwingMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchLabels).toEqual({ action: "Hook" });
      expect(skyHookSwingMeta.status).toBe("dev");
      expect(skyHookSwingMeta.collection).toBe("rollheroes");
      expect(skyHookSwingMeta.order).toBe(56);
      expect(skyHookSwingMeta.owner).toBe("cursor");
   });
});
