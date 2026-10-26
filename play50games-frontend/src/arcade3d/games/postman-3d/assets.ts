// Postman 3D models: the ready Hyper3D set (menu1-postman-3d) plus the shared picket fence, traffic
// light and the dog-park dog, fitted from their measured bounds (assets.test.ts checks every fit on the
// real mesh). Gameplay pieces are fitted to their rules size in metres; decor (bench, bicycle, holiday
// tree) to 1 m, so a decor spot's `scale` is its size and nothing is scaled twice.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-26. */
export const GLB_SIZE = {
   charPostman: { width: 1.9039, height: 1.8715, depth: 0.4527 },
   letter: { width: 1.8899, height: 0.4094, depth: 1.615 },
   mailbag: { width: 1.89, height: 1.4242, depth: 1.4501 },
   mailbox: { width: 0.8895, height: 1.8983, depth: 0.6805 },
   houseA: { width: 1.891, height: 1.895, depth: 1.8932 },
   houseB: { width: 1.89, height: 1.4928, depth: 1.8061 },
   houseC: { width: 1.7829, height: 1.6602, depth: 1.8966 },
   postOffice: { width: 1.64, height: 1.9008, depth: 1.5972 },
   postVan: { width: 0.8521, height: 0.8401, depth: 1.9014 },
   streetLampVictorian: { width: 0.4007, height: 1.9024, depth: 0.6856 },
   bicycle: { width: 0.7319, height: 1.1859, depth: 1.8906 },
   holidayTree: { width: 1.1173, height: 1.8575, depth: 1.1543 },
   picketFence: { width: 1.8986, height: 1.0494, depth: 0.2345 },
   trafficLight: { width: 0.547, height: 1.8964, depth: 0.5693 },
   dog: { width: 1.0087, height: 1.5248, depth: 1.8976 },
} as const;

/** Drawn sizes in metres (the rules' boxes are in rules.ts). */
export const FIT = {
   postmanHeight: 1.78,
   /** a house fills its solid box: 5.0 m along the street, 3.0 m deep */
   houseWidth: 5.0,
   houseDepth: 3.0,
   /** north-row houses (behind the street from the camera) are two storeys */
   houseHeightNorth: 3.6,
   /** south-row houses stand between the camera and the street: bungalows the camera sees over (rules.test "sightline") */
   houseHeightSouth: 1.95,
   mailboxHeight: 1.1,
   officeWidth: 4.2,
   officeDepth: 2.5,
   officeHeight: 3.4,
   vanLength: 4.0,
   lampHeight: 3.0,
   fenceLength: 2.6,
   fenceHeight: 0.6,
   trafficLightHeight: 2.6,
   dogLength: 0.9,
   carLength: 2.8,
   doorHeight: 1.61,
   bagHeight: 0.42,
} as const;

export const POSTMAN_SCALE = FIT.postmanHeight / GLB_SIZE.charPostman.height;

/**
 * Measured with estimateHumanoidLandmarks on charPostman.glb (core/README.md "Landmarks"; postman.test.ts).
 * Set by eye: hemY = crotchY (estimate 0.624): nothing bridges the legs, the estimate's hem is the close
 * inner thighs of the trousers; armRadius 0.075 (estimate 0.061): the sleeve is 0.19 tall at the shoulder
 * (y 1.18-1.37), so the whole sleeve hangs with the arm (with 0.061 a hand stayed at shoulder height).
 */
export const POSTMAN_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.281,
   shoulderX: 0.2446,
   shoulderZ: -0.058,
   armRadius: 0.075,
   clavicleX: 0.1223,
   elbowX: 0.4922,
   wristX: 0.7398,
   armSpread: 0.1268,
   crotchY: 0.7798,
   hipY: 0.8566,
   hipX: 0.1656,
   hipZ: -0.0741,
   kneeY: 0.4283,
   ankleY: 0.157,
   toeZ: 0.2024,
   heelZ: -0.1552,
   legDepth: 0.0983,
   legOuterX: 0.3099,
   hemY: 0.7798,
   spineY: 0.984,
   chestY: 1.1113,
   neckY: 1.3997,
   headY: 1.4231,
   spineZ: -0.0275,
   shoulderBlend: 0.0365,
   elbowBlend: 0.0304,
   hipBlend: 0.0857,
   kneeBlend: 0.0642,
   ankleBlend: 0.0479,
   crotchBlend: 0.0806,
   spineBlend: 0.0382,
   neckBlend: 0.0117,
};

const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/postman-3d/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
   ...fit,
});
const shared = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   ...local(id, fit, fallback, fallbackColor),
   url: `/models/3d/shared/${id}.glb`,
});
const houseFit = (id: "houseA" | "houseB" | "houseC", height: number): Partial<ModelAsset> => {
   const s = FIT.houseWidth / GLB_SIZE[id].width;
   return { scale: s, stretch: [1, height / (GLB_SIZE[id].height * s), FIT.houseDepth / (GLB_SIZE[id].depth * s)] };
};
const house = (id: "houseA" | "houseB" | "houseC", height: number, row: "N" | "S"): ModelAsset => ({
   ...local(id, houseFit(id, height), "box", "#fff7ed"),
   id: `${id}${row}`,
});
const unit = (h: number) => 1 / h;
const officeScale = FIT.officeWidth / GLB_SIZE.postOffice.width;
const vanScale = FIT.vanLength / GLB_SIZE.postVan.depth;
const carScale = FIT.carLength / REUSED_GLB_SIZE.car.depth;

export const ASSETS = {
   /** image-to-3D T-pose (18k verts, 442 KB), auto-rigged with POSTMAN_LANDMARKS, 1.78 m, untinted (a face) */
   postman: {
      ...local("charPostman", {}, "capsule", "#1e293b"),
      budget: { ...CHARACTER_BUDGET },
      scale: POSTMAN_SCALE,
      humanoid: { landmarks: POSTMAN_LANDMARKS },
   },
   /** on the hip through `attach`: 0.42 m tall */
   mailbag: local("mailbag", { scale: FIT.bagHeight / GLB_SIZE.mailbag.height }, "box", "#92400e"),
   /** the delivery puff: a 0.3 m envelope */
   letter: local("letter", { scale: 0.3 / GLB_SIZE.letter.width }, "box", "#f8fafc"),
   mailbox: local("mailbox", { scale: FIT.mailboxHeight / GLB_SIZE.mailbox.height }, "box", "#ef4444"),
   houseAN: house("houseA", FIT.houseHeightNorth, "N"),
   houseBN: house("houseB", FIT.houseHeightNorth, "N"),
   houseCN: house("houseC", FIT.houseHeightNorth, "N"),
   houseAS: house("houseA", FIT.houseHeightSouth, "S"),
   houseBS: house("houseB", FIT.houseHeightSouth, "S"),
   houseCS: house("houseC", FIT.houseHeightSouth, "S"),
   office: local(
      "postOffice",
      { scale: officeScale, stretch: [1, FIT.officeHeight / (GLB_SIZE.postOffice.height * officeScale), FIT.officeDepth / (GLB_SIZE.postOffice.depth * officeScale)] },
      "box",
      "#ef4444"
   ),
   van: local("postVan", { scale: vanScale }, "box", "#ef4444"),
   lamp: local("streetLampVictorian", { scale: FIT.lampHeight / GLB_SIZE.streetLampVictorian.height }, "cylinder", "#1e293b"),
   fence: shared("picketFence", { scale: FIT.fenceLength / GLB_SIZE.picketFence.width, stretch: [1, FIT.fenceHeight / (GLB_SIZE.picketFence.height * (FIT.fenceLength / GLB_SIZE.picketFence.width)), 1] }, "box", "#f8fafc"),
   trafficLight: shared("trafficLight", { scale: FIT.trafficLightHeight / GLB_SIZE.trafficLight.height }, "box", "#1e293b"),
   /** the dog-park dog, tinted per yard (a creature mesh), 0.9 m long */
   dog: shared("dog", { scale: FIT.dogLength / GLB_SIZE.dog.depth }, "box", "#b45309"),
   // decor, fitted to 1 m: the spot's scale is the size in metres
   bicycle: local("bicycle", { scale: unit(GLB_SIZE.bicycle.height) }, "box", "#1e293b"),
   holidayTree: local("holidayTree", { scale: unit(GLB_SIZE.holidayTree.height) }, "cylinder", "#15803d"),
   bench: { ...REUSED_ASSETS.bench, scale: unit(REUSED_GLB_SIZE.bench.height) },
   door: { ...REUSED_ASSETS.door, scale: FIT.doorHeight / REUSED_GLB_SIZE.door.height },
   /** the clean-city car, its length (GLB z) turned along the street (x): 2.8 m, the rules' 2.8 x 1.3 box */
   car: { ...REUSED_ASSETS.car, scale: carScale, rotationY: Math.PI / 2 },
} satisfies Record<string, ModelAsset>;
