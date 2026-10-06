// Office Escape chase camera: README "Scene and camera", fitChase. Pure math (no three.js, React
// or DOM), checked against the README table in camera.test.ts. Scene.tsx runs it on resize and
// safe-area changes only, never per frame, and hands the result to a static core CameraRig.
//
// Why not core useFittedView: it fits a box around a focus point (the picture centre, or a lens
// shift). This camera keeps a fixed 16° pitch and pins the runner's feet at 20% of the safe height
// instead, so its look point moves ahead as the camera backs off (15 m ahead on a portrait phone,
// 7 m on a laptop). The safe rect still comes from core useSafeArea (shell HUD and cookie banner).
import type { SafeArea } from "@/arcade3d/core/safeArea";
import { JUMP_APEX, LANES } from "./rules";

export const CHASE = {
   /** camera tilt below the horizon, degrees */
   pitchDeg: 16,
   /** vertical fov, degrees: portrait canvas (aspect < 1) / otherwise */
   fovPortrait: 60,
   fovLandscape: 50,
   /** px of air under the shell HUD, and the HUD's own padding (to read the side insets) */
   hudAir: 10,
   hudPadding: 10,
   /** safe-rect top before the HUD is measured: 10 px padding + 44 px chips + 10 px air */
   defaultTop: 64,
   /** px kept clear at the bottom (plus the cookie banner) and at each side (plus the insets) */
   bottom: 16,
   side: 8,
   /** the runner's feet sit this share of the safe height above its bottom edge */
   feetShare: 0.2,
   /** a standing runner is at most this share of the safe height */
   runnerShare: 0.25,
   /** the camera is at least this high (m): above the runner at the jump apex */
   minHeight: 3.2,
} as const;

/** The drawn runner (m): 1.55 tall, 0.45 half-width (the 0.35 m hitbox is narrower). */
export const RUNNER_DRAWN = { halfWidth: 0.45, height: 1.55 } as const;
/** Lane centre of the outer lanes and the lane edges, m. */
const OUTER_LANE = LANES[LANES.length - 1] / 1000;
const LANE_EDGE = OUTER_LANE + 1;
/** Top of the drawn runner at the jump apex, m. */
const APEX_TOP = RUNNER_DRAWN.height + JUMP_APEX / 1000;
/** A 1.6 m obstacle top 50 m ahead must stay below the HUD (rule d). */
const FAR = { z: -50, top: 1.6 };
/** The runner box and the lane edges are checked over this depth around z = 0 (m). */
const DEPTH = 0.3;

export interface ChaseInsets {
   /** px from each canvas edge the fitted picture keeps clear of */
   top: number;
   bottom: number;
   left: number;
   right: number;
}

export type ChaseRule = "width" | "height" | "runner" | "camera" | "horizon" | "none";

export interface ChaseFit {
   /** vertical fov, degrees */
   fov: number;
   position: [number, number, number];
   /** where the optical axis meets the floor */
   lookAt: [number, number, number];
   /** the rule that stopped the camera coming closer */
   binding: ChaseRule;
}

/** The safe rect from core useSafeArea: under the shell HUD, above the cookie banner, inside the side insets. */
export function chaseInsets(safe: Pick<SafeArea, "hud" | "obstructions">, width: number, height: number): ChaseInsets {
   let hudBottom = -1;
   let minLeft = Infinity;
   let maxRight = -Infinity;
   for (const r of safe.hud) {
      if (r.top > height / 2) continue;
      if (r.bottom > hudBottom) hudBottom = r.bottom;
      if (r.left < minLeft) minLeft = r.left;
      if (r.right > maxRight) maxRight = r.right;
   }
   let banner = 0;
   for (const r of safe.obstructions ?? []) banner = Math.max(banner, height - r.top);
   // the HUD row is padded by 10 px plus the device's safe-area inset on each side
   const insetLeft = minLeft < Infinity ? Math.max(0, minLeft - CHASE.hudPadding) : 0;
   const insetRight = maxRight > -Infinity ? Math.max(0, width - maxRight - CHASE.hudPadding) : 0;
   return {
      top: hudBottom >= 0 ? hudBottom + CHASE.hudAir : CHASE.defaultTop,
      bottom: CHASE.bottom + banner,
      left: CHASE.side + insetLeft,
      right: CHASE.side + insetRight,
   };
}

/** Points rule (a) keeps inside the safe rect: the runner box (apex included) and the lane edges. */
const FIT_POINTS: readonly (readonly [number, number, number])[] = (() => {
   const points: [number, number, number][] = [];
   const runnerX = OUTER_LANE + RUNNER_DRAWN.halfWidth;
   for (const x of [-runnerX, runnerX]) for (const y of [0, APEX_TOP]) for (const z of [-DEPTH, DEPTH]) points.push([x, y, z]);
   for (const x of [-LANE_EDGE, LANE_EDGE]) for (const z of [-DEPTH, DEPTH]) points.push([x, 0, z]);
   return points;
})();

/**
 * README fitChase: the closest chase camera at a fixed 16° pitch, on the ray that puts the
 * runner's feet (0, 0, 0) at 20% of the safe height above its bottom, such that
 * (a) the runner box (x ±2.45, y 0–2.65, z ±0.3) and the lane edges (x ±3, z ±0.3) fit the safe rect,
 * (b) a standing runner is at most 25% of the safe height,
 * (c) the camera is at least 3.2 m high,
 * (d) a 1.6 m top 50 m ahead stays below the HUD.
 */
export function fitChase(width: number, height: number, insets: ChaseInsets): ChaseFit {
   const W = Math.max(1, width);
   const H = Math.max(1, height);
   const fov = W / H < 1 ? CHASE.fovPortrait : CHASE.fovLandscape;
   const tanHalf = Math.tan((fov * Math.PI) / 360);
   const aspect = W / H;
   const pitch = (CHASE.pitchDeg * Math.PI) / 180;
   const sinP = Math.sin(pitch);
   const cosP = Math.cos(pitch);
   const top = insets.top;
   const bottom = H - insets.bottom;
   const left = insets.left;
   const right = W - insets.right;
   const safeH = Math.max(1, bottom - top);

   // the ray to the feet: feet at y = bottom - 20% of the safe height
   const feetNdcY = 1 - (2 * (bottom - CHASE.feetShare * safeH)) / H;
   const depress = Math.max((2 * Math.PI) / 180, pitch + Math.atan(-feetNdcY * tanHalf));
   const rayY = Math.sin(depress);
   const rayZ = Math.cos(depress);

   let camY = 0;
   let camZ = 0;
   // screen px of a world point for the camera at (0, camY, camZ); NaN when not in front of it
   let sx = 0;
   let sy = 0;
   const project = (x: number, y: number, z: number): boolean => {
      const dy = y - camY;
      const dz = z - camZ;
      const depth = -dy * sinP - dz * cosP;
      if (!(depth > 0.1)) return false;
      const up = dy * cosP - dz * sinP;
      sx = ((x / (depth * tanHalf * aspect) + 1) / 2) * W;
      sy = ((1 - up / (depth * tanHalf)) / 2) * H;
      return true;
   };

   /** The first rule the camera at distance t along the ray breaks, or "none". */
   const broken = (t: number): ChaseRule => {
      camY = rayY * t;
      camZ = rayZ * t;
      if (camY < CHASE.minHeight) return "camera";
      let wide = false;
      for (const [x, y, z] of FIT_POINTS) {
         if (!project(x, y, z)) return "height";
         if (sx < left - 1e-6 || sx > right + 1e-6) wide = true;
         else if (sy < top - 1e-6 || sy > bottom + 1e-6) return "height";
      }
      if (wide) return "width";
      if (!project(0, 0, 0)) return "runner";
      const feet = sy;
      project(0, RUNNER_DRAWN.height, 0);
      if (feet - sy > CHASE.runnerShare * safeH + 1e-6) return "runner";
      if (!project(0, FAR.top, FAR.z) || sy < top) return "horizon";
      return "none";
   };

   let near = 0.5;
   let far = 400;
   if (broken(far) === "none") {
      for (let i = 0; i < 60; i++) {
         const mid = (near + far) / 2;
         if (broken(mid) === "none") far = mid;
         else near = mid;
      }
   }
   const binding = broken(near);
   camY = rayY * far;
   camZ = rayZ * far;
   const round = (v: number) => Math.round(v * 1e4) / 1e4;
   return {
      fov,
      position: [0, round(camY), round(camZ)],
      lookAt: [0, 0, round(camZ - camY / Math.tan(pitch))],
      binding,
   };
}

/** Screen px (x, y) of a world point seen by a fitted camera: for tests and the README table. */
export function chaseProject(fit: ChaseFit, width: number, height: number, point: readonly [number, number, number]): [number, number] {
   const tanHalf = Math.tan((fit.fov * Math.PI) / 360);
   const pitch = (CHASE.pitchDeg * Math.PI) / 180;
   const dy = point[1] - fit.position[1];
   const dz = point[2] - fit.position[2];
   const depth = -dy * Math.sin(pitch) - dz * Math.cos(pitch);
   const up = dy * Math.cos(pitch) - dz * Math.sin(pitch);
   return [((point[0] / (depth * tanHalf * (width / height)) + 1) / 2) * width, ((1 - up / (depth * tanHalf)) / 2) * height];
}
