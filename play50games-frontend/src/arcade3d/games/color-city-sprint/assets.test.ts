import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BufferGeometry } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ARMADILLO, buildArmadilloShapes } from "./Armadillo";
import { ASSETS, GLB_SIZE } from "./assets";
import { colorCitySprintMeta } from "./meta";
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

describe("color-city-sprint models", () => {
   for (const asset of Object.values(ASSETS)) {
      it(`${asset.id} is listed and within budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key} GLB_SIZE matches the mesh`, async () => {
         const asset = ASSETS[key === "gateV2" ? "gateV2" : key === "city" ? "city" : key === "boss" ? "boss" : key === "gem" ? "gem" : key === "barrier" ? "barrier" : key];
         const url = key === "barrier" ? ASSETS.barrier.url
            : key === "bus" ? ASSETS.bus.url
            : key === "gate" ? ASSETS.gate.url
            : key === "gateV2" ? ASSETS.gateV2.url
            : key === "gem" ? ASSETS.gem.url
            : key === "drone" ? ASSETS.drone.url
            : key === "boss" ? ASSETS.boss.url
            : key === "city" ? ASSETS.city.url
            : key === "ramp" ? ASSETS.ramp.url
            : ASSETS.cone.url;
         const { cloud } = await readCharacterGlb(url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.02);
         expect(asset.url).toBe(url);
      });
   }

   it("the stand-in is 1.45 m with its feet on the floor", () => {
      expect(ARMADILLO.height).toBeCloseTo(1.45, 2);
      const shapes = buildArmadilloShapes();
      const geos: BufferGeometry[] = [];
      const walk = (v: unknown) => {
         if (v instanceof BufferGeometry) geos.push(v);
         else if (v && typeof v === "object") Object.values(v).forEach(walk);
      };
      walk(shapes);
      expect(geos.length).toBeGreaterThan(0);
      expect(geos.length).toBeLessThanOrEqual(22);
      for (const g of geos) {
         g.computeBoundingBox();
         expect(g.getAttribute("position").count).toBeGreaterThan(0);
      }
      const feet = ARMADILLO.hipY + shapes.leg.body.boundingBox!.min.y;
      const top = ARMADILLO.headY + Math.max(shapes.head.shell.boundingBox!.max.y, shapes.head.body.boundingBox!.max.y);
      expect(feet).toBeGreaterThan(-0.02);
      expect(feet).toBeLessThan(0.02);
      expect(top).toBeGreaterThan(ARMADILLO.height - 0.06);
      expect(top).toBeLessThan(ARMADILLO.height + 0.06);
   });

   it("the definition is a dev time game with five levels, an intro and no shell clock", () => {
      expect(definition.slug).toBe("color-city-sprint");
      expect(definition.clockChip).toBe(false);
      expect(definition.intro).toBe(true);
      expect(definition.touchLabels?.action).toBe("Power");
      expect(definition.levels).toHaveLength(5);
      expect(definitionLevelProblems(colorCitySprintMeta, definition)).toEqual([]);
      expect(colorCitySprintMeta.order).toBe(56);
      expect(colorCitySprintMeta.status).toBe("dev");
   });
});
