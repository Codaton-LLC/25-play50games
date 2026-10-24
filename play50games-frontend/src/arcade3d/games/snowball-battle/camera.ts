// Follow camera for snowball-battle. Yaw 0: the lens sits on +z and looks toward −z.
// The window is per viewport (areaFor). Desktop is wide enough that the whole yard stays in
// frame while the look-at is held inside AIM_CLAMP. Phones stop at the readability floors
// (kid 40px, 0.50 m ball 14px, landing ring 24px). Shared by Scene and the tests.
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedView, ScreenRect } from "@/arcade3d/core/view";
import { fitView, setLensShift } from "@/arcade3d/core/view";

export const FOV = 45;
/** Lower than the first fit (52°) so a wide window still leaves a 1.30 m kid at least 40px. */
export const PITCH = (36 * Math.PI) / 180;
/** CameraRig looks at the kid's chest, not the feet. */
export const FOLLOW_Y = 0.9;
export const LOOK_AT: [number, number, number] = [0, 0, 0];

/**
 * Desktop look-at clamp. The follow window reaches 14 m sideways and 16 m north, so a look-at
 * in this band keeps every yard corner on screen for the whole fight.
 */
export const AIM_CLAMP: AABB = {
   min: { x: -2, y: 0, z: 6.8 },
   max: { x: 2, y: 2, z: 7 },
};

/** Half-width, north depth and south depth of the follow window, metres, around the look-at. */
export function windowFor(width: number, height: number): { hx: number; zn: number; zp: number } {
   if (Math.min(width, height) >= 600) return { hx: 14, zn: 16, zp: 2.6 };
   if (height >= width) return { hx: 4, zn: 12, zp: 2.2 };
   return { hx: 6, zn: 3, zp: 1.8 };
}

export function areaFor(width: number, height: number): AABB {
   const w = windowFor(width, height);
   return { min: { x: -w.hx, y: 0, z: -w.zn }, max: { x: w.hx, y: 1.35, z: w.zp } };
}

/** Desktop window. Phones pass areaFor into the fit. */
export const AREA = areaFor(1280, 800);

const FOCUS = [{ x: 0, y: 0, z: 0 }];
const YAWS = [0];
const MARGIN = { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 };

export const FIT = {
   area: AREA,
   pitch: PITCH,
   yaws: YAWS,
   focus: FOCUS,
   fov: FOV,
   margin: MARGIN,
   padding: 8,
   shift: true as const,
};

/**
 * HUD, joystick and Scoop the README's px table assumed, plus the cookie banner.
 * Portrait banner 92, landscape 72. Desktop (shorter side ≥ 600) has no touch controls.
 */
export function playAvoid(width: number, height: number, banner: number): ScreenRect[] {
   const portrait = height >= width;
   const phone = Math.min(width, height) < 600;
   const hud: ScreenRect = portrait
      ? { left: 8, top: 8, right: Math.min(width - 8, 280), bottom: 96 }
      : { left: 8, top: 6, right: Math.min(width - 8, 520), bottom: 52 };
   const controls: ScreenRect[] = [];
   if (phone) {
      const joy = 136;
      const scoop = 72;
      const gap = 16;
      const floor = height - banner - gap;
      controls.push({ left: gap, top: floor - joy, right: gap + joy, bottom: floor });
      controls.push({ left: width - gap - scoop, top: floor - scoop, right: width - gap, bottom: floor });
   }
   const block: ScreenRect[] = banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [];
   return [hud, ...controls, ...block];
}

/** Banner the readability check uses: open on a phone, closed on the desktop shot. */
export function playBanner(width: number, height: number): number {
   if (Math.min(width, height) >= 600) return 0;
   return height >= width ? 92 : 72;
}

export function fitScreen(width: number, height: number, banner = playBanner(width, height)): FittedView {
   return fitView({ ...FIT, area: areaFor(width, height), width, height, avoid: playAvoid(width, height, banner) });
}

/** Where CameraRig aims on this screen. Desktop stays inside AIM_CLAMP so the yard does not scroll off. */
export function aimAt(x: number, z: number, width: number, height: number): { x: number; z: number } {
   if (Math.min(width, height) < 600) return { x, z };
   return {
      x: Math.min(AIM_CLAMP.max.x, Math.max(AIM_CLAMP.min.x, x)),
      z: Math.min(AIM_CLAMP.max.z, Math.max(AIM_CLAMP.min.z, z)),
   };
}

const POINT = new Vector3();

/** Steady follow camera: kid at (x, FOLLOW_Y, z), offset and lens shift from fitView. No allocation. */
export function placeFollowCamera(
   cam: PerspectiveCamera,
   view: FittedView,
   x: number,
   z: number,
   width: number,
   height: number,
): void {
   cam.fov = FOV;
   cam.aspect = width / Math.max(1, height);
   cam.near = 0.1;
   cam.far = 200;
   cam.up.set(0, 1, 0);
   cam.position.set(x + view.offset[0], FOLLOW_Y + view.offset[1], z + view.offset[2]);
   cam.lookAt(x, FOLLOW_Y, z);
   cam.updateProjectionMatrix();
   setLensShift(cam, view.shift[0], view.shift[1], width, height);
   cam.updateMatrixWorld(true);
   cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
}

/** CSS px from the canvas top-left. Null when the point is behind the near plane. */
export function projectPoint(
   cam: PerspectiveCamera,
   x: number,
   y: number,
   z: number,
   width: number,
   height: number,
): { x: number; y: number } | null {
   POINT.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
   if (!(POINT.z < -cam.near)) return null;
   POINT.applyMatrix4(cam.projectionMatrix);
   if (!Number.isFinite(POINT.x) || !Number.isFinite(POINT.y)) return null;
   return { x: ((POINT.x + 1) / 2) * width, y: ((1 - POINT.y) / 2) * height };
}

/** Vertical CSS px between two world heights at the same xz. */
export function pixelsTall(
   cam: PerspectiveCamera,
   width: number,
   height: number,
   x: number,
   y0: number,
   y1: number,
   z: number,
): number {
   const a = projectPoint(cam, x, y0, z, width, height);
   const b = projectPoint(cam, x, y1, z, width, height);
   if (!a || !b) return 0;
   return Math.abs(a.y - b.y);
}
