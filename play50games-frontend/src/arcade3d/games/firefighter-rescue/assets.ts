// Firefighter Rescue models: the ready Hyper3D set (menu1-firefighter-rescue) plus the shared sofa,
// bed, cabinet, wooden chair and civilian, fitted from their measured bounds (assets.test.ts checks
// every fit on the real mesh). Furniture fills its rules box (rules.ts FURN_SIZE); the firefighter is
// auto-rigged (firefighter.test.ts). exitSignV2 (an arrow sign) is used, not exitSign (a letter-like
// glyph); the older firefighter-rescue/hero.glb is not used (charFirefighter is the clean T-pose).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { DEBRIS_HALF, DOOR_HALF, FURN_SIZE } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-28. */
export const GLB_SIZE = {
   charFirefighter: { width: 1.8979, height: 1.8506, depth: 0.4562 },
   fireExtinguisher: { width: 0.5617, height: 1.9005, depth: 0.9439 },
   fireHydrant: { width: 1.0909, height: 1.8836, depth: 0.7933 },
   hoseReel: { width: 1.6443, height: 1.8981, depth: 0.6348 },
   fireTruck: { width: 0.8161, height: 0.9812, depth: 1.8973 },
   exitSignV2: { width: 1.8952, height: 1.0732, depth: 0.3054 },
   fireDoor: { width: 0.9025, height: 1.9106, depth: 0.1935 },
   fallingDebris: { width: 1.8843, height: 0.6658, depth: 0.6215 },
   sofa: { width: 1.8916, height: 0.9388, depth: 0.9125 },
   bed: { width: 1.5701, height: 0.7446, depth: 1.8954 },
   cabinet: { width: 1.2248, height: 1.8854, depth: 0.5823 },
   woodenChair: { width: 0.9054, height: 1.8967, depth: 1.0048 },
   civilianNpc: { width: 0.766, height: 1.902, depth: 0.3757 },
} as const;

/** Measured triangles per GLB (assets.test.ts pins them). */
export const GLB_TRIS = {
   charFirefighter: 18000, fireExtinguisher: 1500, fireHydrant: 1500, hoseReel: 1500, fireTruck: 3000, exitSignV2: 1500,
   fireDoor: 1128, fallingDebris: 1500, sofa: 3000, bed: 3000, cabinet: 1500, woodenChair: 1500, civilianNpc: 18000,
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   firefighterHeight: 1.82,
   /** in the right hand, hanging from its handle */
   extinguisherHeight: 0.52,
   hydrantHeight: 0.8,
   hoseReelHeight: 1.05,
   /** the truck's length (GLB z); width and height follow (about 2.1 x 2.5 m) */
   truckLength: 5.2,
   /** wall-mounted, flush on a wall (its depth stays under the 0.18 m wall) */
   exitSignWidth: 0.62,
   /** one leaf of a double fire door: two fill the 1.6 m doorway */
   doorLeafWidth: DOOR_HALF,
   doorHeight: 2.1,
   doorDepth: 0.12,
   /** one charred plank of a debris pile (two crossed, stacked): the rules box is 0.68 m square */
   debrisLength: DEBRIS_HALF.x * 2,
   civilianHeight: 1.62,
} as const;

export const FIREFIGHTER_HEIGHT = FIT.firefighterHeight;
export const FIREFIGHTER_SCALE = FIT.firefighterHeight / GLB_SIZE.charFirefighter.height;

/**
 * Measured with estimateHumanoidLandmarks on charFirefighter.glb (core/README.md "Landmarks";
 * firefighter.test.ts), 2026-10-28. Committed as estimated: the turnout coat ends at hemY 0.632,
 * below the crotch, so the coat's skirt is blended between the legs.
 */
export const FIREFIGHTER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2612,
   shoulderX: 0.2665,
   shoulderZ: -0.0294,
   armRadius: 0.0822,
   clavicleX: 0.1332,
   elbowX: 0.5053,
   wristX: 0.7442,
   armSpread: 0.2423,
   crotchY: 0.7325,
   hipY: 0.8082,
   hipX: 0.1691,
   hipZ: -0.0572,
   kneeY: 0.4041,
   ankleY: 0.1655,
   toeZ: 0.2245,
   heelZ: -0.1768,
   legDepth: 0.1014,
   legOuterX: 0.3119,
   hemY: 0.6323,
   spineY: 0.9441,
   chestY: 1.08,
   neckY: 1.4419,
   headY: 1.4882,
   spineZ: 0.0014,
   shoulderBlend: 0.0493,
   elbowBlend: 0.0411,
   hipBlend: 0.0808,
   kneeBlend: 0.0606,
   ankleBlend: 0.0421,
   crotchBlend: 0.0714,
   spineBlend: 0.0408,
   neckBlend: 0.0231,
};

type Id = keyof typeof GLB_SIZE;
const asset = (id: Id, url: string, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url,
   fallback,
   fallbackColor,
   budget: { ...budget },
   ...fit,
});
const local = (id: Id, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], color: string, budget: ModelAsset["budget"] = PROP_BUDGET) =>
   asset(id, `/models/3d/firefighter-rescue/${id}.glb`, fit, fallback, color, budget);
const shared = (id: Id, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], color: string, budget: ModelAsset["budget"] = PROP_BUDGET) =>
   asset(id, `/models/3d/shared/${id}.glb`, fit, fallback, color, budget);

// Furniture fills its rules box (FURN_SIZE x / y / z in the world, at the furniture's rotY 0).
// The sofa and the cabinet stand with their long side (GLB x) along the world z: rotationY π/2,
// their front (GLB +z) then faces +x; the scene turns them to face into their room.
const sofaScale = FURN_SIZE.sofa.z / GLB_SIZE.sofa.width;
const bedScale = FURN_SIZE.bed.z / GLB_SIZE.bed.depth;
const cabinetScale = FURN_SIZE.cabinet.z / GLB_SIZE.cabinet.width;
const chairScale = FURN_SIZE.chair.y / GLB_SIZE.woodenChair.height;
const doorScale = FIT.doorHeight / GLB_SIZE.fireDoor.height;

export const ASSETS = {
   /** image-to-3D T-pose (18k tris), auto-rigged with FIREFIGHTER_LANDMARKS, 1.82 m */
   firefighter: local("charFirefighter", { scale: FIREFIGHTER_SCALE, humanoid: { landmarks: FIREFIGHTER_LANDMARKS } }, "capsule", "#b91c1c", CHARACTER_BUDGET),
   extinguisher: local("fireExtinguisher", { scale: FIT.extinguisherHeight / GLB_SIZE.fireExtinguisher.height }, "cylinder", "#dc2626"),
   hydrant: local("fireHydrant", { scale: FIT.hydrantHeight / GLB_SIZE.fireHydrant.height }, "cylinder", "#b91c1c"),
   hoseReel: local("hoseReel", { scale: FIT.hoseReelHeight / GLB_SIZE.hoseReel.height }, "cylinder", "#44403c"),
   truck: local("fireTruck", { scale: FIT.truckLength / GLB_SIZE.fireTruck.depth }, "box", "#ef4444"),
   exitSign: local("exitSignV2", { scale: FIT.exitSignWidth / GLB_SIZE.exitSignV2.width }, "box", "#16a34a"),
   /** one leaf of the double fire door: 0.8 x 2.1 m, 0.12 m thick */
   door: local(
      "fireDoor",
      { scale: doorScale, stretch: [FIT.doorLeafWidth / (GLB_SIZE.fireDoor.width * doorScale), 1, FIT.doorDepth / (GLB_SIZE.fireDoor.depth * doorScale)] },
      "box",
      "#b91c1c",
   ),
   /** one plank of a debris pile, 0.68 m long */
   debris: local("fallingDebris", { scale: FIT.debrisLength / GLB_SIZE.fallingDebris.width }, "box", "#57534e"),
   sofa: shared(
      "sofa",
      { scale: sofaScale, stretch: [1, FURN_SIZE.sofa.y / (GLB_SIZE.sofa.height * sofaScale), FURN_SIZE.sofa.x / (GLB_SIZE.sofa.depth * sofaScale)], rotationY: Math.PI / 2 },
      "box",
      "#78716c",
   ),
   bed: shared(
      "bed",
      { scale: bedScale, stretch: [FURN_SIZE.bed.x / (GLB_SIZE.bed.width * bedScale), FURN_SIZE.bed.y / (GLB_SIZE.bed.height * bedScale), 1] },
      "box",
      "#a8a29e",
   ),
   cabinet: shared(
      "cabinet",
      { scale: cabinetScale, stretch: [1, FURN_SIZE.cabinet.y / (GLB_SIZE.cabinet.height * cabinetScale), 1], rotationY: Math.PI / 2 },
      "box",
      "#57534e",
   ),
   chair: shared("woodenChair", { scale: chairScale }, "box", "#92400e"),
   /** a static figure (hands on hips, not a T-pose: unrigged), untinted, 1.62 m */
   civilian: shared("civilianNpc", { scale: FIT.civilianHeight / GLB_SIZE.civilianNpc.height }, "capsule", "#e7e5e4", CHARACTER_BUDGET),
} satisfies Record<string, ModelAsset>;
