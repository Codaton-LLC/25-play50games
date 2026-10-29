import type { ModelAsset } from "@/arcade3d/core/types";
import { GHOST_GLB_SCALE, GHOST_GLB_Y_OFFSET } from "./suck";
import { COLORS } from "./looks";
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
 * candelabra.glb measured bounds (GLB units, root space, 2026-10-25, the assets.test.ts recipe):
 * 1.51181 w x 1.89846 h x 0.67328 d, base at y = 0, centred in x/z. The generation bakes in the
 * three wax candles and small solid flame shapes (spec: "three thick candles with small solid
 * flame shapes"), so the drawn 0.68 m height matches the whole old composition it replaced on
 * the desks (brass 0.38 + wax 0.22 + flames, Mansion.tsx); the procedural wax stalks and
 * flickering flames were dropped with the swap.
 */
export const CANDELABRA_SCALE = 0.68 / 1.89846;

/**
 * atticTrunk.glb measured bounds (GLB units, root space, 2026-10-25, the assets.test.ts recipe):
 * 1.90058 w x 1.20405 h x 1.22258 d, base at y = 0, centred in x/z. Drawn 1.0 m wide on the
 * estate grounds (a steamer trunk ~0.63 tall, ~0.64 deep): extra decor for the Attic (4) and
 * Whole Mansion (5) levels, strictly outside the mansion play bounds (Decor.tsx, trunk spots below).
 */
export const TRUNK_GLB = { width: 1.90058, height: 1.20405, depth: 1.22258 } as const;
export const TRUNK_SCALE = 1.0 / TRUNK_GLB.width;
export const TRUNK_DRAWN = {
   width: 1.0,
   height: TRUNK_GLB.height * TRUNK_SCALE,
   depth: TRUNK_GLB.depth * TRUNK_SCALE,
} as const;
/**
 * The three attic trunks on the grounds, levels 4-5 only: the west and east flanks among the bare
 * trees and one in the south garden band between the hedge rows, where the other decor sits.
 */
export const TRUNK_SPOTS = [
   { x: -20.5, y: 0, z: -5.5, rotY: 0.5 },
   { x: 20.5, y: 0, z: 2.0, rotY: -0.6 },
   { x: 10.8, y: 0, z: 12.7, rotY: 1.2 },
] as const;
/**
 * The hunter's back is flat from the waist to the shoulders (the chest anchor's strip, z -0.204 GLB), but
 * the belt pouches behind the hips (y 0.90-1.03 GLB, x +-0.11) stick out 3.2 cm (drawn) behind it, inside
 * the pack's footprint: the pack keeps this extra gap so its box clears them (poses.test.ts measures the
 * posed mesh: at 0.02 the pack still cuts 1.2 cm into them; the runner needed 0.07 for its shoulder blades).
 */
export const BACK_CLEARANCE = 0.035;
export const PACK_OFFSET = [0, -EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE, EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE - 0.01 - BACK_CLEARANCE] as const;
/** Raw bounds (GLB units, floor pivot, centred) of the GLBs the rooms reuse, measured 2026-10-29 (assets.test.ts). */
export const ROOM_GLB = {
   bookshelfFull: { width: 1.6086, height: 1.8941, depth: 0.4207 },
   table: { width: 1.896, height: 0.8729, depth: 0.9264 },
   prepCounterR: { width: 1.5933, height: 1.8967, depth: 1.1 },
   stoveHearth: { width: 1.8153, height: 1.4526, depth: 1.9017 },
   crate: { width: 1.8797, height: 1.3351, depth: 1.8107 },
   spiderWeb: { width: 1.9131, height: 1.8057, depth: 0.2538 },
} as const;

function unitCube(id: string, url: string, size: { width: number; height: number; depth: number }, fallbackColor: string): ModelAsset {
   return { id, url, scale: 1, stretch: [1 / size.width, 1 / size.height, 1 / size.depth], fallback: "box", fallbackColor, budget: { tris: 5000, bytes: 400000 } };
}

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
   /** Hyper3D three-armed candelabra (1500 tris, 110 KB), candles and flame shapes baked in; 0.68 m tall on the desks. */
   candelabra: { id: "candelabra", url: "/models/3d/ghost-vacuum/candelabra.glb", scale: CANDELABRA_SCALE, fallback: "cylinder", fallbackColor: COLORS.brass, budget: { tris: 5000, bytes: 300000 } },
   /** Hyper3D steamer trunk (2500 tris, 250 KB): drawn 1.0 m wide, base at y = 0; levels 4-5 grounds decor only. */
   trunk: { id: "trunk", url: "/models/3d/ghost-vacuum/atticTrunk.glb", scale: TRUNK_SCALE, rotationY: 0, yOffset: 0, fallback: "box", fallbackColor: COLORS.woodDesk, budget: { tris: 5000, bytes: 300000 } },
   // ----- the rooms' own furniture (rules.ts ROOM_FURNITURE): reused GLBs fitted to a 1 m cube, so a
   // spot's sx / sy / sz is the drawn size in metres (measured bounds in ROOM_GLB, assets.test.ts) -----
   bookshelf: unitCube("bookshelf", "/models/3d/shared/bookshelfFull.glb", ROOM_GLB.bookshelfFull, "#7c4a1e"),
   table: unitCube("kitchenTable", "/models/3d/shared/table.glb", ROOM_GLB.table, "#a16207"),
   counter: unitCube("counter", "/models/3d/pizza-kitchen-3d/prepCounterR.glb", ROOM_GLB.prepCounterR, "#a16207"),
   stove: unitCube("stove", "/models/3d/monster-kitchen/stoveHearth.glb", ROOM_GLB.stoveHearth, "#78716c"),
   trunkBox: unitCube("trunkBox", "/models/3d/ghost-vacuum/atticTrunk.glb", TRUNK_GLB, "#5b3a1f"),
   crate: unitCube("crate", "/models/3d/shared/crate.glb", ROOM_GLB.crate, "#a16207"),
   web: unitCube("web", "/models/3d/bee-garden/spiderWeb.glb", ROOM_GLB.spiderWeb, "#e2e8f0"),
} satisfies Record<string, ModelAsset>;
