// Camera framing and screen-relative movement for 3D Arcade games. Owned by Claude.
// Pure math (three.js vectors, no React, no DOM), unit-tested in view.test.ts.
// - fitView: the closest camera that keeps a world box (an arena, a level) fully on screen at any
//   aspect ratio, inside screen margins and out from under the HUD and touch controls.
//   useFittedView (core/useFittedView.ts) feeds it the live canvas size and safe-area rects.
// - inputToWorld: joystick/WASD input -> a world direction for the camera's yaw.
// Yaw convention everywhere: radians around +y, 0 = camera on the +z side looking towards -z.
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB, Vec3Like } from "./collision";

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
   /** every point the camera may look at (its follow range); the box must fit from each. Default: the box's floor centre */
   focus?: readonly Vec3Like[];
   /** screen edges to keep clear */
   margin?: ScreenMargin;
   /** canvas rects nothing of the box may be drawn under: HUD, touch controls (useSafeArea) */
   avoid?: readonly ScreenRect[];
   /** grows every `avoid` rect by this many px (air around the controls). Default 0 */
   padding?: number;
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
}

const SEARCH_STEPS = 32;

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

/**
 * The closest camera that keeps `area` fully visible inside the margins and out from under every
 * `avoid` rect, from every `focus` point. Tries each yaw and keeps the closest one. Runs on resize,
 * never per frame (a few thousand projections).
 */
export function fitView(options: FitViewOptions): FittedView {
   const w = Math.max(1, options.width);
   const h = Math.max(1, options.height);
   const { area, pitch, yaws = [0], margin = {}, avoid = [], padding = 0, steps = 12 } = options;
   const focus = options.focus ?? [{ x: (area.min.x + area.max.x) / 2, y: area.min.y, z: (area.min.z + area.max.z) / 2 }];
   const cam = new PerspectiveCamera(options.fov, w / h, 0.1, 1000);
   const points = outline(area, Math.max(1, Math.round(steps)));
   const ndc = new Float64Array(points.length * 2);
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

   const fits = (yaw: number, distance: number) => {
      const flat = Math.cos(pitch) * distance;
      for (const f of focus) {
         cam.position.set(f.x + Math.sin(yaw) * flat, f.y + Math.sin(pitch) * distance, f.z + Math.cos(yaw) * flat);
         cam.lookAt(f.x, f.y, f.z);
         cam.updateMatrixWorld();
         for (let i = 0; i < points.length; i++) {
            p.copy(points[i]).project(cam);
            // written so NaN (a point on the camera) fails too; |z| > 1 = behind the camera or too near
            if (!(p.z >= -1 && p.z <= 1 && p.x >= left && p.x <= right && p.y >= bottom && p.y <= top)) return false;
            for (const r of rects) if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) return false;
            ndc[2 * i] = p.x;
            ndc[2 * i + 1] = p.y;
         }
         if (rects.length === 0) continue;
         // a rect the box's outline passes around (the box covers it) has a corner inside its hull
         const hull = hull2d(ndc, points.length);
         for (const r of rects) {
            if (
               insideHull(hull, ndc, r.x0, r.y0) ||
               insideHull(hull, ndc, r.x1, r.y0) ||
               insideHull(hull, ndc, r.x0, r.y1) ||
               insideHull(hull, ndc, r.x1, r.y1)
            ) {
               return false;
            }
         }
      }
      return true;
   };

   const minDistance = options.minDistance ?? 1;
   const maxDistance = options.maxDistance ?? 500;
   let best: FittedView | null = null;
   for (const yaw of yaws) {
      // binary search for the closest distance that still fits
      let near = minDistance;
      let far = maxDistance;
      for (let i = 0; i < SEARCH_STEPS; i++) {
         const mid = (near + far) / 2;
         if (fits(yaw, mid)) far = mid;
         else near = mid;
      }
      if (!best || far < best.distance) {
         const flat = Math.cos(pitch) * far;
         best = { yaw, distance: far, offset: [Math.sin(yaw) * flat, Math.sin(pitch) * far, Math.cos(yaw) * flat] };
      }
   }
   return best ?? { yaw: 0, distance: maxDistance, offset: [0, Math.sin(pitch) * maxDistance, Math.cos(pitch) * maxDistance] };
}

/**
 * Screen-relative move input (useInput: moveX right = 1, moveY up = -1) -> a world direction on
 * the ground for a camera at `cameraYaw`. Up always means "away from the camera" and right means
 * screen-right, also when a portrait layout turns the camera. Pass `out` to avoid allocating.
 */
export function inputToWorld(
   moveX: number,
   moveY: number,
   cameraYaw: number,
   out: { x: number; z: number } = { x: 0, z: 0 }
): { x: number; z: number } {
   const c = Math.cos(cameraYaw);
   const s = Math.sin(cameraYaw);
   out.x = c * moveX + s * moveY;
   out.z = -s * moveX + c * moveY;
   return out;
}
