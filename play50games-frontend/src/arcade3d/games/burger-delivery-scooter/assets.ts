// Burger Delivery Scooter models: the ready menu1-burger-delivery-scooter GLBs (restaurantCounterPlainT = the text-free counter; burgerShopI is the
// text-free shop, LEDGER "OK - burger on roof, blank sign"), fitted from their measured bounds
// (assets.test.ts checks every fit on the real mesh). Props that repeat as dressing are fitted to 1 m,
// so the dressing spot's `scale` is the size in metres and nothing is scaled twice.
import type { ModelAsset } from "../../core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "../../core/sharedAssets";
import { BARRIER, CAR } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   charScooterRider: { width: 1.8918, height: 1.8483, depth: 0.4762 },
   deliveryScooter: { width: 0.9156, height: 1.3263, depth: 1.8948 },
   deliveryBoxV2: { width: 1.8788, height: 1.8861, depth: 1.1752 },
   burgerBag: { width: 1.1232, height: 1.8943, depth: 1.357 },
   foodBoxV2: { width: 1.9048, height: 1.3422, depth: 1.7992 },
   restaurantCounterPlainT: { width: 1.897, height: 1.363, depth: 1.347 },
   burgerShopI: { width: 1.8534, height: 1.9047, depth: 1.4728 },
   roadBarrier: { width: 1.8968, height: 0.9729, depth: 0.9502 },
   trafficCone: { width: 1.3656, height: 1.8767, depth: 1.3908 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   riderHeight: 1.7,
   scooterLength: 1.8,
   boxHeight: 0.5,
   /** the shop at its own proportions (5.76 m tall) on the south-west corner of its block */
   shopWidth: 5.6,
   counterWidth: 2.2,
   counterHeight: 1.1,
   carLength: 2 * CAR.hz,
} as const;

// Measured on the real rider (estimateHumanoidLandmarks agrees); joggers are separate legs, so hemY = crotchY.
export const RIDER_LANDMARKS = {
   shoulderY: 1.2463853, shoulderX: 0.262055, shoulderZ: -0.033633, armRadius: 0.074811,
   clavicleX: 0.131028, elbowX: 0.501398, wristX: 0.740741, armSpread: 0.168486,
   crotchY: 0.731615, hipY: 0.806398, hipX: 0.172661, hipZ: -0.058732,
   kneeY: 0.403199, ankleY: 0.152124, toeZ: 0.219876, heelZ: -0.147233,
   legDepth: 0.098294, legOuterX: 0.310809, hemY: 0.731615,
   spineY: 0.938394, chestY: 1.07039, neckY: 1.390069, headY: 1.428575, spineZ: -0.013647,
   shoulderBlend: 0.044887, elbowBlend: 0.037406, hipBlend: 0.08064,
   kneeBlend: 0.06048, ankleBlend: 0.044307, crotchBlend: 0.077759, spineBlend: 0.039599, neckBlend: 0.019253,
};

export const RIDER_SCALE = FIT.riderHeight / GLB_SIZE.charScooterRider.height;
export const SCOOTER_SCALE = FIT.scooterLength / GLB_SIZE.deliveryScooter.depth;
const SHOP_SCALE = FIT.shopWidth / GLB_SIZE.burgerShopI.width;
const COUNTER_SCALE = FIT.counterWidth / GLB_SIZE.restaurantCounterPlainT.width;
const BARRIER_SCALE = (2 * BARRIER.hx) / GLB_SIZE.roadBarrier.width;

function asset(id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallbackColor: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset {
   return { id, url: `/models/3d/burger-delivery-scooter/${id}.glb`, budget: { ...budget }, fallback: "box", fallbackColor, ...fit };
}

export const ASSETS = {
   rider: { ...asset("charScooterRider", { scale: RIDER_SCALE }, "#fb7185", CHARACTER_BUDGET), humanoid: { landmarks: RIDER_LANDMARKS } },
   scooter: asset("deliveryScooter", { scale: SCOOTER_SCALE }, "#fb7185"),
   box: asset("deliveryBoxV2", { scale: FIT.boxHeight / GLB_SIZE.deliveryBoxV2.height }, "#fbbf24"),
   // dressing on the counter, 1 m tall: the spot scale is the size
   bag: asset("burgerBag", { scale: 1 / GLB_SIZE.burgerBag.height }, "#fbbf24"),
   food: asset("foodBoxV2", { scale: 1 / GLB_SIZE.foodBoxV2.width }, "#fff1e6"),
   counter: asset("restaurantCounterPlainT", { scale: COUNTER_SCALE, stretch: [1, FIT.counterHeight / (GLB_SIZE.restaurantCounterPlainT.height * COUNTER_SCALE), 1] }, "#fb7185"),
   // the shop stands north of its pad (the camera looks north), so it never hides the pad; its 4.8 m
   // shadow at a 50° pitch ends inside its own block (looks.test.ts)
   shop: asset("burgerShopI", { scale: SHOP_SCALE }, "#fb7185"),
   barrier: asset("roadBarrier", { scale: BARRIER_SCALE }, "#fb7185"),
   cone: { id: "trafficCone", url: "/models/3d/shared/trafficCone.glb", scale: 1 / GLB_SIZE.trafficCone.height, fallback: "cylinder", fallbackColor: "#f97316", budget: { ...PROP_BUDGET } } as ModelAsset,
   car: { ...REUSED_ASSETS.car, scale: FIT.carLength / REUSED_GLB_SIZE.car.depth },
   lamp: { ...REUSED_ASSETS.lamp, scale: 1 / REUSED_GLB_SIZE.lamp.height },
   bench: { ...REUSED_ASSETS.bench, scale: 1 / REUSED_GLB_SIZE.bench.width },
} satisfies Record<string, ModelAsset>;
