// The camera: the shared Menu 2 orbit (menu2/camera), outside the wall looking in at the hero, so the
// guardian in the shaft stands behind the hero and his arm swings toward the camera. The wall is drawn
// from inside only (Tower.tsx): its near side vanishes and the far side is the backdrop (a cutaway, no
// solids). Left / right on the stick is round the ring. With no manual input for a moment the orbit
// swings to stay there as you climb (leaning a little toward where you run, so the next gap shows).
// The intro circles the tower from the crown down to the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, wrapAngle, yawBehind, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { R_PATH } from "./levels";
import { type CbtRun, type Tower } from "./rules";

const DEG = Math.PI / 180;

export const FOV = 55;
export const FOV_PORTRAIT = 66;

export const TOWER_CAMERA = {
   pitch: 20 * DEG,
   distance: 8,
   minDistance: 3.5,
   maxDistance: 14,
   /** the swing back behind the hero after manual input (1/s) */
   yawRate: 2.2,
   /** the lean toward the run direction (rad at full speed) */
   lean: 0.32,
} as const;

export const TOWER_COLLISION: ClipOptions = { radius: 0.3, minDistance: 1.2, squeeze: 0.45, liftTo: 60 * DEG };

export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.25 * portraitAmount(aspect);
}

export function orbitLookUp(aspect: number): number {
   return 0.6 + 0.4 * portraitAmount(aspect);
}

/** The camera yaw that sits outside the wall at arc `a`, looking in toward the shaft. */
export function outwardYaw(a: number): number {
   const th = a / R_PATH;
   return yawBehind(-Math.sin(th), -Math.cos(th));
}

export function towerOrbit(run: CbtRun): Partial<OrbitSettings> {
   return {
      yaw: outwardYaw(run.hero.a),
      pitch: TOWER_CAMERA.pitch,
      distance: TOWER_CAMERA.distance,
      minDistance: TOWER_CAMERA.minDistance,
      maxDistance: TOWER_CAMERA.maxDistance,
      autoFollow: false,
   };
}

/**
 * Keeps the orbit outside the wall facing the hero as it runs round the ring (eases the target yaw;
 * the orbit driver eases the view). Leaves a manual turn alone until the orbit's idle delay passes.
 * Returns whether it steered.
 */
export function steerTowerCamera(orbit: OrbitState, run: CbtRun, dt: number): boolean {
   if (!(dt > 0) || orbit.recentering || orbit.idle < orbit.settings.autoFollowDelay) return false;
   const lean = Math.max(-1, Math.min(1, run.hero.va / 6.5)) * TOWER_CAMERA.lean;
   const want = outwardYaw(run.hero.a) + lean;
   const err = wrapAngle(want - orbit.yaw);
   orbit.yaw = wrapAngle(orbit.yaw + err * (1 - Math.exp(-TOWER_CAMERA.yawRate * dt)));
   return true;
}

/** The hero's chest, pulled a little in toward the shaft so the ledge above reads. */
export function orbitPivot(run: CbtRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const th = run.hero.a / R_PATH;
   const r = R_PATH - 0.6;
   out.x = Math.sin(th) * r;
   out.y = run.hero.y + 1.1;
   out.z = Math.cos(th) * r;
   return out;
}

export function playCamera(run: CbtRun, aspect: number): IntroKeyframe {
   const p = orbitPivot(run, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, outwardYaw(run.hero.a), TOWER_CAMERA.pitch, TOWER_CAMERA.distance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** Down the shaft from over the crown, round the guardian, onto the start. */
export function introKeyframes(tower: Tower): IntroKeyframe[] {
   const top = tower.topY;
   return [
      { position: [0, top + 18, 3], lookAt: [0, top * 0.4, 0] },
      { position: [9, top * 0.55, -14], lookAt: [0, top * 0.4, 0] },
      { position: [-15, 6, 9], lookAt: [0, 3, 0] },
   ];
}
