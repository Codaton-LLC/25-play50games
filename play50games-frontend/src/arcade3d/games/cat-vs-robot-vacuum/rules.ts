// Cat vs Robot Vacuum rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// One hall along +z (x in [-2.4, 2.4], six-metre rooms). Furniture and clutter sit in the side
// bays only, so the centre lane (|x| <= 1.0) is always open: every treat and the bed are reachable
// (levels.test.ts floods 200 seeds). The vacuums patrol that lane; the sofa blocks their sight.
import type { AABB, Vec3Like } from "@/arcade3d/core/collision";
import { hasLineOfSightXZ, investigate, stepPatrol, type Agent, type PatrolState } from "@/arcade3d/core/ai";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { createPath, nearestS, pointAt, type Path } from "@/arcade3d/core/path";
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
export const INVESTIGATE_WAIT_S = 0.5;
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
export const CLUTTER_H = 0.5;

export const FURN_SIZE = {
   sofa: { x: 0.9, y: 0.72, z: 1.9 },
   bed: { x: 1.0, y: 0.5, z: 1.9 },
   table: { x: 0.9, y: 0.7, z: 0.9 },
   bookshelf: { x: 0.45, y: 1.5, z: 1.4 },
} as const;

export type FurnKind = keyof typeof FURN_SIZE;

/** Rooms after the bed take these in turn. */
const FURN_CYCLE: readonly FurnKind[] = ["sofa", "bookshelf", "table"];

/** Limits proven against the honest bot (rules.test.ts): maxScore about 5 % over its best win, pps covers its fastest win. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 700, minDurationMs: 4000, maxDurationMs: 90_000, base: 380, maxPointsPerSec: 46, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 970, minDurationMs: 4000, maxDurationMs: 120_000, base: 560, maxPointsPerSec: 23, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1270, minDurationMs: 4000, maxDurationMs: 150_000, base: 760, maxPointsPerSec: 30, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 1410, minDurationMs: 4000, maxDurationMs: 150_000, base: 940, maxPointsPerSec: 17, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 1730, minDurationMs: 4000, maxDurationMs: 180_000, base: 1185, maxPointsPerSec: 13, unitLabel: "pts", display: "int" },
};

// ---------- state ----------

export interface Furniture {
   kind: FurnKind;
   x: number;
   z: number;
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
   patrol: PatrolState;
   /** seconds of chase left (0 = not chasing) */
   chase: number;
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
      furniture.push({ kind, x, z, box: boxAt(x, z, { x: size.x / 2, z: size.z / 2 }, size.y) });
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
      // Spawn at the far corners first and heading away from the cat's start (corner 3 would sweep past it).
      const at = (2 - k + corners.length * 4) % corners.length;
      const p = corners[at];
      vacuums.push({
         agent: { x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0, yaw: 0 },
         patrol: { index: (at + 1) % corners.length, wait: 0, mode: "patrol", target: { x: p.x, y: 0, z: p.z } },
         chase: 0,
      });
   }

   return {
      level,
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

/** Sends a vacuum back to the nearest point of its loop, then it resumes the patrol. */
function backToPath(run: Run, v: Vacuum): void {
   v.patrol.mode = "return";
   v.patrol.wait = 0;
   pointAt(run.route, nearestS(run.route, v.agent), v.patrol.target);
}

function stepVacuum(run: Run, v: Vacuum, dt: number): void {
   const a = v.agent;
   const cat = run.cat;
   if (v.chase > 0) {
      v.chase = Math.max(0, v.chase - dt);
      const dx = cat.x - a.x;
      const dz = cat.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
         const s = Math.min(d, run.level.chaseSpeed * dt) / d;
         a.x += dx * s;
         a.z += dz * s;
         a.vx = (dx / d) * run.level.chaseSpeed;
         a.vz = (dz / d) * run.level.chaseSpeed;
         a.yaw = Math.atan2(dx, dz);
      }
      pushOutAll(a, VAC_R, run.blockers);
      // Chase over: walk to where the cat was last seen, then back to the loop.
      if (v.chase === 0) investigate(v.patrol, { x: cat.x, y: 0, z: cat.z });
      return;
   }
   if (run.level.chaseRange > 0 && v.patrol.mode === "patrol" && sees(run, v)) {
      v.chase = CHASE_S;
      return;
   }
   stepPatrol(a, v.patrol, run.route, dt, { speed: run.level.patrolSpeed, investigateWait: INVESTIGATE_WAIT_S });
   pushOutAll(a, VAC_R, run.blockers);
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
      backToPath(run, v);
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
