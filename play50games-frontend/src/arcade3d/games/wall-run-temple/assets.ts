// Wall Run Temple's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts); Umbra is
// the shared m2ShadowArmadillo. Props live in public/models/3d/wall-run-temple. Every GLB has its feet on
// y = 0, centred on x and z (the optimizer's pivot). GLB_SIZE is the real mesh (assets.test.ts).
// Code stays for: the ram's long chains, the hollow-top fillers of the gap platforms, the moss, orbs,
// darts and the top glyph's glow (markers, ropes and effects).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), metres in the file. */
export const GLB_SIZE = {
   cliff: { x: 1.846, y: 1.527, z: 1.888 },
   goldOrb: { x: 1.756, y: 1.894, z: 1.764 },
   column: { x: 1.056, y: 1.9, z: 1.056 },
   ram: { x: 1.438, y: 1.9, z: 0.854 },
   platform: { x: 1.852, y: 0.545, z: 1.902 },
   shrine: { x: 1.716, y: 1.895, z: 1.27 },
   wall: { x: 1.9, y: 1.155, z: 0.256 },
   marker: { x: 1.892, y: 1.901, z: 0.242 },
   spikes: { x: 1.904, y: 1.043, z: 0.276 },
   umbra: { x: 1.298, y: 1.535, z: 1.894 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
} as const;

/** The gap platform's walkable top (file metres over its feet): its raised frame; the hollow middle is filled in code. */
export const PLATFORM_TOP = 0.54;
/** One wall tile as drawn (m): the brick slab stretched to this width and height. */
export const TILE_W = 5.0;
export const TILE_H = 3.0;
/** A column is drawn as stacked segments this tall (m). */
export const COLUMN_SEG = 4;
/** Umbra is drawn this long (m). */
export const UMBRA_LENGTH = 1.9;
/** The ram's log: the GLB at this uniform scale; its own chains, then code chains up to the pivot. */
export const RAM_SCALE = 1.7;
/** The log's centre over the GLB's feet (file metres): measured on the mesh's lower band. */
export const RAM_LOG_Y = 0.42;

const prop = (id: string, color: string, url = `/models/3d/wall-run-temple/${id}.glb`): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   cliff: prop("m2CliffTempleBg", "#c9a26b"),
   goldOrb: { ...prop("m2GoldRingOrb", "#2dd4bf"), fallback: "sphere" },
   column: { ...prop("m2StoneColumn", "#d6b98a"), fallback: "cylinder" },
   ram: prop("m2SwingingStoneRam", "#8b8b7a"),
   platform: prop("m2TempleGapPlatform", "#d9b98a"),
   shrine: prop("m2TempleWall", "#cfae7c"),
   wall: prop("m2TempleWallV2", "#c8a877"),
   marker: prop("m2WallRunMarker", "#a8a29e"),
   spikes: prop("m2WallSpikePanel", "#9ca3af"),
   umbra: { ...prop("m2ShadowArmadillo", "#6d28d9", "/models/3d/menu2/m2ShadowArmadillo.glb"), budget: CHARACTER_BUDGET },
   beacon: { ...prop("checkpointBeacon", "#4ade80", "/models/3d/menu2/checkpointBeacon.glb"), fallback: "cylinder" },
};

/** Scale that makes a GLB axis `size` draw as `metres`. */
export function fit(size: number, metres: number): number {
   return metres / size;
}
