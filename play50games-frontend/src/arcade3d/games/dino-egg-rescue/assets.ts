import type { ModelAsset } from "@/arcade3d/core/types";
import {
   EXPANSION_ASSETS,
   EXPANSION_GLB_POINTS,
   EXPANSION_GLB_SIZE,
   LEAFY_TREE_TRUNK_RADIUS_GLB,
   expansionPoint,
} from "@/arcade3d/core/sharedAssets";

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
