// Models for Wizard Potion Lab (public/models/3d/wizard-potion-lab/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9);
// assets.test.ts checks the drawn size on the real meshes. Props stand on y = 0, centred on x / z.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   wizard: { x: 1.902, y: 1.867, z: 0.509 },
   mushroom: { x: 1.897, y: 1.092, z: 1.019 },
   crystal: { x: 1.896, y: 1.29, z: 1.867 },
   berry: { x: 1.914, y: 0.828, z: 1.625 },
   flower: { x: 1.735, y: 1.879, z: 0.772 },
   herb: { x: 1.836, y: 1.342, z: 1.064 },
   bottle: { x: 1.377, y: 1.898, z: 1.385 },
   shelf: { x: 1.609, y: 1.894, z: 0.421 },
   table: { x: 1.888, y: 1.698, z: 1.78 },
   book: { x: 1.898, y: 0.618, z: 1.713 },
   ball: { x: 1.213, y: 1.902, z: 1.26 },
   candle: { x: 1.636, y: 1.905, z: 1.639 },
} as const;

export const WIZARD_HEIGHT = 1.7;
export const WIZARD_SCALE = WIZARD_HEIGHT / GLB_SIZE.wizard.y;
/** Drawn size of each ingredient: its biggest side in metres. */
export const INGREDIENT_SIZE = { mushroom: 0.44, crystal: 0.42, berry: 0.42, flower: 0.5, herb: 0.45, bottle: 0.5 } as const;
export const SHELF_WIDTH = 1.2;
export const TABLE_WIDTH = 1.1;
/** The table top, where the book and the ball stand (Scene places them at 0.78). */
export const TABLE_HEIGHT = 0.78;
export const BOOK_LENGTH = 0.36;
export const BALL_HEIGHT = 0.32;
export const CANDLE_HEIGHT = 0.34;

/**
 * The wizard's joints (GLB units: 1.902 x 1.867 x 0.509 T-pose, faces +z; a pointed hat, a long
 * flared robe with wide sleeves). The estimate from the mesh (the character test pins it).
 */
export const WIZARD_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.1539,
   shoulderX: 0.3537,
   shoulderZ: -0.016,
   armRadius: 0.1605,
   clavicleX: 0.1768,
   elbowX: 0.5627,
   wristX: 0.7718,
   armSpread: 0.2319,
   crotchY: 0.739,
   hipY: 0.8082,
   hipX: 0.1842,
   hipZ: -0.0491,
   kneeY: 0.4041,
   ankleY: 0.1664,
   toeZ: 0.2267,
   heelZ: -0.1401,
   legDepth: 0.0966,
   legOuterX: 0.2865,
   hemY: 0.5445,
   spineY: 0.9119,
   chestY: 1.0156,
   neckY: 1.3691,
   headY: 1.4002,
   spineZ: 0.0455,
   shoulderBlend: 0.0963,
   elbowBlend: 0.0803,
   hipBlend: 0.0808,
   kneeBlend: 0.0606,
   ankleBlend: 0.0419,
   crotchBlend: 0.0584,
   spineBlend: 0.0311,
   neckBlend: 0.0156,
};

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   extra: Partial<ModelAsset> = {},
   budget: ModelAsset["budget"] = PROP_BUDGET,
   url = `/models/3d/wizard-potion-lab/${id}.glb`,
): ModelAsset => ({ id, url, fallback, fallbackColor, budget, ...extra });

const longest = (g: { x: number; y: number; z: number }) => Math.max(g.x, g.y, g.z);

export const ASSETS = {
   wizard: local("charWizard", "capsule", "#5b21b6", { scale: WIZARD_SCALE, humanoid: { landmarks: WIZARD_LANDMARKS } }, CHARACTER_BUDGET),
   cauldron: EXPANSION_ASSETS.cauldron,
   mushroom: local("gardenMushroom", "sphere", "#fb923c", { scale: INGREDIENT_SIZE.mushroom / longest(GLB_SIZE.mushroom) }, PROP_BUDGET, "/models/3d/shared/gardenMushroom.glb"),
   crystal: local("magicCrystal", "box", "#67e8f9", { scale: INGREDIENT_SIZE.crystal / longest(GLB_SIZE.crystal) }),
   berry: local("berryBunch", "sphere", "#fb7185", { scale: INGREDIENT_SIZE.berry / longest(GLB_SIZE.berry) }),
   flower: local("magicFlower", "sphere", "#f0abfc", { scale: INGREDIENT_SIZE.flower / longest(GLB_SIZE.flower) }),
   herb: local("herbBundle", "sphere", "#86efac", { scale: INGREDIENT_SIZE.herb / longest(GLB_SIZE.herb) }),
   bottle: local("potionBottle", "cylinder", "#c4b5fd", { scale: INGREDIENT_SIZE.bottle / longest(GLB_SIZE.bottle) }),
   shelf: local("bookshelfFull", "box", "#44403c", { scale: SHELF_WIDTH / GLB_SIZE.shelf.x }),
   table: local("alchemyTable", "box", "#44403c", {
      scale: TABLE_WIDTH / GLB_SIZE.table.x,
      stretch: [1, TABLE_HEIGHT / (GLB_SIZE.table.y * (TABLE_WIDTH / GLB_SIZE.table.x)), 1],
   }),
   book: local("spellBook", "box", "#7c3aed", { scale: BOOK_LENGTH / GLB_SIZE.book.x }),
   ball: local("crystalBall", "sphere", "#67e8f9", { scale: BALL_HEIGHT / GLB_SIZE.ball.y }),
   candle: local("candle", "cylinder", "#f5f5f4", { scale: CANDLE_HEIGHT / GLB_SIZE.candle.y }),
} satisfies Record<string, ModelAsset>;
