// Sky Tower Jump's models: the Menu 2 Hyper3D GLBs (public/models/3d/menu2, shared by the Color Roll
// Heroes games) and this game's own sky platform. Every GLB is one mesh with one material,
// feet on y = 0, centred on x and z (tools/hyper3d optimize). GLB_SIZE holds the raw bounds and the
// top surfaces measured on the meshes (assets.test.ts checks them against the real files); the Scene
// fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
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

/** Raw GLB bounds (x, y, z) and, for platforms, the height of the walkable top inside y. */
export const GLB_SIZE = {
   islandA: { x: 1.892, y: 0.51, z: 1.9, top: 0.46 },
   islandB: { x: 1.918, y: 1.439, z: 1.816 },
   islandC: { x: 1.498, y: 1.849, z: 1.666 },
   islandD: { x: 1.761, y: 1.571, z: 1.89 },
   skyPlatform: { x: 1.889, y: 0.59, z: 1.892, top: 0.58 },
   movingBlock: { x: 1.891, y: 1.208, z: 1.883, top: 1.06 },
   plankBridge: { x: 1.896, y: 0.548, z: 0.891, top: 0.2 },
   bouncePad: { x: 1.812, y: 0.5, z: 1.892, top: 0.43 },
   checkpointBeacon: { x: 1.168, y: 1.902, z: 0.989 },
   skyFortressGate: { x: 1.895, y: 1.346, z: 1.071 },
   stoneTower: { x: 1.648, y: 1.905, z: 1.589 },
   woodenLadder: { x: 0.896, y: 1.898, z: 1.234 },
} as const;

/**
 * An orb is drawn as the shared Hyper3D gold star coin (the concept board's coins), 0.75 m across,
 * its centre on the rules' orb point (the pickup radius is the rules' ORB, not this).
 */
export const ORB_SIZE = 0.75;
export const ORB_SCALE = ORB_SIZE / COIN_GLB_SIZE.width;

const menu2 = (id: string, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/menu2/${id}.glb`,
   fallback: "box",
   fallbackColor: "#94a3b8",
   budget: PROP_BUDGET,
   ...extra,
});

export const ASSETS: Record<string, ModelAsset> = {
   // Riko, the default Color Roll Heroes hero (m2HeroRiko.glb, static T-pose, auto-rigged). The code
   // stand-in (Armadillo.tsx) is the fallback. No hero selection: Nami / Kiro / Zuno / Vexa stay unused.
   hero: menu2("m2HeroRiko", {
      fallback: "capsule",
      fallbackColor: "#ef4444",
      budget: CHARACTER_BUDGET,
      scale: RIKO_SCALE,
      humanoid: { landmarks: RIKO_LANDMARKS },
   }),
   islandA: menu2("islandA", { fallbackColor: "#65a30d" }),
   islandB: menu2("islandB", { fallbackColor: "#65a30d" }),
   islandC: menu2("islandC", { fallbackColor: "#65a30d" }),
   islandD: menu2("islandD", { fallbackColor: "#65a30d" }),
   movingBlock: menu2("movingBlock", { fallbackColor: "#64748b" }),
   plankBridge: menu2("plankBridge", { fallbackColor: "#a16207" }),
   bouncePad: menu2("bouncePad", { fallbackColor: "#38bdf8" }),
   checkpointBeacon: menu2("checkpointBeacon", { fallbackColor: "#38bdf8" }),
   skyFortressGate: menu2("skyFortressGate", { fallbackColor: "#64748b" }),
   stoneTower: menu2("stoneTower", { fallbackColor: "#94a3b8" }),
   woodenLadder: menu2("woodenLadder", { fallbackColor: "#a16207" }),
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
   skyPlatform: {
      id: "skyPlatform",
      url: "/models/3d/sky-tower-jump/skyPlatform.glb",
      fallback: "box",
      fallbackColor: "#65a30d",
      budget: PROP_BUDGET,
   },
};
