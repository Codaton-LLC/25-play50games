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
const FOLLOW = new Map<string, FittedViewOptions>();

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

/**
 * The gentle follow (README: where the fixed view draws the ball under 10 px): the camera looks at
 * centre + FOLLOW_FRACTION (ball - centre), so the ball stays inside a window of 40 % of the hole
 * (+0.3 m) around that point; the window is fitted around the origin and the rig adds the aim.
 */
export function followView(hole: Hole): FittedViewOptions {
   const key = `${hole.index}${hole.mirrored}`;
   let v = FOLLOW.get(key);
   if (!v) {
      const a = holeArea(hole);
      const hx = ((a.max.x - a.min.x) / 2) * (1 - FOLLOW_FRACTION) + 0.3;
      const hz = ((a.max.z - a.min.z) / 2) * (1 - FOLLOW_FRACTION) + 0.3;
      const area: AABB = { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 0.3, z: hz } };
      v = { area, focus: ORIGIN, pitch: PITCH, yaws: hole.windmill ? YAWS_FACING : YAWS_ANY, margin: MARGIN, padding: 8, shift: true, fov: FOV };
      FOLLOW.set(key, v);
   }
   return v;
}

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 400);
const P = new Vector3();
const Q = new Vector3();
const RIGHT = new Vector3();

/**
 * The smallest drawn scale (px per metre, across the screen) of the area's floor for this fit:
 * the camera at focus + offset with the fit's lens shift (CameraRig draws exactly this).
 */
export function minPxPerMetre(options: FittedViewOptions, view: FittedView, width: number, height: number): number {
   const focus = options.focus?.[0] ?? { x: 0, y: 0, z: 0 };
   CAM.aspect = width / height;
   CAM.fov = options.fov ?? FOV;
   CAM.position.set(focus.x + view.offset[0], focus.y + view.offset[1], focus.z + view.offset[2]);
   CAM.lookAt(focus.x, focus.y, focus.z);
   CAM.setViewOffset(width, height, (-view.shift[0] * width) / 2, (view.shift[1] * height) / 2, width, height);
   CAM.updateMatrixWorld();
   CAM.updateProjectionMatrix();
   RIGHT.setFromMatrixColumn(CAM.matrixWorld, 0);
   const { min, max } = options.area;
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
