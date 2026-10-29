import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ASSETS, GLB_SIZE } from "./assets";
import { hasModel } from "../../core/modelManifest";

describe("committed models", () => {
   it("uses every supplied GLB, and every asset is listed in the shared manifest", () => {
      const dir = fileURLToPath(new URL("../../../../public/models/3d/snow-slide-dash/", import.meta.url));
      const urls = Object.values(ASSETS).map((a) => a.url);
      for (const file of readdirSync(dir)) expect(urls).toContain(`/models/3d/snow-slide-dash/${file}`);
      for (const url of urls) expect(hasModel(url), url).toBe(true);
   });
   for (const key of Object.keys(GLB_SIZE) as (keyof typeof GLB_SIZE)[]) it(`${key}: measured bounds, sole and declared budget match the actual GLB`, () => {
      const a = ASSETS[key];
      const b = readFileSync(fileURLToPath(new URL(`../../../../public${a.url}`, import.meta.url)));
      const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
      const primitive = json.meshes[0].primitives[0], positions = json.accessors[primitive.attributes.POSITION];
      for (let i = 0; i < 3; i++) expect(positions.max[i] - positions.min[i]).toBeCloseTo(GLB_SIZE[key][i], 4);
      expect(positions.min[1] + json.nodes[0].translation[1]).toBeCloseTo(0, 5);
      const triangles = json.accessors[primitive.indices].count / 3;
      expect(triangles).toBeLessThanOrEqual(a.budget.tris);
      expect(b.length).toBeLessThanOrEqual(a.budget.bytes);
   });
});
