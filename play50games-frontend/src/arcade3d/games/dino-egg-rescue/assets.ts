import type { ModelAsset } from "@/arcade3d/core/types";
import { DINO_LANDMARKS } from "./dinoGait";
import {
   EXPANSION_ASSETS,
   EXPANSION_GLB_POINTS,
   EXPANSION_GLB_SIZE,
   LEAFY_TREE_TRUNK_RADIUS_GLB,
   PROP_BUDGET,
   expansionPoint,
} from "@/arcade3d/core/sharedAssets";

/**
 * The volcano backdrop GLB measured on the real mesh (assets.test.ts decodes it): floor pivot at
 * y = 0, height 0.8426, footprint radius 1.0029 (max radial vertex, GLB units). Rodin normalised
 * it wider than tall, so the fit takes the 5.5 m footprint from `scale` and stretches y to the old
 * cone's 8 m.
 */
const VOLCANO_GLB = { height: 0.8426, footprintRadius: 1.0029 };
export const VOLCANO_RADIUS = 5.5;
export const VOLCANO_HEIGHT = 8.0;
const VOLCANO_SCALE = VOLCANO_RADIUS / VOLCANO_GLB.footprintRadius;

/**
 * lavaRock.glb (batch 5 companion, Hyper3D 2026-10-25) raw bounds, measured on the real mesh
 * (assets.test.ts decodes it): floor pivot at y = 0, 1.8564 wide x 0.7371 tall x 1.8964 deep
 * (GLB units) — a squat volcanic boulder cluster, wider than tall.
 */
export const LAVA_ROCK_GLB = { width: 1.8564, height: 0.73712, depth: 1.89642 } as const;
/** Drawn 1.8 m across its longest side (the GLB depth); the spot scale varies 0.9-1.25. */
export const LAVA_ROCK_WIDTH = 1.8;
const LAVA_ROCK_SCALE = LAVA_ROCK_WIDTH / LAVA_ROCK_GLB.depth;
export const LAVA_ROCK_DRAWN = {
   width: LAVA_ROCK_GLB.width * LAVA_ROCK_SCALE,
   height: LAVA_ROCK_GLB.height * LAVA_ROCK_SCALE,
   depth: LAVA_ROCK_WIDTH,
} as const;

/**
 * Lava rock boulders ring the valley outside the play bounds on the volcanic levels 4-5
 * (Volcanic Pass, Dino Sanctuary): two on the north bank, one on each flank, all clear of
 * the main volcano base and the decor scatter bands.
 */
export const LAVA_ROCK_SPOTS = [
   { x: -12, z: -14, rotY: 0.4, scale: 1.0 },
   { x: -4.5, z: -13.5, rotY: 1.9, scale: 1.25 },
   { x: -17.5, z: 2, rotY: 2.7, scale: 0.9 },
   { x: 17.5, z: 6.5, rotY: 5.1, scale: 1.1 },
] as const;

/**
 * dinoEgg.glb (Menu 1 adoption, 1500 tris) 1.366 x 1.897 x 1.4, floor pivot at y 0, centred. Drawn 0.4 m tall
 * (the old code egg: 0.15 radius x 1.33 stretch); the golden egg is the same mesh, 0.45 m, in gold.
 */
export const DINO_EGG_GLB = { width: 1.366, height: 1.897, depth: 1.4 } as const;
export const DINO_EGG_HEIGHT = 0.4;
export const GOLDEN_EGG_HEIGHT = 0.45;

/**
 * dinoNestV2.glb (Menu 1 adoption, 4484 tris) 1.856 x 0.625 x 1.801, floor pivot, a shallow straw nest. Drawn
 * 3.6 m across (the old outer radius 1.8) and flattened to ~0.5 m tall so the dino and eggs read over its rim.
 */
export const DINO_NEST_GLB = { width: 1.856, height: 0.625, depth: 1.801 } as const;
export const DINO_NEST_DIAMETER = 3.6;
export const DINO_NEST_HEIGHT = 0.5;
const DINO_NEST_SCALE = DINO_NEST_DIAMETER / DINO_NEST_GLB.width;

export const ASSETS = {
   // the baby triceratops walks on the core quadruped rig (dinoGait.ts DINO_LANDMARKS)
   dino: { ...EXPANSION_ASSETS.dino, quadruped: { landmarks: DINO_LANDMARKS } },
   rock: {
      ...EXPANSION_ASSETS.rock,
      scale: 1.0,
      stretch: [
         1.0 / EXPANSION_GLB_SIZE.rock.width,
         1.0 / EXPANSION_GLB_SIZE.rock.height,
         1.0 / EXPANSION_GLB_SIZE.rock.depth,
      ] as const,
   },
   leafyTree: EXPANSION_ASSETS.leafyTree,
   volcano: {
      id: "volcano",
      url: "/models/3d/dino-egg-rescue/volcano.glb",
      scale: VOLCANO_SCALE,
      stretch: [1, VOLCANO_HEIGHT / (VOLCANO_GLB.height * VOLCANO_SCALE), 1] as const,
      fallback: "cylinder",
      fallbackColor: "#292524",
      budget: { ...PROP_BUDGET },
   },
   dinoEgg: {
      id: "dinoEgg",
      url: "/models/3d/dino-egg-rescue/dinoEgg.glb",
      scale: DINO_EGG_HEIGHT / DINO_EGG_GLB.height,
      fallback: "sphere",
      fallbackColor: "#f5e6c8",
      budget: { ...PROP_BUDGET },
   },
   goldenEgg: {
      id: "goldenEgg",
      url: "/models/3d/dino-egg-rescue/dinoEgg.glb",
      scale: GOLDEN_EGG_HEIGHT / DINO_EGG_GLB.height,
      material: "gold",
      fallback: "sphere",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
   dinoNest: {
      id: "dinoNest",
      url: "/models/3d/dino-egg-rescue/dinoNestV2.glb",
      scale: DINO_NEST_SCALE,
      stretch: [1, DINO_NEST_HEIGHT / (DINO_NEST_GLB.height * DINO_NEST_SCALE), 1] as const,
      fallback: "cylinder",
      fallbackColor: "#d4a24c",
      budget: { ...PROP_BUDGET },
   },
   lavaRock: {
      id: "lavaRock",
      url: "/models/3d/dino-egg-rescue/lavaRock.glb",
      scale: LAVA_ROCK_SCALE,
      fallback: "sphere",
      fallbackColor: "#292524",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** Leafy tree trunk radius in metres, scaled from GLB units. */
export const TREE_TRUNK_RADIUS =
   LEAFY_TREE_TRUNK_RADIUS_GLB * (EXPANSION_ASSETS.leafyTree.scale ?? 1);

/** Anchor point for the egg stack on the baby dino's back (metres). */
export const DINO_BACK_TOP_ANCHOR = expansionPoint(
   EXPANSION_ASSETS.dino,
   EXPANSION_GLB_POINTS.dinoBackTop
);

export const ASSET_DIMENSIONS = {
   dino: { length: 1.1, height: 0.8 },
   boulder: { diameter: 1.0 },
   leafyTree: { height: 3.5, trunkRadius: TREE_TRUNK_RADIUS },
   egg: { width: 0.4, height: 0.3, glowDiscRadius: 0.5 },
   goldenEgg: { width: 0.45, height: 0.35, glowDiscRadius: 0.6 },
   nest: { diameter: 3.6, deliveryRadius: 1.4 },
} as const;
