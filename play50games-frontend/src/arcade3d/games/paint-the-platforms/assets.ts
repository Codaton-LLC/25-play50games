// Paint the Platforms' models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). This
// game's props live in public/models/3d/paint-the-platforms (Hyper3D, generated for this game, neutral
// pale materials recoloured at runtime): the arena floor tile (every tile, tinted by its paint), the
// arena wall (the rims), the paint pickup (paint blobs, Vexa's caged blob, Nami's gold blob) and the
// Paint Blob (the level 5 boss; small and grey, the blots). Shared from menu2: the floating islands
// and stone towers of the fortress backdrop. Every GLB stands on y = 0, centred on x and z; GLB_SIZE is
// the real bounds (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { TILE } from "./course";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   tile: { x: 1.253, y: 0.127, z: 1.883 },
   wall: { x: 1.899, y: 0.622, z: 1.849 },
   pickup: { x: 1.519, y: 1.888, z: 1.484 },
   blob: { x: 1.896, y: 1.876, z: 1.283 },
   island: { x: 1.918, y: 1.439, z: 1.816 },
   tower: { x: 1.648, y: 1.905, z: 1.589 },
} as const;

/** A tile is drawn 1.92 m square (a 4 cm seam to the next) and 0.16 m thick, its top on the floor. */
export const TILE_DRAWN = TILE - 0.08;
export const TILE_THICK = 0.16;
export const TILE_STRETCH: [number, number, number] = [TILE_DRAWN / GLB_SIZE.tile.x, TILE_THICK / GLB_SIZE.tile.y, TILE_DRAWN / GLB_SIZE.tile.z];
/** A paint blob stands 0.9 m tall; the Paint Blob 4.2 m; a grey blot 1.1 m. */
export const PICKUP_SCALE = 0.9 / GLB_SIZE.pickup.y;
export const BLOB_SCALE = 4.2 / GLB_SIZE.blob.y;
export const BLOT_SCALE = 1.1 / GLB_SIZE.blob.y;

const prop = (id: string, color: string, dir = "paint-the-platforms", budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/${dir}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   tile: prop("m2ArenaFloorTile", "#94a3b8"),
   wall: prop("m2ArenaWall", "#64748b"),
   pickup: { ...prop("m2PaintPickup", "#f8fafc"), fallback: "sphere" },
   blob: prop("m2PaintBlobBoss", "#64748b", "paint-the-platforms", CHARACTER_BUDGET),
   island: prop("islandB", "#475569", "menu2"),
   tower: prop("stoneTower", "#475569", "menu2"),
};
