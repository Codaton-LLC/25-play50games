import type { ModelAsset } from "../../core/types";
import { REUSED_ASSETS } from "../../core/sharedAssets";
function asset(id: string, scale = 1): ModelAsset {
   return { id, url: "/models/3d/burger-delivery-scooter/" + id + ".glb", scale, budget: { tris: 20000, bytes: 600000 }, fallback: "box", fallbackColor: "#fb7185" };
}
// Snapshot from the ready rider POSITION cloud with its node translation applied, 2026-10-25.
// Joggers are separate legs, so hemY is set to crotchY rather than the skirt heuristic.
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
export const ASSETS = {
   rider: { ...asset("charScooterRider", 0.9197687445508058), humanoid: { landmarks: RIDER_LANDMARKS } },
   scooter: asset("deliveryScooter", 1.05), box: asset("deliveryBoxV2", 0.38),
   bag: asset("burgerBag", 0.22), food: asset("foodBoxV2", 0.2),
   counter: { ...asset("restaurantCounter", 2.4 / 1.8798), stretch: [1, 0.412, 0.527] as const },
   shop: { ...asset("burgerShop", 12 / 1.9032621383666992), stretch: [1, 0.42, 1] as const },
   barrier: asset("roadBarrier", 0.75),
   cone: asset("trafficCone", 0.35),
   car: { ...REUSED_ASSETS.car, scale: 1.1 },
   lamp: REUSED_ASSETS.lamp, bench: REUSED_ASSETS.bench,
};
