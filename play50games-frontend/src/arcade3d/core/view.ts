// Camera framing and screen-relative movement for 3D Arcade games. Owned by Claude.
// Pure math (three.js vectors, no React, no DOM), unit-tested in view.test.ts.
// - fitView: the closest camera that keeps a world box (an arena, a level) fully on screen at any
//   aspect ratio, inside screen margins and out from under the HUD and touch controls. With
//   `shift` it may also move the picture on screen (a lens shift), so the box sits in the free
//   space between the HUD and the controls instead of shrinking around the screen centre.
//   useFittedView (core/useFittedView.ts) feeds it the live canvas size and safe-area rects.
// - followFocus: every point a follow camera (CameraRig followFraction / bounds) can look at, for
//   fitView's `focus`, so the two can never disagree.
// - inputToWorld: joystick/WASD input -> a world direction for the camera's yaw. It lives in
//   core/math.ts (pure, no three.js, so rules.ts can use it) and is re-exported here.
// Yaw convention everywhere: radians around +y, 0 = camera on the +z side looking towards -z.
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB, Vec3Like } from "./collision";

export { inputToWorld } from "./math";

/** A rectangle on the canvas in CSS px, measured from the canvas's top-left corner. */
export interface ScreenRect {
   left: number;
   top: number;
   right: number;
   bottom: number;
}

/** Share (0..1) of the canvas width (left/right) or height (top/bottom) kept clear at each edge. */
export interface ScreenMargin {
   top?: number;
   right?: number;
   bottom?: number;
   left?: number;
}

export interface FitViewOptions {
   /** canvas size, CSS px */
   width: number;
   height: number;
   /** vertical field of view, degrees */
   fov: number;
   /** the world box that must stay fully visible, e.g. the floor plus its walls */
   area: AABB;
   /** camera tilt above the ground, radians: 0 = level, towards PI/2 = top-down (stay below PI/2) */
   pitch: number;
   /** yaws to try; the closest fit wins (e.g. [0, PI / 2] turns the camera for portrait). Default [0] */
   yaws?: readonly number[];
   /** every point the camera may look at (its follow range, see followFocus); the box must fit from each. Default: the box's floor centre */
   focus?: readonly Vec3Like[];
   /** screen edges to keep clear */
   margin?: ScreenMargin;
   /** canvas rects nothing of the box may be drawn under: HUD, touch controls (useSafeArea) */
   avoid?: readonly ScreenRect[];
   /** grows every `avoid` rect by this many px (air around the controls). Default 0 */
   padding?: number;
   /**
    * Also move the picture on screen (a lens shift, returned as `shift`; pass it to CameraRig
    * `shift`), not only the camera distance: the box then sits in the free space between the HUD
    * and the controls (e.g. above a joystick lifted by the cookie banner) instead of shrinking
    * around the screen centre. Default false.
    */
   shift?: boolean;
   /** sample points per box edge; more = tighter around `avoid` rects. Default 12 */
   steps?: number;
   /** search range for the camera distance. Default 1..500 */
   minDistance?: number;
   maxDistance?: number;
}

export interface FittedView {
   yaw: number;
   /** camera distance from the focus point */
   distance: number;
   /** camera position relative to the focus point (CameraRig `offset`) */
   offset: [number, number, number];
   /**
    * Lens shift in normalised device coordinates (x right, y up; 2 = the canvas width or height):
    * how far the picture moves on screen (CameraRig `shift`). [0, 0] unless options.shift.
    */
   shift: [number, number];
}

const SEARCH_STEPS = 32;
/** grid cells per axis when searching for a lens shift (the no-shift-closest candidate is tried first) */
const SHIFT_GRID = 8;

/** Sample points along the bottom and top outline of a box (the box's screen extremes lie on them). */
function outline(area: AABB, steps: number): Vector3[] {
   const { min, max } = area;
   const points: Vector3[] = [];
   for (const y of min.y === max.y ? [min.y] : [min.y, max.y]) {
      for (let k = 0; k <= steps; k++) {
         const x = min.x + ((max.x - min.x) * k) / steps;
         const z = min.z + ((max.z - min.z) * k) / steps;
         points.push(new Vector3(x, y, min.z), new Vector3(x, y, max.z), new Vector3(min.x, y, z), new Vector3(max.x, y, z));
      }
   }
   return points;
}

/** Convex hull (counter-clockwise) of 2D points, packed as [x0, y0, x1, y1, ...]. */
function hull2d(xy: Float64Array, count: number): number[] {
   const order = Array.from({ length: count }, (_v, i) => i).sort((a, b) => xy[2 * a] - xy[2 * b] || xy[2 * a + 1] - xy[2 * b + 1]);
   const cross = (o: number, a: number, b: number) =>
      (xy[2 * a] - xy[2 * o]) * (xy[2 * b + 1] - xy[2 * o + 1]) - (xy[2 * a + 1] - xy[2 * o + 1]) * (xy[2 * b] - xy[2 * o]);
   const chain = (indices: number[]) => {
      const out: number[] = [];
      for (const i of indices) {
         while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], i) <= 0) out.pop();
         out.push(i);
      }
      out.pop();
      return out;
   };
   return [...chain(order), ...chain([...order].reverse())];
}

/** Is (x, y) strictly inside a counter-clockwise convex polygon? */
function insideHull(hull: number[], xy: Float64Array, x: number, y: number): boolean {
   if (hull.length < 3) return false;
   for (let k = 0; k < hull.length; k++) {
      const a = hull[k];
      const b = hull[(k + 1) % hull.length];
      const side = (xy[2 * b] - xy[2 * a]) * (y - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (x - xy[2 * a]);
      if (side <= 0) return false;
   }
   return true;
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/**
 * The closest camera that keeps `area` fully visible inside the margins and out from under every
 * `avoid` rect, from every `focus` point. Tries each yaw and keeps the closest one. Runs on resize,
 * never per frame (a few thousand projections; with `shift`, a small grid of shifts per distance).
 */
export function fitView(options: FitViewOptions): FittedView {
   const w = Math.max(1, options.width);
   const h = Math.max(1, options.height);
   const { area, pitch, yaws = [0], margin = {}, avoid = [], padding = 0, steps = 12, shift = false } = options;
   const focus = options.focus ?? [{ x: (area.min.x + area.max.x) / 2, y: area.min.y, z: (area.min.z + area.max.z) / 2 }];
   const cam = new PerspectiveCamera(options.fov, w / h, 0.1, 1000);
   const points = outline(area, Math.max(1, Math.round(steps)));
   const n = points.length;
   // projected points and hull per focus point
   const ndc = focus.map(() => new Float64Array(n * 2));
   const hulls: number[][] = focus.map(() => []);
   const p = new Vector3();

   // screen limits and avoid rects in NDC (-1..1, y up)
   const left = -1 + 2 * (margin.left ?? 0);
   const right = 1 - 2 * (margin.right ?? 0);
   const top = 1 - 2 * (margin.top ?? 0);
   const bottom = -1 + 2 * (margin.bottom ?? 0);
   const rects = avoid.map((r) => ({
      x0: -1 + (2 * (r.left - padding)) / w,
      x1: -1 + (2 * (r.right + padding)) / w,
      y0: 1 - (2 * (r.bottom + padding)) / h,
      y1: 1 - (2 * (r.top - padding)) / h,
   }));

   /** Projects the outline from every focus point; false if a point is behind or on the camera. */
   const project = (yaw: number, distance: number, range: { x0: number; x1: number; y0: number; y1: number }): boolean => {
      const flat = Math.cos(pitch) * distance;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let f = 0; f < focus.length; f++) {
         const at = focus[f];
         const xy = ndc[f];
         cam.position.set(at.x + Math.sin(yaw) * flat, at.y + Math.sin(pitch) * distance, at.z + Math.cos(yaw) * flat);
         cam.lookAt(at.x, at.y, at.z);
         cam.updateMatrixWorld();
         for (let i = 0; i < n; i++) {
            p.copy(points[i]).project(cam);
            // written so NaN (a point on the camera) fails too; |z| > 1 = behind the camera or too near
            if (!(p.z >= -1 && p.z <= 1)) return false;
            xy[2 * i] = p.x;
            xy[2 * i + 1] = p.y;
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
         }
         hulls[f] = rects.length > 0 ? hull2d(xy, n) : [];
      }
      // the shifts that keep every point inside the margins
      range.x0 = left - minX;
      range.x1 = right - maxX;
      range.y0 = bottom - minY;
      range.y1 = top - maxY;
      return true;
   };

   /** With the picture moved by (sx, sy): is the box clear of every avoid rect? */
   const clear = (sx: number, sy: number): boolean => {
      for (let f = 0; f < focus.length; f++) {
         const xy = ndc[f];
         for (let i = 0; i < n; i++) {
            const x = xy[2 * i] + sx;
            const y = xy[2 * i + 1] + sy;
            for (const r of rects) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return false;
         }
         // a rect the box's outline passes around (the box covers it) has a corner inside its hull
         const hull = hulls[f];
         for (const r of rects) {
            if (
               insideHull(hull, xy, r.x0 - sx, r.y0 - sy) ||
               insideHull(hull, xy, r.x1 - sx, r.y0 - sy) ||
               insideHull(hull, xy, r.x0 - sx, r.y1 - sy) ||
               insideHull(hull, xy, r.x1 - sx, r.y1 - sy)
            ) {
               return false;
            }
         }
      }
      return true;
   };

   const range = { x0: 0, x1: 0, y0: 0, y1: 0 };
   /** The lens shift that fits at this yaw and distance (the one closest to no shift), or null. */
   const fits = (yaw: number, distance: number): [number, number] | null => {
      if (!project(yaw, distance, range)) return null;
      if (!shift) return range.x0 <= 0 && range.x1 >= 0 && range.y0 <= 0 && range.y1 >= 0 && clear(0, 0) ? [0, 0] : null;
      if (range.x0 > range.x1 || range.y0 > range.y1) return null;
      const cx = clamp(0, range.x0, range.x1);
      const cy = clamp(0, range.y0, range.y1);
      if (clear(cx, cy)) return [cx, cy];
      if (rects.length === 0) return null;
      let best: [number, number] | null = null;
      let bestDist = Infinity;
      for (let i = 0; i <= SHIFT_GRID; i++) {
         const sx = range.x0 + ((range.x1 - range.x0) * i) / SHIFT_GRID;
         for (let j = 0; j <= SHIFT_GRID; j++) {
            const sy = range.y0 + ((range.y1 - range.y0) * j) / SHIFT_GRID;
            const dist = (sx - cx) ** 2 + (sy - cy) ** 2;
            if (dist < bestDist && clear(sx, sy)) {
               best = [sx, sy];
               bestDist = dist;
            }
         }
      }
      return best;
   };

   const minDistance = options.minDistance ?? 1;
   const maxDistance = options.maxDistance ?? 500;
   let best: FittedView | null = null;
   for (const yaw of yaws) {
      // binary search for the closest distance that still fits
      let near = minDistance;
      let far = maxDistance;
      let lens: [number, number] | null = null;
      for (let i = 0; i < SEARCH_STEPS; i++) {
         const mid = (near + far) / 2;
         const found = fits(yaw, mid);
         if (found) {
            far = mid;
            lens = found;
         } else {
            near = mid;
         }
      }
      if (!best || far < best.distance) {
         const flat = Math.cos(pitch) * far;
         best = {
            yaw,
            distance: far,
            offset: [Math.sin(yaw) * flat, Math.sin(pitch) * far, Math.cos(yaw) * flat],
            shift: lens ?? fits(yaw, far) ?? [0, 0],
         };
      }
   }
   return (
      best ?? { yaw: 0, distance: maxDistance, offset: [0, Math.sin(pitch) * maxDistance, Math.cos(pitch) * maxDistance], shift: [0, 0] }
   );
}

/** Moves the picture of a perspective camera by (x, y) in NDC (fitView `shift`, CameraRig `shift`) with a view offset: the camera does not turn. */
export function setLensShift(camera: PerspectiveCamera, x: number, y: number, width: number, height: number): void {
   // an offset of (-x/2, y/2) of the canvas moves the picture by (x, y) in NDC
   camera.setViewOffset(width, height, (-x / 2) * width, (y / 2) * height, width, height);
}

/**
 * Where a follow camera looks for a target (CameraRig): `fraction` of the way from `lookAt` to the
 * target, then kept inside `bounds`. Writes into `out` (a Vector3 works).
 */
export function followAim<T extends Vec3Like>(target: Vec3Like, lookAt: readonly [number, number, number], fraction: number, bounds: AABB | undefined, out: T): T {
   out.x = lookAt[0] + (target.x - lookAt[0]) * fraction;
   out.y = lookAt[1] + (target.y - lookAt[1]) * fraction;
   out.z = lookAt[2] + (target.z - lookAt[2]) * fraction;
   if (bounds) {
      out.x = clamp(out.x, bounds.min.x, bounds.max.x);
      out.y = clamp(out.y, bounds.min.y, bounds.max.y);
      out.z = clamp(out.z, bounds.min.z, bounds.max.z);
   }
   return out;
}

export interface FollowFocusOptions {
   /** CameraRig camera.lookAt: where the camera looks with the target at rest. Default [0, 0, 0] */
   lookAt?: readonly [number, number, number];
   /** every place the followed target can be (e.g. the floor the player walks on) */
   reach: AABB;
   /** CameraRig followFraction. Default 1 */
   fraction?: number;
   /** CameraRig bounds, if any */
   bounds?: AABB;
}

/**
 * The corners of everything a follow camera can look at while its target stays inside `reach`,
 * from the same followAim CameraRig uses (each axis maps on its own and in order, so the corners
 * of `reach` give the corners of the aim range). Pass it as fitView / useFittedView `focus`, with
 * the same lookAt, fraction and bounds as the CameraRig, so the fit holds wherever it follows.
 */
export function followFocus({ lookAt = [0, 0, 0], reach, fraction = 1, bounds }: FollowFocusOptions): Vec3Like[] {
   const lo = followAim(reach.min, lookAt, fraction, bounds, { x: 0, y: 0, z: 0 });
   const hi = followAim(reach.max, lookAt, fraction, bounds, { x: 0, y: 0, z: 0 });
   const axis = (a: number, b: number) => (a === b ? [a] : [a, b]);
   return axis(lo.x, hi.x).flatMap((x) => axis(lo.y, hi.y).flatMap((y) => axis(lo.z, hi.z).map((z) => ({ x, y, z }))));
}
