// Models used by Pirate Cannon Battle. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes), the scene files draw them. The ship is this game's own
// GLB (assets.spec.json); the cannon and the chest are expansion props, the barrel and the palm are
// reused from the original games, the crate is shared. Every fit is derived from measured GLB bounds
// (GLB units, w x h x d; optimize centres x and z and stands the model on y = 0) and checked on the
// real meshes in assets.test.ts.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, REUSED_ASSETS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { COLORS } from "./looks";

/** The sloop is 6 m long (the expansion default fit); dinghy x0.5 and galleon x1.5 per copy (rules SHIPS.scale). */
const SHIP_SCALE = 6 / EXPANSION_GLB_SIZE.ship.depth;
/** The ship's waterline (GLB y 0.2) is drawn on the water (y 0). */
export const SHIP_WATERLINE = EXPANSION_GLB_POINTS.shipWaterline.y * SHIP_SCALE;
/** The sloop's mast top over the waterline (m): the pennant flies there. GLB mast tip y 1.629. */
export const SHIP_MAST_TOP = 1.629 * SHIP_SCALE - SHIP_WATERLINE;

/** barrel.glb 1.736 x 1.898 x 1.736: drawn 0.9 m tall, half of it under the water. */
export const BARREL_GLB_HEIGHT = 1.898;
export const BARREL_HEIGHT = 0.9;

/** palm.glb 1.775 x 1.903 x 1.782: 3.6 m tall with a 2.6 m crown; the trunk base is at GLB (0, 0.19). */
export const PALM_GLB = { width: 1.775, height: 1.903, depth: 1.782, baseZ: 0.19 } as const;
export const PALM_SIZE = { height: 3.6, crown: 2.6 } as const;
const PALM_XZ = PALM_SIZE.crown / PALM_GLB.width;
/** How far the palm's trunk base is drawn from its origin along +z (m): the origin goes on the rules' trunk minus this. */
export const PALM_BASE_Z = PALM_GLB.baseZ * (PALM_SIZE.crown / PALM_GLB.depth);

/** crate.glb 1.880 wide: flotsam 0.8 m across. */
export const CRATE_SIZE = 0.8;
const CRATE_GLB_WIDTH = 1.88;

/** The chest floats with its lid just above the water. */
export const CHEST_DRAFT = 0.25;

export const ASSETS = {
   ship: { ...EXPANSION_ASSETS.ship, yOffset: -SHIP_WATERLINE },
   cannon: EXPANSION_ASSETS.cannon,
   barrel: {
      ...REUSED_ASSETS.barrel,
      id: "powderBarrel",
      scale: BARREL_HEIGHT / BARREL_GLB_HEIGHT,
      yOffset: -BARREL_HEIGHT / 2,
      material: { color: COLORS.barrel, roughness: 0.65 },
   },
   chest: { ...EXPANSION_ASSETS.chest, yOffset: -CHEST_DRAFT },
   palm: {
      ...REUSED_ASSETS.palm,
      scale: PALM_XZ,
      stretch: [1, PALM_SIZE.height / PALM_GLB.height / PALM_XZ, PALM_SIZE.crown / PALM_GLB.depth / PALM_XZ] as const,
   },
   crate: { ...SHARED_ASSETS.crate, scale: CRATE_SIZE / CRATE_GLB_WIDTH },
} satisfies Record<string, ModelAsset>;

export { SHIP_SCALE };
