// Models used by Clean the City. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Only urls listed in core/modelManifest.ts are fetched. tinCan and banana are; the rest go
// straight to the primitive fallbacks in Primitives.tsx, so swapping a GLB in later is a scale
// tweak here, never a scene change. Collision never comes from a model (rules.ts).
//
// Rodin makes the longest side about 1.9 and the optimize step stands the mesh on y = 0.
// Measured (w x h x d): tinCan 1.83 x 1.69 x 1.90, banana 1.90 x 1.56 x 1.85. Scale 0.5 makes
// the longest side 0.95, inside the README's drawn size of about 0.9-1.0. The pickup circle
// stays r = 0.3 whatever the mesh does. The stand-in parts are authored at that drawn size
// already (DynamicInstancedModel does not scale fallbackParts by asset.scale).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const LITTER_SCALE = 0.5;

const prop = (id: string, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/clean-city/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
});

export const ASSETS = {
   // shared cast. No GLB yet: Scene draws PrimitiveRunner until the core humanoid rig lands.
   runner: { ...SHARED_ASSETS.runner },
   // shared litter (public/models/3d/shared/*.glb), longest side 0.95
   tinCan: { ...SHARED_ASSETS.tinCan, scale: LITTER_SCALE },
   banana: { ...SHARED_ASSETS.banana, scale: LITTER_SCALE },
   // this game only (./assets.spec.json). Not generated yet: primitive fallbacks, scale 1.
   // When a GLB lands (longest side ~1.9), set scale to LITTER_SCALE here.
   bottle: { ...prop("bottle", "cylinder", "#4ade80"), scale: 1 },
   bag: { ...prop("bag", "box", "#d6a46b"), scale: 1 },
   // scenery, not in assets.spec.json (README: stay primitives). Same swap path.
   bench: prop("bench", "box", "#c4a574"),
   tree: prop("tree", "cylinder", "#166534"),
   bin: prop("bin", "cylinder", "#475569"),
   building: prop("building", "box", "#64748b"),
   lamp: prop("lamp", "cylinder", "#94a3b8"),
   palm: prop("palm", "cylinder", "#15803d"),
   umbrella: prop("umbrella", "cylinder", "#38bdf8"),
} satisfies Record<string, ModelAsset>;

/** Drawn litter size the stand-ins are built at (the GLBs reach it through LITTER_SCALE). */
export const LITTER_DRAW = 0.95;
