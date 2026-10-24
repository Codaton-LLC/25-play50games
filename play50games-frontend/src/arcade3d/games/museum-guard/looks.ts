// Night-museum colours, the fixed-eye band, and the radar's screen rect.
// Projection helpers are for tests; the scene never calls them per frame.
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB } from "@/arcade3d/core/collision";
import type { ScreenRect } from "@/arcade3d/core/view";
import { setEyeRotation } from "@/arcade3d/core/view";

export const COLORS = {
   night: "#1e1b4b",
   accent: "#c4b5fd",
   beam: "#e9e3ff",
   flash: "#fde9b8",
   sneak: "#fb7185",
   frozen: "#6ee7b7",
   alarm: "#fb7185",
   hud: "#f8fafc",
   // room: deep plum walls fading to near-black at the floor and cornice, gold trim, warm lamps
   wallTop: "#120e26",
   wallMid: "#2b2352",
   wallLow: "#1a1536",
   wallPanel: "rgba(205, 190, 255, 0.10)",
   trim: "#d4a64a",
   trimDark: "#6b4f1d",
   floorCore: "#2a2450",
   floorMid: "#15122c",
   floorEdge: "#07060f",
   ceiling: "#0b0a18",
   skylight: "#b9a8ff",
   sconce: "#ffcf8a",
   lampGlow: "#ffb862",
   velvet: "#8a1538",
   brass: "#caa04e",
   plinth: "#151229",
   column: "#2c2650",
   cap: "#d4a64a",
   still: "#64748b",
   door: "#a16207",
   bench: "#78716c",
   vase: "#b8834f",
   shadow: "#020617",
} as const;

/** View frame of the wall ahead of the eye (yaw removed). x right, z forward. */
export const BAND: AABB = { min: { x: -1.5, y: 0, z: 5 }, max: { x: 1.5, y: 2.4, z: 6.4 } };
export const FOV = 70;
export const EYE_Y = 1.6;
export const EYE: readonly [number, number, number] = [0, EYE_Y, 0];
export const MARGIN = { top: 0.08, bottom: 0.06, left: 0.02, right: 0.02 };
export const PADDING = 8;

/** Widest beam the player can hold, plus 10°, in radians. Coarse phase 0 is 17°. */
export const BEAM_CLEAR_RAD = ((17 + 10) * Math.PI) / 180;

const cam = new PerspectiveCamera(FOV, 1, 0.1, 100);
const point = new Vector3();

/** Screen px from the top-left of a world point, eye at the origin, no lens shift. */
export function projectWorld(x: number, y: number, z: number, width: number, height: number, yaw: number): { x: number; y: number } {
   cam.fov = FOV;
   cam.aspect = width / Math.max(1, height);
   cam.position.set(0, EYE_Y, 0);
   setEyeRotation(cam.rotation, yaw, 0);
   cam.updateProjectionMatrix();
   cam.updateMatrixWorld();
   point.set(x, y, z).project(cam);
   return { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height };
}

/** Vertical CSS pixels a `heightM` figure covers at `depth` metres. */
export function figurePixels(heightM: number, depth: number, cssWidth: number, cssHeight: number): number {
   const top = projectWorld(0, 0.4 + heightM, depth, cssWidth, cssHeight, 0);
   const bottom = projectWorld(0, 0.4, depth, cssWidth, cssHeight, 0);
   return Math.abs(top.y - bottom.y);
}

/** Portrait 132 px above the banner; landscape 96 px under the chip row. */
export function radarRect(width: number, height: number, banner: number): ScreenRect {
   if (width > height) return { left: 12, top: 60, right: 108, bottom: 156 };
   const bottom = height - banner - 12;
   return { left: 12, top: bottom - 132, right: 144, bottom };
}

/** Shell chips, mute/pause, and the cookie banner. Same layout the core eye test uses. */
export function shellHud(width: number, height: number, banner: number): ScreenRect[] {
   return [
      { left: 10, top: 10, right: 218, bottom: 52 },
      { left: width - 104, top: 10, right: width - 10, bottom: 54 },
      { left: 0, top: height - banner, right: width, bottom: height },
   ];
}

export function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
   return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function pointInRect(p: { x: number; y: number }, r: ScreenRect): boolean {
   return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

/**
 * The guard's brass-and-velvet barrier: a low ring close to the eye so that, from the fixed eye,
 * every post and the sagging rope project below the far statue band at any yaw (looks.test.ts).
 * Rule of thumb: (EYE_Y - top) / radius must stay above the band's lowest slope EYE_Y / BAND.min.z.
 */
export const BARRIER = {
   radius: 1.9,
   posts: 10,
   /** post shaft height; the brass ball sits on top */
   post: 0.66,
   postRadius: 0.028,
   ball: 0.045,
   /** rope height at the posts, sag at mid-span, tube radius */
   ropeY: 0.6,
   sag: 0.12,
   rope: 0.024,
} as const;

export function barrierPostAngle(i: number): number {
   return ((i + 0.5) / BARRIER.posts) * Math.PI * 2;
}

/** Rope centre line, `perSpan` samples per span, closed (the last point equals the first). */
export function barrierRope(perSpan = 12): Array<{ x: number; y: number; z: number }> {
   const out: Array<{ x: number; y: number; z: number }> = [];
   for (let i = 0; i < BARRIER.posts; i += 1) {
      for (let k = 0; k < perSpan; k += 1) {
         const f = k / perSpan;
         const a = ((i + 0.5 + f) / BARRIER.posts) * Math.PI * 2;
         out.push({ x: Math.sin(a) * BARRIER.radius, y: BARRIER.ropeY - BARRIER.sag * Math.sin(Math.PI * f), z: Math.cos(a) * BARRIER.radius });
      }
   }
   out.push({ ...out[0] });
   return out;
}

/** Top-most points of the barrier (ball tops, shaft tops, rope tops) for the eye-band test. */
export function barrierTopPoints(): Array<{ x: number; y: number; z: number }> {
   const pts: Array<{ x: number; y: number; z: number }> = [];
   for (let i = 0; i < BARRIER.posts; i += 1) {
      const a = barrierPostAngle(i);
      const top = BARRIER.post + BARRIER.ball * 2;
      for (const dr of [-BARRIER.ball, 0, BARRIER.ball]) {
         const r = BARRIER.radius + dr;
         pts.push({ x: Math.sin(a) * r, y: top, z: Math.cos(a) * r });
      }
   }
   for (const p of barrierRope(40)) pts.push({ x: p.x, y: p.y + BARRIER.rope, z: p.z });
   return pts;
}

/** Screen rect of the far band (yaw-free: the band turns with the eye). */
export function bandRect(width: number, height: number): ScreenRect {
   const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
   for (const x of [BAND.min.x, BAND.max.x])
      for (const y of [BAND.min.y, BAND.max.y])
         for (const z of [BAND.min.z, BAND.max.z]) {
            const p = projectWorld(x, y, z, width, height, 0);
            r.left = Math.min(r.left, p.x);
            r.right = Math.max(r.right, p.x);
            r.top = Math.min(r.top, p.y);
            r.bottom = Math.max(r.bottom, p.y);
         }
   return r;
}

/** Depth of a world point along the eye's view axis at `yaw` (m). */
export function viewDepth(x: number, z: number, yaw: number): number {
   return x * Math.sin(yaw) + z * Math.cos(yaw);
}
