// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera): behind the
// hero looking down the corridor (+z), a little high so the next section reads. The corridor walls,
// the shut gates and door rows and the nook barriers are its solids. On level 5 the orbit leans
// toward the Chroma Sentinel through his fight (manual input always wins). The intro flies the
// corridor from the summit back to the start and ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, wrapAngle, yawBehind, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { HALF_W } from "./levels";
import { GATE_T, doorAt, type Course } from "./course";
import { exitShut, guidePoint, type TrialRun } from "./rules";

const DEG = Math.PI / 180;

export function trialOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: course.startYaw, pitch: (course.boss ? 34 : 27) * DEG, distance: course.boss ? 12 : 9.5, minDistance: 4.5, maxDistance: 26 };
}

export const TRIAL_COLLISION: ClipOptions = { radius: 0.35, minDistance: 1.4, squeeze: 0.45, liftTo: 64 * DEG };

export const FOV = 52;
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

/** The Sentinel hovers this high over the arena floor (the framing and the boss drawing agree). */
export const BOSS_HOVER = 2.6;

const guide = { x: 0, y: 0, z: 0 };

/**
 * Level 5's boss framing: the pivot leans `share` of the way from the hero toward the Sentinel (at most
 * `maxLead` m), and with no recent manual input the orbit swings (easing rate `yawRate` 1/s) to look
 * from the hero toward him, so he and his beacon stay in shot. Under `minGap` m the yaw is left alone.
 */
export const BOSS_FRAME = {
   share: 0.12,
   maxLead: 2,
   yawRate: 4,
   pitchRate: 4,
   minGap: 2,
   minPitch: 12 * DEG,
   top: 0.58,
   bottom: 0.82,
} as const;

/** The Sentinel's spot while the fight is on; false before he wakes, after his defeat and on other levels. */
export function bossTarget(run: TrialRun, out: { x: number; y: number; z: number }): boolean {
   if (!run.boss || !run.bossAwake || run.boss.hp <= 0 || !run.course.bossSpec) return false;
   out.x = run.course.bossSpec.x;
   out.y = BOSS_HOVER;
   out.z = run.course.bossSpec.z;
   return true;
}

const bossAt = { x: 0, y: 0, z: 0 };
const fPivot = { x: 0, y: 0, z: 0 };
const fCam = { x: 0, y: 0, z: 0 };

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

/** Does a camera at (yaw, pitch, distance) round the run's pivot keep the hero and the Sentinel inside the safe band? */
export function bossInFrame(run: TrialRun, yaw: number, pitch: number, distance: number, lookUp: number, fovDeg: number, aspect: number, margin = 0): boolean {
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
      [bossAt.x, bossAt.y + 2.2, bossAt.z],
   ];
   for (const [px, py, pz] of pts) {
      offView(fCam.x, fCam.y, fCam.z, fPivot.x, ly, fPivot.z, px, py, pz, ang);
      const y = Math.tan(ang.v) / Math.tan(half);
      if (y > BOSS_FRAME.top - margin || y < -(BOSS_FRAME.bottom - margin) || Math.abs(Math.tan(ang.h) / Math.tan(halfH)) > 0.9 - margin) return false;
   }
   return true;
}

export function bossPitch(run: TrialRun, yaw: number, from: number, distance: number, lookUp: number, fovDeg: number, aspect: number): number {
   for (let p = from; p >= BOSS_FRAME.minPitch - 1e-9; p -= 2 * DEG) if (bossInFrame(run, yaw, p, distance, lookUp, fovDeg, aspect, 0.06)) return p;
   return BOSS_FRAME.minPitch;
}

/** One frame (`dt` s) of the boss framing on the orbit's target yaw and pitch. Manual input wins. Returns whether it steered. */
export function steerBossFraming(orbit: OrbitState, run: TrialRun, dt: number, aspect = 1.6): boolean {
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

/** The hero's chest, led a little toward where it should go; on level 5 toward the Sentinel. */
export function orbitPivot(run: TrialRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
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
   // the fight: the pivot stays at the arena floor, so a jump never swings the Sentinel out of the frame
   out.y = (boss ? 0 : Math.max(h.y, -1)) + 1.1;
   out.z = h.z + dz * lead;
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = trialOrbit(course);
   const p = { x: course.startX, y: 1.1, z: course.startZ };
   const c = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** From high over the summit, back down the corridor, onto the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const len = course.maxZ - course.minZ;
   return [
      { position: [course.finish.x + 12, 16, course.maxZ + 4], lookAt: [course.finish.x, 1, course.finish.z - 10] },
      { position: [-14, 12, course.minZ + len * 0.5], lookAt: [0, 0, course.minZ + len * 0.35] },
      { position: [course.startX + 3, 7, course.startZ - 8], lookAt: [course.startX, 1, course.startZ + 10] },
   ];
}

const SOLID_REACH = 34;

/** The solid boxes near the camera: the corridor walls, the shut exits, the door rows' walls and shut doors, the nook barriers. */
export function courseSolids(run: TrialRun, x: number, z: number, out: AABB[]): number {
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
   // the walls, in 20 m pieces (the reach test is per box)
   for (let z0 = c.minZ; z0 < c.maxZ; z0 += 20) {
      const z1 = Math.min(c.maxZ, z0 + 20);
      add(-HALF_W - 1, -HALF_W, 0, 4, z0, z1);
      add(HALF_W, HALF_W + 1, 0, 4, z0, z1);
   }
   c.sections.forEach((s, i) => {
      if (exitShut(run, i)) add(-HALF_W, HALF_W, 0, 3.5, s.z1 - GATE_T, s.z1 + GATE_T);
   });
   for (const row of c.rows) {
      // the walls between the doors
      let x = -HALF_W;
      for (const d of [...row.doors].sort((a, b) => a.x0 - b.x0)) {
         if (d.x0 > x) add(x, d.x0, 0, 3.5, row.z - GATE_T, row.z + GATE_T);
         x = d.x1;
      }
      if (x < HALF_W) add(x, HALF_W, 0, 3.5, row.z - GATE_T, row.z + GATE_T);
      for (const d of row.doors) if (doorAt(row, (d.x0 + d.x1) / 2) && d.color !== run.charge) add(d.x0, d.x1, 0, 3.5, row.z - GATE_T, row.z + GATE_T);
   }
   c.nooks.forEach((k, i) => {
      if (k.kind === "wall" && run.wallBroken[i]) return;
      add(k.disc.x - k.disc.r, k.disc.x + k.disc.r, k.disc.y0, k.disc.y1, k.disc.z - k.disc.r, k.disc.z + k.disc.r);
   });
   return n;
}
