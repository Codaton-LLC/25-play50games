// Models for Farm Tractor Challenge (public/models/3d/farm-tractor-challenge/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9);
// assets.test.ts checks the drawn size on the real meshes.
//
// Placed by <Model> (tractor, trailer, barn, silo, trough, scarecrow, gates, the crate): size in metres.
// Placed by a spot or a matrix that carries the size (the fence segments, the hay bales, the apple
// crates): a UNIT model, so the scene's scale is the size and nothing is scaled twice.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   farmer: { x: 1.901, y: 1.893, z: 0.528 },
   tractor: { x: 0.98, y: 1.158, z: 1.891 },
   trailer: { x: 0.813, y: 0.862, z: 1.89 },
   hay: { x: 1.694, y: 1.823, z: 1.819 },
   crate: { x: 1.903, y: 1.112, z: 1.752 },
   barn: { x: 1.885, y: 1.52, z: 1.887 },
   fence: { x: 1.893, y: 0.862, z: 0.194 },
   gate: { x: 1.902, y: 1.474, z: 0.234 },
   scarecrow: { x: 1.28, y: 1.906, z: 0.527 },
   silo: { x: 1.593, y: 1.755, z: 1.885 },
   trough: { x: 1.892, y: 0.912, z: 1.141 },
} as const;

type Size = { x: number; y: number; z: number };

export const FARMER_HEIGHT = 1.78;
export const FARMER_SCALE = FARMER_HEIGHT / GLB_SIZE.farmer.y;
export const TRACTOR_LENGTH = 2.3;
/** The trailer is drawn as wide as the tractor (1.2 m) so the cargo reads on it; the drawbar is part of the length. */
export const TRAILER_LENGTH = 2.8;
/** Lower sides (the GLB at its fitted length is a 1.28 m tall wagon, taller than the bales on it). */
export const TRAILER_SQUASH = 0.8;
const TRAILER_SCALE = TRAILER_LENGTH / GLB_SIZE.trailer.z;
/**
 * The trailer's load bed, measured on farmTrailer.glb (GLB units: bed floor top 0.405 up, the box from
 * z -0.945 to 0.54, 0.774 wide inside; the drawbar eye at z +0.945, 0.324 up; it faces +z), in metres
 * in the trailer's frame once drawn. assets.test.ts checks it on the real mesh.
 */
export const TRAILER_BED = {
   y: 0.405 * TRAILER_SCALE * TRAILER_SQUASH,
   z: ((-0.945 + 0.54) / 2) * TRAILER_SCALE,
   length: (0.54 + 0.945) * TRAILER_SCALE,
   width: 0.774 * TRAILER_SCALE,
   tongueY: 0.324 * TRAILER_SCALE * TRAILER_SQUASH,
   tongueZ: TRAILER_LENGTH / 2,
} as const;
export const BARN_WIDTH = 7;
export const BARN_SQUASH = 0.75;
export const SILO_WIDTH = 1.8;
export const SILO_HEIGHT = 3.5;
export const TROUGH_LENGTH = 1.9;
export const SCARECROW_HEIGHT = 1.8;
export const GATE_SCALE = 0.9;
export const BARN_CRATE_WIDTH = 1;
/** The farmer's origin on the tractor so his hips rest on the seat (metres, in the tractor's frame). */
export const SEAT_Y = 0.27;
export const SEAT_Z = -0.12;

/**
 * The farmer's joints (GLB units: 1.901 x 1.893 x 0.528 T-pose, faces +z; a straw hat, a shirt and
 * dungarees). The estimate from the mesh, except hemY = crotchY: nothing bridges the legs.
 */
export const FARMER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.3409,
   shoulderX: 0.2609,
   shoulderZ: -0.0543,
   armRadius: 0.0702,
   clavicleX: 0.1304,
   elbowX: 0.5023,
   wristX: 0.7438,
   armSpread: 0.1045,
   crotchY: 0.7886,
   hipY: 0.8691,
   hipX: 0.1542,
   hipZ: -0.0872,
   kneeY: 0.4345,
   ankleY: 0.159,
   toeZ: 0.1963,
   heelZ: -0.1948,
   legDepth: 0.1009,
   legOuterX: 0.2755,
   hemY: 0.7886,
   spineY: 1.0106,
   chestY: 1.1522,
   neckY: 1.4905,
   headY: 1.5378,
   spineZ: -0.0369,
   shoulderBlend: 0.0421,
   elbowBlend: 0.0351,
   hipBlend: 0.0869,
   kneeBlend: 0.0652,
   ankleBlend: 0.0486,
   crotchBlend: 0.0709,
   spineBlend: 0.0425,
   neckBlend: 0.0237,
};

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   extra: Partial<ModelAsset> = {},
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({ id, url: `/models/3d/farm-tractor-challenge/${id}.glb`, fallback, fallbackColor, budget, ...extra });

/** A unit box: `stretch` makes the GLB 1 x 1 x 1 (the scene's scale is its size); it stands on y = 0. */
const unitBox = (s: Size): Partial<ModelAsset> => ({ stretch: [1 / s.x, 1 / s.y, 1 / s.z] });

export const ASSETS = {
   farmer: local("charFarmer", "capsule", "#f1d0b4", { scale: FARMER_SCALE, humanoid: { landmarks: FARMER_LANDMARKS } }, CHARACTER_BUDGET),
   tractor: local("tractor", "box", "#eab308", { scale: TRACTOR_LENGTH / GLB_SIZE.tractor.z }),
   trailer: local("farmTrailer", "box", "#78716c", { scale: TRAILER_SCALE, stretch: [1, TRAILER_SQUASH, 1] }),
   hay: local("hayBaleBound", "cylinder", "#eab308", unitBox(GLB_SIZE.hay)),
   appleCrate: local("appleCrate", "box", "#c2410c", unitBox(GLB_SIZE.crate)),
   barn: local("barn", "box", "#b45309", { scale: BARN_WIDTH / GLB_SIZE.barn.x, stretch: [1, BARN_SQUASH, 1] }),
   /** one fence segment between two posts, its length along x turned to the fence's z; the spot's scale is the span */
   fence: local("farmFence", "box", "#a16207", { scale: 1 / GLB_SIZE.fence.x, rotationY: Math.PI / 2 }),
   gate: local("farmGate", "box", "#78716c", { scale: GATE_SCALE }),
   scarecrow: local("scarecrowPost", "box", "#a16207", { scale: SCARECROW_HEIGHT / GLB_SIZE.scarecrow.y }),
   silo: local("grainSiloGroundT", "cylinder", "#e7e5e4", {
      scale: SILO_WIDTH / GLB_SIZE.silo.x,
      stretch: [1, SILO_HEIGHT / (GLB_SIZE.silo.y * (SILO_WIDTH / GLB_SIZE.silo.x)), 1],
   }),
   trough: local("waterTrough", "box", "#64748b", { scale: TROUGH_LENGTH / GLB_SIZE.trough.x }),
   tree: EXPANSION_ASSETS.leafyTree,
   barnCrate: { ...SHARED_ASSETS.crate, scale: BARN_CRATE_WIDTH / SHARED_GLB_SIZE.crate.width },
} satisfies Record<string, ModelAsset>;
