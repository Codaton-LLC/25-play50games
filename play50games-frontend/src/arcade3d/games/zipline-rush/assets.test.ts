import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ASSETS } from "./assets";
import { MODEL_MANIFEST } from "../../core/modelManifest";
describe("ready Hyper3D assets", () => {
   for (const [name, asset] of Object.entries(ASSETS)) it(`${name}: is a listed local GLB inside its declared budget`, () => {
      expect(MODEL_MANIFEST.includes(asset.url)).toBe(true);
      expect(asset.url).not.toMatch(/ninja|turtle|shell/i);
      const file = fs.readFileSync(path.resolve(__dirname, "../../../../public", asset.url.slice(1)));
      expect(file.subarray(0, 4).toString()).toBe("glTF");
      const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
      const tris = json.meshes.reduce((sum: number, m: { primitives: { indices: number }[] }) => sum + m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0), 0);
      expect(tris).toBeLessThanOrEqual(asset.budget.tris);
      expect(file.length).toBeLessThanOrEqual(asset.budget.bytes);
   });
});
