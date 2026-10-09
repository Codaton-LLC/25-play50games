// Mini Golf looks worth a test (README "Scene and camera"): where each hole sits in the world, its
// felt regions, the fixed whole-hole view and the gentle follow view, the drawn size of the ball and
// the cup on screen (the size rule) and the palette. Pure: three.js math only, no React.
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { FittedView } from "@/arcade3d/core/view";
import { HILL, HOLE_SPACING, RAMP, TIER_WALL_Z, type Hole } from "./course";
import { BALL, CUP } from "./physics";

const DEG = Math.PI / 180;

/** The canvas camera's fov (definition.camera.fov) and the tilt of every view. */
export const FOV = 45;
export const PITCH = 58 * DEG;

/** The world position of hole k's origin. */
export const holeZ = (index: number): number => -HOLE_SPACING * index;

/** A felt region in the hole's frame (`upper`: hole 5's tier). */
export interface FeltRect {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
   upper: boolean;
}

const RECTS: [number, number, number, number, boolean?][][] = [
   [[-0.5, 0.5, -3.5, 3.5]],
   [[-0.5, 0.5, -1.5, 3.5], [0.5, 3.5, -1.5, -0.5]],
   [[-0.6, 0.6, RAMP.start, 3.0], [-0.6, 0.6, RAMP.lip, RAMP.start], [-0.6, 0.6, -4.0, RAMP.gapEnd]],
   [[-0.8, 0.8, -3.0, 3.0]],
   [[-1.5, 1.5, TIER_WALL_Z, 4.5, true], [-1.5, 1.5, -4.5, TIER_WALL_Z]],
   [[-0.8, 0.8, HILL.z0, 5.0], [-1.0, 1.0, HILL.z1, HILL.z0], [-1.5, 1.5, -4.2, HILL.z1]],
];

/** The hole's felt regions (mirrored with the hole). */
export function feltRects(hole: Hole): FeltRect[] {
   return RECTS[hole.index].map(([a, b, z0, z1, upper]) => (hole.sx > 0 ? { x0: a, x1: b, z0, z1, upper: !!upper } : { x0: -b, x1: -a, z0, z1, upper: !!upper }));
}

export function onFelt(rects: readonly FeltRect[], x: number, z: number): boolean {
   for (const r of rects) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
   return false;
}

// ---------- views ----------

const MARGIN = { top: 0.1, bottom: 0.05, left: 0.03, right: 0.03 };
const YAWS_ANY = [0, Math.PI / 2];
const YAWS_FACING = [0];
const ORIGIN = [{ x: 0, y: 0, z: 0 }];
/** The follow camera looks this share of the way from the hole's centre to the ball. */
export const FOLLOW_FRACTION = 0.6;
/** Smallest drawn scale (px per metre) that keeps the ball >= 10 px and the cup >= 14 px. */
export const MIN_PX_PER_M = Math.max(10 / (2 * BALL.drawnRadius), 14 / (2 * CUP.drawnRadius));
/**
 * The fixed view is used only when it draws at least this (10 % over the size rule): a hole right at
 * the border (portrait hole 5, 10.2 px in the test's layout) would flip between fixed and follow
 * with a few px of HUD or banner difference, so it takes the follow everywhere.
 */
export const FIXED_MIN_PX_PER_M = 1.1 * MIN_PX_PER_M;
/** The establishing shot (whole hole, then the follow): this long after the hole opens (s), skipped by any aim input. */
export const ESTABLISH_S = 1.2;

/** The hole's rail box (+0.15 m) up to its tallest part, in the hole's frame. */
export function holeArea(hole: Hole): AABB {
   const b = hole.box;
   return { min: { x: b.x0 - 0.15, y: 0, z: b.z0 - 0.15 }, max: { x: b.x1 + 0.15, y: b.top, z: b.z1 + 0.15 } };
}

/** The point the fixed view looks at (the area's floor centre), in the hole's frame. */
export function holeFocus(hole: Hole): { x: number; y: number; z: number } {
   const a = holeArea(hole);
   return { x: (a.min.x + a.max.x) / 2, y: 0, z: (a.min.z + a.max.z) / 2 };
}

const FIXED = new Map<string, FittedViewOptions>();
const FOLLOW = new Map<string, readonly FollowFit[]>();

/** The fixed whole-hole fit (one cached object per hole and mirror). Hole 4 faces the camera (its blades). */
export function fixedView(hole: Hole): FittedViewOptions {
   const key = `${hole.index}${hole.mirrored}`;
   let v = FIXED.get(key);
   if (!v) {
      const area = holeArea(hole);
      const f = holeFocus(hole);
      v = { area, focus: [f], pitch: PITCH, yaws: hole.windmill ? YAWS_FACING : YAWS_ANY, margin: MARGIN, padding: 8, shift: true, fov: FOV };
      FIXED.set(key, v);
   }
   return v;
}

/** A follow candidate: the fit's options and the floor window around the look-at point the size rule is measured on. */
export interface FollowFit {
   options: FittedViewOptions;
   window: AABB;
}

/**
 * The gentle follow (README: where the fixed view draws the ball under 10 px): the camera looks at
 * centre + FOLLOW_FRACTION (ball - centre), so the ball stays inside a window of 40 % of the hole
 * (+0.3 m) around that point; the window is fitted around the origin and the rig adds the aim.
 * Hole 4 has two candidates, tried in order: the window plus the whole windmill (its roof, 2.2 m,
 * up to 1.96 m behind the look-at point while the ball is on the tee), then the window up to 0.7 m
 * (the blade disc's top at the tee, under a 10 px ball on a landscape phone with the banner open).
 */
export function followViews(hole: Hole): readonly FollowFit[] {
   const key = `${hole.index}${hole.mirrored}`;
   let v = FOLLOW.get(key);
   if (!v) {
      const a = holeArea(hole);
      const hx = ((a.max.x - a.min.x) / 2) * (1 - FOLLOW_FRACTION) + 0.3;
      const hz = ((a.max.z - a.min.z) / 2) * (1 - FOLLOW_FRACTION) + 0.3;
      const window: AABB = { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 0.3, z: hz } };
      const fit = (area: AABB): FollowFit => ({ options: { area, focus: ORIGIN, pitch: PITCH, yaws: hole.windmill ? YAWS_FACING : YAWS_ANY, margin: MARGIN, padding: 8, shift: true, fov: FOV }, window });
      v = hole.windmill
         ? [fit({ min: { x: -hx, y: 0, z: -hz - 0.4 }, max: { x: hx, y: 2.2, z: hz } }), fit({ min: window.min, max: { x: hx, y: 0.7, z: hz } })]
         : [fit(window)];
      FOLLOW.set(key, v);
   }
   return v;
}

/**
 * Which camera a hole gets from the drawn scales (px per metre) of its fixed view and its follow
 * candidates: -1 = the fixed view (it draws >= FIXED_MIN_PX_PER_M), else the first follow candidate
 * that meets the size rule (the last one if none does).
 */
export function pickCamera(fixedPx: number, followPx: readonly number[]): number {
   if (fixedPx >= FIXED_MIN_PX_PER_M) return -1;
   const i = followPx.findIndex((px) => px >= MIN_PX_PER_M);
   return i >= 0 ? i : followPx.length - 1;
}

const ESTABLISH = new Map<string, FittedViewOptions>();

/** The establishing shot: the fixed whole-hole fit at the follow view's yaw (so the camera never turns between the two). */
export function establishView(hole: Hole, yaw: number): FittedViewOptions {
   const key = `${hole.index}${hole.mirrored}${yaw}`;
   let v = ESTABLISH.get(key);
   if (!v) {
      v = { ...fixedView(hole), yaws: [yaw] };
      ESTABLISH.set(key, v);
   }
   return v;
}

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 400);
const P = new Vector3();
const Q = new Vector3();
const RIGHT = new Vector3();

/**
 * The smallest drawn scale (px per metre, across the screen) of the area's floor (or `area`'s) for this fit:
 * the camera at focus + offset with the fit's lens shift (CameraRig draws exactly this).
 */
export function minPxPerMetre(options: FittedViewOptions, view: FittedView, width: number, height: number, area: AABB = options.area): number {
   const focus = options.focus?.[0] ?? { x: 0, y: 0, z: 0 };
   CAM.aspect = width / height;
   CAM.fov = options.fov ?? FOV;
   CAM.position.set(focus.x + view.offset[0], focus.y + view.offset[1], focus.z + view.offset[2]);
   CAM.lookAt(focus.x, focus.y, focus.z);
   CAM.setViewOffset(width, height, (-view.shift[0] * width) / 2, (view.shift[1] * height) / 2, width, height);
   CAM.updateMatrixWorld();
   CAM.updateProjectionMatrix();
   RIGHT.setFromMatrixColumn(CAM.matrixWorld, 0);
   const { min, max } = area;
   let worst = Infinity;
   for (const x of [min.x, max.x]) {
      for (const z of [min.z, max.z]) {
         P.set(x, 0, z).project(CAM);
         Q.set(x, 0, z).addScaledVector(RIGHT, 0.1).project(CAM);
         const px = Math.hypot(((Q.x - P.x) * width) / 2, ((Q.y - P.y) * height) / 2) / 0.1;
         worst = Math.min(worst, px);
      }
   }
   return worst;
}

// ---------- decor ----------

/** A decor spot (world frame): the shape core/render's InstanceSpot takes. */
export interface DecorSpot {
   x: number;
   y: number;
   z: number;
   rotY: number;
   scale: number;
}

/** The trees' spot scale (x TREE_HEIGHT 2.3 m = 0.92 m tall) and their canopy's half width at it (leafyTree 1.804 wide at 1.9133 tall). */
export const DECOR_TREE_SCALE = 0.4;
export const DECOR_TREE_HALF = ((1.804 / 1.9133) * 2.3 * DECOR_TREE_SCALE) / 2;
/** Trees stand this far outside the rail box (on the island's rim), so the canopy clears the rails by >= 0.13 m. */
export const DECOR_TREE_OUT = 0.58;

/**
 * Trees and rocks on each island's two lateral sides as its camera sees it (yaw 0: the camera at
 * +z, the sides are -x / +x; yaw PI / 2: the camera at +x, the sides are the -z / +z ends): never on
 * the far side (there a tree rises into the HUD at the top of the screen) and never between the
 * camera and the lane. `yaws[i]` belongs to `holes[i]` (0 if missing).
 */
export function decorSpots(holes: readonly Hole[], yaws: readonly number[] = []): { trees: DecorSpot[]; rocks: DecorSpot[] } {
   const trees: DecorSpot[] = [];
   const rocks: DecorSpot[] = [];
   holes.forEach((hole, i) => {
      const b = hole.box;
      const z0 = holeZ(hole.index);
      const k = hole.index * 1.7;
      const xc = (b.x0 + b.x1) / 2;
      const zc = (b.z0 + b.z1) / 2;
      const hx = (b.x1 - b.x0) / 2;
      const hz = (b.z1 - b.z0) / 2;
      // lateral side s (-1 / +1) at `out` past the rails, `along` x the half depth towards the camera
      const lateralX = Math.abs(Math.cos(yaws[i] ?? 0)) > 0.5;
      const at = (s: number, out: number, along: number) =>
         lateralX ? { x: xc + s * (hx + out), z: z0 + zc + along * hz } : { x: xc + along * hx, z: z0 + zc + s * (hz + out) };
      trees.push({ ...at(-1, DECOR_TREE_OUT, 0.15), y: -0.28, rotY: k, scale: DECOR_TREE_SCALE });
      trees.push({ ...at(1, DECOR_TREE_OUT, -0.15), y: -0.28, rotY: k + 2, scale: DECOR_TREE_SCALE });
      rocks.push({ ...at(1, 0.45, 0.45), y: -0.35, rotY: k, scale: 0.6 });
      rocks.push({ ...at(-1, 0.45, -0.45), y: -0.35, rotY: k + 1, scale: 0.55 });
      rocks.push({ ...at(-1, 0.45, 0.6), y: -0.35, rotY: k + 3, scale: 0.45 });
   });
   return { trees, rocks };
}

export const COLORS = {
   sky: "#e0f2fe",
   felt: "#4ade80",
   feltLow: "#16a34a",
   feltSide: "#166534",
   rail: "#a16207",
   railTop: "#ca8a04",
   water: "#38bdf8",
   deep: "#0369a1",
   rock: "#a8a29e",
   rockDark: "#78716c",
   cup: "#0f172a",
   rim: "#f8fafc",
   ball: "#ffffff",
   flag: "#dc2626",
   pipe: "#2563eb",
   pipeDark: "#1e3a8a",
   plate: "#fef3c7",
   bar: "#f97316",
   blade: "#fff7ed",
   spar: "#92400e",
   dots: "#ffffff",
   ring: "#86efac",
   ringWait: "#cbd5e1",
   accent: "#86efac",
} as const;
