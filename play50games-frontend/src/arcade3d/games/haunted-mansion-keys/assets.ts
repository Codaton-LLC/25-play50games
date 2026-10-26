// Haunted Mansion Keys models: the ready Hyper3D GLBs (menu1-haunted-mansion-keys + shared furniture),
// fitted from their measured bounds (assets.test.ts checks every fit on the real mesh).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { CHEST_TOP, DOOR_WIDTH, PROP_SIZE } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   charDetective: { width: 1.8973, height: 1.8652, depth: 0.475 },
   skeletonKey: { width: 0.749, height: 1.9025, depth: 0.2473 },
   mansionDoor: { width: 1.4558, height: 1.9044, depth: 0.6277 },
   wallLeverV2: { width: 1.8159, height: 1.8998, depth: 0.8637 },
   grandfatherClock: { width: 0.6763, height: 1.8978, depth: 0.4774 },
   paintingFrame: { width: 1.6527, height: 1.9018, depth: 0.2672 },
   armourStand: { width: 0.8058, height: 1.9017, depth: 0.7495 },
   woodenChair: { width: 0.9054, height: 1.8967, depth: 1.0048 },
   table: { width: 1.896, height: 0.8729, depth: 0.9264 },
   bookshelf: { width: 0.8399, height: 1.903, depth: 0.3048 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   detective: 1.8,
   /** the key stands upright on its pedestal, 0.42 m tall */
   key: 0.42,
   /** doors fill the doorway; drawn 1.5 m tall so a closed door never hides the detective behind it */
   doorHeight: 1.5,
   doorDepth: 0.22,
   lever: 0.55,
   clock: 2.0,
   painting: 0.95,
   armour: 1.85,
   chair: 0.95,
   bookshelf: 2.0,
} as const;

/**
 * charDetective.glb (Hyper3D image-to-3D, 19k verts, 473 KB): a static T-pose facing +z, 1.8652 tall
 * with a 1.897 arm span, auto-rigged (core/rig). The estimate's set (detective.test.ts compares it); the
 * coat bridges the legs down to hemY 0.513 (skirt weights).
 */
export const DETECTIVE_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2689,
   shoulderX: 0.2651,
   shoulderZ: -0.0485,
   armRadius: 0.0795,
   clavicleX: 0.1325,
   elbowX: 0.5043,
   wristX: 0.7436,
   armSpread: 0.1877,
   crotchY: 0.7772,
   hipY: 0.8533,
   hipX: 0.1812,
   hipZ: -0.0811,
   kneeY: 0.4267,
   ankleY: 0.1565,
   toeZ: 0.1769,
   heelZ: -0.1519,
   legDepth: 0.0748,
   legOuterX: 0.2893,
   hemY: 0.5129,
   spineY: 0.978,
   chestY: 1.1027,
   neckY: 1.4533,
   headY: 1.5,
   spineZ: 0.0286,
   shoulderBlend: 0.0477,
   elbowBlend: 0.0397,
   hipBlend: 0.0853,
   kneeBlend: 0.064,
   ankleBlend: 0.0477,
   crotchBlend: 0.0883,
   spineBlend: 0.0374,
   neckBlend: 0.0233,
};

export const DETECTIVE_SCALE = FIT.detective / GLB_SIZE.charDetective.height;
export const DETECTIVE_HEIGHT = FIT.detective;

const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string, folder = "haunted-mansion-keys"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
   ...fit,
});

const doorScale = DOOR_WIDTH / GLB_SIZE.mansionDoor.width;
const chairScale = FIT.chair / GLB_SIZE.woodenChair.height;
const tableScale = PROP_SIZE.table.w / GLB_SIZE.table.width;
const shelfScale = FIT.bookshelf / GLB_SIZE.bookshelf.height;
const chestScale = PROP_SIZE.chest.w / EXPANSION_GLB_SIZE.chest.width;

export const ASSETS = {
   detective: {
      ...local("charDetective", { scale: DETECTIVE_SCALE }, "capsule", "#475569"),
      budget: { ...CHARACTER_BUDGET },
      humanoid: { landmarks: DETECTIVE_LANDMARKS },
   },
   key: local("skeletonKey", { scale: FIT.key / GLB_SIZE.skeletonKey.height }, "cylinder", "#f59e0b"),
   door: local(
      "mansionDoor",
      { scale: doorScale, stretch: [1, FIT.doorHeight / (GLB_SIZE.mansionDoor.height * doorScale), FIT.doorDepth / (GLB_SIZE.mansionDoor.depth * doorScale)] },
      "box",
      "#451a03"
   ),
   lever: local("wallLeverV2", { scale: FIT.lever / GLB_SIZE.wallLeverV2.height }, "box", "#78716c"),
   clock: local("grandfatherClock", { scale: FIT.clock / GLB_SIZE.grandfatherClock.height }, "box", "#78350f"),
   painting: local("paintingFrame", { scale: FIT.painting / GLB_SIZE.paintingFrame.height }, "box", "#d97706"),
   armour: local("armourStand", { scale: FIT.armour / GLB_SIZE.armourStand.height }, "cylinder", "#94a3b8"),
   chair: local("woodenChair", { scale: chairScale }, "box", "#92400e", "shared"),
   table: local("table", { scale: tableScale, stretch: [1, 1, PROP_SIZE.table.d / (GLB_SIZE.table.depth * tableScale)] }, "box", "#78350f", "shared"),
   bookshelf: local("bookshelf", { scale: shelfScale }, "box", "#57534e", "shared"),
   /** grounds decor, fitted to 1 m tall: the spot's scale is its height (looks.ts groundsSpots) */
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: 1 / EXPANSION_GLB_SIZE.leafyTree.height },
   chest: { ...EXPANSION_ASSETS.chest, scale: chestScale, stretch: [1, CHEST_TOP / (EXPANSION_GLB_SIZE.chest.height * chestScale), PROP_SIZE.chest.d / (EXPANSION_GLB_SIZE.chest.depth * chestScale)] },
} satisfies Record<string, ModelAsset>;
