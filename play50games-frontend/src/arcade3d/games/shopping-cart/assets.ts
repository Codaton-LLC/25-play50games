// Models used by Crazy Shopping Cart.
// Cart is EXPANSION_ASSETS.cart (assets.spec.json). Pusher is SHARED_ASSETS.runner.
// Shoppers are EXPANSION_CHARACTERS (shopperA, shopperB, shopperC).
// Products are 10 kinds from SHARED, REUSED, and EXPANSION assets.
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   EXPANSION_ASSETS,
   EXPANSION_CHARACTERS,
   EXPANSION_GLB_SIZE,
   REUSED_ASSETS,
   RUNNER_LANDMARKS,
   SHARED_ASSETS,
} from "@/arcade3d/core/sharedAssets";

export const RUNNER_SCALE = 0.825; // 1.556 m tall

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
