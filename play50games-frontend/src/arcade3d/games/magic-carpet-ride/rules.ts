// Magic Carpet Ride rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// The carpet rides a smooth open spline (core/path). moveX / moveY slide it inside a window
// around the path. Hold jump to boost while stamina lasts. Rings pay on a plane cross, stars
// on an overlap, rocks spend a life outside the mercy (clouds on level 3 only slow).
import type { Vec3Like as Vec3 } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import { bank, spring, type SpringState } from "@/arcade3d/core/motion";
import { createPath, pointAt, tangentAt, type Path } from "@/arcade3d/core/path";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, themeOf, type CarpetLevel, type CarpetTheme } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

export const LIVES = 3;
export const RING_POINTS = 50;
export const STAR_POINTS = 30;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;

export const SIDE = 4;
export const VERT = 2.5;
export const OFFSET_SPEED = 5;
export const SPRING_K = 42;

export const BOOST_MUL = 1.5;
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN = 30;
export const STAMINA_REFILL = 12;
export const BOOST_LOCK = 1;

/** Ring radius 1.5 minus the carpet half-width 0.3. */
export const PASS_R = 1.2;
export const CARPET_HALF = 0.3;
export const STAR_R = 0.7;
export const ROCK_R = 0.85;
export const HIT_R = ROCK_R + CARPET_HALF;
export const MERCY = 1;
export const ROCK_CLEAR = 6;
export const LINE_OFF = 2.5;
export const SLOW_MUL = 0.7;
export const SLOW_S = 1.1;
export const MOVER_PERIOD = 3;
export const MOVER_AMP = 1.5;
export const BANK_MAX = 0.55;

/** Objective ceiling. Time bonus sits on top, only on a win. */
export function objectScore(level: CarpetLevel): number {
   return RING_POINTS * level.rings + STAR_POINTS * level.stars;
}

/**
 * Sketch limits assumed a slower stamina finish than a held boost actually takes
 * (refill during the 1 s lock, then a 0.4 s pulse). These numbers cover that finish
 * with about 4% on maxScore. base stays the object ceiling. minDurationMs is 4000
 * because a crash cannot land before the first rock. See README.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 1000, minDurationMs: 4000, maxDurationMs: 120_000, base: 640, maxPointsPerSec: 9, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1420, minDurationMs: 4000, maxDurationMs: 150_000, base: 960, maxPointsPerSec: 8, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1780, minDurationMs: 4000, maxDurationMs: 180_000, base: 1250, maxPointsPerSec: 8, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 2060, minDurationMs: 4000, maxDurationMs: 180_000, base: 1540, maxPointsPerSec: 8, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 2650, minDurationMs: 4000, maxDurationMs: 240_000, base: 1910, maxPointsPerSec: 9, unitLabel: "pts", display: "int" },
};

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

// ---------- layout ----------

export interface Ring {
   s: number;
   lat: number;
   vert: number;
   x: number;
   y: number;
   z: number;
   tx: number;
   ty: number;
   tz: number;
   rx: number;
   ry: number;
   rz: number;
   ux: number;
   uy: number;
   uz: number;
   taken: boolean;
}

export interface Star {
   s: number;
   lat: number;
   vert: number;
   x: number;
   y: number;
   z: number;
   taken: boolean;
}

export interface Rock {
   s: number;
   lat: number;
   vert: number;
   baseY: number;
   phase: number;
   mover: boolean;
   cloud: boolean;
   rotY: number;
   x: number;
   y: number;
   z: number;
}

export type DecorKind = "roof" | "mesa" | "lantern" | "palace" | "cloud";

export interface Decor {
   kind: DecorKind;
   x: number;
   y: number;
   z: number;
   sx: number;
   sy: number;
   sz: number;
   rotY: number;
   /** signed metres off the path; the palace sits past the finish and uses 0 */
   lat: number;
}

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   ring: number;
   star: number;
   hit: boolean;
   cloud: boolean;
   boostOn: boolean;
}

export interface Run {
   seed: number;
   level: CarpetLevel;
   theme: CarpetTheme;
   path: Path;
   s: number;
   lat: SpringState;
   vert: SpringState;
   prevLatV: number;
   stamina: number;
   lock: number;
   boosting: boolean;
   mercy: number;
   slow: number;
   grace: number;
   carpet: Vec3;
   prev: Vec3;
   tangent: Vec3;
   yaw: number;
   pitch: number;
   roll: number;
   cam: Vec3;
   camYaw: number;
   rings: Ring[];
   stars: Star[];
   rocks: Rock[];
   decor: Decor[];
   arch: { x: number; y: number; z: number; yaw: number };
   ringsPassed: number;
   starsTaken: number;
   nextRing: number;
   lives: number;
   score: number;
   over: "win" | "lose" | null;
   time: number;
   needRings: number;
   needStars: number;
   ev: StepEvents;
   scratch: { p: Vec3; t: Vec3; r: Vec3; ahead: Vec3 };
}

export interface CarpetInput {
   moveX: number;
   moveY: number;
   /** held boost: Space and the touch Boost button both set this */
   jump: boolean;
}

export const idleInput = (): CarpetInput => ({ moveX: 0, moveY: 0, jump: false });

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
   return Math.max(lo, Math.min(hi, v));
}

function hypot3(ax: number, ay: number, az: number): number {
   return Math.hypot(ax, ay, az);
}

function cross(a: Vec3, b: Vec3, out: Vec3): Vec3 {
   out.x = a.y * b.z - a.z * b.y;
   out.y = a.z * b.x - a.x * b.z;
   out.z = a.x * b.y - a.y * b.x;
   return out;
}

function basis(tangent: Vec3, right: Vec3): void {
   const h = Math.hypot(tangent.x, tangent.z) || 1;
   right.x = tangent.z / h;
   right.y = 0;
   right.z = -tangent.x / h;
}

/** World point at an along-track distance and a window offset. Writes `out`. */
export function poseAt(path: Path, s: number, lat: number, vert: number, scratch: Run["scratch"], out: Vec3): Vec3 {
   pointAt(path, s, scratch.p);
   tangentAt(path, s, scratch.t);
   basis(scratch.t, scratch.r);
   out.x = scratch.p.x + scratch.r.x * lat;
   out.y = scratch.p.y + vert;
   out.z = scratch.p.z + scratch.r.z * lat;
   return out;
}

function fillFrame(path: Path, s: number, lat: number, vert: number, scratch: Run["scratch"], ring: Ring): void {
   poseAt(path, s, lat, vert, scratch, ring);
   ring.tx = scratch.t.x;
   ring.ty = scratch.t.y;
   ring.tz = scratch.t.z;
   ring.rx = scratch.r.x;
   ring.ry = scratch.r.y;
   ring.rz = scratch.r.z;
   const up = scratch.ahead;
   cross(scratch.t, scratch.r, up);
   const len = hypot3(up.x, up.y, up.z) || 1;
   ring.ux = up.x / len;
   ring.uy = up.y / len;
   ring.uz = up.z / len;
}

function buildPath(rng: () => number, level: CarpetLevel): Path {
   const n = Math.max(12, Math.ceil(level.length / 70));
   const step = level.length / (n - 1);
   const points: Vec3[] = [];
   let x = 0;
   let y = 18;
   let z = 0;
   let heading = 0;
   for (let i = 0; i < n; i++) {
      points.push({ x, y, z });
      heading = clamp(heading + (rng() - 0.5) * 0.42, -0.85, 0.85);
      const climb = (rng() - 0.5) * 0.08;
      x += Math.sin(heading) * step;
      z += Math.cos(heading) * step;
      y = clamp(y + climb * step, 12, 26);
   }
   let path = createPath(points, { smooth: true, samples: 8 });
   const k = level.length / path.total;
   const origin = points[0];
   const scaled = points.map((p) => ({
      x: origin.x + (p.x - origin.x) * k,
      y: origin.y + (p.y - origin.y) * k,
      z: origin.z + (p.z - origin.z) * k,
   }));
   path = createPath(scaled, { smooth: true, samples: 8 });
   return path;
}

function nearRing(rings: readonly Ring[], s: number): boolean {
   for (let i = 0; i < rings.length; i++) if (Math.abs(rings[i].s - s) < ROCK_CLEAR) return true;
   return false;
}

function placeRings(rng: () => number, path: Path, level: CarpetLevel, scratch: Run["scratch"]): Ring[] {
   const rings: Ring[] = [];
   for (let i = 0; i < level.rings; i++) {
      const s = level.length * (i + 1) / (level.rings + 1);
      const side = i % 2 === 0 ? 1 : -1;
      const lat = side * (1.55 + rng() * 1.3);
      const vert = (rng() - 0.5) * 1.8;
      const ring: Ring = {
         s, lat, vert, x: 0, y: 0, z: 0,
         tx: 0, ty: 0, tz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, taken: false,
      };
      fillFrame(path, s, lat, vert, scratch, ring);
      rings.push(ring);
   }
   return rings;
}

function placeStars(rng: () => number, path: Path, level: CarpetLevel, rings: readonly Ring[], scratch: Run["scratch"]): Star[] {
   const stars: Star[] = [];
   const gaps = rings.length - 1;
   const at = { x: 0, y: 0, z: 0 };
   for (let i = 0; i < level.stars; i++) {
      const gap = i % gaps;
      const end = (Math.floor(i / gaps) + (i % 2)) % 2 === 0;
      const u = 0.16 + (i % 3) * 0.05;
      const t = end ? u : 1 - u;
      const a = rings[gap];
      const b = rings[gap + 1];
      const s = a.s + (b.s - a.s) * t;
      let lat = a.lat + (b.lat - a.lat) * t;
      let vert = a.vert + (b.vert - a.vert) * t;
      if (Math.abs(lat) < 1.2) lat = Math.sign(lat || a.lat || 1) * 1.2;
      vert = clamp(vert + (rng() - 0.5) * 0.2, -1.6, 1.6);
      poseAt(path, s, lat, vert, scratch, at);
      stars.push({ s, lat, vert, x: at.x, y: at.y, z: at.z, taken: false });
   }
   return stars;
}

function clearOfRings(path: Path, rings: readonly Ring[], s: number, lat: number, vert: number, scratch: Run["scratch"], at: Vec3): boolean {
   poseAt(path, s, lat, vert, scratch, at);
   for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const dy = Math.max(0, Math.abs(at.y - ring.y) - MOVER_AMP);
      if (hypot3(at.x - ring.x, dy, at.z - ring.z) < ROCK_CLEAR) return false;
   }
   return true;
}

function placeRocks(rng: () => number, path: Path, level: CarpetLevel, rings: readonly Ring[], scratch: Run["scratch"]): Rock[] {
   const cloud = themeOf(level) === "cloud";
   const slots: number[] = [];
   for (let i = 0; i < rings.length - 1; i++) {
      const s = (rings[i].s + rings[i + 1].s) / 2;
      if (s >= 55 && s <= level.length - 36 && !nearRing(rings, s)) slots.push(s);
   }
   for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = slots[i];
      slots[i] = slots[j];
      slots[j] = swap;
   }
   const rocks: Rock[] = [];
   const at = { x: 0, y: 0, z: 0 };
   const take = (s: number): boolean => {
      if (rocks.length >= level.rocks) return true;
      if (rocks.some((rock) => Math.abs(rock.s - s) < 8)) return false;
      const next = rings.find((ring) => ring.s > s) ?? rings[rings.length - 1];
      const sign = next.lat >= 0 ? -1 : 1;
      let lat = clamp(next.lat + sign * LINE_OFF, -3.6, 3.6);
      if (Math.abs(lat - next.lat) < 2.2) lat = clamp(next.lat - sign * LINE_OFF, -3.6, 3.6);
      const vert = clamp((rng() - 0.5) * 0.8, -1.2, 1.2);
      if (!clearOfRings(path, rings, s, lat, vert, scratch, at)) return false;
      const mover = rocks.length < level.movers;
      const phase = rng() * TAU;
      const y = at.y + (mover ? Math.sin(phase) * MOVER_AMP : 0);
      rocks.push({
         s, lat, vert, baseY: at.y, phase, mover, cloud, rotY: rng() * TAU,
         x: at.x, y, z: at.z,
      });
      return true;
   };
   for (let n = 0; n < slots.length && rocks.length < level.rocks; n++) take(slots[n]);
   for (let s = 60; rocks.length < level.rocks && s < level.length - 40; s += 7) take(s);
   return rocks;
}

function pushDecor(decor: Decor[], kind: DecorKind, path: Path, s: number, lat: number, yLift: number, sx: number, sy: number, sz: number, scratch: Run["scratch"]): void {
   const at = scratch.ahead;
   poseAt(path, s, lat, 0, scratch, at);
   const yaw = Math.atan2(scratch.t.x, scratch.t.z);
   decor.push({
      kind, x: at.x, y: at.y + yLift, z: at.z, sx, sy, sz, rotY: yaw, lat,
   });
}

function placeDecor(rng: () => number, path: Path, level: CarpetLevel, theme: CarpetTheme, scratch: Run["scratch"]): Decor[] {
   const decor: Decor[] = [];
   if (theme === "town") {
      for (let s = 24; s < level.length - 20; s += 26) {
         pushDecor(decor, "roof", path, s, 12 + rng() * 4, -7.5, 6.5, 4.2, 6.5, scratch);
         pushDecor(decor, "roof", path, s + 8, -(11 + rng() * 5), -8, 5.5, 3.6, 5.5, scratch);
      }
   } else if (theme === "canyon") {
      for (let s = 30; s < level.length - 24; s += 34) {
         pushDecor(decor, "mesa", path, s, 16, -1.5, 4.2, 12, 7, scratch);
         pushDecor(decor, "mesa", path, s + 12, -15, -2, 3.6, 11, 6.5, scratch);
      }
   } else if (theme === "cloud") {
      for (let s = 40; s < level.length - 30; s += 48) {
         pushDecor(decor, "cloud", path, s, 18, 3, 7, 3.2, 6, scratch);
         pushDecor(decor, "cloud", path, s + 16, -17, 1.5, 6, 2.6, 5, scratch);
      }
   } else if (theme === "night") {
      for (let s = 36; s < level.length - 28; s += 32) {
         pushDecor(decor, "lantern", path, s, 6.4, 1.4, 0.36, 0.7, 0.36, scratch);
         pushDecor(decor, "lantern", path, s + 14, -6.4, 1.6, 0.36, 0.7, 0.36, scratch);
      }
   }
   if (theme === "palace") {
      const at = scratch.ahead;
      poseAt(path, level.length, 0, 0, scratch, at);
      const reach = 16;
      decor.push({
         kind: "palace",
         x: at.x + scratch.t.x * reach,
         y: at.y + scratch.t.y * reach + 1,
         z: at.z + scratch.t.z * reach,
         sx: 9,
         sy: 11,
         sz: 9,
         rotY: Math.atan2(scratch.t.x, scratch.t.z),
         lat: 0,
      });
   }
   return decor;
}

function archAt(path: Path, level: CarpetLevel, scratch: Run["scratch"]): Run["arch"] {
   const at = scratch.ahead;
   const s = Math.max(0, level.length - 2);
   poseAt(path, s, 0, 0, scratch, at);
   return { x: at.x, y: at.y, z: at.z, yaw: Math.atan2(scratch.t.x, scratch.t.z) };
}

function blankEvents(): StepEvents {
   return { score: 0, lifeLost: false, won: false, lost: false, ring: -1, star: -1, hit: false, cloud: false, boostOn: false };
}

export function createRun(seed: number, level: CarpetLevel): Run {
   const rng = createRng(seed);
   const scratch = {
      p: { x: 0, y: 0, z: 0 },
      t: { x: 0, y: 0, z: 1 },
      r: { x: 1, y: 0, z: 0 },
      ahead: { x: 0, y: 0, z: 0 },
   };
   const path = buildPath(rng, level);
   const theme = themeOf(level);
   const rings = placeRings(rng, path, level, scratch);
   const stars = placeStars(rng, path, level, rings, scratch);
   const rocks = placeRocks(rng, path, level, rings, scratch);
   const decor = placeDecor(rng, path, level, theme, scratch);
   const run: Run = {
      seed,
      level,
      theme,
      path,
      s: 0,
      lat: { x: 0, v: 0 },
      vert: { x: 0, v: 0 },
      prevLatV: 0,
      stamina: STAMINA_MAX,
      lock: 0,
      boosting: false,
      mercy: 0,
      slow: 0,
      grace: 0,
      carpet: { x: 0, y: 0, z: 0 },
      prev: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 0, z: 1 },
      yaw: 0,
      pitch: 0,
      roll: 0,
      cam: { x: 0, y: 0, z: 0 },
      camYaw: 0,
      rings,
      stars,
      rocks,
      decor,
      arch: archAt(path, level, scratch),
      ringsPassed: 0,
      starsTaken: 0,
      nextRing: 0,
      lives: LIVES,
      score: 0,
      over: null,
      time: 0,
      needRings: level.ringQuota,
      needStars: level.starQuota,
      ev: blankEvents(),
      scratch,
   };
   writePose(run);
   run.prev.x = run.carpet.x;
   run.prev.y = run.carpet.y;
   run.prev.z = run.carpet.z;
   return run;
}

/** Puts the carpet on `s` / lat / vert and clears the previous sample so the next step starts there. */
export function place(run: Run): void {
   writePose(run);
   run.prev.x = run.carpet.x;
   run.prev.y = run.carpet.y;
   run.prev.z = run.carpet.z;
}

function writePose(run: Run): void {
   const { scratch, path } = run;
   poseAt(path, run.s, run.lat.x, run.vert.x, scratch, run.carpet);
   run.tangent.x = scratch.t.x;
   run.tangent.y = scratch.t.y;
   run.tangent.z = scratch.t.z;
   const h = Math.hypot(scratch.t.x, scratch.t.z) || 1;
   run.yaw = Math.atan2(scratch.t.x, scratch.t.z);
   run.pitch = Math.atan2(scratch.t.y, h);
   const fx = scratch.t.x / h;
   const fz = scratch.t.z / h;
   run.cam.x = run.carpet.x - fx * 5;
   run.cam.y = run.carpet.y + 1.8;
   run.cam.z = run.carpet.z - fz * 5;
   pointAt(path, run.s + 10, scratch.ahead);
   run.camYaw = Math.atan2(scratch.ahead.x - run.cam.x, scratch.ahead.z - run.cam.z);
}

function easeAxis(state: SpringState, target: number, dt: number): void {
   const before = state.x;
   spring(state, target, SPRING_K, -1, dt);
   const cap = OFFSET_SPEED * dt;
   if (state.x > before + cap) {
      state.x = before + cap;
      state.v = OFFSET_SPEED;
   } else if (state.x < before - cap) {
      state.x = before - cap;
      state.v = -OFFSET_SPEED;
   }
}

/** In-plane distance if the segment crosses the ring plane going forward, else null. */
export function planeGap(
   ax: number, ay: number, az: number,
   bx: number, by: number, bz: number,
   ring: Ring,
): number | null {
   const a = (ax - ring.x) * ring.tx + (ay - ring.y) * ring.ty + (az - ring.z) * ring.tz;
   const b = (bx - ring.x) * ring.tx + (by - ring.y) * ring.ty + (bz - ring.z) * ring.tz;
   if (!(a < 0 && b >= 0)) return null;
   const u = a === b ? 1 : -a / (b - a);
   const x = ax + (bx - ax) * u;
   const y = ay + (by - ay) * u;
   const z = az + (bz - az) * u;
   const dx = x - ring.x;
   const dy = y - ring.y;
   const dz = z - ring.z;
   const along = dx * ring.tx + dy * ring.ty + dz * ring.tz;
   return Math.hypot(dx - ring.tx * along, dy - ring.ty * along, dz - ring.tz * along);
}

function advanceFlight(run: Run, want: boolean, dt: number): void {
   let left = dt;
   const speed = run.level.speed;
   let boosted = false;
   while (left > 1e-8) {
      const slow = run.slow > 0 ? SLOW_MUL : 1;
      if (run.lock > 0) {
         const step = Math.min(left, run.lock);
         run.lock -= step;
         run.stamina = Math.min(STAMINA_MAX, run.stamina + STAMINA_REFILL * step);
         run.s += speed * slow * step;
         left -= step;
         continue;
      }
      if (want && run.stamina > 0) {
         const step = Math.min(left, run.stamina / STAMINA_DRAIN);
         run.stamina -= STAMINA_DRAIN * step;
         if (run.stamina <= 1e-8) {
            run.stamina = 0;
            run.lock = BOOST_LOCK;
         }
         run.s += speed * BOOST_MUL * slow * step;
         boosted = true;
         left -= step;
         continue;
      }
      run.stamina = Math.min(STAMINA_MAX, run.stamina + STAMINA_REFILL * left);
      run.s += speed * slow * left;
      left = 0;
   }
   run.boosting = boosted;
}

function moveRocks(run: Run): void {
   const { scratch, path } = run;
   const at = scratch.ahead;
   for (let i = 0; i < run.rocks.length; i++) {
      const rock = run.rocks[i];
      const lift = rock.mover ? Math.sin((run.time / MOVER_PERIOD) * TAU + rock.phase) * MOVER_AMP : 0;
      poseAt(path, rock.s, rock.lat, rock.vert, scratch, at);
      rock.x = at.x;
      rock.baseY = at.y;
      rock.y = at.y + lift;
      rock.z = at.z;
   }
}

function segmentDist(
   ax: number, ay: number, az: number,
   bx: number, by: number, bz: number,
   x: number, y: number, z: number,
): number {
   const dx = bx - ax;
   const dy = by - ay;
   const dz = bz - az;
   const l2 = dx * dx + dy * dy + dz * dz;
   let t = 0;
   if (l2 > 0) t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / l2, 0, 1);
   return hypot3(ax + dx * t - x, ay + dy * t - y, az + dz * t - z);
}

function knock(run: Run): void {
   run.lat.x = 0;
   run.lat.v = 0;
   run.vert.x = 0;
   run.vert.v = 0;
   writePose(run);
}

export function step(run: Run, input: CarpetInput, dt: number, timeLeftMs: number): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.ring = -1;
   ev.star = -1;
   ev.hit = false;
   ev.cloud = false;
   ev.boostOn = false;
   if (!(dt > 0) || run.over) return ev;

   if (run.mercy > 0) run.mercy = Math.max(0, run.mercy - dt);
   if (run.slow > 0) run.slow = Math.max(0, run.slow - dt);
   if (run.grace > 0) run.grace = Math.max(0, run.grace - dt);

   const targetLat = clamp(input.moveX, -1, 1) * SIDE;
   const targetVert = clamp(-input.moveY, -1, 1) * VERT;
   easeAxis(run.lat, targetLat, dt);
   easeAxis(run.vert, targetVert, dt);
   run.lat.x = clamp(run.lat.x, -SIDE, SIDE);
   run.vert.x = clamp(run.vert.x, -VERT, VERT);

   run.prev.x = run.carpet.x;
   run.prev.y = run.carpet.y;
   run.prev.z = run.carpet.z;
   const wasBoost = run.boosting;
   advanceFlight(run, input.jump, dt);
   if (run.s > run.path.total) run.s = run.path.total;
   run.time += dt;
   const accel = (run.lat.v - run.prevLatV) / dt;
   run.prevLatV = run.lat.v;
   run.roll = bank(accel, BANK_MAX);
   writePose(run);
   moveRocks(run);
   ev.boostOn = run.boosting && !wasBoost;

   for (let i = 0; i < run.stars.length; i++) {
      const star = run.stars[i];
      if (star.taken) continue;
      if (segmentDist(run.prev.x, run.prev.y, run.prev.z, run.carpet.x, run.carpet.y, run.carpet.z, star.x, star.y, star.z) > STAR_R) continue;
      star.taken = true;
      run.starsTaken += 1;
      run.score += STAR_POINTS;
      ev.score += STAR_POINTS;
      ev.star = i;
   }

   for (let i = 0; i < run.rings.length; i++) {
      const ring = run.rings[i];
      if (ring.taken) continue;
      const gap = planeGap(run.prev.x, run.prev.y, run.prev.z, run.carpet.x, run.carpet.y, run.carpet.z, ring);
      if (gap === null || gap > PASS_R) continue;
      ring.taken = true;
      run.ringsPassed += 1;
      run.score += RING_POINTS;
      ev.score += RING_POINTS;
      ev.ring = i;
   }

   if (run.mercy <= 0 && run.grace <= 0) {
      for (let i = 0; i < run.rocks.length; i++) {
         const rock = run.rocks[i];
         if (segmentDist(run.prev.x, run.prev.y, run.prev.z, run.carpet.x, run.carpet.y, run.carpet.z, rock.x, rock.y, rock.z) > HIT_R) continue;
         if (rock.cloud) {
            run.slow = SLOW_S;
            run.grace = SLOW_S;
            ev.cloud = true;
         } else {
            run.lives -= 1;
            run.mercy = MERCY;
            ev.hit = true;
            ev.lifeLost = true;
            knock(run);
            if (run.lives <= 0) {
               run.over = "lose";
               ev.lost = true;
            }
         }
         break;
      }
   }

   if (!run.over && run.s >= run.path.total - 1e-6) {
      run.s = run.path.total;
      const win = run.ringsPassed >= run.level.ringQuota && run.starsTaken >= run.level.starQuota;
      if (win) {
         const bonus = timeBonus(timeLeftMs);
         run.score += bonus;
         ev.score += bonus;
         ev.won = true;
         run.over = "win";
      } else {
         ev.lost = true;
         run.over = "lose";
      }
   }

   run.nextRing = -1;
   for (let i = 0; i < run.rings.length; i++) {
      if (!run.rings[i].taken) {
         run.nextRing = i;
         break;
      }
   }
   run.needRings = Math.max(0, run.level.ringQuota - run.ringsPassed);
   run.needStars = Math.max(0, run.level.starQuota - run.starsTaken);
   return ev;
}

/** Euclidean gap from every rock to every ring, using the mover's closest height. */
export function closestRockGap(run: Run): number {
   let best = Infinity;
   for (let i = 0; i < run.rocks.length; i++) {
      const rock = run.rocks[i];
      for (let j = 0; j < run.rings.length; j++) {
         const ring = run.rings[j];
         const dy = Math.max(0, Math.abs(rock.baseY - ring.y) - (rock.mover ? MOVER_AMP : 0));
         best = Math.min(best, hypot3(rock.x - ring.x, dy, rock.z - ring.z));
      }
   }
   return best;
}
