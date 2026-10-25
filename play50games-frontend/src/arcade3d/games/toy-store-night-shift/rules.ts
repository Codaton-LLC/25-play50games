// Toy Store Night Shift rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// A store of shelf rows (aisles). The night guard picks up the scattered toys (Use) and drops each
// one on the shelf of its kind. Wind-up robots and cars patrol loops round the rows and knock the
// carried toys out of his hands. No lives: the clock is the shell's.
import { stepPatrol, type PatrolState } from "@/arcade3d/core/ai/patrol";
import { createPath, type Path } from "@/arcade3d/core/path";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { CATEGORIES, LEVELS, shelvesOf, type Category, type ToyLevel } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

/** A toy put on a shelf of its kind. */
export const RIGHT_POINTS = 80;
/** Extra when no wrong drop happened since the previous right one. */
export const CLEAN_POINTS = 20;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;

export const RADIUS = 0.38;
export const MAX_SPEED = 4.4;
export const CARRY_SPEED = 0.9;
export const ACCEL = 22;
export const BRAKE = 28;
/** Use reaches a toy or a shelf within this distance. */
export const REACH = 1.2;
export const STUN_S = 0.5;
export const MERCY_S = 0.8;
export const WINDUP_HIT = 0.95;
export const TOY_R = 0.25;

export const SHELF_LEN = 4;
export const SHELF_DEPTH = 0.8;
export const SHELF_H = 1.6;
export const SHELF_GAP = 1.4;
export const ROW_PITCH = 3.6;
/** The wind-ups' loops run this far from a row's centre line (the middle of the corridor). */
export const LOOP_OFFSET = 1.8;
export const LOOP_CHAMFER = 0.9;
/** Toys on a shelf: slots per shelf (the drawing stacks them), spread along its length. */
export const SLOTS = 4;

/** Sketch limits from the spec. The proof in README retunes these to the oracle. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 990, minDurationMs: 4000, maxDurationMs: 120_000, base: 500, maxPointsPerSec: 93, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1400, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 56, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1715, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 48, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 2110, minDurationMs: 4000, maxDurationMs: 180_000, base: 1400, maxPointsPerSec: 36, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 2605, minDurationMs: 4000, maxDurationMs: 210_000, base: 1800, maxPointsPerSec: 26, unitLabel: "pts", display: "int" },
};

// ---------- layout ----------

export interface Shelf {
   x: number;
   z: number;
   cat: Category;
   row: number;
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
   /** toys placed here so far */
   count: number;
}

/** state 0 = on the floor, 1 = carried, 2 = on its shelf */
export interface Toy {
   x: number;
   z: number;
   cat: Category;
   state: 0 | 1 | 2;
   shelf: number;
   slot: number;
   spin: number;
}

export interface Windup {
   kind: "robot" | "car";
   row: number;
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   yaw: number;
   state: PatrolState;
   route: Path;
}

export interface StepEvents {
   score: number;
   won: boolean;
   /** the toy picked up this frame, or -1 */
   pick: number;
   /** the shelf a toy went onto this frame, or -1 */
   right: number;
   rightToy: number;
   /** a wrong drop this frame (the toy is back on the floor at the shelf) */
   wrong: boolean;
   wrongToy: number;
   hit: boolean;
}

export interface Run {
   seed: number;
   level: ToyLevel;
   hx: number;
   hz: number;
   start: { x: number; z: number };
   hero: { x: number; z: number; vx: number; vz: number; yaw: number; stun: number };
   shelves: Shelf[];
   toys: Toy[];
   /** toy indices in pickup order; the last is the top */
   carried: number[];
   windups: Windup[];
   score: number;
   placed: number;
   /** a wrong drop happened since the previous right one */
   wrongSince: boolean;
   mercy: number;
   over: "win" | null;
   time: number;
   ev: StepEvents;
}

export interface ToyInput {
   moveX: number;
   moveY: number;
   /** the Use button went down this frame (actionPressed) */
   use: boolean;
   /** camera yaw, the same value useFittedView returns; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): ToyInput => ({ moveX: 0, moveY: 0, use: false, yaw: 0 });

export const rowsOf = (level: ToyLevel): number => level.aisles;

/** How many shelves row `r` holds: the shelves go to the rows in turn. */
export function rowCount(level: ToyLevel, r: number): number {
   const s = shelvesOf(level);
   return Math.floor(s / level.aisles) + (r < s % level.aisles ? 1 : 0);
}

export const maxRowCount = (level: ToyLevel): number => Math.ceil(shelvesOf(level) / level.aisles);

export function storeHalf(level: ToyLevel): { hx: number; hz: number } {
   const n = maxRowCount(level);
   const rowHalf = (n * SHELF_LEN + (n - 1) * SHELF_GAP) / 2;
   return { hx: rowHalf + LOOP_OFFSET + 1.2, hz: ((level.aisles - 1) * ROW_PITCH) / 2 + LOOP_OFFSET + 1.4 };
}

export const rowZ = (level: ToyLevel, r: number): number => (r - (level.aisles - 1) / 2) * ROW_PITCH;

export function startOf(level: ToyLevel): { x: number; z: number } {
   const { hx, hz } = storeHalf(level);
   return { x: -hx + 1.6, z: hz - 1.4 };
}

/** The distance from a point to a shelf's box (0 inside). */
export function distanceToShelf(s: Shelf, x: number, z: number): number {
   const dx = Math.max(s.minX - x, 0, x - s.maxX);
   const dz = Math.max(s.minZ - z, 0, z - s.maxZ);
   return Math.hypot(dx, dz);
}

export function standable(run: Run, x: number, z: number, radius = RADIUS): boolean {
   if (Math.abs(x) > run.hx - radius || Math.abs(z) > run.hz - radius) return false;
   for (const s of run.shelves) if (distanceToShelf(s, x, z) < radius) return false;
   return true;
}

/** Eight waypoints round a row: its rectangle `LOOP_OFFSET` out, corners cut. */
export function loopPoints(level: ToyLevel, row: number, clockwise: boolean): Array<{ x: number; y: number; z: number }> {
   const n = rowCount(level, row);
   const half = (n * SHELF_LEN + (n - 1) * SHELF_GAP) / 2 + LOOP_OFFSET;
   const z = rowZ(level, row);
   const c = LOOP_CHAMFER;
   const zo = LOOP_OFFSET;
   const p = (x: number, zz: number) => ({ x, y: 0, z: zz });
   const pts = [
      p(-half + c, z - zo), p(half - c, z - zo), p(half, z - zo + c), p(half, z + zo - c),
      p(half - c, z + zo), p(-half + c, z + zo), p(-half, z + zo - c), p(-half, z - zo + c),
   ];
   return clockwise ? pts : pts.reverse();
}

function shuffle<T>(items: T[], rng: () => number): T[] {
   for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
   }
   return items;
}

function build(seed: number, attempt: number, level: ToyLevel): Run | null {
   const rng = createRng((seed + attempt * 7919) >>> 0);
   const { hx, hz } = storeHalf(level);
   const start = startOf(level);
   const run: Run = {
      seed: seed >>> 0,
      level,
      hx,
      hz,
      start,
      hero: { x: start.x, z: start.z, vx: 0, vz: 0, yaw: 0, stun: 0 },
      shelves: [],
      toys: [],
      carried: [],
      windups: [],
      score: 0,
      placed: 0,
      wrongSince: false,
      mercy: 0,
      over: null,
      time: 0,
      ev: { score: 0, won: false, pick: -1, right: -1, rightToy: -1, wrong: false, wrongToy: -1, hit: false },
   };

   const kinds: Category[] = [];
   for (let s = 0; s < level.shelvesPerCategory; s++) for (let c = 0; c < level.categories; c++) kinds.push(CATEGORIES[c]);
   shuffle(kinds, rng);
   let k = 0;
   for (let r = 0; r < level.aisles; r++) {
      const n = rowCount(level, r);
      for (let i = 0; i < n; i++) {
         const x = (i - (n - 1) / 2) * (SHELF_LEN + SHELF_GAP);
         const z = rowZ(level, r);
         run.shelves.push({
            x, z, cat: kinds[k++], row: r,
            minX: x - SHELF_LEN / 2, maxX: x + SHELF_LEN / 2, minZ: z - SHELF_DEPTH / 2, maxZ: z + SHELF_DEPTH / 2, count: 0,
         });
      }
   }

   const cats: Category[] = [];
   for (let i = 0; i < level.toys; i++) cats.push(CATEGORIES[i % level.categories]);
   shuffle(cats, rng);
   for (const cat of cats) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
         const x = -hx + 1 + (hx * 2 - 2) * rng();
         const z = -hz + 1 + (hz * 2 - 2) * rng();
         if (!standable(run, x, z, RADIUS + 0.2)) continue;
         if (Math.hypot(x - start.x, z - start.z) < 2.5) continue;
         if (run.toys.some((t) => Math.hypot(t.x - x, t.z - z) < 1.5)) continue;
         run.toys.push({ x, z, cat, state: 0, shelf: -1, slot: 0, spin: rng() * Math.PI * 2 });
         placed = true;
      }
      if (!placed) return null;
   }

   for (let w = 0; w < level.windups; w++) {
      const row = w % level.aisles;
      const pts = loopPoints(level, row, w % 2 === 0);
      const route = createPath(pts, { closed: true });
      for (let tries = 0; tries < 20; tries++) {
         const at = Math.floor(rng() * pts.length);
         if (Math.hypot(pts[at].x - start.x, pts[at].z - start.z) < 6) continue;
         const next = (at + 1) % pts.length;
         run.windups.push({
            kind: w % 2 === 0 ? "robot" : "car", row, x: pts[at].x, y: 0, z: pts[at].z, vx: 0, vy: 0, vz: 0,
            yaw: Math.atan2(pts[next].x - pts[at].x, pts[next].z - pts[at].z),
            state: { index: next, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } }, route,
         });
         break;
      }
      if (run.windups.length <= w) return null;
   }
   return run;
}

export function createRun(seed: number, level: ToyLevel = LEVELS[1]): Run {
   for (let attempt = 0; attempt < 80; attempt++) {
      const run = build(seed, attempt, level);
      if (run && objectivesReachable(run)) return run;
   }
   throw new Error(`toy store layout unreachable (seed ${seed})`);
}

// ---------- reachability ----------

const CELL = 0.3;

function flood(run: Run): { cols: number; rows: number; seen: Uint8Array } {
   const cols = Math.ceil((run.hx * 2) / CELL) + 1;
   const rows = Math.ceil((run.hz * 2) / CELL) + 1;
   const open = new Uint8Array(cols * rows);
   const seen = new Uint8Array(cols * rows);
   for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (standable(run, -run.hx + c * CELL, -run.hz + r * CELL, RADIUS * 0.95)) open[r * cols + c] = 1;
   const qx = new Int32Array(cols * rows);
   const qz = new Int32Array(cols * rows);
   let head = 0;
   let tail = 0;
   const push = (c: number, r: number) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      const id = r * cols + c;
      if (!open[id] || seen[id]) return;
      seen[id] = 1;
      qx[tail] = c;
      qz[tail] = r;
      tail += 1;
   };
   push(Math.round((run.start.x + run.hx) / CELL), Math.round((run.start.z + run.hz) / CELL));
   while (head < tail) {
      const c = qx[head];
      const r = qz[head];
      head += 1;
      push(c + 1, r);
      push(c - 1, r);
      push(c, r + 1);
      push(c, r - 1);
   }
   return { cols, rows, seen };
}

/** Every toy can be picked up and every shelf's front reached (Use within 1.0 m) from the start. */
export function objectivesReachable(run: Run): boolean {
   const g = flood(run);
   const at = (c: number, r: number) => (c >= 0 && r >= 0 && c < g.cols && r < g.rows ? g.seen[r * g.cols + c] : 0);
   const near = (test: (x: number, z: number) => boolean, x: number, z: number, within: number): boolean => {
      const span = Math.ceil(within / CELL) + 1;
      const c0 = Math.round((x + run.hx) / CELL);
      const r0 = Math.round((z + run.hz) / CELL);
      for (let r = r0 - span; r <= r0 + span; r++) {
         for (let c = c0 - span; c <= c0 + span; c++) {
            if (at(c, r) && test(-run.hx + c * CELL, -run.hz + r * CELL)) return true;
         }
      }
      return false;
   };
   for (const t of run.toys) if (!near((x, z) => Math.hypot(x - t.x, z - t.z) <= REACH - 0.25, t.x, t.z, REACH)) return false;
   for (const s of run.shelves) {
      if (!near((x, z) => distanceToShelf(s, x, z) <= REACH - 0.25, s.x, s.z, SHELF_LEN / 2 + REACH)) return false;
   }
   return true;
}

// ---------- step ----------

const DIR = { x: 0, z: 0 };

function slide(run: Run): void {
   const h = run.hero;
   for (let pass = 0; pass < 2; pass++) {
      for (const s of run.shelves) {
         const cx = Math.min(Math.max(h.x, s.minX), s.maxX);
         const cz = Math.min(Math.max(h.z, s.minZ), s.maxZ);
         const dx = h.x - cx;
         const dz = h.z - cz;
         const d2 = dx * dx + dz * dz;
         if (d2 >= RADIUS * RADIUS) continue;
         const d = Math.sqrt(d2);
         let nx: number;
         let nz: number;
         if (d > 1e-6) {
            nx = dx / d;
            nz = dz / d;
         } else {
            // centre inside the box: leave by the nearest face
            const toLeft = h.x - s.minX;
            const toRight = s.maxX - h.x;
            const toTop = h.z - s.minZ;
            const toBottom = s.maxZ - h.z;
            const m = Math.min(toLeft, toRight, toTop, toBottom);
            nx = m === toLeft ? -1 : m === toRight ? 1 : 0;
            nz = m === toTop ? -1 : m === toBottom ? 1 : 0;
            if (nx === 0 && nz === 0) nz = 1;
         }
         h.x = cx + nx * RADIUS;
         h.z = cz + nz * RADIUS;
         const vn = h.vx * nx + h.vz * nz;
         if (vn < 0) {
            h.vx -= vn * nx;
            h.vz -= vn * nz;
         }
      }
      const maxX = run.hx - RADIUS;
      const maxZ = run.hz - RADIUS;
      if (h.x > maxX) { h.x = maxX; if (h.vx > 0) h.vx = 0; }
      if (h.x < -maxX) { h.x = -maxX; if (h.vx < 0) h.vx = 0; }
      if (h.z > maxZ) { h.z = maxZ; if (h.vz > 0) h.vz = 0; }
      if (h.z < -maxZ) { h.z = -maxZ; if (h.vz < 0) h.vz = 0; }
   }
}

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** Objective points only: every toy with the clean bonus. The clock bonus is separate and win-only. */
export function objectiveCeiling(level: ToyLevel): number {
   return (RIGHT_POINTS + CLEAN_POINTS) * level.toys;
}

/** The nearest shelf within reach, or -1. */
export function shelfInReach(run: Run): number {
   let best = -1;
   let bestD = REACH;
   for (let i = 0; i < run.shelves.length; i++) {
      const d = distanceToShelf(run.shelves[i], run.hero.x, run.hero.z);
      if (d <= bestD) { bestD = d; best = i; }
   }
   return best;
}

/** The nearest floor toy within reach, or -1. */
export function toyInReach(run: Run): number {
   let best = -1;
   let bestD = REACH;
   for (let i = 0; i < run.toys.length; i++) {
      if (run.toys[i].state !== 0) continue;
      const d = Math.hypot(run.toys[i].x - run.hero.x, run.toys[i].z - run.hero.z);
      if (d <= bestD) { bestD = d; best = i; }
   }
   return best;
}

function use(run: Run): void {
   const ev = run.ev;
   const h = run.hero;
   const toy = toyInReach(run);
   const shelf = shelfInReach(run);
   const cap = run.level.carry;
   const canDrop = run.carried.length > 0 && shelf >= 0;
   const canPick = run.carried.length < cap && toy >= 0;
   // with both in reach, a matching shelf takes the drop; a wrong one never steals the pick-up
   const matches = canDrop && run.toys[run.carried[run.carried.length - 1]].cat === run.shelves[shelf].cat;
   if (canDrop && (!canPick || matches)) {
      const index = run.carried[run.carried.length - 1];
      const t = run.toys[index];
      const s = run.shelves[shelf];
      run.carried.pop();
      if (t.cat === s.cat) {
         t.state = 2;
         t.shelf = shelf;
         t.slot = s.count;
         s.count += 1;
         run.placed += 1;
         const pts = RIGHT_POINTS + (run.wrongSince ? 0 : CLEAN_POINTS);
         run.wrongSince = false;
         run.score += pts;
         ev.score += pts;
         ev.right = shelf;
         ev.rightToy = index;
      } else {
         // back on the floor in front of the shelf, 0.55 m off its face
         const cx = Math.min(Math.max(h.x, s.minX), s.maxX);
         const cz = Math.min(Math.max(h.z, s.minZ), s.maxZ);
         let dx = h.x - cx;
         let dz = h.z - cz;
         const d = Math.hypot(dx, dz) || 1;
         dx /= d;
         dz /= d;
         t.state = 0;
         t.x = cx + dx * 0.55;
         t.z = cz + dz * 0.55;
         if (!standable(run, t.x, t.z, 0.1)) {
            t.x = h.x;
            t.z = h.z;
         }
         h.stun = STUN_S;
         run.wrongSince = true;
         ev.wrong = true;
         ev.wrongToy = index;
      }
   } else if (canPick) {
      run.toys[toy].state = 1;
      run.carried.push(toy);
      ev.pick = toy;
   }
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share
 * this function: only `use` and the stick axes matter, for the same stun and mercy on both devices.
 */
export function step(run: Run, input: ToyInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.won = false;
   ev.pick = -1;
   ev.right = -1;
   ev.rightToy = -1;
   ev.wrong = false;
   ev.wrongToy = -1;
   ev.hit = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   run.mercy = Math.max(0, run.mercy - dt);
   const h = run.hero;
   const stunned = h.stun > 0;
   if (stunned) h.stun = Math.max(0, h.stun - dt);

   for (const w of run.windups) stepPatrol(w, w.state, w.route, dt, { speed: run.level.windupSpeed });

   inputToWorld(stunned ? 0 : input.moveX, stunned ? 0 : input.moveY, input.yaw, DIR);
   let len = Math.hypot(DIR.x, DIR.z);
   if (len > 1) {
      DIR.x /= len;
      DIR.z /= len;
      len = 1;
   }
   const top = MAX_SPEED * (run.carried.length > 0 ? CARRY_SPEED : 1);
   let dvx = DIR.x * top - h.vx;
   let dvz = DIR.z * top - h.vz;
   const dv = Math.hypot(dvx, dvz);
   const cap = (len > 0.01 ? ACCEL : BRAKE) * dt;
   if (dv > cap && dv > 0) {
      dvx *= cap / dv;
      dvz *= cap / dv;
   }
   h.vx += dvx;
   h.vz += dvz;
   h.x += h.vx * dt;
   h.z += h.vz * dt;
   slide(run);
   if (Math.hypot(h.vx, h.vz) > 0.25) h.yaw = turnTowards(h.yaw, Math.atan2(h.vx, h.vz), Math.min(1, dt * 12));

   if (input.use && !stunned) use(run);

   if (run.mercy <= 0) {
      for (const w of run.windups) {
         if (Math.hypot(h.x - w.x, h.z - w.z) > WINDUP_HIT) continue;
         // everything carried falls where the guard stands
         run.carried.forEach((index, k) => {
            const t = run.toys[index];
            t.state = 0;
            const a = (k + 1) * 2.1 + run.time;
            t.x = h.x + Math.cos(a) * 0.45;
            t.z = h.z + Math.sin(a) * 0.45;
            if (!standable(run, t.x, t.z, 0.1)) {
               t.x = h.x;
               t.z = h.z;
            }
         });
         run.carried.length = 0;
         run.mercy = MERCY_S;
         ev.hit = true;
         break;
      }
   }

   if (run.placed === run.toys.length && run.toys.length > 0) {
      const bonus = timeBonus(timeLeftMs);
      run.score += bonus;
      ev.score += bonus;
      run.over = "win";
      ev.won = true;
   }
   return ev;
}

/** Where the marker points: the shelf for the carried toy, else the nearest floor toy. */
export function nextTarget(run: Run): { x: number; z: number } | null {
   const h = run.hero;
   if (run.carried.length > 0) {
      const cat = run.toys[run.carried[run.carried.length - 1]].cat;
      let best: Shelf | null = null;
      let bestD = Infinity;
      for (const s of run.shelves) {
         if (s.cat !== cat) continue;
         const d = Math.hypot(s.x - h.x, s.z - h.z);
         if (d < bestD) { bestD = d; best = s; }
      }
      return best ? { x: best.x, z: best.z + SHELF_DEPTH / 2 + 0.6 } : null;
   }
   let best: Toy | null = null;
   let bestD = Infinity;
   for (const t of run.toys) {
      if (t.state !== 0) continue;
      const d = Math.hypot(t.x - h.x, t.z - h.z);
      if (d < bestD) { bestD = d; best = t; }
   }
   return best ? { x: best.x, z: best.z } : null;
}
