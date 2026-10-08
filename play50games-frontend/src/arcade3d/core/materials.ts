// Material looks for GLB models: overrides (ModelAsset.material: a stone statue, a gold robot) and
// tints (<Model tint>, <HumanoidModel tint>). Owned by Claude. Plain three.js, no React, so it is
// tested in node; core/assets.tsx applies it.
//
//    { ...SHARED_ASSETS.robot, id: "robotStatue", material: "gold" }      // a whole GLB in gold
//    <Model asset={KNIGHT} tint="#93c5fd" />                              // the GLB's colours x blue
//
// - An override replaces every material of the model with ONE shared MeshStandardMaterial per kind
//   (presets "stone" | "bronze" | "gold" | "bone", or { color, roughness?, metalness?, emissive? }):
//   no texture, so a statue reads as one material. A tint on an override multiplies its colour.
// - A tint without an override clones each GLB material once per distinct tint and multiplies its
//   colour (its textures are shared, not copied).
// - Every look lives in one page-wide cache (MATERIAL_CACHE), counted by the models that use it:
//   two hundred gold coins share one material. When the last model using a look unmounts, the look
//   is disposed after the commit (a microtask), so a Retry that remounts the scene keeps it.
import { Color, MeshStandardMaterial, type Material, type Mesh, type Object3D } from "three";

export type MaterialPreset = "stone" | "bronze" | "gold" | "bone";

export interface CustomMaterial {
   color: string;
   roughness?: number;
   metalness?: number;
   emissive?: string;
}

/** ModelAsset.material: draw the GLB with another look. */
export type MaterialOverride = MaterialPreset | CustomMaterial;

/**
 * The presets. The arcade's lights have no environment map, so the metals stay part-rough with a
 * warm base colour (fully metallic surfaces would render almost black between highlights).
 */
export const MATERIAL_PRESETS: Readonly<Record<MaterialPreset, Readonly<Required<Omit<CustomMaterial, "emissive">> & { emissive?: string }>>> = {
   stone: { color: "#a8a29e", roughness: 0.95, metalness: 0 },
   bronze: { color: "#b8834f", roughness: 0.45, metalness: 0.6 },
   gold: { color: "#f2c14e", roughness: 0.32, metalness: 0.7, emissive: "#3a2600" },
   bone: { color: "#ebe1c8", roughness: 0.8, metalness: 0 },
};

const DEFAULT_ROUGHNESS = 0.6;
const DEFAULT_METALNESS = 0;

/** A colour string as a cache key: trimmed and lower-case ("#FFAA00 " = "#ffaa00"). */
export function colorKey(color: string): string {
   return color.trim().toLowerCase();
}

/** The full settings of an override (a preset or a custom one with its defaults). */
export function overrideSettings(override: MaterialOverride): Required<Omit<CustomMaterial, "emissive">> & { emissive?: string } {
   if (typeof override === "string") return MATERIAL_PRESETS[override];
   return {
      color: override.color,
      roughness: override.roughness ?? DEFAULT_ROUGHNESS,
      metalness: override.metalness ?? DEFAULT_METALNESS,
      emissive: override.emissive,
   };
}

/**
 * The cache key of an override (with an optional tint): equal looks share a key, so they share one
 * material. Presets are keyed by name, custom looks by their normalised settings.
 */
export function overrideKey(override: MaterialOverride, tint?: string | null): string {
   const base =
      typeof override === "string"
         ? `preset:${override}`
         : `custom:${colorKey(override.color)}|${override.roughness ?? DEFAULT_ROUGHNESS}|${override.metalness ?? DEFAULT_METALNESS}|${override.emissive ? colorKey(override.emissive) : ""}`;
   return tint ? `${base}|tint:${colorKey(tint)}` : base;
}

/** The cache key of a GLB material (by its uuid) in a tint. */
export function tintKey(source: Pick<Material, "uuid">, tint: string): string {
   return `tint:${source.uuid}|${colorKey(tint)}`;
}

/** A new override material (MATERIAL_CACHE makes one per key). */
export function createOverrideMaterial(override: MaterialOverride, tint?: string | null): MeshStandardMaterial {
   const s = overrideSettings(override);
   const material = new MeshStandardMaterial({ color: s.color, roughness: s.roughness, metalness: s.metalness });
   if (s.emissive) material.emissive.set(s.emissive);
   if (tint) material.color.multiply(new Color(tint));
   material.name = `arcade:${typeof override === "string" ? override : "custom"}`;
   return material;
}

/** A clone of a GLB material with its colour multiplied by `tint` (textures shared). */
export function createTintedMaterial(source: Material, tint: string): Material {
   const material = source.clone();
   const color = (material as Material & { color?: Color }).color;
   if (color && color.isColor) color.multiply(new Color(tint));
   material.name = `${source.name}:tint`;
   return material;
}

/** A reference-counted cache: get() creates, retain()/release() count the mounted users. */
export interface RefCache<T> {
   /** the cached value for `key`, created (uncounted) when missing */
   get(key: string, create: () => T): T;
   /** a mounted user of `key` (re-inserts `value` if the key was disposed meanwhile) */
   retain(key: string, value: T): void;
   /** that user unmounted: at zero users the value is disposed after the current commit */
   release(key: string): void;
   has(key: string): boolean;
   /** users of `key` (0 when unknown) */
   users(key: string): number;
}

/**
 * A cache whose values are disposed once nobody uses them. A release to zero only schedules the
 * disposal (`schedule`, a microtask by default): a remount that retains the key in the same commit
 * (React runs every cleanup, then every effect) keeps the value.
 */
export function createRefCache<T>(dispose: (value: T) => void, schedule: (task: () => void) => void = queueMicrotask): RefCache<T> {
   const entries = new Map<string, { value: T; users: number }>();
   return {
      get(key, create) {
         let entry = entries.get(key);
         if (!entry) {
            entry = { value: create(), users: 0 };
            entries.set(key, entry);
         }
         return entry.value;
      },
      retain(key, value) {
         const entry = entries.get(key);
         if (entry) entry.users += 1;
         else entries.set(key, { value, users: 1 });
      },
      release(key) {
         const entry = entries.get(key);
         if (!entry || entry.users === 0) return;
         entry.users -= 1;
         if (entry.users > 0) return;
         schedule(() => {
            const now = entries.get(key);
            if (now !== entry || entry.users > 0) return;
            entries.delete(key);
            dispose(entry.value);
         });
      },
      has(key) {
         return entries.has(key);
      },
      users(key) {
         return entries.get(key)?.users ?? 0;
      },
   };
}

/** Every override and tint material of the page. */
export const MATERIAL_CACHE: RefCache<Material> = createRefCache<Material>((material) => material.dispose());

/** What a mesh's material becomes: the cached look, with its key, or null to keep the GLB's own. */
export function lookFor(
   source: Material,
   override: MaterialOverride | undefined,
   tint: string | null | undefined,
   cache: RefCache<Material> = MATERIAL_CACHE
): { key: string; material: Material } | null {
   if (override) {
      const key = overrideKey(override, tint);
      return { key, material: cache.get(key, () => createOverrideMaterial(override, tint)) };
   }
   if (tint) {
      const key = tintKey(source, tint);
      return { key, material: cache.get(key, () => createTintedMaterial(source, tint)) };
   }
   return null;
}

/** The looks a model uses: cache key -> material (retain each while the model is mounted). */
export type LookUse = Map<string, Material>;

/** The GLB's own materials of a mesh whose look was changed (so a new look starts from them). */
const ORIGINALS = new WeakMap<Mesh, Material | Material[]>();

/**
 * Gives every mesh of a model's private clone the look (override and/or tint) and returns the cache
 * looks it uses (retain them while mounted; useLookUse in assets.tsx does). Without either it
 * restores the GLB's own materials. Never call it on a shared scene (the loader cache): only on a
 * clone (<Model>, a humanoid rig) or on instanced parts' material lists.
 */
export function applyLook(
   root: Object3D,
   override: MaterialOverride | undefined,
   tint: string | null | undefined,
   cache: RefCache<Material> = MATERIAL_CACHE
): LookUse {
   const keys: LookUse = new Map();
   root.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      let original = ORIGINALS.get(mesh);
      if (!original) {
         original = mesh.material;
         ORIGINALS.set(mesh, original);
      }
      mesh.material = Array.isArray(original)
         ? original.map((m) => pick(m, override, tint, cache, keys))
         : pick(original, override, tint, cache, keys);
   });
   return keys;
}

/** The look of a material (list) of instanced parts: the cached material(s), each look added to `keys`. */
export function lookMaterials(
   material: Material | Material[],
   override: MaterialOverride | undefined,
   tint: string | null | undefined,
   keys: LookUse,
   cache: RefCache<Material> = MATERIAL_CACHE
): Material | Material[] {
   return Array.isArray(material) ? material.map((m) => pick(m, override, tint, cache, keys)) : pick(material, override, tint, cache, keys);
}

function pick(source: Material, override: MaterialOverride | undefined, tint: string | null | undefined, cache: RefCache<Material>, keys: LookUse): Material {
   const look = lookFor(source, override, tint, cache);
   if (!look) return source;
   keys.set(look.key, look.material);
   return look.material;
}
