import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ASSETS } from "./assets";
import { hasModel } from "../../core/modelManifest";
import bounds from "./model-bounds.json";
describe("measured factory GLBs", () => {
   for (const [key, b] of Object.entries(bounds))
      it(key, () => {
         const asset = ASSETS[key];
         const bytes = fs.readFileSync(path.resolve("public", asset.url.slice(1)));
         expect(bytes.toString("utf8", 0, 4)).toBe("glTF");
         expect(bytes.length).toBe(b.bytes);
         expect(asset.budget.tris).toBeGreaterThanOrEqual(b.tris);
         expect(hasModel(asset.url)).toBe(true);
         const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)).trim());
         const a = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
         expect(a.min).toEqual(b.min);
         expect(a.max).toEqual(b.max);
         expect((b.min[1] + b.translation[1]) * (asset.scale ?? 1)).toBeCloseTo(0, 5);
      });
});
