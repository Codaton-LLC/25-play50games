// Cat vs Robot Vacuum rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// One hall along +z (x in [-2.4, 2.4], six-metre rooms). Furniture and clutter sit in the side
// bays only, so the centre lane (|x| <= 1.0) is always open: every treat and the bed are reachable
// (levels.test.ts floods 200 seeds). The vacuums patrol that lane; the sofa blocks their sight.
import type { AABB, Vec3Like } from "@/arcade3d/core/collision";
import { hasLineOfSightXZ, type Agent } from "@/arcade3d/core/ai";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { createPath, nearestS, pointAt, tangentAt, type Path } from "@/arcade3d/core/path";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type CatLevel } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

export const LIVES = 3;
export const TREAT_POINTS = 30;
export const STREAK_POINTS = 5;
export const STREAK_CAP = 15;
/** A treat within this many play seconds of the last one extends the streak. */
export const STREAK_WINDOW_S = 4;
export const TOY_POINTS = 20;
/** Win only: points per full second left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;

export const RADIUS = 0.28;
export const MAX_SPEED = 4.2;
export const ACCEL = 22;
export const BRAKE = 28;
/** Pickups (treat, toy) collect when the cat's centre is this close. Same for every device. */
export const PICKUP_R = 0.5;
/** A hop is a short i-frame: the vacuum overlap is ignored for HOP_S. */
export const HOP_S = 0.45;
export const HOP_H = 0.4;
/** Hops cannot be chained: the next one waits HOP_GAP_S after the last one ends. */
export const HOP_GAP_S = 0.3;
/** After a hit the cat is safe for MERCY_S. */
export const MERCY_S = 0.8;
export const VAC_R = 0.36;
export const VAC_X = 0.6;
/** Patrol loop z (the first and last corner, from the hall ends). */
export const LOOP_INSET = 1.2;
export const CHASE_S = 4;
/** No chase in the first seconds of a run, so a vacuum that starts near the cat cannot hit it at once. */
export const CHASE_GRACE_S = 3;
/** After a chase the vacuum drives back to the nearest point of its loop at this multiple of its patrol speed. */
export const RETURN_FACTOR = 1.3;
/** A loop vacuum this close (along the loop) behind another waits, so they never stack. */
export const SEP_GAP = 3;
/** A returning vacuum turns harmful again only with the cat at least this far from its edge. */
export const REJOIN_CLEAR = 1.0;
/** Back on its loop after a chase, a vacuum patrols this long before it may chase again. */
export const CHASE_REST_S = 2.5;
/** Vacuums spawn at least this far (along the loop) from its start corner, by the cat's start. */
export const SPAWN_CLEAR = 6;
/** Standing this close to the bed centre counts as on the bed. */
export const HOME_R = 1.0;

export const HALL_HALF = 2.4;
export const LANE_HALF = 1.0;
export const ROOM_LEN = 6;
export const START = { x: 0, z: 0.8 } as const;
/** Bed and sofa centres sit in the bay; the shelf sits against the wall. */
export const BAY_X = 1.75;
export const SHELF_X = 2.05;
/** The cat's spot on the lane side of the bed, used after a hit. */
export const HOME_LANE_X = 0.85;
export const CLUTTER_HALF = 0.25;
/** the cat box GLB at 0.5 m across is 0.335 m tall (assets.ts) */
export const CLUTTER_H = 0.335;

/**
 * Solid boxes (x across the hall, z along it), sized to the fitted GLBs (assets.test.ts): the sofa,
 * table and shelf GLBs are long in their own x, so they stand turned a quarter, facing the lane.
 * Heights stay low (the shelf is a low bookcase) so no piece hides the cat from the camera.
 */
export const FURN_SIZE = {
   sofa: { x: 0.9, y: 0.72, z: 1.9 },
   bed: { x: 1.2, y: 0.6, z: 1.9 },
   table: { x: 0.88, y: 0.72, z: 1.8 },
   bookshelf: { x: 0.37, y: 1.15, z: 1.4 },
} as const;

export type FurnKind = keyof typeof FURN_SIZE;

/** Rooms after the bed take these in turn. */
const FURN_CYCLE: readonly FurnKind[] = ["sofa", "bookshelf", "table"];

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/**
 * Per level (README "Server limits and why they hold"): base = Bobj = 45 treats + 20 toys (every treat at
 * its streak cap, every toy); the win bonus 4 floor(D - t) is largest at the earliest win M, so maxScore
 * >= Bobj + 4 floor(D - M) (+3 %) and pps >= 4 (D / M - 1). M = 0.8 x the fastest oracle / greedy win
 * over 200 seeds at 30 / 60 / 144 Hz (PROOF_EARLIEST_WIN_S, pinned by the proof tests).
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 380, D 90 s, M 4.3 s → peak 720; pps 79.7 */
   1: { ...PTS, maxScore: 745, minDurationMs: 4000, maxDurationMs: 90_000, base: 380, maxPointsPerSec: 81 },
   /** L2: Bobj 560, D 120 s, M 12.73 s → peak 988; pps 33.7 */
   2: { ...PTS, maxScore: 1020, minDurationMs: 4000, maxDurationMs: 120_000, base: 560, maxPointsPerSec: 35 },
   /** L3: Bobj 760, D 150 s, M 11.23 s → peak 1312; pps 49.4 */
   3: { ...PTS, maxScore: 1355, minDurationMs: 4000, maxDurationMs: 150_000, base: 760, maxPointsPerSec: 51 },
   /** L4: Bobj 940, D 150 s, M 16.32 s → peak 1472; pps 32.8 */
   4: { ...PTS, maxScore: 1520, minDurationMs: 4000, maxDurationMs: 150_000, base: 940, maxPointsPerSec: 34 },
   /** L5: Bobj 1185, D 180 s, M 21.97 s → peak 1817; pps 28.8 */
   5: { ...PTS, maxScore: 1875, minDurationMs: 4000, maxDurationMs: 180_000, base: 1185, maxPointsPerSec: 30 },
};

/** The earliest win each proof assumes (s): 0.8 x the fastest bot win (tests pin it). */
export const PROOF_EARLIEST_WIN_S: Record<LevelId, number> = { 1: 4.3, 2: 12.73, 3: 11.23, 4: 16.32, 5: 21.97 };

// ---------- state ----------

export interface Furniture {
   kind: FurnKind;
   x: number;
   z: number;
   /** visual turn: a turned piece faces the lane */
   rotY: number;
   box: AABB;
}

export interface Pickup {
   x: number;
   z: number;
   got: boolean;
}

export interface Cat extends Vec3Like {
   vx: number;
   vz: number;
   yaw: number;
   /** seconds of hop left (i-frames while > 0) */
   hop: number;
   /** seconds until the next hop may start */
   cool: number;
   /** seconds of mercy left after a hit */
   mercy: number;
}

export interface Vacuum {
   agent: Agent;
   /** its place on the loop (arc length) while it patrols */
   ghost: number;
   /** "patrol" = on its place on the loop; "chase" = after the cat; "return" = back to its place */
   mode: "patrol" | "chase" | "return";
   /** seconds of chase left */
   chase: number;
   /** seconds before it may chase again */
   rest: number;
   /** a returning vacuum that reached its loop rides it, still harmless, until the cat is clear */
   docked: boolean;
}

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   hop: boolean;
   /** index of a treat collected this frame, or -1 */
   treat: number;
   /** index of a toy collected this frame, or -1 */
   toy: number;
}

export interface Run {
   level: CatLevel;
   /** hall length (m): rooms * ROOM_LEN */
   length: number;
   /** what the store last got, so the HUD updates only on a change */
   synced: { treats: number; hop: number };
   time: number;
   over: "win" | "lose" | null;
   lives: number;
   score: number;
   collected: number;
   streak: number;
   /** run time of the last treat (-Infinity before the first) */
   lastTreat: number;
   cat: Cat;
   treats: Pickup[];
   toys: Pickup[];
   furniture: Furniture[];
   clutter: AABB[];
   /** furniture and clutter boxes: solid for the cat and the vacuums, and they block sight */
   blockers: AABB[];
   home: { x: number; z: number };
   homeSpot: { x: number; z: number };
   route: Path;
   vacuums: Vacuum[];
   ev: StepEvents;
}

export interface CatInput {
   moveX: number;
   moveY: number;
   jumpPressed: boolean;
   yaw: number;
}

export const idleInput = (): CatInput => ({ moveX: 0, moveY: 0, jumpPressed: false, yaw: 0 });

// ---------- layout ----------

const DIR = { x: 0, z: 0 };

const sideOf = (room: number) => (room % 2 === 0 ? 1 : -1);

function boxAt(x: number, z: number, half: { x: number; z: number }, height: number): AABB {
   return { min: { x: x - half.x, y: 0, z: z - half.z }, max: { x: x + half.x, y: height, z: z + half.z } };
}

/** Distance test that keeps a pickup reachable: the cat's edge must fit beside it. */
function pickupSpotOk(x: number, z: number, run: { blockers: AABB[]; home: { x: number; z: number }; placed: Vec3Like[]; length: number }): boolean {
   const margin = RADIUS + 0.2;
   for (const box of run.blockers) {
      if (x > box.min.x - margin && x < box.max.x + margin && z > box.min.z - margin && z < box.max.z + margin) return false;
   }
   if (Math.hypot(x - START.x, z - START.z) < 2) return false;
   if (Math.hypot(x - run.home.x, z - run.home.z) < 1.5) return false;
   for (const p of run.placed) if (Math.hypot(x - p.x, z - p.z) < 1.5) return false;
   return Math.abs(x) <= 2 && z >= 0.8 && z <= run.length - 0.8;
}

function placePickups(count: number, rng: () => number, run: { blockers: AABB[]; home: { x: number; z: number }; placed: Vec3Like[]; length: number }, out: Pickup[]) {
   for (let tries = 0; out.length < count; tries++) {
      if (tries > 4000) throw new Error("cat-vs-robot-vacuum: no room for every pickup");
      const x = (rng() * 2 - 1) * 2;
      const z = 0.8 + rng() * (run.length - 1.6);
      if (!pickupSpotOk(x, z, run)) continue;
      out.push({ x, z, got: false });
      run.placed.push({ x, y: 0, z });
   }
}

/** Furniture, clutter, the bed, the treats and toys, and the vacuums' loop, for one seed. */
export function createRun(seed: number, level: CatLevel = LEVELS[1]): Run {
   const rng = createRng(seed);
   const length = level.rooms * ROOM_LEN;
   const furniture: Furniture[] = [];
   for (let i = 0; i < level.rooms; i++) {
      const kind: FurnKind = i === 0 ? "bed" : FURN_CYCLE[(i - 1) % FURN_CYCLE.length];
      const side = sideOf(i);
      const x = side * (kind === "bookshelf" ? SHELF_X : BAY_X);
      const z = i * ROOM_LEN + ROOM_LEN / 2 + (rng() * 2 - 1) * 0.6;
      const size = FURN_SIZE[kind];
      const rotY = kind === "bed" ? 0 : side > 0 ? -Math.PI / 2 : Math.PI / 2;
      furniture.push({ kind, x, z, rotY, box: boxAt(x, z, { x: size.x / 2, z: size.z / 2 }, size.y) });
   }
   // Clutter goes in the free bay of rooms 1 and up, two pieces per room at most.
   const clutter: AABB[] = [];
   const spare = Math.max(1, level.rooms - 1);
   for (let k = 0; k < level.clutter; k++) {
      const room = 1 + (k % spare);
      const offset = k < spare ? 1.5 : 4.5;
      const x = -sideOf(room) * BAY_X;
      const z = room * ROOM_LEN + offset + (rng() * 2 - 1) * 0.3;
      clutter.push(boxAt(x, z, { x: CLUTTER_HALF, z: CLUTTER_HALF }, CLUTTER_H));
   }
   const blockers = [...furniture.map((f) => f.box), ...clutter];
   const bed = furniture[0];
   const home = { x: bed.x, z: bed.z };
   const homeSpot = { x: sideOf(0) * HOME_LANE_X, z: bed.z };

   const treats: Pickup[] = [];
   const toys: Pickup[] = [];
   const placed: Vec3Like[] = [];
   const ctx = { blockers, home, placed, length };
   placePickups(level.treats, rng, ctx, treats);
   placePickups(level.toys, rng, ctx, toys);

   const z0 = LOOP_INSET;
   const z1 = length - LOOP_INSET;
   const corners = [
      { x: VAC_X, y: 0, z: z0 },
      { x: VAC_X, y: 0, z: z1 },
      { x: -VAC_X, y: 0, z: z1 },
      { x: -VAC_X, y: 0, z: z0 },
   ];
   const route = createPath(corners, { closed: true });
   const vacuums: Vacuum[] = [];
   for (let k = 0; k < level.vacuums; k++) {
      // Spread over the loop away from the cat's start: the arc from 5 m past corner 0 to 5 m before it.
      const span = route.total - 2 * SPAWN_CLEAR;
      const ghost = SPAWN_CLEAR + ((k + 0.5) * span) / Math.max(1, level.vacuums);
      const p = pointAt(route, ghost);
      vacuums.push({ agent: { x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0, yaw: 0 }, ghost, mode: "patrol", chase: 0, rest: 0, docked: false });
   }

   return {
      level,
      length,
      synced: { treats: -1, hop: -1 },
      time: 0,
      over: null,
      lives: LIVES,
      score: 0,
      collected: 0,
      streak: 0,
      lastTreat: -Infinity,
      cat: { x: START.x, y: 0, z: START.z, vx: 0, vz: 0, yaw: 0, hop: 0, cool: 0, mercy: 0 },
      treats,
      toys,
      furniture,
      clutter,
      blockers,
      home,
      homeSpot,
      route,
      vacuums,
      ev: { score: 0, lifeLost: false, won: false, lost: false, hop: false, treat: -1, toy: -1 },
   };
}

/** Most points a full clear can score before the time bonus: every treat at its streak cap, every toy. */
export function objectiveCeiling(level: CatLevel): number {
   return (TREAT_POINTS + STREAK_CAP) * level.treats + TOY_POINTS * level.toys;
}

/** Win only: full seconds left on the shell clock. */
export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** Is the cat standing on the bed pad? */
export function onBed(run: Run): boolean {
   return Math.hypot(run.cat.x - run.home.x, run.cat.z - run.home.z) <= HOME_R;
}

// ---------- the cat ----------

function approach(value: number, target: number, maxDelta: number): number {
   const diff = target - value;
   if (diff > maxDelta) return value + maxDelta;
   if (diff < -maxDelta) return value - maxDelta;
   return target;
}

/** Pushes a circle (XZ) out of one box. Pure; the centre inside a box leaves by its nearest side. */
export function pushOutXZ(p: Vec3Like, radius: number, box: AABB): void {
   const cx = Math.min(Math.max(p.x, box.min.x), box.max.x);
   const cz = Math.min(Math.max(p.z, box.min.z), box.max.z);
   const dx = p.x - cx;
   const dz = p.z - cz;
   const d2 = dx * dx + dz * dz;
   if (d2 >= radius * radius) return;
   if (d2 > 0) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * radius;
      p.z = cz + (dz / d) * radius;
      return;
   }
   const left = p.x - box.min.x;
   const right = box.max.x - p.x;
   const down = p.z - box.min.z;
   const up = box.max.z - p.z;
   const m = Math.min(left, right, down, up);
   if (m === left) p.x = box.min.x - radius;
   else if (m === right) p.x = box.max.x + radius;
   else if (m === down) p.z = box.min.z - radius;
   else p.z = box.max.z + radius;
}

function pushOutAll(p: Vec3Like, radius: number, boxes: readonly AABB[]): void {
   for (let i = 0; i < boxes.length; i++) pushOutXZ(p, radius, boxes[i]);
}

/** The hall walls: keeps a circle of `radius` inside x in ±HALL_HALF and z in [0, length]; returns true on contact. */
export function clampToHall(p: Vec3Like, radius: number, length: number): boolean {
   const hx = HALL_HALF - radius;
   let hit = false;
   if (p.x < -hx || p.x > hx) {
      p.x = Math.max(-hx, Math.min(hx, p.x));
      hit = true;
   }
   if (p.z < radius || p.z > length - radius) {
      p.z = Math.max(radius, Math.min(length - radius, p.z));
      hit = true;
   }
   return hit;
}

function integrate(cat: Cat, dirX: number, dirZ: number, dt: number): void {
   const moving = dirX !== 0 || dirZ !== 0;
   const rate = (moving ? ACCEL : BRAKE) * dt;
   cat.vx = approach(cat.vx, dirX * MAX_SPEED, rate);
   cat.vz = approach(cat.vz, dirZ * MAX_SPEED, rate);
   cat.x += cat.vx * dt;
   cat.z += cat.vz * dt;
   if (Math.hypot(cat.vx, cat.vz) > 0.3) cat.yaw = turnTowards(cat.yaw, Math.atan2(cat.vx, cat.vz), Math.min(1, dt * 12));
}

function award(run: Run, ev: StepEvents, points: number): void {
   run.score += points;
   ev.score += points;
}

function near(cat: Vec3Like, p: Pickup): boolean {
   const dx = cat.x - p.x;
   const dz = cat.z - p.z;
   return dx * dx + dz * dz <= PICKUP_R * PICKUP_R;
}

function collect(run: Run, ev: StepEvents): void {
   for (let i = 0; i < run.treats.length; i++) {
      const treat = run.treats[i];
      if (treat.got || !near(run.cat, treat)) continue;
      treat.got = true;
      run.collected += 1;
      const chained = run.time - run.lastTreat <= STREAK_WINDOW_S + 1e-9;
      run.streak = chained ? run.streak + 1 : 1;
      run.lastTreat = run.time;
      award(run, ev, TREAT_POINTS + Math.min(STREAK_CAP, STREAK_POINTS * (run.streak - 1)));
      ev.treat = i;
   }
   for (let i = 0; i < run.toys.length; i++) {
      const toy = run.toys[i];
      if (toy.got || !near(run.cat, toy)) continue;
      toy.got = true;
      award(run, ev, TOY_POINTS);
      ev.toy = i;
   }
}

// ---------- the vacuums ----------

function sees(run: Run, v: Vacuum): boolean {
   if (run.time < CHASE_GRACE_S) return false;
   const cat = run.cat;
   const d = Math.hypot(cat.x - v.agent.x, cat.z - v.agent.z);
   return d <= run.level.chaseRange && hasLineOfSightXZ(v.agent, cat, run.blockers);
}

const GHOST = { x: 0, y: 0, z: 0 };
const TANGENT = { x: 0, y: 0, z: 0 };

/** Drives a vacuum towards (x, z) at `speed`; true once there. */
function driveTo(a: Agent, x: number, z: number, speed: number, dt: number): boolean {
   const dx = x - a.x;
   const dz = z - a.z;
   const d = Math.hypot(dx, dz);
   if (d <= speed * dt || d < 1e-9) {
      a.x = x;
      a.z = z;
      return true;
   }
   a.x += (dx / d) * speed * dt;
   a.z += (dz / d) * speed * dt;
   a.vx = (dx / d) * speed;
   a.vz = (dz / d) * speed;
   a.yaw = Math.atan2(dx, dz);
   return false;
}

function stepVacuum(run: Run, v: Vacuum, dt: number): void {
   const a = v.agent;
   const level = run.level;
   const total = run.route.total;
   if (v.mode === "patrol") v.rest = Math.max(0, v.rest - dt);
   // sees() is false at a chase range of 0 (level 1)
   if (v.mode === "patrol" && v.rest <= 0 && sees(run, v)) {
      v.mode = "chase";
      v.chase = CHASE_S;
   }
   if (v.mode === "chase") {
      v.chase = Math.max(0, v.chase - dt);
      driveTo(a, run.cat.x, run.cat.z, level.chaseSpeed, dt);
      pushOutAll(a, VAC_R, run.blockers);
      clampToHall(a, VAC_R, run.length);
      // a cat hopping over it shakes it off: it gives up and goes back to its loop
      const hopped = run.cat.hop > 0 && Math.hypot(run.cat.x - a.x, run.cat.z - a.z) < RADIUS + VAC_R;
      if (v.chase === 0 || hopped) {
         v.chase = 0;
         v.mode = "return";
      }
      return;
   }
   if (v.mode === "return" && !v.docked) {
      const s0 = nearestS(run.route, a);
      pointAt(run.route, s0, GHOST);
      if (driveTo(a, GHOST.x, GHOST.z, level.patrolSpeed * RETURN_FACTOR, dt)) {
         v.docked = true;
         v.ghost = s0;
      }
      pushOutAll(a, VAC_R, run.blockers);
      return;
   }
   // on the loop (patrolling, or docked after a return): wait while another loop vacuum is just ahead
   let speed = level.patrolSpeed;
   let spaced = true;
   for (let k = 0; k < run.vacuums.length; k++) {
      const o = run.vacuums[k];
      if (o === v || o.mode === "chase" || (o.mode === "return" && !o.docked)) continue;
      const ahead = (((o.ghost - v.ghost) % total) + total) % total;
      const behind = (((v.ghost - o.ghost) % total) + total) % total;
      if (ahead < SEP_GAP || behind < SEP_GAP) spaced = false;
      if ((ahead > 0 && ahead < SEP_GAP) || (ahead === 0 && run.vacuums.indexOf(v) > k)) speed = 0;
   }
   // a docked vacuum turns harmful again only clear of the cat and spaced from the others
   if (v.mode === "return" && spaced && Math.hypot(run.cat.x - a.x, run.cat.z - a.z) >= RADIUS + VAC_R + REJOIN_CLEAR) {
      v.mode = "patrol";
      v.docked = false;
      v.rest = CHASE_REST_S;
   }
   v.ghost = (v.ghost + speed * dt) % total;
   pointAt(run.route, v.ghost, GHOST);
   tangentAt(run.route, v.ghost, TANGENT);
   a.x = GHOST.x;
   a.z = GHOST.z;
   a.vx = TANGENT.x * speed;
   a.vz = TANGENT.z * speed;
   a.yaw = Math.atan2(TANGENT.x, TANGENT.z);
}

// ---------- one frame ----------

function hit(run: Run, ev: StepEvents): void {
   const cat = run.cat;
   run.lives -= 1;
   ev.lifeLost = true;
   cat.x = run.homeSpot.x;
   cat.z = run.homeSpot.z;
   cat.vx = 0;
   cat.vz = 0;
   cat.hop = 0;
   cat.mercy = MERCY_S;
   for (const v of run.vacuums) {
      v.chase = 0;
      if (v.mode === "chase") v.mode = "return";
   }
   if (run.lives <= 0) {
      run.over = "lose";
      ev.lost = true;
   }
}

function overlapsVacuum(run: Run): boolean {
   const cat = run.cat;
   const r = RADIUS + VAC_R;
   for (const v of run.vacuums) {
      // a vacuum driving back to its loop (shaken off, or after its chase) is harmless until it is on it
      if (v.mode === "return") continue;
      const dx = cat.x - v.agent.x;
      const dz = cat.z - v.agent.z;
      if (dx * dx + dz * dz < r * r) return true;
   }
   return false;
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share
 * this function: only the stick axes and jumpPressed matter, for the same durations.
 */
export function step(run: Run, input: CatInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.hop = false;
   ev.treat = -1;
   ev.toy = -1;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;

   const cat = run.cat;
   cat.hop = Math.max(0, cat.hop - dt);
   cat.cool = Math.max(0, cat.cool - dt);
   cat.mercy = Math.max(0, cat.mercy - dt);
   if (input.jumpPressed && cat.hop <= 0 && cat.cool <= 0) {
      cat.hop = HOP_S;
      cat.cool = HOP_S + HOP_GAP_S;
      ev.hop = true;
   }

   inputToWorld(input.moveX, input.moveY, input.yaw, DIR);
   integrate(cat, DIR.x, DIR.z, dt);
   pushOutAll(cat, RADIUS, run.blockers);
   const ox = cat.x;
   const oz = cat.z;
   if (clampToHall(cat, RADIUS, run.length)) {
      if (cat.x !== ox) cat.vx = 0;
      if (cat.z !== oz) cat.vz = 0;
   }
   collect(run, ev);

   for (const v of run.vacuums) stepVacuum(run, v, dt);
   if (cat.hop <= 0 && cat.mercy <= 0 && overlapsVacuum(run)) {
      hit(run, ev);
      if (run.over) return ev;
   }

   if (run.collected === run.treats.length && onBed(run)) {
      award(run, ev, timeBonus(timeLeftMs));
      run.over = "win";
      ev.won = true;
   }
   return ev;
}

/** What the Scene and the bots hand the shell store after each step (only changes are written). */
export interface CatStore {
   getState(): {
      addScore(points: number): void;
      setStat(key: string, value: number): void;
      loseLife(): void;
      end(reason: "win"): void;
   };
}

/** Score, lives, the win and the HUD stats into the shell store; the shell ends "lose" at 0 lives. */
export function syncStore(run: Run, ev: StepEvents, store: CatStore): void {
   const s = store.getState();
   if (ev.score) s.addScore(ev.score);
   if (ev.lifeLost) s.loseLife();
   if (ev.won) s.end("win");
   if (run.synced.treats !== run.collected) s.setStat("treats", (run.synced.treats = run.collected));
   const hop = run.cat.cool <= 0 ? 1 : 0;
   if (run.synced.hop !== hop) s.setStat("hop", (run.synced.hop = hop));
}
