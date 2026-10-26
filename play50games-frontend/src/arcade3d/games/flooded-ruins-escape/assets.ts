// Flooded Ruins Escape's models. The hero is the shared Menu 2 armadillo (m2HeroRiko.glb, the other
// colours are a material tint). This game's own Hyper3D props live in public/models/3d/flooded-ruins-escape.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
// The scene fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, COIN_GLB_SIZE, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/**
 * m2HeroRiko.glb is 1.903528 tall (GLB units, measured 2026-10-25; arm reach 0.752, the tail makes
 * the depth 1.60). Drawn at 1.45 m, the stand-in's height (ARMADILLO.height).
 */
export const RIKO_GLB_HEIGHT = 1.9035283327102661;
export const RIKO_SCALE = 1.45 / RIKO_GLB_HEIGHT;

/**
 * Riko's joints (GLB units, faces +z, feet on y = 0), measured on m2HeroRiko.glb (2026-10-25, the
 * core recipe; hero.test.ts). The mesh is centred on its bounds, so the snout is at z +0.80 and the
 * tail at z -0.80, and the feet sit forward of the origin (sole z 0.24..0.66). The tail fills the
 * gap between the legs, so an unseeded estimate puts the crotch up at the shoulders.
 * Set by eye (the rest is that estimate):
 * - crotchY 0.58 / hipY 0.64 / kneeY 0.40: the hips are where the tail meets the torso. The legs are
 *   the short columns in front (z 0.30..0.60, y 0..0.40); the estimate's crotch was 1.11.
 * - hipX 0.22 / hipZ 0.42 / legDepth 0.12 / legOuterX 0.34: the shins' centre and thickness, in front
 *   of the tail (the estimate's legDepth 0.61 was the tail plus the belly).
 * - hemY 0.30: below the tail, and above the boots. The tail hangs behind the shins, outside
 *   legDepth, so it is skirt-weighted onto the hips and the spine. The shins stay inside legDepth
 *   and keep their own leg bones. The tail is not a limb.
 * - hipBlend 0.04: a short blend, so the tail tip (y about 0.64, z -0.80) stays on the hips.
 * - ankleY 0.20 / ankleBlend 0.03: the boot (the deep sole, y under 0.16) stays rigid.
 * - headY 1.36 / neckY 1.30 / neckBlend 0.02: the helmet, face and snout start near y 1.34 and turn
 *   as one. The estimate's head joint (1.54) cut through the muzzle.
 * - wristX 0.60 (estimate 0.632): the paws are small, so the wrist sits a little further in and the
 *   outer forearm hangs with the paw.
 */
export const RIKO_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.208,
   shoulderX: 0.352,
   shoulderZ: 0.44,
   armRadius: 0.084,
   clavicleX: 0.176,
   elbowX: 0.476,
   wristX: 0.6,
   armSpread: 0.174,
   crotchY: 0.58,
   hipY: 0.64,
   hipX: 0.22,
   hipZ: 0.42,
   kneeY: 0.4,
   ankleY: 0.2,
   toeZ: 0.658,
   heelZ: 0.24,
   legDepth: 0.12,
   legOuterX: 0.34,
   hemY: 0.3,
   spineY: 0.81,
   chestY: 0.981,
   neckY: 1.3,
   headY: 1.36,
   spineZ: 0.31,
   shoulderBlend: 0.05,
   elbowBlend: 0.042,
   hipBlend: 0.04,
   kneeBlend: 0.036,
   ankleBlend: 0.03,
   crotchBlend: 0.099,
   spineBlend: 0.051,
   neckBlend: 0.02,
};

/** Sole centre along z (GLB units). The drawn hero is shifted back by this so its feet sit on the physics point. */
export const RIKO_SOLE_Z = (RIKO_LANDMARKS.toeZ + RIKO_LANDMARKS.heelZ) / 2;

/** Raw GLB bounds (x, y, z). platform.top is the walkable deck, under the raised lip. */
export const GLB_SIZE = {
   platform: { x: 1.5533100366592407, y: 0.5869178175926208, z: 1.894503116607666, top: 0.3385263681411743 },
   brickLedge: { x: 1.8836073875427246, y: 0.6977473497390747, z: 1.1200847625732422 },
   channel: { x: 1.895902395248413, y: 0.42309802770614624, z: 1.576421856880188 },
   lever: { x: 1.729189157485962, y: 1.3045274019241333, z: 1.9008623361587524 },
   floodGate: { x: 1.8740476369857788, y: 1.9022464752197266, z: 0.40018993616104126 },
   spout: { x: 1.8949108123779297, y: 1.591225504875183, z: 1.462268352508545 },
   temple: { x: 1.8819454908370972, y: 1.8824912309646606, z: 1.4473990201950073 },
} as const;

/**
 * A coin is the shared Hyper3D gold star, 0.62 m across, its centre on the rules' pickup point.
 */
export const ORB_SIZE = 0.62;
export const ORB_SCALE = ORB_SIZE / COIN_GLB_SIZE.width;

const hero = (extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id: "m2HeroRiko",
   url: "/models/3d/menu2/m2HeroRiko.glb",
   fallback: "capsule",
   fallbackColor: "#ef4444",
   budget: CHARACTER_BUDGET,
   scale: RIKO_SCALE,
   humanoid: { landmarks: RIKO_LANDMARKS },
   ...extra,
});

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/flooded-ruins-escape/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: hero(),
   platform: prop("m2RuinPlatform", "#a89078"),
   brickLedge: prop("m2RuinBrickLedge", "#8d735c"),
   channel: prop("m2RuinChannel", "#7d8f86"),
   lever: prop("m2StoneLever", "#6b5a48"),
   floodGate: prop("m2RuinFloodGate", "#5c6b62"),
   spout: prop("m2RuinWaterSpout", "#3d8b9a"),
   temple: prop("m2SunkenTempleBg", "#6e6256"),
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
};
