// Follow camera for snowball-battle. The fit is a window around the kid (yaw 0: the lens sits on
// +z and looks toward −z), shared by Scene and the occlusion / readability tests.
import { PerspectiveCamera, Vector3 } from "three";
import type { FittedView, ScreenRect } from "@/arcade3d/core/view";
import { fitView, setLensShift } from "@/arcade3d/core/view";

export const FOV = 45;
export const PITCH = (52 * Math.PI) / 180;
/** CameraRig looks at the kid's chest, not the feet. */
export const FOLLOW_Y = 0.9;
export const LOOK_AT: [number, number, number] = [0, 0, 0];

export const AREA = { min: { x: -1.42, y: 0, z: -0.94 }, max: { x: 1.42, y: 1.35, z: 0.94 } };

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
   return fitView({ ...FIT, width, height, avoid: playAvoid(width, height, banner) });
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
