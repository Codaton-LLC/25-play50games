// Obstacle Race follow camera: README "Scene and camera". Pure (no React, no DOM); Scene.tsx hands
// the view for the canvas's aspect to core useFittedView and CameraRig, and camera.test.ts checks
// the README fit table and the lane, runner and lag rules against core fitView.
//
// The camera follows a point F (followPoint) with no yaw, so up on the stick is always forward. The
// fitted area is a box relative to F (useFittedView is translation-invariant), and `focus` is the
// corners of LAG, the most CameraRig's easing can trail F, so the window stays on screen while the
// camera catches up anywhere on the 126 m course.
import type { AABB, Vec3Like } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { ObstacleRun } from "./rules";

/** F.x = FOLLOW_X · runner.x: the camera drifts with the runner, the lane around it stays in view. */
export const FOLLOW_X = 0.3;
/** CameraRig damping (1/s): it trails a target moving at v by at most v / DAMPING. */
export const DAMPING = 8;
/** The most the eased camera trails F: 6 m/s forward, 3.6 m/s sideways (knock), a 0.5 m groundY step, over DAMPING. */
export const LAG: AABB = { min: { x: -0.45, y: -0.5, z: -0.8 }, max: { x: 0.45, y: 0.5, z: 0.8 } };
/** Every point the camera can look at relative to F (CameraRig followFraction 1, lookAt the origin). */
export const FOCUS: readonly Vec3Like[] = followFocus({ lookAt: [0, 0, 0], reach: LAG, fraction: 1 });

const MARGIN = { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 } as const;

export type RaceView = FittedViewOptions & { fov: number };

/**
 * Width < height: looks 22 m ahead, the window is ±4.8 m around F. Pitched 36° (45° until
 * 2026-10-08): the fit is bound by the window's width, so a lower camera draws the runner taller
 * at the same lane width (README "Phones: a bigger runner").
 */
export const PORTRAIT: RaceView = {
   area: { min: { x: -4.8, y: -1, z: -22 }, max: { x: 4.8, y: 3, z: 0.5 } },
   pitch: (36 * Math.PI) / 180,
   fov: 60,
   yaws: [0],
   focus: FOCUS,
   margin: MARGIN,
   padding: 8,
   shift: true,
};

/** Width >= height on a desktop or tablet (shorter side at least PHONE_MAX_SIDE): looks 11 m ahead. */
export const LANDSCAPE: RaceView = {
   area: { min: { x: -4.8, y: -1, z: -11 }, max: { x: 4.8, y: 3, z: 0.5 } },
   pitch: (40 * Math.PI) / 180,
   fov: 50,
   yaws: [0],
   focus: FOCUS,
   margin: MARGIN,
   padding: 8,
   shift: true,
};

/** A landscape canvas whose shorter side is below this many CSS px is a phone (PHONE_LANDSCAPE). */
export const PHONE_MAX_SIDE = 600;

/**
 * A phone held sideways: looks 12 m ahead, pitched 35°. The fit is bound by the screen's height
 * (the HUD, the controls, the banner), and a lower camera draws the course ahead shorter on screen,
 * so the camera comes closer and the runner is drawn taller (README "Phones: a bigger runner").
 */
export const PHONE_LANDSCAPE: RaceView = {
   area: { min: { x: -4.8, y: -1, z: -12 }, max: { x: 4.8, y: 3, z: 0.5 } },
   pitch: (35 * Math.PI) / 180,
   fov: 50,
   yaws: [0],
   focus: FOCUS,
   margin: MARGIN,
   padding: 8,
   shift: true,
};

/** The view for a canvas: portrait below a 1:1 aspect, a phone's landscape below PHONE_MAX_SIDE (a rotation or resize refits). */
export function viewFor(width: number, height: number): RaceView {
   if (width < height) return PORTRAIT;
   return height < PHONE_MAX_SIDE ? PHONE_LANDSCAPE : LANDSCAPE;
}

/** Writes the follow point F for the run into `out`: x = FOLLOW_X · x, y = the last support's top, z = the runner's z. */
export function followPoint<T extends Vec3Like>(run: Pick<ObstacleRun, "runner" | "groundY">, out: T): T {
   out.x = FOLLOW_X * run.runner.x;
   out.y = run.groundY;
   out.z = run.runner.z;
   return out;
}
