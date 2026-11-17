// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera): behind the
// hero looking along the climb, a little high so the next pads and the crystals above read. The
// spire, the crystal walls and the void gates are its solids. On level 5 the orbit leans toward
// Prism Shade through his fight (manual input always wins). The intro circles down the tower from
// the summit and ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, wrapAngle, yawBehind, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { guidePoint, type TowerRun } from "./rules";
import { CORE_R, type Course } from "./tower";

const DEG = Math.PI / 180;

export function towerOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: course.startYaw, pitch: (course.boss ? 36 : 28) * DEG, distance: course.boss ? 12 : 9.5, minDistance: 4.5, maxDistance: 26 };
}

export const TOWER_COLLISION: ClipOptions = { radius: 0.35, minDistance: 1.4, squeeze: 0.45, liftTo: 64 * DEG };

export const FOV = 52;

/**
 * Is this beacon post standing between the camera and the hero? (Portal Hop's anchorBlocksView, for a
 * post.) At the start of a tier the hero steps into the beacon's ring right beside the post, and while
 * the orbit swings round behind him the post can fill the view. True while the post is within
 * `BEACON_BLOCK.width` m of the line from the camera to the hero (on the ground plan), between the two,
 * with the hero close to it: TowerView hides that one post then.
 */
export const BEACON_BLOCK = { width: 0.9, heroNear: 6, camNear: 16 } as const;

export function beaconBlocksView(post: { x: number; z: number }, cam: { x: number; z: number }, hero: { x: number; z: number }): boolean {
   const dx = hero.x - cam.x;
   const dz = hero.z - cam.z;
   const len2 = dx * dx + dz * dz;
   if (len2 < 1e-6) return false;
   const t = ((post.x - cam.x) * dx + (post.z - cam.z) * dz) / len2;
   if (t <= 0.02 || t >= 0.98) return false;
   const off = Math.abs((post.x - cam.x) * dz - (post.z - cam.z) * dx) / Math.sqrt(len2);
   return off < BEACON_BLOCK.width && Math.hypot(post.x - hero.x, post.z - hero.z) < BEACON_BLOCK.heroNear && Math.hypot(post.x - cam.x, post.z - cam.z) < BEACON_BLOCK.camNear;
}
export const FOV_PORTRAIT = 62;

export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.35 * portraitAmount(aspect);
}

export function orbitLookUp(aspect: number): number {
   return 0.6 + 0.3 * portraitAmount(aspect);
}

/** Prism Shade hovers this high over the arena (the framing and the boss drawing agree). */
export const BOSS_HOVER = 2.8;

const guide = { x: 0, y: 0, z: 0 };

/**
 * Level 5's boss framing: the pivot leans `share` of the way from the hero toward Prism Shade (at
 * most `maxLead` m), and with no recent manual input the orbit swings (easing rate `yawRate` 1/s) to
 * look from the hero toward him, so he and his crystals stay in shot through his shows and windows.
 * Under `minGap` m the yaw is left alone.
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

/** Prism Shade's spot while the fight is on; false before he wakes, after his defeat and on other levels. */
export function bossTarget(run: TowerRun, out: { x: number; y: number; z: number }): boolean {
   if (!run.boss || !run.bossAwake || run.boss.hp <= 0 || !run.course.arena) return false;
   out.x = run.course.arena.x;
   out.y = run.course.arena.y + BOSS_HOVER;
   out.z = run.course.arena.z;
   return true;
}

const bossAt = { x: 0, y: 0, z: 0 };
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
 * Prism Shade (belly to crest) inside the safe band of a view with this vertical FOV (deg) and aspect?
 */
export function bossInFrame(run: TowerRun, yaw: number, pitch: number, distance: number, lookUp: number, fovDeg: number, aspect: number, margin = 0): boolean {
   orbitPivot(run, fPivot);
   orbitPosition(fPivot.x, fPivot.y, fPivot.z, yaw, pitch, distance, fCam);
   const half = (fovDeg * DEG) / 2;
   const halfH = Math.atan(Math.tan(half) * aspect);
   const ly = fPivot.y + lookUp;
   const h = run.hero;
   if (!bossTarget(run, bossAt)) return true;
   const pts: [number, number, number][] = [
      [h.x, h.y, h.z],
      [h.x, h.y + 1.4, h.z],
      [bossAt.x, bossAt.y - 0.6, bossAt.z],
      [bossAt.x, bossAt.y + 1.4, bossAt.z],
   ];
   for (const [px, py, pz] of pts) {
      offView(fCam.x, fCam.y, fCam.z, fPivot.x, ly, fPivot.z, px, py, pz, ang);
      const y = Math.tan(ang.v) / Math.tan(half);
      if (y > BOSS_FRAME.top - margin || y < -(BOSS_FRAME.bottom - margin) || Math.abs(Math.tan(ang.h) / Math.tan(halfH)) > 0.9 - margin) return false;
   }
   return true;
}

/** The steepest pitch (from `from` down to BOSS_FRAME.minPitch) that keeps both in the band (with a 0.06 margin, so the eased view stays in it); else the flattest. */
export function bossPitch(run: TowerRun, yaw: number, from: number, distance: number, lookUp: number, fovDeg: number, aspect: number): number {
   for (let p = from; p >= BOSS_FRAME.minPitch - 1e-9; p -= 2 * DEG) if (bossInFrame(run, yaw, p, distance, lookUp, fovDeg, aspect, 0.06)) return p;
   return BOSS_FRAME.minPitch;
}

/**
 * One frame (`dt` s) of the boss framing on the orbit's target yaw. Manual input wins: nothing
 * happens until the orbit has been idle for its auto-follow delay, or while a recenter swings round.
 * Returns whether it steered.
 */
export function steerBossFraming(orbit: OrbitState, run: TowerRun, dt: number, aspect = 1.6): boolean {
   if (!(dt > 0) || !bossTarget(run, bossAt)) return false;
   if (orbit.recentering || orbit.idle < orbit.settings.autoFollowDelay) return false;
   const dx = bossAt.x - run.hero.x;
   const dz = bossAt.z - run.hero.z;
   if (Math.hypot(dx, dz) < BOSS_FRAME.minGap) return false;
   const yaw = yawBehind(dx, dz);
   const err = wrapAngle(yaw - orbit.yaw);
   orbit.yaw = wrapAngle(orbit.yaw + err * (1 - Math.exp(-BOSS_FRAME.yawRate * dt)));
   const fov = aspect < 1 ? FOV_PORTRAIT : FOV;
   const want = bossPitch(run, yaw, orbit.settings.pitch, orbit.distance * orbitScale(aspect), orbitLookUp(aspect), fov, aspect);
   orbit.pitch += (want - orbit.pitch) * (1 - Math.exp(-BOSS_FRAME.pitchRate * dt));
   return true;
}

/** The hero's chest, led a little toward where it should go (the beacon, the summit); on level 5 toward Prism Shade. */
export function orbitPivot(run: TowerRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   const boss = bossTarget(run, guide);
   const has = boss || guidePoint(run, guide);
   let lead = 0;
   let dx = 0;
   let dz = 0;
   if (has) {
      dx = guide.x - h.x;
      dz = guide.z - h.z;
      const d = Math.hypot(dx, dz);
      lead = boss ? Math.min(BOSS_FRAME.maxLead, d * BOSS_FRAME.share) : Math.min(2.5, d * 0.15);
      if (d > 0.01) {
         dx /= d;
         dz /= d;
      } else lead = 0;
   }
   out.x = h.x + dx * lead;
   out.y = Math.max(h.y, run.course.minY - 3) + 1.1;
   out.z = h.z + dz * lead;
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = towerOrbit(course);
   const p = { x: course.startX, y: course.startY + 1.1, z: course.startZ };
   const c = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** From high over the summit, round and down the spire, onto the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const top = course.maxY;
   const s = course.summit;
   const r = course.maxR + 10;
   const a0 = Math.atan2(course.startX, course.startZ);
   return [
      { position: [s.x + Math.sin(a0 + 2.4) * 8, top + 12, s.z + Math.cos(a0 + 2.4) * 8], lookAt: [s.x, top + 1, s.z] },
      { position: [Math.sin(a0 + 1.2) * r, top * 0.55 + 6, Math.cos(a0 + 1.2) * r], lookAt: [0, top * 0.45, 0] },
      { position: [course.startX + Math.sin(a0) * 7, course.startY + 6, course.startZ + Math.cos(a0) * 7], lookAt: [course.startX, course.startY + 1, course.startZ] },
   ];
}

const SOLID_REACH = 36;

/** The solid boxes near the camera: the spire, the unbroken crystal walls and the void gates. */
export function courseSolids(run: TowerRun, x: number, z: number, out: AABB[]): number {
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
   // the spire as a box a little inside its round (the camera may clip its corners)
   const k = CORE_R * 0.8;
   add(-k, k, c.minY - 20, c.arena ? c.arena.y - 0.5 : c.maxY + 6, -k, k);
   c.walls.forEach((w, i) => {
      if (!run.wallBroken[i]) add(w.x - w.r, w.x + w.r, w.y0, w.y1, w.z - w.r, w.z + w.r);
   });
   for (const g of c.gates) add(g.x - g.r, g.x + g.r, g.y0, g.y1, g.z - g.r, g.z + g.r);
   return n;
}
