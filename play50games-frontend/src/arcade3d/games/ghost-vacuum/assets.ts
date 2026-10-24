import type { ModelAsset } from "@/arcade3d/core/types";
import { GHOST_GLB_SCALE, GHOST_GLB_Y_OFFSET } from "./suck";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_ASSETS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** hunter.glb is 1.8997 tall (GLB units, measured; its arm span 1.748 is shorter): drawn 1.56 m, the height of the runner it replaced. */
export const HUNTER_GLB_HEIGHT = 1.8997;
export const HUNTER_SCALE = 1.56 / HUNTER_GLB_HEIGHT;
/**
 * The hunter's joints (GLB units: a 1.748 x 1.8997 x 0.487 T-pose, faces +z; a big head with a headset,
 * glasses and a beard, a short-sleeved jumpsuit, a belt with pouches, knee pads, boots), measured on
 * hunter.glb (2026-10-24, the core recipe; hunter.test.ts). The estimate finds most of them; set by eye:
 * - shoulderY 1.295 / armRadius 0.095 (estimate 1.291 / 0.057): the short sleeve's top reaches 1.39-1.41
 *   at the shoulder, so with the estimate's band it stayed out as a fin when the arm hung (widest above
 *   the chest 0.41; at 0.095 it is 0.35, the sleeve hangs with the arm);
 * - headY 1.405 / neckY 1.375 (estimate 1.460 / 1.437): the beard reaches down to 1.40 in front of the
 *   neck, so the joint sits under it and the face, glasses, headset and beard turn as one (the collar's
 *   top follows the head a little);
 * - hipZ -0.06 (estimate -0.071, the shins' middle): between the thighs' middle (-0.045) and the shins';
 * - ankleY 0.19 with a 0.03 blend (estimate 0.186 / 0.044): the boot's foot (toe cap up to 0.14) is rigid;
 * - hemY = crotchY: nothing bridges the legs (the estimate's 0.681 is the close inner thighs).
 */
export const HUNTER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.295,
   shoulderX: 0.225,
   shoulderZ: -0.065,
   armRadius: 0.095,
   clavicleX: 0.112,
   elbowX: 0.452,
   wristX: 0.679,
   armSpread: 0.31,
   crotchY: 0.785,
   hipY: 0.869,
   hipX: 0.157,
   hipZ: -0.06,
   kneeY: 0.435,
   ankleY: 0.19,
   toeZ: 0.22,
   heelZ: -0.179,
   legDepth: 0.108,
   legOuterX: 0.287,
   hemY: 0.785,
   spineY: 0.996,
   chestY: 1.122,
   neckY: 1.375,
   headY: 1.405,
   spineZ: -0.038,
   shoulderBlend: 0.034,
   elbowBlend: 0.028,
   hipBlend: 0.087,
   kneeBlend: 0.065,
   ankleBlend: 0.03,
   crotchBlend: 0.067,
   spineBlend: 0.038,
   neckBlend: 0.015,
};
export const VACUUM_SCALE = 0.55 / EXPANSION_GLB_SIZE.vacuum.height;
/**
 * The hunter's back is flat from the waist to the shoulders (the chest anchor's strip, z -0.204 GLB), but
 * the belt pouches behind the hips (y 0.90-1.03 GLB, x +-0.11) stick out 3.2 cm (drawn) behind it, inside
 * the pack's footprint: the pack keeps this extra gap so its box clears them (poses.test.ts measures the
 * posed mesh: at 0.02 the pack still cuts 1.2 cm into them; the runner needed 0.07 for its shoulder blades).
 */
export const BACK_CLEARANCE = 0.035;
export const PACK_OFFSET = [0, -EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE, EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE - 0.01 - BACK_CLEARANCE] as const;
export const ASSETS = {
   /** Hyper3D image-to-3D from the user's own concept (18k tris, 545 KB): a static T-pose, auto-rigged (core/rig) with HUNTER_LANDMARKS. */
   hunter: { id: "hunter", url: "/models/3d/ghost-vacuum/hunter.glb", scale: HUNTER_SCALE, fallback: "capsule", fallbackColor: "#6ee7b7", budget: { ...CHARACTER_BUDGET }, humanoid: { landmarks: HUNTER_LANDMARKS } },
   vacuum: { ...EXPANSION_ASSETS.vacuum, scale: VACUUM_SCALE, rotationY: Math.PI },
   desk: { ...SHARED_ASSETS.desk, material: { color: "#765038", roughness: 0.9 }, scale: 1.6 / 1.90155, stretch: [1, 1, 0.8 / (0.91617 * (1.6 / 1.90155))] },
   chair: { ...SHARED_ASSETS.chair, scale: 0.6 / 1.21227, stretch: [1, 1, 0.6 / (1.23750 * (0.6 / 1.21227))] },
   book: { ...REUSED_ASSETS.book, scale: 0.25 / 1.89505, rotationY: -Math.PI / 2, yOffset: -0.125 },
   door: { ...REUSED_ASSETS.door, scale: 2.2 / 1.89286 },
   /** Hyper3D sheet ghost (2500 tris, 59 KB): 1.35 m tall, middle on the frame's body centre y0.8. */
   ghost: { id: "ghost", url: "/models/3d/ghost-vacuum/ghost.glb", scale: GHOST_GLB_SCALE, yOffset: GHOST_GLB_Y_OFFSET, fallback: "sphere", fallbackColor: "#e0e7ff", budget: { tris: 5000, bytes: 300000 } },
} satisfies Record<string, ModelAsset>;
