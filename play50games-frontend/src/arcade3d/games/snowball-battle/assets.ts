// Model fits for snowball-battle. The snow kid and the pine are shared assets; the snowman is the
// shared GLB fitted to this yard's collision box (height 1.60, footprint ±0.70). The igloo and the
// big snowman are this game's own decor, drawn only on levels 4-5 behind the far fence.
import type { LevelId } from "@/arcade3d/types";
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_CHARACTERS, EXPANSION_GLB_SIZE, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Accessor bounds of /models/3d/shared/snowman.glb. The nose makes the horizontal reach wider than the body. */
export const SNOWMAN_GLB = { height: 1.9034, halfWidth: 0.7904 };
export const SNOWMAN_HEIGHT = 1.6;
export const SNOWMAN_RADIUS = 0.7;
export const SNOWMAN_SCALE = SNOWMAN_HEIGHT / SNOWMAN_GLB.height;
/** Height from the uniform scale; XZ stretch brings the nose inside the ±0.70 collision box. */
export const SNOWMAN_STRETCH_XZ = SNOWMAN_RADIUS / (SNOWMAN_GLB.halfWidth * SNOWMAN_SCALE);

const snowman: ModelAsset = {
   id: "snowman",
   url: "/models/3d/shared/snowman.glb",
   scale: SNOWMAN_SCALE,
   stretch: [SNOWMAN_STRETCH_XZ, 1, SNOWMAN_STRETCH_XZ],
   fallback: "sphere",
   fallbackColor: "#f8fafc",
   budget: { ...PROP_BUDGET },
};

/** igloo.glb (this game, Hyper3D) raw bounds, measured on the mesh (assets.test.ts): feet on y = 0, centred on x / z. */
export const IGLOO_GLB = { width: 1.8936, height: 1.0618, depth: 1.9052 } as const;
/** Drawn 2.6 m across (a real igloo hut), so it reads at the fence from across the yard. */
export const IGLOO_WIDTH = 2.6;
export const IGLOO_SCALE = IGLOO_WIDTH / IGLOO_GLB.width;
export const IGLOO_DRAWN = {
   width: IGLOO_WIDTH,
   height: IGLOO_GLB.height * IGLOO_SCALE,
   depth: IGLOO_GLB.depth * IGLOO_SCALE,
} as const;

/** snowmanBig.glb raw bounds, measured on the mesh: arms along ±x, feet on y = 0. */
export const SNOWMAN_BIG_GLB = { width: 1.6304, height: 1.8895, depth: 0.8869 } as const;
/** Drawn 2.2 m tall, topping the yard's own 1.60 m origin snowman. */
export const SNOWMAN_BIG_HEIGHT = 2.2;
export const SNOWMAN_BIG_SCALE = SNOWMAN_BIG_HEIGHT / SNOWMAN_BIG_GLB.height;
export const SNOWMAN_BIG_DRAWN = {
   width: SNOWMAN_BIG_GLB.width * SNOWMAN_BIG_SCALE,
   height: SNOWMAN_BIG_HEIGHT,
   depth: SNOWMAN_BIG_GLB.depth * SNOWMAN_BIG_SCALE,
} as const;

const igloo: ModelAsset = {
   id: "igloo",
   url: "/models/3d/snowball-battle/igloo.glb",
   scale: IGLOO_SCALE,
   fallback: "sphere",
   fallbackColor: "#e2e8f0",
   budget: { ...PROP_BUDGET },
};

const snowmanBig: ModelAsset = {
   id: "snowmanBig",
   url: "/models/3d/snowball-battle/snowmanBig.glb",
   scale: SNOWMAN_BIG_SCALE,
   fallback: "sphere",
   fallbackColor: "#f8fafc",
   budget: { ...PROP_BUDGET },
};

/**
 * The levels whose theme is a built place (meta.ts: Ice Village, Championship Arena): they alone
 * get the igloos and big snowmen behind the far fence.
 */
export const VILLAGE_LEVEL_IDS: readonly LevelId[] = [4, 5];

/**
 * Village decor spots, all behind the far (−z) fence so the follow camera never sees them between
 * itself and a kid. Every footprint clears the 24 x 18 play area (assets.test.ts).
 */
export interface VillageSpot {
   x: number;
   y: number;
   z: number;
   rotY: number;
}

export const IGLOO_SPOTS: readonly VillageSpot[] = [
   { x: -8.4, y: 0, z: -11.7, rotY: 0.5 },
   { x: 0, y: 0, z: -12.8, rotY: -0.3 },
   { x: 8.4, y: 0, z: -11.7, rotY: -0.15 },
];

export const SNOWMAN_BIG_SPOTS: readonly VillageSpot[] = [
   { x: -4.2, y: 0, z: -10.6, rotY: 1.1 },
   { x: 4.2, y: 0, z: -10.6, rotY: -1.9 },
];

/** snowFort.glb (Menu 1 adoption, 3000 tris) raw bounds: a low snow wall, feet on y = 0, centred. */
export const SNOW_FORT_GLB = { width: 1.89, height: 0.399, depth: 1.759 } as const;
/** Drawn 3.2 m long (about 0.67 m tall): spectator forts built beside the yard, outside the fence. */
export const SNOW_FORT_WIDTH = 3.2;
export const SNOW_FORT_SCALE = SNOW_FORT_WIDTH / SNOW_FORT_GLB.width;
export const SNOW_FORT_DRAWN = {
   width: SNOW_FORT_WIDTH,
   height: SNOW_FORT_GLB.height * SNOW_FORT_SCALE,
   depth: SNOW_FORT_GLB.depth * SNOW_FORT_SCALE,
} as const;
const snowFort: ModelAsset = {
   id: "snowFort",
   url: "/models/3d/snowball-battle/snowFort.glb",
   scale: SNOW_FORT_SCALE,
   fallback: "box",
   fallbackColor: "#e2e8f0",
   budget: { ...PROP_BUDGET },
};
/** Side forts beyond both long fences (every level), turned so their long face runs along z. */
export const SNOW_FORT_SPOTS: readonly VillageSpot[] = [
   { x: -14.9, y: 0, z: -5, rotY: Math.PI / 2 },
   { x: -14.9, y: 0, z: 1, rotY: Math.PI / 2 + 0.1 },
   { x: -14.9, y: 0, z: 6.5, rotY: Math.PI / 2 - 0.1 },
   { x: 14.9, y: 0, z: -4, rotY: Math.PI / 2 - 0.1 },
   { x: 14.9, y: 0, z: 2, rotY: Math.PI / 2 },
   { x: 14.9, y: 0, z: 7, rotY: Math.PI / 2 + 0.1 },
];

export const ASSETS = {
   kid: EXPANSION_CHARACTERS.snowKid,
   pine: EXPANSION_ASSETS.pineTree,
   snowman,
   igloo,
   snowmanBig,
   snowFort,
} as const;

export const KID_SCALE = ASSETS.kid.scale ?? 1;
export const PINE_HEIGHT = EXPANSION_GLB_SIZE.pineTree.height * (ASSETS.pine.scale ?? 1);

export const TEAM = ["#38bdf8", "#f87171", "#4ade80", "#fb923c"] as const;
