// Beach Lifeguard models: the ready Hyper3D GLBs (menu1-beach-lifeguard), fitted from their measured bounds
// (assets.test.ts checks every fit on the real mesh). Gameplay props are fitted to their size in metres;
// the decor (palms, huts) to 1 m tall, so a decor spot's `scale` is its height and nothing is scaled twice.
// Left out on purpose: surfboard / surfboardV2 / surfboardLong (a disc, broken, square) and alertBuoy (the
// alert stays the spec's code torus); beach-lifeguard/hero.glb (an older mesh).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   charLifeguard: { width: 1.8684, height: 1.8986, depth: 0.4417 },
   lifeguardTower: { width: 1.015, height: 1.8638, depth: 1.1805 },
   rescueFloat: { width: 1.0085, height: 0.3772, depth: 1.8908 },
   beachChair: { width: 1.3327, height: 1.7617, depth: 1.9062 },
   beachCooler: { width: 1.839, height: 1.8991, depth: 1.422 },
   beachgoerNpc: { width: 0.7197, height: 1.9005, depth: 0.4798 },
   beachHut: { width: 1.3542, height: 1.9004, depth: 1.7811 },
   sandcastle: { width: 1.8873, height: 1.6597, depth: 1.8929 },
   rescueJetSki: { width: 0.7264, height: 0.6767, depth: 1.8984 },
   /** clean-city umbrella (raw bounds in clean-city/assets.ts) */
   umbrella: { width: 1.78, height: 1.902, depth: 1.737 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   lifeguard: 1.82,
   swimmer: 1.65,
   /** the swimmer stands in the water up to the chest */
   swimmerSink: 1.05,
   tower: 3.0,
   float: 0.9,
   jetSki: 2.4,
   chairDepth: 1.3,
   coolerHeight: 0.5,
   sandcastleWidth: 1.0,
   umbrellaHeight: 2.0,
} as const;

export const LIFEGUARD_SCALE = FIT.lifeguard / GLB_SIZE.charLifeguard.height;

/**
 * Measured on charLifeguard.glb (estimateHumanoidLandmarks, lifeguard.test.ts): T-pose, arms at y 1.25-1.40,
 * red shorts. Set by hand: hemY = crotchY (the shorts' inner sides read as a hem bridging the legs).
 */
export const LIFEGUARD_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.343,
   shoulderX: 0.242,
   shoulderZ: -0.064,
   armRadius: 0.065,
   clavicleX: 0.121,
   elbowX: 0.485,
   wristX: 0.727,
   armSpread: 0.117,
   crotchY: 0.791,
   hipY: 0.872,
   hipX: 0.142,
   hipZ: -0.092,
   kneeY: 0.436,
   ankleY: 0.16,
   toeZ: 0.169,
   heelZ: -0.188,
   legDepth: 0.067,
   legOuterX: 0.26,
   hemY: 0.791,
   spineY: 1.013,
   chestY: 1.154,
   neckY: 1.483,
   headY: 1.507,
   spineZ: -0.025,
   shoulderBlend: 0.039,
   elbowBlend: 0.032,
   hipBlend: 0.087,
   kneeBlend: 0.065,
   ankleBlend: 0.049,
   crotchBlend: 0.068,
   spineBlend: 0.042,
   neckBlend: 0.012,
};

const local = (id: keyof typeof GLB_SIZE, scale: number, fallback: ModelAsset["fallback"], fallbackColor: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset & { scale: number } => ({
   id,
   url: `/models/3d/beach-lifeguard/${id}.glb`,
   scale,
   fallback,
   fallbackColor,
   budget: { ...budget },
});

export const ASSETS = {
   lifeguard: {
      ...local("charLifeguard", LIFEGUARD_SCALE, "capsule", "#dc2626", CHARACTER_BUDGET),
      humanoid: { landmarks: LIFEGUARD_LANDMARKS },
   },
   // unrigged (spec): stands in the water to the chest and bobs
   swimmer: { ...local("beachgoerNpc", FIT.swimmer / GLB_SIZE.beachgoerNpc.height, "capsule", "#38bdf8", CHARACTER_BUDGET), yOffset: -FIT.swimmerSink },
   tower: local("lifeguardTower", FIT.tower / GLB_SIZE.lifeguardTower.height, "box", "#ef4444"),
   rescueFloat: local("rescueFloat", FIT.float / GLB_SIZE.rescueFloat.depth, "cylinder", "#ef4444"),
   jetSki: local("rescueJetSki", FIT.jetSki / GLB_SIZE.rescueJetSki.depth, "box", "#0284c7"),
   chair: local("beachChair", FIT.chairDepth / GLB_SIZE.beachChair.depth, "box", "#0ea5e9"),
   cooler: local("beachCooler", FIT.coolerHeight / GLB_SIZE.beachCooler.height, "box", "#0284c7"),
   sandcastle: local("sandcastle", FIT.sandcastleWidth / GLB_SIZE.sandcastle.width, "cylinder", "#eab308"),
   umbrella: { ...REUSED_ASSETS.umbrella, scale: FIT.umbrellaHeight / GLB_SIZE.umbrella.height },
   // decor, 1 m tall: the spot's scale is the height
   decorCastle: { ...local("sandcastle", 1 / GLB_SIZE.sandcastle.height, "cylinder", "#eab308"), id: "decorCastle" },
   decorCooler: { ...local("beachCooler", 1 / GLB_SIZE.beachCooler.height, "box", "#0284c7"), id: "decorCooler" },
   hut: local("beachHut", 1 / GLB_SIZE.beachHut.height, "box", "#78350f"),
   palm: { ...REUSED_ASSETS.palm, scale: 1 / REUSED_GLB_SIZE.palm.height },
} satisfies Record<string, ModelAsset>;
