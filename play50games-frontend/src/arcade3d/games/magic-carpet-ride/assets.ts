// Models for Magic Carpet Ride (public/models/3d/magic-carpet-ride/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9; every
// GLB here stands on y = 0, centred on x / z); assets.test.ts checks the drawn sizes on the real meshes.
//
// Three kinds of fit, matching how Scene.tsx places them:
// - the carpet and the rider at their size in metres, standing on their origin;
// - everything that flies or floats (rings, coins, gems, boosts, the flying obstacles) at its size in
//   metres and centred on its own middle (`yOffset`), because the rules place it by its centre;
// - the instanced decor (roofs, mesas, towers, islands, the palace...) as unit boxes (`stretch` makes
//   it 1 x 1 x 1 standing on the origin), because its spots carry the box's size.
//
// Adopted from the other ready folders for this flight (2026-10-28, LEDGER QA notes OK): the menu2
// gull, cave bat, storm hawk, balloon bunch, hot-air balloon (m2AirshipBg), smoke blimp, temple
// lantern, gold coin, sky islands (castle, waterfall, windmill) and step pyramid; treasure-island's
// gem; tower-climb's rocket booster. No kite GLB exists in the ready sets.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   rider: { x: 1.902, y: 1.861, z: 0.506 },
   carpet: { x: 1.804, y: 0.21, z: 1.898 },
   ring: { x: 1.901, y: 1.849, z: 0.496 },
   coin: { x: 1.893, y: 1.901, z: 0.473 },
   gem: { x: 1.9, y: 1.832, z: 1.891 },
   boost: { x: 1.304, y: 1.899, z: 1.542 },
   gull: { x: 1.895, y: 1.393, z: 1.403 },
   bat: { x: 1.9, y: 1.353, z: 0.567 },
   hawk: { x: 1.895, y: 1.42, z: 1.217 },
   balloon: { x: 1.274, y: 1.905, z: 1.358 },
   hotAir: { x: 1.831, y: 1.828, z: 1.89 },
   blimp: { x: 1.896, y: 1.517, z: 1.172 },
   skyLantern: { x: 1.008, y: 1.909, z: 0.984 },
   rock: { x: 1.787, y: 1.043, z: 1.901 },
   cloud: { x: 1.898, y: 1.196, z: 1.031 },
   tower: { x: 1.312, y: 1.871, z: 1.295 },
   roof: { x: 1.898, y: 1.225, z: 1.689 },
   mesa: { x: 1.902, y: 1.627, z: 1.723 },
   lantern: { x: 0.872, y: 1.908, z: 0.824 },
   palace: { x: 1.818, y: 1.727, z: 1.889 },
   pyramid: { x: 1.618, y: 1.505, z: 1.897 },
   islandCastle: { x: 1.669, y: 1.914, z: 1.626 },
   islandFalls: { x: 1.7, y: 1.62, z: 1.893 },
   islandMill: { x: 1.904, y: 1.567, z: 1.807 },
} as const;

type Size = { x: number; y: number; z: number };

export const RIDER_HEIGHT = 1.72;
export const RIDER_SCALE = RIDER_HEIGHT / GLB_SIZE.rider.y;
export const CARPET_WIDTH = 1.9;
export const CARPET_SCALE = CARPET_WIDTH / GLB_SIZE.carpet.x;
/** The carpet is drawn longer than the near-square GLB. */
export const CARPET_STRETCH_Z = 1.35;
export const CARPET_TOP = GLB_SIZE.carpet.y * CARPET_SCALE;

/** Flyers and pickups: their size in metres on the longest side (the ring: its diameter). */
export const FLY_SIZE = {
   ring: 3.4,
   coin: 0.9,
   gem: 0.95,
   boost: 1.35,
   gull: 2.2,
   bat: 1.8,
   hawk: 2.6,
   balloon: 2.4,
   hotAir: 4.2,
   blimp: 5.6,
   skyLantern: 1.4,
   rock: 2.4,
} as const;

/** The rider's seat: his origin under the carpet's top so the hip joints rest just over it (metres, the carpet's frame). */
export const SEAT_Y = CARPET_TOP + 0.15 - 0.7745 * RIDER_SCALE;
export const SEAT_Z = -0.1;

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
): ModelAsset => ({ id, url: `/models/3d/magic-carpet-ride/${id}.glb`, fallback, fallbackColor, budget: { ...budget }, ...extra });

/** A lit gold for the rings and coins (core materials: a custom look). */
export const BRIGHT_GOLD = { color: "#fcd34d", roughness: 0.35, metalness: 0.2, emissive: "#8a5a00" } as const;

const longest = (s: Size) => Math.max(s.x, s.y, s.z);
/** A unit box standing on the origin: `stretch` makes the GLB 1 x 1 x 1. */
const unitBox = (s: Size): Partial<ModelAsset> => ({ stretch: [1 / s.x, 1 / s.y, 1 / s.z] });
/** Drawn at `size` metres on its longest side, centred on its own middle. */
const centred = (s: Size, size: number): Partial<ModelAsset> => {
   const scale = size / longest(s);
   return { scale, yOffset: -(s.y * scale) / 2 };
};

export const ASSETS = {
   rider: local("charCarpetRider", "capsule", "#4c1d95", { scale: RIDER_SCALE, humanoid: { landmarks: RIDER_LANDMARKS } }, CHARACTER_BUDGET),
   carpet: local("magicCarpet", "box", "#7c3aed", { scale: CARPET_SCALE, stretch: [1, 1, CARPET_STRETCH_Z] }),
   // bright gold: the GLBs' own metal renders near black without an environment map
   ring: local("flyingRing", "cylinder", "#fbbf24", { ...centred(GLB_SIZE.ring, FLY_SIZE.ring), material: BRIGHT_GOLD }),
   coin: local("m2GoldCoin", "cylinder", "#fbbf24", { ...centred(GLB_SIZE.coin, FLY_SIZE.coin), material: BRIGHT_GOLD }),
   // a bright, clear stone the scene tints ruby, emerald, sapphire or amethyst per copy
   gem: local("treasureGem", "sphere", "#e879f9", { ...centred(GLB_SIZE.gem, FLY_SIZE.gem), material: { color: "#ffffff", roughness: 0.15, metalness: 0.1, emissive: "#4a4a66" } }),
   boost: local("rocketBooster", "capsule", "#fb923c", centred(GLB_SIZE.boost, FLY_SIZE.boost)),
   gull: local("m2SeaGullDiver", "sphere", "#f8fafc", centred(GLB_SIZE.gull, FLY_SIZE.gull), CHARACTER_BUDGET),
   bat: local("m2CaveBat", "sphere", "#6d28d9", centred(GLB_SIZE.bat, FLY_SIZE.bat), CHARACTER_BUDGET),
   hawk: local("m2StormHawkBoss", "sphere", "#0ea5e9", centred(GLB_SIZE.hawk, FLY_SIZE.hawk), CHARACTER_BUDGET),
   balloon: local("m2BalloonBunch", "sphere", "#f472b6", centred(GLB_SIZE.balloon, FLY_SIZE.balloon)),
   hotAir: local("m2AirshipBg", "sphere", "#d97706", centred(GLB_SIZE.hotAir, FLY_SIZE.hotAir)),
   blimp: local("m2SmokeBlimpBoss", "capsule", "#44403c", centred(GLB_SIZE.blimp, FLY_SIZE.blimp), CHARACTER_BUDGET),
   skyLantern: local("m2TempleLantern", "box", "#f59e0b", centred(GLB_SIZE.skyLantern, FLY_SIZE.skyLantern)),
   rock: local("floatingRockV3", "box", "#78716c", centred(GLB_SIZE.rock, FLY_SIZE.rock)),
   // white, softly self-lit: the GLB's grey shades like stone under the sun
   cloud: local("cloud", "sphere", "#f8fafc", { ...unitBox(GLB_SIZE.cloud), material: { color: "#ffffff", roughness: 1, metalness: 0, emissive: "#8fa3b8" } }),
   tower: local("palaceTower", "box", "#e9d5ff", unitBox(GLB_SIZE.tower)),
   roof: local("desertRooftopV2", "box", "#c2410c", unitBox(GLB_SIZE.roof)),
   mesa: local("canyonMesa", "box", "#9a3412", unitBox(GLB_SIZE.mesa)),
   lantern: local("hangingLantern", "box", "#fbbf24", unitBox(GLB_SIZE.lantern)),
   palace: local("floatingPalaceR", "box", "#f5f3ff", unitBox(GLB_SIZE.palace)),
   pyramid: local("m2StepPyramidBg", "box", "#d6a86a", unitBox(GLB_SIZE.pyramid)),
   islandCastle: local("m2SkyIslandCastle", "box", "#a3e635", unitBox(GLB_SIZE.islandCastle)),
   islandFalls: local("m2SkyIslandWaterfall", "box", "#4ade80", unitBox(GLB_SIZE.islandFalls)),
   islandMill: local("m2WindmillIsland", "box", "#86efac", unitBox(GLB_SIZE.islandMill)),
   palm: { ...REUSED_ASSETS.palm, stretch: [1 / REUSED_GLB_SIZE.palm.width, 1 / REUSED_GLB_SIZE.palm.height, 1 / REUSED_GLB_SIZE.palm.depth] },
} satisfies Record<string, ModelAsset>;

/** The flying obstacles' assets by kind. */
export const OBSTACLE_ASSET = {
   gull: ASSETS.gull,
   bat: ASSETS.bat,
   hawk: ASSETS.hawk,
   balloon: ASSETS.balloon,
   hotAir: ASSETS.hotAir,
   blimp: ASSETS.blimp,
   lantern: ASSETS.skyLantern,
   rock: ASSETS.rock,
} as const;
