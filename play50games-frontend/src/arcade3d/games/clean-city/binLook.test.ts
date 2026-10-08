// The bin's slate look (binLook.ts, README "Obstacle props"): the GLB's own material recoloured,
// detail maps kept, and a colour that stands out on all three grounds.
import { readFileSync } from "node:fs";
import path from "node:path";
import { MeshBasicMaterial, MeshStandardMaterial, Texture } from "three";
import { describe, expect, it } from "vitest";
import { ASSETS, BIN_COLOR } from "./assets";
import { disposeMaterials, slateMaterial, slateMaterials } from "./binLook";
import { GLB_PROPS } from "./propSpots";
import { MAPS } from "./rules";

interface GlbMaterial {
   pbrMetallicRoughness?: { baseColorTexture?: unknown; baseColorFactor?: number[]; metallicRoughnessTexture?: unknown };
   normalTexture?: unknown;
}

function glbJson(url: string): { materials: GlbMaterial[]; meshes: { primitives: { material?: number; attributes: Record<string, number> }[] }[] } {
   const glb = readFileSync(path.join(process.cwd(), "public", url));
   return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
   const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
   });
   return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
   const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
   return (hi + 0.05) / (lo + 0.05);
};

/** A material as GLTFLoader makes the bin's: white colour times the albedo map, plus the detail maps. */
function glbLikeMaterial() {
   const maps = { map: new Texture(), normalMap: new Texture(), roughnessMap: new Texture(), metalnessMap: new Texture() };
   return { maps, material: new MeshStandardMaterial({ ...maps, color: "#ffffff", name: "model" }) };
}

describe("clean-city bin: slate, not green", () => {
   it("the bin GLB is one mesh with one material: an albedo texture (the green) on a white factor, plus normal and metal/roughness maps", () => {
      const json = glbJson(ASSETS.bin.url);
      expect(json.meshes).toHaveLength(1);
      expect(json.meshes[0].primitives.map((p) => p.material)).toEqual([0]);
      expect(json.meshes[0].primitives[0].attributes.COLOR_0).toBeUndefined();
      expect(json.materials).toHaveLength(1);
      const [material] = json.materials;
      // the colour lives in the albedo map alone, so dropping the map leaves exactly `color`
      expect(material.pbrMetallicRoughness?.baseColorTexture).toBeDefined();
      expect(material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).toEqual([1, 1, 1, 1]);
      expect(material.normalTexture).toBeDefined();
      expect(material.pbrMetallicRoughness?.metallicRoughnessTexture).toBeDefined();
   });

   it("slateMaterial drops the albedo map, sets BIN_COLOR, keeps the normal, roughness and metalness maps, and leaves the GLB's material alone", () => {
      const { maps, material } = glbLikeMaterial();
      const slate = slateMaterial(material);
      expect(slate).not.toBe(material);
      expect(slate).toBeInstanceOf(MeshStandardMaterial);
      expect(slate.map).toBeNull();
      expect(`#${slate.color.getHexString()}`).toBe(BIN_COLOR);
      expect(slate.normalMap).toBe(maps.normalMap);
      expect(slate.roughnessMap).toBe(maps.roughnessMap);
      expect(slate.metalnessMap).toBe(maps.metalnessMap);
      expect(slate.name).toBe("bin-slate");
      // the cached GLB material is untouched (other copies, a later mount)
      expect(material.map).toBe(maps.map);
      expect(material.color.getHexString()).toBe("ffffff");
   });

   it("slateMaterials handles a material list and a non-standard material; disposeMaterials frees the clones only", () => {
      const { maps, material } = glbLikeMaterial();
      const list = slateMaterials([material, new MeshBasicMaterial()]) as MeshStandardMaterial[];
      expect(list).toHaveLength(2);
      for (const slate of list) {
         expect(slate).toBeInstanceOf(MeshStandardMaterial);
         expect(slate.map).toBeNull();
         expect(`#${slate.color.getHexString()}`).toBe(BIN_COLOR);
      }
      let disposed = 0;
      list.forEach((slate) => slate.addEventListener("dispose", () => disposed++));
      let mapDisposed = false;
      maps.normalMap.addEventListener("dispose", () => (mapDisposed = true));
      disposeMaterials(list);
      expect(disposed).toBe(2);
      expect(mapDisposed).toBe(false);
   });

   it("BIN_COLOR is a dark slate that stands out on the park lawn, the city asphalt and the beach sand", () => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(BIN_COLOR.slice(i, i + 2), 16));
      expect(b).toBeGreaterThan(r);
      expect(b).toBeGreaterThan(g);
      expect(luminance(BIN_COLOR)).toBeLessThan(0.12);
      // the green GLB on the lawn was about 1; the lighter slate #64748b would be 1.4 and 1.5
      for (const map of MAPS) expect(contrast(BIN_COLOR, map.ground)).toBeGreaterThan(2);
   });

   it("the GLB and its stand-in share the colour, and every bin of the three maps is ASSETS.bin", () => {
      expect(ASSETS.bin.fallbackColor).toBe(BIN_COLOR);
      const bins = GLB_PROPS.filter((set) => set.kind === "bin");
      expect(bins.map((set) => set.map).sort()).toEqual([0, 1, 2]);
      for (const set of bins) expect(set.asset).toBe(ASSETS.bin);
   });
});
