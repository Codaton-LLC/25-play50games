// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera): behind the
// hero looking down the room (+z), a little high so the next gap and the wave read. The castle, the
// block walls, the toyboxes and the shelves are its solids. The intro flies down the room from the
// castle and ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, wrapAngle, yawBehind, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { guidePoint, type ToyRun } from "./rules";
import { BOXES } from "./levels";
import type { Course } from "./room";

const DEG = Math.PI / 180;

export function roomOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: course.startYaw, pitch: (course.boss ? 40 : 30) * DEG, distance: course.boss ? 12 : 9, minDistance: 4.5, maxDistance: 24 };
}

export const ROOM_COLLISION: ClipOptions = { radius: 0.35, minDistance: 1.4, squeeze: 0.45, liftTo: 64 * DEG };

export const FOV = 52;
export const FOV_PORTRAIT = 62;

export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.35 * portraitAmount(aspect);
}

export function orbitLookUp(aspect: number): number {
   return 0.5 + 0.3 * portraitAmount(aspect);
}

const guide = { x: 0, y: 0, z: 0 };

/**
 * Level 5's boss framing: the pivot leans `share` of the way from the hero toward Jack (at most
 * `maxLead` m), and with no recent manual input the orbit swings (easing rate `yawRate` 1/s) to look
 * from the hero toward Jack, so he stays in shot through his telegraphs and windows while the hero
 * runs to the chain starters. Under `minGap` m (Jack's slam spot) the yaw is left alone.
 */
export const BOSS_FRAME = {
   share: 0.12,
   maxLead: 2,
   yawRate: 2.5,
   pitchRate: 2.5,
   minGap: 2,
   /** the flattest pitch the framing uses (rad) */
   minPitch: 12 * DEG,
   /** the safe band on screen, as a share of the half-height (tan space): under the boss bar on top, over the controls below */
   top: 0.55,
   bottom: 0.82,
} as const;

/** Jack's spot while the fight is on; false before the fight, after his defeat and on other levels. */
export function bossTarget(run: ToyRun, out: { x: number; z: number }): boolean {
   if (!run.boss || run.boss.hp <= 0) return false;
   out.x = run.jack.x;
   out.z = run.jack.z;
   return true;
}

const jackAt = { x: 0, z: 0 };
const fPivot = { x: 0, y: 0, z: 0 };
const fCam = { x: 0, y: 0, z: 0 };

/** Vertical and horizontal angles (rad) of a point off the view axis (camera -> look point). */
function offView(cx: number, cy: number, cz: number, lx: number, ly: number, lz: number, px: number, py: number, pz: number, out: { v: number; h: number }): void {
   const fx = lx - cx;
   const fz = lz - cz;
   const flat = Math.hypot(fx, fz) || 1;
   const axisPitch = Math.atan2(ly - cy, flat);
   const qx = px - cx;
   const qz = pz - cz;
   const along = (qx * fx + qz * fz) / flat;
   const across = (qx * fz - qz * fx) / flat;
   out.v = Math.atan2(py - cy, Math.max(0.01, along)) - axisPitch;
   out.h = Math.atan2(across, Math.max(0.01, along));
}

const ang = { v: 0, h: 0 };

/**
 * Does a camera at (yaw, pitch, distance) round the run's pivot keep the hero (feet to head) and
 * Jack (base to top) inside the safe band of a view with this vertical FOV (deg) and aspect?
 */
export function bossInFrame(run: ToyRun, yaw: number, pitch: number, distance: number, lookUp: number, fovDeg: number, aspect: number, margin = 0): boolean {
   orbitPivot(run, fPivot);
   orbitPosition(fPivot.x, fPivot.y, fPivot.z, yaw, pitch, distance, fCam);
   const half = (fovDeg * DEG) / 2;
   const halfH = Math.atan(Math.tan(half) * aspect);
   const ly = fPivot.y + lookUp;
   const h = run.hero;
   const j = run.jack;
   // in Whack and Throwback frame the pose he springs up to (2.4 m), so the view is ready before the window
   const jy = run.boss && run.boss.phase < 2 ? Math.max(j.y, 2.4) : j.y;
   const pts: [number, number, number][] = [
      [h.x, Math.max(h.y, -1), h.z],
      [h.x, Math.max(h.y, -1) + 1.4, h.z],
      [j.x, Math.max(0, jy - 1.6), j.z],
      [j.x, jy + 1.8, j.z],
   ];
   for (const [px, py, pz] of pts) {
      offView(fCam.x, fCam.y, fCam.z, fPivot.x, ly, fPivot.z, px, py, pz, ang);
      const y = Math.tan(ang.v) / Math.tan(half);
      if (y > BOSS_FRAME.top - margin || y < -(BOSS_FRAME.bottom - margin) || Math.abs(Math.tan(ang.h) / Math.tan(halfH)) > 0.9 - margin) return false;
   }
   return true;
}

/** The steepest pitch (from `from` down to BOSS_FRAME.minPitch) that keeps both in the band (with a 0.06 margin, so the eased view stays in it); else the flattest. */
export function bossPitch(run: ToyRun, yaw: number, from: number, distance: number, lookUp: number, fovDeg: number, aspect: number): number {
   for (let p = from; p >= BOSS_FRAME.minPitch - 1e-9; p -= 2 * DEG) if (bossInFrame(run, yaw, p, distance, lookUp, fovDeg, aspect, 0.06)) return p;
   return BOSS_FRAME.minPitch;
}

/**
 * One frame (`dt` s) of the boss framing on the orbit's target yaw. Manual input wins: nothing
 * happens until the orbit has been idle for its auto-follow delay, or while a recenter swings round.
 * Returns whether it steered.
 */
export function steerBossFraming(orbit: OrbitState, run: ToyRun, dt: number, aspect = 1.6): boolean {
   if (!(dt > 0) || !bossTarget(run, jackAt)) return false;
   if (orbit.recentering || orbit.idle < orbit.settings.autoFollowDelay) return false;
   const dx = jackAt.x - run.hero.x;
   const dz = jackAt.z - run.hero.z;
   if (Math.hypot(dx, dz) < BOSS_FRAME.minGap) return false;
   const yaw = yawBehind(dx, dz);
   const err = wrapAngle(yaw - orbit.yaw);
   orbit.yaw = wrapAngle(orbit.yaw + err * (1 - Math.exp(-BOSS_FRAME.yawRate * dt)));
   // and the pitch that keeps both in the band (never steeper than the level's own pitch)
   const fov = aspect < 1 ? FOV_PORTRAIT : FOV;
   const want = bossPitch(run, yaw, orbit.settings.pitch, orbit.distance * orbitScale(aspect), orbitLookUp(aspect), fov, aspect);
   orbit.pitch += (want - orbit.pitch) * (1 - Math.exp(-BOSS_FRAME.pitchRate * dt));
   return true;
}

/** The hero's chest, led a little toward where it should go (a starter, a spare, the wave); on level 5 toward Jack. */
export function orbitPivot(run: ToyRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   const boss = bossTarget(run, guide);
   if (!boss) guidePoint(run, guide);
   const dx = guide.x - h.x;
   const dz = guide.z - h.z;
   const d = Math.hypot(dx, dz);
   const lead = boss ? Math.min(BOSS_FRAME.maxLead, d * BOSS_FRAME.share) : Math.min(2.5, d * 0.15);
   out.x = h.x + (d > 0.01 ? (dx / d) * lead : 0);
   out.y = Math.max(h.y, -1) + 1.1;
   out.z = h.z + (d > 0.01 ? (dz / d) * lead : 0);
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = roomOrbit(course);
   const p = { x: course.startX, y: 1.1, z: course.startZ };
   const c = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** From high over the castle end, back down the room, onto the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const len = course.maxZ - course.minZ;
   return [
      { position: [course.finish.x + 10, 16, course.maxZ + 6], lookAt: [course.finish.x, 0, course.finish.z - 8] },
      { position: [-9, 12, course.minZ + len * 0.5], lookAt: [0, 0, course.minZ + len * 0.3] },
      { position: [course.startX + 3, 7, course.startZ - 8], lookAt: [course.startX, 1, course.startZ + 10] },
   ];
}

const SOLID_REACH = 30;

/** The solid boxes near the camera: the castle, unbroken block walls, the toyboxes, shelves and ledges. */
export function courseSolids(run: ToyRun, x: number, z: number, out: AABB[]): number {
   let n = 0;
   const c = run.course;
   const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
      if (n >= out.length) return;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      if ((mx - x) ** 2 + (mz - z) ** 2 > SOLID_REACH * SOLID_REACH) return;
      const b = out[n++];
      b.min.x = x0;
      b.max.x = x1;
      b.min.y = y0;
      b.max.y = y1;
      b.min.z = z0;
      b.max.z = z1;
   };
   for (const k of c.castles) add(k.x0, k.x1, 0, 6, k.z0, k.z1);
   c.walls.forEach((w, i) => {
      if (!run.wallBroken[i]) add(w.x0, w.x1, 0, 2.6, w.z0, w.z1);
   });
   for (const p of c.plats) if (p.y > 0) add(p.x0, p.x1, p.y - 0.5, p.y, p.z0, p.z1);
   if (c.boss) for (const b of BOXES) add(b.x - 1.3, b.x + 1.3, 0, 2.6, b.z - 1.3, b.z + 1.3);
   return n;
}
