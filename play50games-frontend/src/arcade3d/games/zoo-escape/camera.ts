// The follow camera's window and bounds (pure, pinned in camera.test.ts). One yaw: the camera sits
// on +z of its aim and looks north (-z), so the escape always runs up the screen.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { STAGES, type StageIndex } from "./level";

/** 62° down: the cones are fans on the floor and read best from high above. */
export const PITCH = (62 * Math.PI) / 180;
export const FOV = 45;
/** The aim looks this far ahead (north) of the panda. */
export const LOOK_AHEAD = 1.5;
/** The window may show this much past the current stage's north gate. */
export const NORTH_PEEK = 3;

/** Full window sizes (m, x across, z up the screen) per screen kind. */
export const WINDOWS = {
   portrait: { w: 8.5, d: 12 },
   landscape: { w: 16, d: 7.5 },
   large: { w: 16, d: 14 },
} as const;

export type ScreenKind = keyof typeof WINDOWS;

/** Phones (shorter side < 600 CSS px) by orientation; everything else "large". */
export function screenKind(width: number, height: number): ScreenKind {
   if (Math.min(width, height) >= 600) return "large";
   return height >= width ? "portrait" : "landscape";
}

export function windowHalf(width: number, height: number): { hx: number; hz: number } {
   const w = WINDOWS[screenKind(width, height)];
   return { hx: w.w / 2, hz: w.d / 2 };
}

const VIEWS = new Map<ScreenKind, FittedViewOptions>();
const ORIGIN = [{ x: 0, y: 0, z: 0 }];
const YAWS = [0];
const MARGIN = { top: 0.1, bottom: 0.06, left: 0.02, right: 0.02 };

/** useFittedView options for the canvas (one cached object per screen kind). */
export function viewFor(width: number, height: number): FittedViewOptions {
   const kind = screenKind(width, height);
   let view = VIEWS.get(kind);
   if (!view) {
      const { w, d } = WINDOWS[kind];
      const area: AABB = { min: { x: -w / 2, y: 0, z: -d / 2 }, max: { x: w / 2, y: 1.8, z: d / 2 } };
      view = { area, pitch: PITCH, yaws: YAWS, focus: ORIGIN, margin: MARGIN, padding: 8, shift: true, fov: FOV };
      VIEWS.set(kind, view);
   }
   return view;
}

/**
 * Where the aim may go in a stage (written into `out`): the stage box shrunk by hz on the south and
 * hx on the sides, the north bound NORTH_PEEK past the gate, so the window never shows past the
 * stage's south or side edges. A window wider than the stage pins that axis to its middle.
 */
export function stageBounds(stage: StageIndex, hx: number, hz: number, out: AABB): AABB {
   const s = STAGES[stage];
   let x0 = s.bounds.x0 + hx, x1 = s.bounds.x1 - hx;
   if (x0 > x1) x0 = x1 = (s.bounds.x0 + s.bounds.x1) / 2;
   let z0 = s.gate.z + hz - NORTH_PEEK, z1 = s.bounds.z1 - hz;
   if (z0 > z1) z0 = z1 = (z0 + z1) / 2;
   out.min.x = x0; out.max.x = x1; out.min.z = z0; out.max.z = z1;
   out.min.y = 0; out.max.y = 0;
   return out;
}

/** The live aim: the panda's position with the look-ahead (written into `out`). */
export function aimAt(x: number, z: number, out: { x: number; y: number; z: number }): typeof out {
   out.x = x; out.y = 0; out.z = z - LOOK_AHEAD;
   return out;
}
