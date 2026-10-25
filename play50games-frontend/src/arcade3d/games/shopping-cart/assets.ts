// Models used by Crazy Shopping Cart.
// Cart is EXPANSION_ASSETS.cart (assets.spec.json). Pusher is SHARED_ASSETS.runner.
// Shoppers are EXPANSION_CHARACTERS (shopperA, shopperB, shopperC).
// Products are 10 kinds from SHARED, REUSED, and EXPANSION assets.
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   EXPANSION_ASSETS,
   EXPANSION_CHARACTERS,
   EXPANSION_GLB_SIZE,
   PROP_BUDGET,
   REUSED_ASSETS,
   RUNNER_LANDMARKS,
   SHARED_ASSETS,
} from "@/arcade3d/core/sharedAssets";

export const RUNNER_SCALE = 0.825; // 1.556 m tall

/**
 * supermarketShelfV2.glb (Hyper3D 2026-10-25, QA "OK-ish"): stocked on both faces.
 * Measured on the mesh (assets.test.ts). One bay is fitted to 1.2 x 2.0 x 2.0; six bays tile
 * each rules shelf (1.2 x 2.2 x 12, z -7.5..4.5) so the mesh stays inside the collision box.
 */
export const SHELF_GLB = { width: 1.6425, height: 1.8818, depth: 1.8573 } as const;
export const SHELF_BAY = { width: 1.2, height: 2, depth: 2 } as const;
const SHELF_SCALE = SHELF_BAY.height / SHELF_GLB.height;
export const SHELF_STRETCH = [
   SHELF_BAY.width / (SHELF_GLB.width * SHELF_SCALE),
   1,
   SHELF_BAY.depth / (SHELF_GLB.depth * SHELF_SCALE),
] as const;
/** Centres of the four aisle shelves (rules SHELVES). */
const SHELF_X = [-9, -4, 1, 6] as const;
const SHELF_Z0 = -7.5;
export const SHELF_BAYS = SHELF_X.flatMap((x) =>
   Array.from({ length: 6 }, (_, i) => ({ x, y: 0, z: SHELF_Z0 + SHELF_BAY.depth / 2 + i * SHELF_BAY.depth }))
);

/** bakeryStand.glb (Group D, QA "OK"). A 2.4 m stall. Spots are north of the store, outside PLAY_BOUNDS. */
export const BAKERY_GLB = { width: 1.478, height: 1.8913, depth: 1.5569 } as const;
export const BAKERY_HEIGHT = 2.4;
const BAKERY_SCALE = BAKERY_HEIGHT / BAKERY_GLB.height;
export const BAKERY_DRAWN = {
   width: BAKERY_GLB.width * BAKERY_SCALE,
   height: BAKERY_HEIGHT,
   depth: BAKERY_GLB.depth * BAKERY_SCALE,
} as const;
export const BAKERY_SPOTS = [
   { x: -18, y: 0, z: -17.4, rotY: 0.2 },
   { x: 0, y: 0, z: -17.4, rotY: -0.15 },
   { x: 18, y: 0, z: -17.4, rotY: 0.4 },
] as const;
/** Fallback boxes are centred, so they sit half their height above the stall's feet. */
export const BAKERY_FALLBACK_SPOTS = BAKERY_SPOTS.map((s) => ({ ...s, y: BAKERY_HEIGHT / 2 }));

export const ASSETS = {
   cart: EXPANSION_ASSETS.cart,
   pusher: {
      ...SHARED_ASSETS.runner,
      scale: RUNNER_SCALE,
      humanoid: { landmarks: RUNNER_LANDMARKS },
   },
   shopperA: EXPANSION_CHARACTERS.shopperA,
   shopperB: EXPANSION_CHARACTERS.shopperB,
   shopperC: EXPANSION_CHARACTERS.shopperC,
   // 10 grocery products
   apple: { ...REUSED_ASSETS.apple, scale: 0.25 / 1.9 },
   banana: { ...SHARED_ASSETS.banana, scale: 0.25 / 1.9 },
   burger: { ...REUSED_ASSETS.burger, scale: 0.25 / 1.9 },
   tinCan: { ...SHARED_ASSETS.tinCan, scale: 0.25 / 1.9 },
   bottle: { ...REUSED_ASSETS.bottle, scale: 0.3 / 1.9 },
   bag: { ...REUSED_ASSETS.bag, scale: 0.3 / 1.9 },
   sock: { ...REUSED_ASSETS.sock, scale: 0.25 / 1.9 },
   battery: { ...SHARED_ASSETS.battery, scale: 0.25 / 1.9 },
   fish: { ...EXPANSION_ASSETS.fish, scale: 0.35 / EXPANSION_GLB_SIZE.fish.depth },
   gourd: { ...EXPANSION_ASSETS.gourd, scale: 0.3 / EXPANSION_GLB_SIZE.gourd.height },
   shelf: {
      id: "shelf",
      url: "/models/3d/shopping-cart/supermarketShelfV2.glb",
      scale: SHELF_SCALE,
      stretch: SHELF_STRETCH,
      fallback: "box",
      fallbackColor: "#f8fafc",
      budget: { ...PROP_BUDGET },
   },
   bakery: {
      id: "bakery",
      url: "/models/3d/shopping-cart/bakeryStand.glb",
      scale: BAKERY_SCALE,
      fallback: "box",
      fallbackColor: "#fde68a",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

export type ProductKind =
   | "apple"
   | "banana"
   | "burger"
   | "tinCan"
   | "bottle"
   | "bag"
   | "sock"
   | "battery"
   | "fish"
   | "gourd";

export const PRODUCT_KINDS: ProductKind[] = [
   "apple",
   "banana",
   "burger",
   "tinCan",
   "bottle",
   "bag",
   "sock",
   "battery",
   "fish",
   "gourd",
];
