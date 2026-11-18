// The five Color Roll Heroes' own Hyper3D models (public/models/3d/menu2/m2Hero<Name>.glb), shared by every
// Menu 2 game: one place maps a hero id to its GLB, its drawn scale, its joints and its ModelAsset, so a game
// never tints one mesh into four. Each hero renders with its own textures. The colour in heroes.ts stays
// only as a UI accent (picker swatch, power pill). All five are the same armadillo build, 20 000 triangles,
// feet on y = 0, centred on x and z, facing +z (tail toward -z); heroModels.test.ts measures every real mesh.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";

export type M2HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export const M2_HERO_IDS: readonly M2HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Every hero is drawn this tall (metres): the code stand-in's height. */
export const HERO_HEIGHT_M = 1.45;

/** Measured on the real GLBs (2026-10-26): the height (y), the arm reach (|x|) and the tail depth (|z|), GLB units. */
export const HERO_GLB: Record<M2HeroId, { name: string; height: number; reach: number; depth: number }> = {
   riko: { name: "Riko", height: 1.9035283327102661, reach: 0.7524892687797546, depth: 0.8000152111 },
   nami: { name: "Nami", height: 1.9057738781, reach: 0.7717772722, depth: 0.7975129485 },
   kiro: { name: "Kiro", height: 1.8979462385, reach: 0.7966410518, depth: 0.8858175874 },
   zuno: { name: "Zuno", height: 1.9003524780, reach: 0.7822100520, depth: 0.7974335551 },
   vexa: { name: "Vexa", height: 1.8991692066, reach: 0.7852765322, depth: 0.7899929285 },
};

/** Scale that draws each hero HERO_HEIGHT_M tall. */
export const HERO_SCALE: Record<M2HeroId, number> = {
   riko: HERO_HEIGHT_M / HERO_GLB.riko.height,
   nami: HERO_HEIGHT_M / HERO_GLB.nami.height,
   kiro: HERO_HEIGHT_M / HERO_GLB.kiro.height,
   zuno: HERO_HEIGHT_M / HERO_GLB.zuno.height,
   vexa: HERO_HEIGHT_M / HERO_GLB.vexa.height,
};

/**
 * The Color Roll Heroes' joints (all five are the same armadillo body in their own colours and plates, so one set fits each; heroModels.test.ts rigs every one) (GLB units, faces +z, feet on y = 0), measured on m2HeroRiko.glb (2026-10-25, the
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
const RIKO_LANDMARKS: HumanoidLandmarks = {
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



/**
 * Each hero's joints: Riko's measured set, and for the other four the same recipe on their own mesh (the shared
 * leg, hip, head and wrist values above, with this hero's own shoulders, arms, toes, spine and blends from the core
 * estimate, 2026-10-26; heroModels.test.ts checks each against the estimate and rigs it).
 */
export const HERO_LANDMARKS: Record<M2HeroId, HumanoidLandmarks> = {
   riko: RIKO_LANDMARKS,
   nami: { ...RIKO_LANDMARKS, ...{"shoulderY":1.22,"shoulderX":0.336,"shoulderZ":0.417,"armRadius":0.093,"clavicleX":0.168,"elbowX":0.468,"armSpread":0.167,"toeZ":0.673,"heelZ":0.213,"spineY":0.814,"chestY":0.988,"spineZ":0.291,"shoulderBlend":0.056,"elbowBlend":0.047,"crotchBlend":0.052,"spineBlend":0.052} },
   kiro: { ...RIKO_LANDMARKS, ...{"shoulderY":1.269,"shoulderX":0.392,"shoulderZ":0.487,"armRadius":0.108,"clavicleX":0.196,"elbowX":0.496,"armSpread":0.161,"toeZ":0.757,"heelZ":0.289,"spineY":0.829,"chestY":1.017,"spineZ":0.36,"shoulderBlend":0.065,"elbowBlend":0.052,"crotchBlend":0.116,"spineBlend":0.057} },
   zuno: { ...RIKO_LANDMARKS, ...{"shoulderY":1.175,"shoulderX":0.343,"shoulderZ":0.427,"armRadius":0.1,"clavicleX":0.172,"elbowX":0.472,"armSpread":0.166,"toeZ":0.67,"heelZ":0.218,"spineY":0.8,"chestY":0.961,"spineZ":0.296,"shoulderBlend":0.06,"elbowBlend":0.05,"crotchBlend":0.093,"spineBlend":0.048} },
   vexa: { ...RIKO_LANDMARKS, ...{"shoulderY":1.216,"shoulderX":0.354,"shoulderZ":0.42,"armRadius":0.099,"clavicleX":0.177,"elbowX":0.477,"armSpread":0.167,"toeZ":0.673,"heelZ":0.212,"spineY":0.813,"chestY":0.986,"spineZ":0.245,"shoulderBlend":0.059,"elbowBlend":0.049,"crotchBlend":0.103,"spineBlend":0.052} },
};

/** Sole centre along z (GLB units). The drawn hero is shifted back by this so its feet sit on the physics point. */
export const HERO_SOLE_Z: Record<M2HeroId, number> = {
   riko: (HERO_LANDMARKS.riko.toeZ + HERO_LANDMARKS.riko.heelZ) / 2,
   nami: (HERO_LANDMARKS.nami.toeZ + HERO_LANDMARKS.nami.heelZ) / 2,
   kiro: (HERO_LANDMARKS.kiro.toeZ + HERO_LANDMARKS.kiro.heelZ) / 2,
   zuno: (HERO_LANDMARKS.zuno.toeZ + HERO_LANDMARKS.zuno.heelZ) / 2,
   vexa: (HERO_LANDMARKS.vexa.toeZ + HERO_LANDMARKS.vexa.heelZ) / 2,
};

const ACCENT: Record<M2HeroId, string> = { riko: "#ef4444", nami: "#2563eb", kiro: "#22c55e", zuno: "#facc15", vexa: "#8b5cf6" };

export const heroUrl = (id: M2HeroId) => `/models/3d/menu2/m2Hero${HERO_GLB[id].name}.glb`;

/** The hero's own ModelAsset: its GLB, scale and auto-rig joints; the accent colour is only the capsule fallback. */
export function heroModelAsset(id: M2HeroId): ModelAsset {
   return {
      id: `m2Hero${HERO_GLB[id].name}`,
      url: heroUrl(id),
      fallback: "capsule",
      fallbackColor: ACCENT[id],
      budget: CHARACTER_BUDGET,
      scale: HERO_SCALE[id],
      humanoid: { landmarks: HERO_LANDMARKS[id] },
   };
}
