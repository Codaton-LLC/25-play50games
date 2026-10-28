// The models as Wind Tunnel Escape draws them: listed in the manifest, on disk, within budget, GLB_SIZE
// equal to the real (meshopt-decoded) meshes, the fan's hub on the current's axis, and the definition's
// levels.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, FAN_HUB_GLB, FAN_SCALE, GLB_SIZE } from "./assets";
import { HUB } from "./tunnel";
import { windTunnelEscapeMeta } from "./meta";
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

const KEYS: Record<keyof typeof GLB_SIZE, string> = {
   fan: "fan",
   vent: "vent",
   lift: "lift",
   crate: "crate",
   post: "post",
   tube: "tube",
   tower: "tower",
   drone: "drone",
   boss: "boss",
   orb: "orb",
   beacon: "beacon",
};

describe("wind-tunnel-escape models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[KEYS[key as keyof typeof GLB_SIZE]].url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.03);
      });
   }

   it("the fan's grille centre (its hub) sits on the current's axis: FAN_HUB_GLB × FAN_SCALE = HUB", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.fan.url);
      // the grille: the vertices above the pedestal's base (y > 0.3), their mid height
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < cloud.length; i += 3) {
         const y = cloud[i + 1];
         if (y < 0.3) continue;
         if (Math.abs(cloud[i]) > 0.6) {
            lo = Math.min(lo, y);
            hi = Math.max(hi, y);
         }
      }
      expect((lo + hi) / 2).toBeCloseTo(FAN_HUB_GLB, 0);
      expect(FAN_HUB_GLB * FAN_SCALE).toBeCloseTo(HUB, 6);
   });

   it("the definition: five levels, Menu 2 meta, the touch Fan / Power button", () => {
      expect(definitionLevelProblems(windTunnelEscapeMeta, definition)).toEqual([]);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.intro).toBe(true);
      expect(windTunnelEscapeMeta.collection).toBe("rollheroes");
      expect(windTunnelEscapeMeta.status).toBe("dev");
   });
});
