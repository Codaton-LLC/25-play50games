// Where the yard is drawn. Rules keep the pine trunks and the snowman; the meshes do not sit
// between the follow camera (+z) and a kid. Forts stay inside the 1.80 m collision square.
import { PerspectiveCamera, Vector3 } from "three";
import type { FittedView } from "@/arcade3d/core/view";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, PINE_HEIGHT, SNOWMAN_HEIGHT, SNOWMAN_RADIUS } from "./assets";
import { FOV, placeFollowCamera } from "./camera";
import { FORT, KID, YARD, type PineState, type Run } from "./rules";

/** A decor screen box may cover at most this share of a kid's screen box. */
export const COVER_LIMIT = 0.15;

/** Low drift on a trunk. Anything taller belongs outside the fence. */
export const BANK = { height: 0.2, radius: 0.42 } as const;

/** Team hat, metres, in the head anchor (scale is undone). Wide and short so the colour reads. */
export const BEANIE = { radius: 0.24, y: 0.02, scaleXZ: 1.05, scaleY: 0.75 } as const;
/** Team collar. The chest anchor is the back; +z walks the ring onto the front. */
export const SCARF = { radius: 0.17, tube: 0.07, y: 0.04, z: 0.08 } as const;

export const FORT_TONES = ["#f8fafc", "#e0f2fe", "#bae6fd"] as const;
export const ICICLE_COLOR = "#7dd3fc";

export interface FortBlock {
   x: number;
   y: number;
   z: number;
   r: number;
   /** vertical squash of the snowball */
   sy: number;
   tone: 0 | 1 | 2;
   /** 0 skirt, 1 course, 2 crenel. hp 0 draws the skirt only. */
   tier: 0 | 1 | 2;
}

export interface Icicle {
   x: number;
   y: number;
   z: number;
   r: number;
   len: number;
}

/**
 * Horseshoe of snowballs inside the fort's inscribed circle (so a yaw toward the snowman still
 * lands in the axis-aligned 1.80 m square). The opening is local +z, toward the snowman.
 * y is the sphere centre at full height (1.40 m); sy squashes it.
 */
export const FORT_BLOCKS: readonly FortBlock[] = [
   { x: -0.34, y: 0.12, z: -0.36, r: 0.26, sy: 0.5, tone: 0, tier: 0 },
   { x: 0, y: 0.13, z: -0.4, r: 0.28, sy: 0.5, tone: 0, tier: 0 },
   { x: 0.34, y: 0.12, z: -0.36, r: 0.26, sy: 0.5, tone: 1, tier: 0 },
   { x: -0.48, y: 0.1, z: 0.02, r: 0.22, sy: 0.5, tone: 2, tier: 0 },
   { x: 0.48, y: 0.1, z: 0.02, r: 0.22, sy: 0.5, tone: 2, tier: 0 },
   { x: -0.36, y: 0.09, z: 0.32, r: 0.2, sy: 0.48, tone: 0, tier: 0 },
   { x: 0.36, y: 0.09, z: 0.32, r: 0.2, sy: 0.48, tone: 1, tier: 0 },
   { x: -0.32, y: 0.46, z: -0.38, r: 0.22, sy: 0.9, tone: 1, tier: 1 },
   { x: 0, y: 0.5, z: -0.42, r: 0.24, sy: 0.9, tone: 0, tier: 1 },
   { x: 0.32, y: 0.46, z: -0.38, r: 0.22, sy: 0.9, tone: 2, tier: 1 },
   { x: -0.48, y: 0.4, z: 0, r: 0.18, sy: 0.88, tone: 0, tier: 1 },
   { x: 0.48, y: 0.4, z: 0, r: 0.18, sy: 0.88, tone: 1, tier: 1 },
   { x: -0.3, y: 0.82, z: -0.36, r: 0.16, sy: 0.85, tone: 0, tier: 2 },
   { x: 0, y: 0.96, z: -0.4, r: 0.18, sy: 0.85, tone: 1, tier: 2 },
   { x: 0.3, y: 0.78, z: -0.36, r: 0.15, sy: 0.85, tone: 2, tier: 2 },
   { x: 0, y: 1.2, z: -0.38, r: 0.13, sy: 0.8, tone: 0, tier: 2 },
];

export const FORT_ICICLES: readonly Icicle[] = [
   { x: -0.32, y: 0.62, z: -0.36, r: 0.045, len: 0.28 },
   { x: 0, y: 0.7, z: -0.4, r: 0.05, len: 0.32 },
   { x: 0.32, y: 0.58, z: -0.36, r: 0.04, len: 0.24 },
   { x: -0.46, y: 0.48, z: 0.02, r: 0.035, len: 0.2 },
   { x: 0.46, y: 0.48, z: 0.02, r: 0.035, len: 0.2 },
];

/** Local +z (the opening) turns toward the snowman at the origin. */
export function fortYaw(x: number, z: number): number {
   return Math.atan2(-x, -z);
}

/** Height scale of the wall. A crumbled fort (0 HP) keeps a low skirt. */
export function fortVisualScale(hp: number): number {
   if (hp >= 3) return 1;
   if (hp === 2) return FORT.heights[1] / FORT.heights[0];
   if (hp === 1) return FORT.heights[2] / FORT.heights[0];
   return 0.16 / FORT.heights[0];
}

/** 0 hides this block at this HP. */
export function fortBlockScale(hp: number, tier: 0 | 1 | 2): number {
   if (hp <= 0) return tier === 0 ? fortVisualScale(0) : 0;
   return fortVisualScale(hp);
}

export interface WorldBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

export const SNOWMAN_BOX: WorldBox = {
   minX: -SNOWMAN_RADIUS,
   maxX: SNOWMAN_RADIUS,
   minY: 0,
   maxY: SNOWMAN_HEIGHT,
   minZ: -SNOWMAN_RADIUS,
   maxZ: SNOWMAN_RADIUS,
};

const PINE_ASSET_SCALE = ASSETS.pine.scale ?? 1;
const PINE_GLB_HALF = Math.max(EXPANSION_GLB_SIZE.pineTree.width, EXPANSION_GLB_SIZE.pineTree.depth) / 2;

/** Horizontal half-extent of a drawn pine (GLB fit × the spot's own scale). */
export function pineHalf(spotScale: number): number {
   return PINE_GLB_HALF * PINE_ASSET_SCALE * spotScale;
}

/** Draw every pine outside the far fence (−z, away from the camera), smaller so the canopy does not loom over a kid. Trunk circles stay in rules.ts. */
export function pineSpots(pines: readonly PineState[]): InstanceSpot[] {
   const n = pines.length;
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < n; i++) {
      const scale = pines[i].scale * 0.62;
      const half = pineHalf(scale);
      const x = -16 + ((i + 0.5) * 32) / Math.max(1, n);
      const z = YARD.minZ - half - 8;
      spots.push({ x, y: 0, z, rotY: pines[i].rotY, scale });
   }
   return spots;
}

/**
 * No interior mounds. A 0.20 m bank under the landscape camera (the lens sits only a few metres
 * back) still filled a kid's screen box, so the trunk circles stay collision-only.
 */
export function bankSpots(_pines: readonly PineState[]): InstanceSpot[] {
   return [];
}

export function pineBox(spot: InstanceSpot, out: WorldBox): WorldBox {
   const half = pineHalf(spot.scale ?? 1);
   const top = PINE_HEIGHT * (spot.scale ?? 1);
   out.minX = spot.x - half;
   out.maxX = spot.x + half;
   out.minY = 0;
   out.maxY = top;
   out.minZ = spot.z - half;
   out.maxZ = spot.z + half;
   return out;
}

export function bankBox(spot: InstanceSpot, out: WorldBox): WorldBox {
   const hx = spot.sx ?? BANK.radius;
   const hy = (spot.sy ?? BANK.height / 2) * 2;
   const hz = spot.sz ?? BANK.radius;
   out.minX = spot.x - hx;
   out.maxX = spot.x + hx;
   out.minY = 0;
   out.maxY = hy;
   out.minZ = spot.z - hz;
   out.maxZ = spot.z + hz;
   return out;
}

export function kidBox(x: number, z: number, out: WorldBox): WorldBox {
   out.minX = x - KID.radius;
   out.maxX = x + KID.radius;
   out.minY = 0;
   out.maxY = KID.height;
   out.minZ = z - KID.radius;
   out.maxZ = z + KID.radius;
   return out;
}

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 200);
const P = new Vector3();

function closestCamZ(box: WorldBox, cam: PerspectiveCamera): number {
   let best = -Infinity;
   for (let i = 0; i < 8; i++) {
      P.set(i & 1 ? box.maxX : box.minX, i & 2 ? box.maxY : box.minY, i & 4 ? box.maxZ : box.minZ);
      P.applyMatrix4(cam.matrixWorldInverse);
      if (P.z > best) best = P.z;
   }
   return best;
}

interface PxRect {
   left: number;
   top: number;
   right: number;
   bottom: number;
   ok: boolean;
}

const RECT_A: PxRect = { left: 0, top: 0, right: 0, bottom: 0, ok: false };
const RECT_B: PxRect = { left: 0, top: 0, right: 0, bottom: 0, ok: false };

/** True when a corner sits on or behind the near plane (the box crosses the lens). */
function fillRect(box: WorldBox, cam: PerspectiveCamera, width: number, height: number, out: PxRect): boolean {
   let left = Infinity;
   let right = -Infinity;
   let top = Infinity;
   let bottom = -Infinity;
   let any = false;
   let behind = false;
   for (let i = 0; i < 8; i++) {
      P.set(i & 1 ? box.maxX : box.minX, i & 2 ? box.maxY : box.minY, i & 4 ? box.maxZ : box.minZ);
      P.applyMatrix4(cam.matrixWorldInverse);
      if (!(P.z < -cam.near)) {
         behind = true;
         continue;
      }
      P.applyMatrix4(cam.projectionMatrix);
      if (!Number.isFinite(P.x) || !Number.isFinite(P.y)) {
         behind = true;
         continue;
      }
      const sx = ((P.x + 1) / 2) * width;
      const sy = ((1 - P.y) / 2) * height;
      if (sx < left) left = sx;
      if (sx > right) right = sx;
      if (sy < top) top = sy;
      if (sy > bottom) bottom = sy;
      any = true;
   }
   out.ok = any;
   out.left = left;
   out.right = right;
   out.top = top;
   out.bottom = bottom;
   return behind;
}

function centerCamZ(box: WorldBox, cam: PerspectiveCamera): number {
   P.set((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2);
   P.applyMatrix4(cam.matrixWorldInverse);
   return P.z;
}

/**
 * Share of `kid`'s screen box covered by `decor`, or 0 when the decor is not closer to the lens
 * than the kid (the depth buffer would draw the kid in front). A decor whose centre is behind the
 * camera does not count: a corner on the near plane would otherwise fill the screen.
 * Scratch only: safe to call from a frame, not re-entrant.
 */
export function coverFraction(
   decor: WorldBox,
   kid: WorldBox,
   cam: PerspectiveCamera,
   width: number,
   height: number,
): number {
   if (!(closestCamZ(decor, cam) > closestCamZ(kid, cam) + 0.02)) return 0;
   if (!(centerCamZ(decor, cam) < -cam.near)) return 0;
   const decorBehind = fillRect(decor, cam, width, height, RECT_A);
   if (!RECT_A.ok) return 0;
   if (decorBehind) {
      const span = Math.max(RECT_A.right - RECT_A.left, RECT_A.bottom - RECT_A.top);
      if (span > Math.max(width, height) * 1.5) return 1;
   }
   fillRect(kid, cam, width, height, RECT_B);
   if (!RECT_B.ok) return 0;
   const kidArea = (RECT_B.right - RECT_B.left) * (RECT_B.bottom - RECT_B.top);
   if (!(kidArea > 1)) return 0;
   const x0 = Math.max(RECT_A.left, RECT_B.left);
   const y0 = Math.max(RECT_A.top, RECT_B.top);
   const x1 = Math.min(RECT_A.right, RECT_B.right);
   const y1 = Math.min(RECT_A.bottom, RECT_B.bottom);
   if (x1 <= x0 || y1 <= y0) return 0;
   return ((x1 - x0) * (y1 - y0)) / kidArea;
}

const KID_SCRATCH: WorldBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

/** True when the origin snowman would hide the player or a living rival this frame. */
export function snowmanCovers(run: Run, view: FittedView, width: number, height: number): boolean {
   if (width < 2 || height < 2) return false;
   const player = run.kids[0];
   placeFollowCamera(CAM, view, player.x, player.z, width, height);
   for (let i = 0; i < run.kids.length; i++) {
      const kid = run.kids[i];
      if (!kid.present || !kid.alive) continue;
      kidBox(kid.x, kid.z, KID_SCRATCH);
      if (coverFraction(SNOWMAN_BOX, KID_SCRATCH, CAM, width, height) > COVER_LIMIT) return true;
   }
   return false;
}

/** A rules pine rebuilt as a world box (the occluder the playtest saw). */
export function rulesPineBox(x: number, z: number, scale: number, out: WorldBox): WorldBox {
   const half = pineHalf(scale);
   out.minX = x - half;
   out.maxX = x + half;
   out.minY = 0;
   out.maxY = PINE_HEIGHT * scale;
   out.minZ = z - half;
   out.maxZ = z + half;
   return out;
}
