// The bin's slate look (2026-10-08, README "Obstacle props"). The flat-lid bin GLB is green and
// melted into the park's green lawn, so it is drawn dark slate, in code (no regeneration): its own
// material cloned with the albedo map dropped (`map = null`) and `color` = BIN_COLOR, the normal and
// metal/roughness maps kept, so the lid, its handle and the base ring keep their relief. The same
// recolour as warehouse-rush's crate: multiplying the green albedo by slate would give a dark olive,
// never slate. Pure three.js, no React: Primitives.tsx `BinProp` makes the clones once, before the
// first render, and disposes of them; binLook.test.ts checks them.
import { MeshStandardMaterial, type Material } from "three";
import { BIN_COLOR } from "./assets";

/** One slate clone of a bin material (a plain slate material if the GLB's is not a standard one). */
export function slateMaterial(source: Material, color: string = BIN_COLOR): MeshStandardMaterial {
   if (source instanceof MeshStandardMaterial) {
      const material = source.clone();
      material.map = null;
      material.color.set(color);
      material.name = "bin-slate";
      return material;
   }
   return new MeshStandardMaterial({ color, roughness: 0.55, name: "bin-slate" });
}

/** slateMaterial over a mesh's material or material list. */
export function slateMaterials(source: Material | Material[]): Material | Material[] {
   return Array.isArray(source) ? source.map((material) => slateMaterial(material)) : slateMaterial(source);
}

/** Frees what slateMaterials made (never the textures: they belong to the GLB's loader cache). */
export function disposeMaterials(materials: Material | Material[]): void {
   (Array.isArray(materials) ? materials : [materials]).forEach((material) => material.dispose());
}
