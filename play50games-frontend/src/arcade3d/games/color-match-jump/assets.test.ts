import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasModel } from "../../core/modelManifest";
import { ASSETS, GLB_SIZE } from "./assets";

const PUBLIC = new URL("../../../../public", import.meta.url);

/** The POSITION bounds and triangle count of a GLB (all mesh nodes, translation and scale applied). */
function measure(url: string): { size: number[]; minY: number; tris: number; bytes: number } {
   const bytes = readFileSync(new URL(`.${url}`, PUBLIC.href + "/"));
   const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
   const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   let tris = 0;
   for (const node of json.nodes ?? []) {
      if (node.mesh == null) continue;
      const t = node.translation ?? [0, 0, 0];
      const s = node.scale ?? [1, 1, 1];
      for (const p of json.meshes[node.mesh].primitives) {
         const a = json.accessors[p.attributes.POSITION];
         tris += (p.indices != null ? json.accessors[p.indices].count : a.count) / 3;
         for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], a.min[i] * s[i] + t[i]);
            max[i] = Math.max(max[i], a.max[i] * s[i] + t[i]);
         }
      }
   }
   return { size: max.map((v, i) => v - min[i]), minY: min[1], tris, bytes: bytes.length };
}

const BY_KEY: Record<keyof typeof GLB_SIZE, string> = {
   hex: ASSETS.hex.url, hexThin: ASSETS.crown.url, cracked: ASSETS.cracked.url, pillar: ASSETS.pillar.url, beacon: ASSETS.beacon.url,
   lamp: ASSETS.lamp.url, arena: ASSETS.arena.url, orb: ASSETS.orb.url, golem: ASSETS.golem.url,
};

describe("Color Match Jump models", () => {
   it("every model url is in the manifest, and every GLB in the game's folder is used", () => {
      for (const a of Object.values(ASSETS)) expect(hasModel(a.url), a.url).toBe(true);
      const urls = Object.values(ASSETS).map((a) => a.url);
      for (const f of readdirSync(new URL("./models/3d/color-match-jump", PUBLIC.href + "/"))) expect(urls).toContain(`/models/3d/color-match-jump/${f}`);
   });
   for (const key of Object.keys(GLB_SIZE) as (keyof typeof GLB_SIZE)[]) it(`${key}: measured bounds, sole at y 0 and within budget`, () => {
      const m = measure(BY_KEY[key]);
      m.size.forEach((v, i) => expect(v).toBeCloseTo(GLB_SIZE[key][i], 2));
      expect(m.minY).toBeCloseTo(0, 3);
      const budget = key === "golem" ? { tris: 20_000, kb: 1536 } : { tris: 5_000, kb: 300 };
      expect(m.tris).toBeLessThanOrEqual(budget.tris);
      expect(m.bytes / 1024).toBeLessThanOrEqual(budget.kb);
   });
   it("no GLB in the folder is a stray copy (all are small, optimised files)", () => {
      for (const f of readdirSync(new URL("./models/3d/color-match-jump", PUBLIC.href + "/"))) {
         expect(statSync(new URL(`./models/3d/color-match-jump/${f}`, PUBLIC.href + "/")).size).toBeLessThan(300 * 1024);
      }
   });
});
