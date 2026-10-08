// Material looks (core/materials.ts): cache keys, the reference-counted cache, overrides and tints
// on a real three.js scene (node, no WebGL).
import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, type Material } from "three";
import {
   MATERIAL_PRESETS,
   applyLook,
   createRefCache,
   lookMaterials,
   overrideKey,
   tintKey,
   type LookUse,
} from "./materials";

const freshCache = () => {
   const tasks: Array<() => void> = [];
   const disposed: Material[] = [];
   const cache = createRefCache<Material>((m) => disposed.push(m), (task) => tasks.push(task));
   const flush = () => tasks.splice(0).forEach((t) => t());
   return { cache, disposed, flush };
};

const hex = (c: Color) => `#${c.getHexString()}`;

describe("cache keys", () => {
   it("presets by name, custom looks by their normalised settings, tints appended", () => {
      expect(overrideKey("gold")).toBe("preset:gold");
      expect(overrideKey("gold", "#FFF ")).toBe("preset:gold|tint:#fff");
      expect(overrideKey({ color: "#AA0000" })).toBe(overrideKey({ color: " #aa0000", roughness: 0.6, metalness: 0 }));
      expect(overrideKey({ color: "#aa0000", roughness: 0.2 })).not.toBe(overrideKey({ color: "#aa0000" }));
      expect(overrideKey({ color: "#aa0000", emissive: "#110000" })).not.toBe(overrideKey({ color: "#aa0000" }));
      const m = new MeshStandardMaterial();
      expect(tintKey(m, "#93C5FD")).toBe(`tint:${m.uuid}|#93c5fd`);
      expect(tintKey(m, "#93c5fd")).not.toBe(tintKey(new MeshStandardMaterial(), "#93c5fd"));
   });

   it("has the four presets", () => {
      expect(Object.keys(MATERIAL_PRESETS).sort()).toEqual(["bone", "bronze", "gold", "stone"]);
   });
});

describe("reference-counted cache", () => {
   it("creates once per key and disposes after the last user, after the commit", () => {
      const { cache, disposed, flush } = freshCache();
      const create = vi.fn(() => new MeshStandardMaterial());
      const a = cache.get("k", create);
      expect(cache.get("k", create)).toBe(a);
      expect(create).toHaveBeenCalledTimes(1);
      cache.retain("k", a);
      cache.retain("k", a);
      cache.release("k");
      flush();
      expect(disposed).toEqual([]);
      cache.release("k");
      expect(cache.has("k")).toBe(true); // not yet: the remount of a Retry may retain it
      flush();
      expect(disposed).toEqual([a]);
      expect(cache.has("k")).toBe(false);
   });

   it("a remount in the same commit keeps the material", () => {
      const { cache, disposed, flush } = freshCache();
      const a = cache.get("k", () => new MeshStandardMaterial());
      cache.retain("k", a);
      cache.release("k"); // the old scene's cleanup
      cache.retain("k", cache.get("k", () => new MeshStandardMaterial())); // the new scene's effect
      flush();
      expect(disposed).toEqual([]);
      expect(cache.users("k")).toBe(1);
   });

   it("re-inserts a value retained after its disposal; extra releases are ignored", () => {
      const { cache, flush } = freshCache();
      const a = new MeshStandardMaterial();
      cache.retain("k", a);
      cache.release("k");
      flush();
      cache.release("k");
      cache.retain("k", a);
      expect(cache.users("k")).toBe(1);
      expect(cache.get("k", () => new MeshStandardMaterial())).toBe(a);
   });
});

function model() {
   const root = new Group();
   const red = new MeshStandardMaterial({ color: "#ff0000" });
   const grey = new MeshStandardMaterial({ color: "#808080" });
   const a = new Mesh(new BoxGeometry(), red);
   const b = new Mesh(new BoxGeometry(), [red, grey]);
   root.add(a, b);
   return { root, a, b, red, grey };
}

describe("applyLook", () => {
   it("an override gives every mesh one shared material per look", () => {
      const { cache } = freshCache();
      const one = model();
      const two = model();
      const looks = applyLook(one.root, "stone", undefined, cache);
      applyLook(two.root, "stone", undefined, cache);
      expect([...looks.keys()]).toEqual(["preset:stone"]);
      const stone = one.a.material as MeshStandardMaterial;
      expect(stone).toBeInstanceOf(MeshStandardMaterial);
      expect(hex(stone.color)).toBe(MATERIAL_PRESETS.stone.color);
      expect(stone.map).toBeNull();
      expect(one.b.material).toEqual([stone, stone]);
      expect(two.a.material).toBe(stone);
      // the GLB's own materials are untouched
      expect(hex(one.red.color)).toBe("#ff0000");
   });

   it("a tint clones each GLB material once per tint and multiplies its colour", () => {
      const { cache } = freshCache();
      const { root, a, b, red, grey } = model();
      const looks: LookUse = applyLook(root, undefined, "#00ff00", cache);
      expect(looks.size).toBe(2);
      const tintedRed = a.material as MeshStandardMaterial;
      expect(tintedRed).not.toBe(red);
      expect(hex(tintedRed.color)).toBe("#000000"); // red x green
      const [r2, g2] = b.material as MeshStandardMaterial[];
      expect(r2).toBe(tintedRed); // the same GLB material in one tint: one clone
      expect(g2.color.g).toBeCloseTo(grey.color.g);
      expect(g2.color.r).toBe(0);
   });

   it("a new look starts from the GLB's materials, and no look restores them", () => {
      const { cache } = freshCache();
      const { root, a, red } = model();
      applyLook(root, undefined, "#808080", cache);
      applyLook(root, undefined, "#808080", cache);
      // not tinted twice
      expect((a.material as MeshStandardMaterial).color.r).toBeCloseTo(new Color("#808080").r);
      applyLook(root, "gold", "#ffffff", cache);
      expect((a.material as Material).name).toBe("arcade:gold");
      expect(applyLook(root, undefined, undefined, cache).size).toBe(0);
      expect(a.material).toBe(red);
   });

   it("instanced parts' material lists (override only)", () => {
      const { cache } = freshCache();
      const red = new MeshStandardMaterial({ color: "#ff0000" });
      const looks: LookUse = new Map();
      const out = lookMaterials([red, red], { color: "#123456", metalness: 0.5 }, undefined, looks, cache) as MeshStandardMaterial[];
      expect(out[0]).toBe(out[1]);
      expect(hex(out[0].color)).toBe("#123456");
      expect(out[0].metalness).toBe(0.5);
      expect(looks.size).toBe(1);
      expect(lookMaterials(red, undefined, undefined, looks, cache)).toBe(red);
   });
});
