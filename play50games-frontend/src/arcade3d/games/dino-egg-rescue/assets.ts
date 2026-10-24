import type { ModelAsset } from "@/arcade3d/core/types";
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

export const ASSETS = {
   dino: EXPANSION_ASSETS.dino,
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
