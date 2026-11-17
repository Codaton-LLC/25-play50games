// Color Arena Survival's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts,
// each its own GLB). This game's own: the Prism Keeper (m2PrismArenaBoss, from the user's new Hyper3D
// batch in p50-assets/hyper3d-new, optimized here with tools/hyper3d's optimizer: 15k triangles, 1024 px
// webp, no credits spent) and the colour beacon (m2ColorBeacon, the same Hyper3D prop Portal Hop uses,
// copied in), the floor tile (m2SurvivalFloorTile, the card's recolourable tile, tinted per tile) and the
// safe marker (m2SafeMarker), both from ready/menu2/color-arena-survival. Shared menu2: the fortress gate
// (the backdrop), islands B-D (drifting decor) and the colour orb. The arena rim, the pit, the sweeper bar
// (menu2/props SweeperBar), the shock ring and the prism shards are built in code. Every GLB is one mesh, feet
// on y = 0, centred on x and z; GLB_SIZE is the real bounds (assets.test.ts measures each mesh).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2PrismArenaBoss: the Prism Keeper (its face along +z) */
   keeper: { x: 1.9, y: 1.478, z: 1.184 },
   /** m2ColorBeacon: the arena's big beacon and the level 5 beacon on a tile */
   beacon: { x: 0.485, y: 1.91, z: 0.448 },
   /** the shared menu2 fortress gate (the backdrop) */
   gate: { x: 1.895, y: 1.346, z: 1.071 },
   /** m2SurvivalFloorTile: a bevelled square slab, pale grey (tinted per tile); its top is its y */
   tile: { x: 1.718, y: 0.264, z: 1.89 },
   /** m2SafeMarker: a low stone disc with a glowing ring and a short flag post */
   safe: { x: 1.854, y: 0.961, z: 1.894 },
   /** the shared menu2 colour orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
   islandB: { x: 1.918, y: 1.439, z: 1.816 },
   islandC: { x: 1.498, y: 1.849, z: 1.666 },
   islandD: { x: 1.761, y: 1.571, z: 1.89 },
} as const;

/** Drawn sizes (m): the Keeper 7 m wide, the arena beacon 4.2 m tall, a tile beacon 1.6 m, the orb 0.6 m, the gate 34 m wide. */
export const KEEPER_W = 7;
export const BEACON_H = 4.2;
export const TILE_BEACON_H = 1.6;
export const ORB_SIZE = 0.6;
export const GATE_W = 34;
/** A tile is drawn this thick under its top (m); the safe marker this wide (one tile). */
export const TILE_DRAWN_H = 0.4;
export const SAFE_W = 1.8;

const prop = (id: string, color: string): ModelAsset => ({ id, url: `/models/3d/color-arena-survival/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET });
const menu2 = (id: string, color: string): ModelAsset => ({ id, url: `/models/3d/menu2/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET });

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   keeper: { id: "m2PrismArenaBoss", url: "/models/3d/color-arena-survival/m2PrismArenaBoss.glb", fallback: "box", fallbackColor: "#a855f7", budget: CHARACTER_BUDGET },
   beacon: prop("m2ColorBeacon", "#f0abfc"),
   tile: prop("m2SurvivalFloorTile", "#e2e8f0"),
   safe: prop("m2SafeMarker", "#e2e8f0"),
   gate: menu2("skyFortressGate", "#94a3b8"),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#c084fc", budget: PROP_BUDGET },
   islandB: menu2("islandB", "#94a3b8"),
   islandC: menu2("islandC", "#94a3b8"),
   islandD: menu2("islandD", "#94a3b8"),
};
