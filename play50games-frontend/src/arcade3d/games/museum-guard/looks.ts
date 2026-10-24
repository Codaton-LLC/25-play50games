// Night-museum colours, the fixed-eye band, and the radar's screen rect.
// Projection helpers are for tests; the scene never calls them per frame.
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB } from "@/arcade3d/core/collision";
import type { ScreenRect } from "@/arcade3d/core/view";
import { setEyeRotation } from "@/arcade3d/core/view";

export const COLORS = {
   night: "#1e1b4b",
   accent: "#c4b5fd",
   beam: "#ddd6fe",
   flash: "#fef3c7",
   sneak: "#fb7185",
   frozen: "#6ee7b7",
   alarm: "#fb7185",
   hud: "#f8fafc",
   wall: "#14122c",
   plinth: "#1c1838",
   column: "#3b3566",
   cap: "#c4b5fd",
   rope: "#94a3b8",
   ropeRail: "#e2e8f0",
   still: "#64748b",
   door: "#a16207",
   bench: "#78716c",
   vase: "#b8834f",
   painting: "#4c1d95",
   paintingGlow: "#a78bfa",
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
