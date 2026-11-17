// Bee Garden models: the ready Hyper3D GLBs (menu1-bee-garden), fitted from their measured bounds
// (assets.test.ts checks every fit on the real mesh). Gameplay props are fitted to their size in metres.
// Decor is fitted to 1 m (height; the planter its length), so the decor spot's `scale` is its size and
// nothing is scaled twice.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   bee: { width: 1.9004, height: 1.3847, depth: 1.2122 },
   beehive: { width: 1.4343, height: 1.8994, depth: 1.4372 },
   flowerA: { width: 1.0511, height: 1.9054, depth: 0.5107 },
   flowerB: { width: 0.7929, height: 1.8909, depth: 0.6031 },
   flowerC: { width: 1.1687, height: 1.9005, depth: 0.4411 },
   nectarOrb: { width: 1.9071, height: 1.9025, depth: 1.8966 },
   bigLeaf: { width: 1.3448, height: 1.8969, depth: 0.5339 },
   branchV2: { width: 1.8915, height: 1.2451, depth: 0.4915 },
   spiderWeb: { width: 1.9131, height: 1.8057, depth: 0.2538 },
   vegetablePlanter: { width: 1.8949, height: 0.627, depth: 1.2232 },
   wateringCan: { width: 0.784, height: 1.3079, depth: 1.8895 },
   gardenMushroom: { width: 1.8974, height: 1.0921, depth: 1.0186 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   /** wing tip to wing tip */
   beeSpan: 0.8,
   /** under the flight height, so the hive never hides the bee from the camera */
   hiveHeight: 0.85,
   /** the bloom sits just under the flight height (1.15) */
   flowerHeight: 0.95,
   orbSize: 0.3,
   /** the orb's bottom on the bloom */
   orbY: 0.98,
   /** a branch is a solid circle of radius 0.5: the twig stands upright, 1.6 m, over the flight height */
   branchLength: 1.6,
   webWidth: 1.4,
   /** the web hangs from webLift so its middle is at the flight height */
   webLift: 0.45,
} as const;

const BEE_SCALE = FIT.beeSpan / GLB_SIZE.bee.width;
const BRANCH_SCALE = FIT.branchLength / GLB_SIZE.branchV2.width;

/**
 * The branch GLB lies along x with its leaves up (y). Stood on end: turned +90° about z (x → y, y → -x),
 * lifted by half its length so the cut end is on the floor, and moved back by half its height so the
 * twig is centred on the solid circle.
 */
export const BRANCH_UPRIGHT = {
   position: [(GLB_SIZE.branchV2.height * BRANCH_SCALE) / 2, FIT.branchLength / 2, 0] as [number, number, number],
   rotation: [0, 0, Math.PI / 2] as [number, number, number],
} as const;
const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/bee-garden/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
   ...fit,
});
const unit = (h: number) => 1 / h;

export const ASSETS = {
   // the bee is the player: centred on its flight point (yOffset), 12k verts, one mesh
   bee: local("bee", { scale: BEE_SCALE, yOffset: (-GLB_SIZE.bee.height * BEE_SCALE) / 2, budget: { tris: 20000, bytes: 400_000 } }, "sphere", "#fbbf24"),
   beehive: local("beehive", { scale: FIT.hiveHeight / GLB_SIZE.beehive.height }, "cylinder", "#f59e0b"),
   flowerA: local("flowerA", { scale: FIT.flowerHeight / GLB_SIZE.flowerA.height }, "cylinder", "#f43f5e"),
   flowerB: local("flowerB", { scale: FIT.flowerHeight / GLB_SIZE.flowerB.height }, "cylinder", "#8b5cf6"),
   flowerC: local("flowerC", { scale: FIT.flowerHeight / GLB_SIZE.flowerC.height }, "cylinder", "#38bdf8"),
   nectarOrb: local("nectarOrb", { scale: FIT.orbSize / GLB_SIZE.nectarOrb.height }, "sphere", "#fbbf24"),
   branch: local("branchV2", { scale: BRANCH_SCALE }, "cylinder", "#78350f"),
   spiderWeb: local("spiderWeb", { scale: FIT.webWidth / GLB_SIZE.spiderWeb.width, yOffset: FIT.webLift }, "box", "#e2e8f0"),
   // decor, 1 m tall / long: the spot's scale is the size in metres
   bigLeaf: local("bigLeaf", { scale: unit(GLB_SIZE.bigLeaf.height) }, "box", "#22c55e"),
   planter: local("vegetablePlanter", { scale: unit(GLB_SIZE.vegetablePlanter.width) }, "box", "#ca8a04"),
   wateringCan: local("wateringCan", { scale: unit(GLB_SIZE.wateringCan.height) }, "cylinder", "#0284c7"),
   mushroom: {
      id: "gardenMushroom",
      url: "/models/3d/shared/gardenMushroom.glb",
      scale: unit(GLB_SIZE.gardenMushroom.height),
      fallback: "sphere",
      fallbackColor: "#dc2626",
      budget: { ...PROP_BUDGET },
   },
   leafyTree: { ...EXPANSION_ASSETS.leafyTree, scale: unit(EXPANSION_GLB_SIZE.leafyTree.height) },
} satisfies Record<string, ModelAsset>;
