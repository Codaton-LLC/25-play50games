// Models for Magic Carpet Ride (public/models/3d/magic-carpet-ride/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9);
// assets.test.ts checks the drawn size on the real meshes.
//
// Three kinds of fit, matching how Scene.tsx places them:
// - the carpet, the rider, the rings, the stars and the obstacles are drawn at their size in metres,
//   centred on their own origin where the scene places them by centre (`yOffset`);
// - the instanced decor (roofs, mesas, lanterns, the palace) is unit-box normalised (`stretch`
//   makes it exactly 1 x 1 x 1, `yOffset` centres it), because its spots carry the box's size;
// - the rock obstacle is drawn upside down (the scene turns it): see ROCK_FLIP.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   rider: { x: 1.902, y: 1.861, z: 0.506 },
   carpet: { x: 1.804, y: 0.21, z: 1.898 },
   ring: { x: 1.901, y: 1.849, z: 0.496 },
   star: { x: 1.791, y: 1.901, z: 0.55 },
   rock: { x: 1.787, y: 1.043, z: 1.901 },
   cloud: { x: 1.898, y: 1.196, z: 1.031 },
   tower: { x: 1.312, y: 1.871, z: 1.295 },
   roof: { x: 1.898, y: 1.225, z: 1.689 },
   mesa: { x: 1.902, y: 1.627, z: 1.723 },
   lantern: { x: 0.872, y: 1.908, z: 0.824 },
   palace: { x: 1.818, y: 1.727, z: 1.889 },
} as const;

type Size = { x: number; y: number; z: number };

export const RIDER_HEIGHT = 1.72;
export const RIDER_SCALE = RIDER_HEIGHT / GLB_SIZE.rider.y;
export const CARPET_WIDTH = 1.7;
export const CARPET_SCALE = CARPET_WIDTH / GLB_SIZE.carpet.x;
export const RING_DIAMETER = 3.1;
export const STAR_SIZE = 0.9;
export const ROCK_WIDTH = 1.9;
export const CLOUD_WIDTH = 2.5;
export const TOWER_HEIGHT = 2.4;
/** The scene turns the rock over (Rz pi): the flat grassy disc is its top, the peak hangs below. */
export const ROCK_FLIP = Math.PI;

/** The rider's seat: where his origin sits on the carpet so the hips rest on its top (metres, in the carpet's frame). */
export const SEAT_Y = 0.3 - 0.7745 * RIDER_SCALE;
export const SEAT_Z = 0.05;

/**
 * The rider's joints (GLB units: 1.902 x 1.861 x 0.506 T-pose, faces +z; a scarf and baggy
 * trousers). The estimate from the mesh, except hemY = crotchY: nothing bridges the legs.
 */
export const RIDER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2796,
   shoulderX: 0.29,
   shoulderZ: -0.0268,
   armRadius: 0.0807,
   clavicleX: 0.145,
   elbowX: 0.5214,
   wristX: 0.7528,
   armSpread: 0.1441,
   crotchY: 0.6977,
   hipY: 0.7745,
   hipX: 0.1901,
   hipZ: -0.0549,
   kneeY: 0.3872,
   ankleY: 0.1767,
   toeZ: 0.1618,
   heelZ: -0.163,
   legDepth: 0.1135,
   legOuterX: 0.3213,
   hemY: 0.6977,
   spineY: 0.926,
   chestY: 1.0776,
   neckY: 1.4962,
   headY: 1.5737,
   spineZ: -0.0255,
   shoulderBlend: 0.0484,
   elbowBlend: 0.0403,
   hipBlend: 0.0774,
   kneeBlend: 0.0581,
   ankleBlend: 0.0372,
   crotchBlend: 0.0454,
   spineBlend: 0.0455,
   neckBlend: 0.0388,
};

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   extra: Partial<ModelAsset> = {},
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({ id, url: `/models/3d/magic-carpet-ride/${id}.glb`, fallback, fallbackColor, budget, ...extra });

const longest = (s: Size) => Math.max(s.x, s.y, s.z);
/** A unit box: `stretch` makes the GLB 1 x 1 x 1, `yOffset` puts its centre on the origin like the stand-in boxes. */
const unitBox = (s: Size): Partial<ModelAsset> => ({ stretch: [1 / s.x, 1 / s.y, 1 / s.z], yOffset: -0.5 });
/** Drawn at `size` metres on its longest side, centred on its own middle. */
const centred = (s: Size, size: number): Partial<ModelAsset> => {
   const scale = size / longest(s);
   return { scale, yOffset: -(s.y * scale) / 2 };
};

export const ASSETS = {
   rider: local("charCarpetRider", "capsule", "#4c1d95", { scale: RIDER_SCALE, humanoid: { landmarks: RIDER_LANDMARKS } }, CHARACTER_BUDGET),
   carpet: local("magicCarpet", "box", "#7c3aed", { scale: CARPET_SCALE }),
   ring: local("flyingRing", "cylinder", "#fbbf24", centred(GLB_SIZE.ring, RING_DIAMETER)),
   star: local("star", "sphere", "#fde68a", centred(GLB_SIZE.star, STAR_SIZE), PROP_BUDGET),
   rock: local("floatingRockV3", "box", "#78716c", centred(GLB_SIZE.rock, ROCK_WIDTH)),
   cloud: local("cloud", "sphere", "#f8fafc", centred(GLB_SIZE.cloud, CLOUD_WIDTH)),
   tower: local("palaceTower", "box", "#c4b5fd", { scale: TOWER_HEIGHT / GLB_SIZE.tower.y, yOffset: -TOWER_HEIGHT / 2 }),
   roof: local("desertRooftopV2", "box", "#c2410c", unitBox(GLB_SIZE.roof)),
   mesa: local("canyonMesa", "box", "#9a3412", unitBox(GLB_SIZE.mesa)),
   lantern: local("hangingLantern", "box", "#fbbf24", unitBox(GLB_SIZE.lantern)),
   palace: local("floatingPalaceR", "box", "#f5f3ff", unitBox(GLB_SIZE.palace)),
} satisfies Record<string, ModelAsset>;
