// Farm Tractor Challenge rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. The same seed, level and inputs replay the same run.
//
// Street-vehicle integrator (tractor numbers): speed along the heading, steer 1.4 rad/s, drag 0.8.
// The trailer is a 1D spring 2.4 m behind the hitch. It never writes the tractor.
// Hitch a free armed bale when the circles overlap and the incoming speed is under 2.
// Speed >= 2 bumps that bale (it stays). Fence and gate posts bump above 0.8. Park is a 0.60 s
// hold under 0.4 m/s inside the bay, on play time, for keyboard and touch alike.
import { resolveSphereAabb, type AABB } from "@/arcade3d/core/collision";
import { spring, type SpringState } from "@/arcade3d/core/motion";
import { createRng } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type FarmLevel } from "./levels";

export const TRACTOR = {
   top: 6,
   accel: 6,
   brake: 10,
   reverse: 2,
   steer: 1.4,
   radius: 1.35,
   drag: 0.8,
} as const;

/** Overlap under this speed hitches. At or above it, the bale stays and a life is spent. */
export const HITCH_SPEED = 2;
/** Fence and gate-post contact above this speed spends a life. */
export const FENCE_BUMP_SPEED = 0.8;
export const PARK_SPEED = 0.4;
export const PARK_HOLD = 0.6;
export const MUD_SCALE = 0.55;
/** Hitch point, metres behind the tractor centre along its heading. */
export const HITCH_BACK = 1.15;
/** Trailer spring target, metres behind the hitch. */
export const TRAILER_BEHIND = 2.4;
export const BALE_R = 0.7;
export const MIN_GAP = 4;
export const TRIP_POINTS = 200;
export const CLEAN_POINTS = 100;
export const TIME_BONUS_PER_SECOND = 4;
export const BUMP_LOCK = 1.15;
export const BAY_DEPTH = 8;
export const GATE_HALF = 3.8;
export const BAY_HALF = 2.4;
export const BAY_LIP = 0.55;
export const POST_R = 0.42;
export const TREE_HALF = 0.55;
export const SPRING_K = 26;
/** How far inside the north fence the park point sits, past the tractor radius. */
export const PARK_INSET = 1.15;
export const MAX_BALES = 12;

/** Slots on the trailer anchor: lateral (tractor right) and further behind. */
export const SLOT_LOCAL = [
   { lat: 0.62, back: 0.48 },
   { lat: -0.62, back: 0.48 },
] as const;

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/**
 * Spec sketch, retuned to the oracle in rules.test.ts (README table).
 * Level 1's earliest measured clear is 23.05 s at 984, which needs pps 17; 22 still
 * accepts a 19.1 s clear that scores the 1000 cap. Levels 2-5 keep the sketch pps.
 * Their maxScore is pulled down so the measured best is at least 90% of the cap.
 * minDurationMs stays 4000. Level 5 / level 1 maxScore is 2.28.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { ...PTS, maxScore: 1000, minDurationMs: 4000, maxDurationMs: 120_000, base: 600, maxPointsPerSec: 22 },
   2: { ...PTS, maxScore: 1340, minDurationMs: 4000, maxDurationMs: 150_000, base: 900, maxPointsPerSec: 13 },
   3: { ...PTS, maxScore: 1740, minDurationMs: 4000, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 12 },
   4: { ...PTS, maxScore: 1960, minDurationMs: 4000, maxDurationMs: 180_000, base: 1500, maxPointsPerSec: 9 },
   5: { ...PTS, maxScore: 2280, minDurationMs: 4000, maxDurationMs: 210_000, base: 1800, maxPointsPerSec: 8 },
};

export interface Bale {
   x: number;
   z: number;
   trip: number;
   state: "field" | "hitched" | "delivered";
   /** Trailer slot, or -1 while it sits in the field. */
   slot: number;
}

export interface MudRect { x0: number; x1: number; z0: number; z1: number }
export interface TreeSpot { x: number; z: number }
interface Seg { ax: number; az: number; bx: number; bz: number }

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   hitch: number;
   trip: boolean;
   bump: boolean;
}

export interface Run {
   seed: number;
   level: FarmLevel;
   halfW: number;
   halfD: number;
   gateZ: number;
   tractor: { x: number; z: number; yaw: number; speed: number };
   trailerX: SpringState;
   trailerZ: SpringState;
   bales: Bale[];
   mud: MudRect[];
   trees: TreeSpot[];
   trip: number;
   tripBumps: number;
   park: number;
   bumpLock: number;
   lives: number;
   score: number;
   parked: number;
   over: "win" | "lose" | null;
   time: number;
   segs: Seg[];
   posts: { x: number; z: number }[];
   treeBoxes: AABB[];
   scratch: { x: number; y: number; z: number };
   ev: StepEvents;
}

export interface FarmInput {
   moveX: number;
   moveY: number;
   /** Camera yaw is unused: steer is vehicle-relative, so keyboard and touch share one step. */
   yaw: number;
}

export const idleInput = (): FarmInput => ({ moveX: 0, moveY: 0, yaw: 0 });

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

export function forwardOf(yaw: number): { x: number; z: number } {
   return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function hitchPoint(tractor: Run["tractor"]): { x: number; z: number } {
   const f = forwardOf(tractor.yaw);
   return { x: tractor.x - f.x * HITCH_BACK, z: tractor.z - f.z * HITCH_BACK };
}

/** Where the trailer spring is heading. Not where it is. */
export function trailerAnchorTarget(tractor: Run["tractor"]): { x: number; z: number } {
   const f = forwardOf(tractor.yaw);
   const h = hitchPoint(tractor);
   return { x: h.x - f.x * TRAILER_BEHIND, z: h.z - f.z * TRAILER_BEHIND };
}

export function slotWorld(anchorX: number, anchorZ: number, yaw: number, slot: number): { x: number; z: number } {
   const f = forwardOf(yaw);
   const local = SLOT_LOCAL[slot] ?? SLOT_LOCAL[0];
   const rx = f.z;
   const rz = -f.x;
   return {
      x: anchorX + rx * local.lat - f.x * local.back,
      z: anchorZ + rz * local.lat - f.z * local.back,
   };
}

export function parkPoint(run: Run): { x: number; z: number } {
   return { x: 0, z: run.halfD - TRACTOR.radius - PARK_INSET };
}

export function inBay(run: Run, x: number, z: number): boolean {
   return Math.abs(x) <= BAY_HALF && z >= run.gateZ + BAY_LIP && z <= run.halfD - 0.3;
}

export function bayRect(run: Run): MudRect {
   return { x0: -BAY_HALF, x1: BAY_HALF, z0: run.gateZ + BAY_LIP, z1: run.halfD - 0.3 };
}

export function rectsOverlap(a: MudRect, b: MudRect): boolean {
   return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

/** Circle against an axis-aligned rect, including a mere touch. */
export function rectHitsCircle(rect: MudRect, x: number, z: number, r: number): boolean {
   const cx = Math.max(rect.x0, Math.min(x, rect.x1));
   const cz = Math.max(rect.z0, Math.min(z, rect.z1));
   const dx = x - cx;
   const dz = z - cz;
   return dx * dx + dz * dz <= r * r + 1e-9;
}

export function circlesOverlap(x0: number, z0: number, r0: number, x1: number, z1: number, r1: number): boolean {
   const dx = x0 - x1;
   const dz = z0 - z1;
   const r = r0 + r1;
   return dx * dx + dz * dz <= r * r;
}

function onSoil(x: number, z: number, halfW: number, halfD: number, gateZ: number): boolean {
   return Math.abs(x) <= halfW - TRACTOR.radius - BALE_R - 0.2
      && z >= -halfD + TRACTOR.radius + BALE_R + 0.5
      && z <= gateZ - 2.7;
}

function columnXs(count: number, halfW: number): number[] {
   const outer = Math.min(halfW - 3.8, 13.2);
   if (count <= 2) return [-4.7, 4.7];
   if (count <= 6) return [-outer, -4.7, 4.7];
   return [-outer, -4.7, 4.7, outer];
}

function placeBales(level: FarmLevel, halfW: number, halfD: number, gateZ: number, rng: () => number): Bale[] {
   const count = level.trips * level.balesPerTrip;
   const xs = columnXs(count, halfW);
   const cols = xs.length;
   const rows = Math.ceil(count / cols);
   const z0 = -halfD + TRACTOR.radius + 3.5;
   const z1 = gateZ - 3.6;
   const span = Math.max(0, z1 - z0);
   const rowGap = rows <= 1 ? 0 : Math.max(4.2, span / (rows - 1 + 0.45));
   const stagger = Math.min(3.15, rowGap * 0.48);
   const bales: Bale[] = [];
   for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      let x = xs[col];
      let z = z0 + row * rowGap + (col % 2) * stagger;
      if (z > z1) z = z1;
      for (let attempt = 0; attempt < 8; attempt++) {
         const jx = x + (rng() - 0.5) * 0.64;
         const jz = z + (rng() - 0.5) * 0.64;
         if (!onSoil(jx, jz, halfW, halfD, gateZ)) continue;
         let ok = true;
         for (const bale of bales) {
            if ((bale.x - jx) ** 2 + (bale.z - jz) ** 2 < MIN_GAP * MIN_GAP) ok = false;
         }
         if (!ok) continue;
         x = jx;
         z = jz;
         break;
      }
      bales.push({
         x,
         z,
         trip: Math.floor(i / level.balesPerTrip),
         state: "field",
         slot: -1,
      });
   }
   return bales;
}

function placeMud(level: FarmLevel, bales: readonly Bale[], halfW: number, halfD: number, gateZ: number, rng: () => number): MudRect[] {
   if (level.mud <= 0) return [];
   const bay: MudRect = { x0: -BAY_HALF, x1: BAY_HALF, z0: gateZ + BAY_LIP, z1: halfD - 0.3 };
   const hx = 1.4;
   const hz = 1.15;
   const xs = [-8.5, 8.5, -11.2, 11.2];
   const zs = [-7.2, -3.1, 0.6, -10, 2.2, -5];
   const mud: MudRect[] = [];
   const accept = (x: number, z: number): boolean => {
      const rect: MudRect = { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
      if (rect.z1 > gateZ - 1.5 || rect.z0 < -halfD + 1.6) return false;
      if (rect.x0 < -halfW + 1.2 || rect.x1 > halfW - 1.2) return false;
      if (rect.x0 < 3.15 && rect.x1 > -3.15) return false;
      if (rectsOverlap(rect, bay)) return false;
      for (const bale of bales) if (rectHitsCircle(rect, bale.x, bale.z, BALE_R + 0.3)) return false;
      for (const have of mud) if (rectsOverlap(rect, have)) return false;
      mud.push(rect);
      return true;
   };
   for (const x of xs) {
      for (const z of zs) {
         if (mud.length >= level.mud) return mud;
         accept(x, z);
      }
   }
   let guard = 0;
   while (mud.length < level.mud && guard++ < 80) {
      const x = (rng() < 0.5 ? -1 : 1) * (6.5 + rng() * Math.max(0.5, halfW - 8));
      const z = -halfD + 3 + rng() * Math.max(1, gateZ - 4 - (-halfD + 3));
      accept(x, z);
   }
   return mud;
}

function placeTrees(level: FarmLevel, bales: readonly Bale[], halfW: number, halfD: number, gateZ: number, rng: () => number): TreeSpot[] {
   const trees: TreeSpot[] = [];
   if (level.trees <= 0) return trees;
   const edge = halfW - 2.25;
   const rows = Math.ceil(level.trees / 2);
   const z0 = -halfD + 4.2;
   const z1 = gateZ - 2.4;
   for (let i = 0; i < level.trees; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      let z = rows === 1 ? (z0 + z1) / 2 : z0 + ((z1 - z0) * row) / (rows - 1);
      z += (rng() - 0.5) * 0.5;
      z = clamp(z, z0, z1);
      let x = side * edge;
      for (const bale of bales) {
         const dx = bale.x - x;
         const dz = bale.z - z;
         const need = BALE_R + TREE_HALF + 0.45;
         if (dx * dx + dz * dz < need * need) z = clamp(z + (dz >= 0 ? -1.2 : 1.2), z0, z1);
      }
      if (Math.abs(x) < 3.2) x = side * edge;
      trees.push({ x, z });
   }
   return trees;
}

function fenceSegs(halfW: number, halfD: number, gateZ: number): Seg[] {
   return [
      { ax: -halfW, az: -halfD, bx: halfW, bz: -halfD },
      { ax: halfW, az: -halfD, bx: halfW, bz: halfD },
      { ax: halfW, az: halfD, bx: -halfW, bz: halfD },
      { ax: -halfW, az: halfD, bx: -halfW, bz: -halfD },
      { ax: -halfW, az: gateZ, bx: -GATE_HALF, bz: gateZ },
      { ax: GATE_HALF, az: gateZ, bx: halfW, bz: gateZ },
   ];
}

function blankEvents(): StepEvents {
   return { score: 0, lifeLost: false, won: false, lost: false, hitch: -1, trip: false, bump: false };
}

export function createRun(seed: number, level: FarmLevel = LEVELS[1]): Run {
   const rng = createRng(seed);
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   const gateZ = halfD - BAY_DEPTH;
   const bales = placeBales(level, halfW, halfD, gateZ, rng);
   const mud = placeMud(level, bales, halfW, halfD, gateZ, rng);
   const trees = placeTrees(level, bales, halfW, halfD, gateZ, rng);
   const tractor = { x: 0, z: -halfD + TRACTOR.radius + 1.7, yaw: 0, speed: 0 };
   const target = trailerAnchorTarget(tractor);
   const run: Run = {
      seed,
      level,
      halfW,
      halfD,
      gateZ,
      tractor,
      trailerX: { x: target.x, v: 0 },
      trailerZ: { x: target.z, v: 0 },
      bales,
      mud,
      trees,
      trip: 0,
      tripBumps: 0,
      park: 0,
      bumpLock: 0,
      lives: level.lives,
      score: 0,
      parked: 0,
      over: null,
      time: 0,
      segs: fenceSegs(halfW, halfD, gateZ),
      posts: [{ x: -GATE_HALF, z: gateZ }, { x: GATE_HALF, z: gateZ }],
      treeBoxes: trees.map((tree) => ({
         min: { x: tree.x - TREE_HALF, y: 0, z: tree.z - TREE_HALF },
         max: { x: tree.x + TREE_HALF, y: 4, z: tree.z + TREE_HALF },
      })),
      scratch: { x: 0, y: 1, z: 0 },
      ev: blankEvents(),
   };
   return run;
}

function inMud(run: Run): boolean {
   const r = TRACTOR.radius;
   for (const rect of run.mud) {
      if (rectHitsCircle(rect, run.tractor.x, run.tractor.z, r)) return true;
   }
   return false;
}

/** Coast, throttle and steer. `throttle` +1 is forward (stick up). Positive steer turns right. */
function integrateTractor(run: Run, moveX: number, moveY: number, dt: number): void {
   const body = run.tractor;
   const throttle = clamp(-moveY, -1, 1);
   const steerIn = clamp(moveX, -1, 1);
   const mud = inMud(run);
   const scale = mud ? MUD_SCALE : 1;
   const top = TRACTOR.top * scale;
   const accel = TRACTOR.accel * scale;
   const reverse = TRACTOR.reverse * scale;
   if (body.speed > top) body.speed = Math.max(top, body.speed - TRACTOR.brake * dt);
   if (throttle > 0) {
      if (body.speed < 0) body.speed = Math.min(0, body.speed + TRACTOR.brake * throttle * dt);
      else body.speed = Math.min(top * throttle, body.speed + accel * throttle * dt);
   } else if (throttle < 0) {
      const back = -throttle;
      if (body.speed > 0) body.speed = Math.max(0, body.speed - TRACTOR.brake * back * dt);
      else body.speed = Math.max(-reverse * back, body.speed - accel * back * dt);
   } else {
      const drag = TRACTOR.drag * dt;
      if (body.speed > drag) body.speed -= drag;
      else if (body.speed < -drag) body.speed += drag;
      else body.speed = 0;
   }
   const crawling = Math.abs(body.speed) < 0.12;
   const turnSign = crawling ? 1 : Math.sign(body.speed);
   const turnScale = crawling ? 0.5 : 1;
   body.yaw += steerIn * TRACTOR.steer * turnSign * turnScale * dt;
   if (body.yaw > Math.PI) body.yaw -= Math.PI * 2;
   else if (body.yaw < -Math.PI) body.yaw += Math.PI * 2;
   body.x += Math.sin(body.yaw) * body.speed * dt;
   body.z += Math.cos(body.yaw) * body.speed * dt;
}

/** Push out of a segment. Returns true when the tractor is moving into it. */
function pushSeg(body: Run["tractor"], seg: Seg): boolean {
   const dx = seg.bx - seg.ax;
   const dz = seg.bz - seg.az;
   const l2 = dx * dx + dz * dz || 1;
   let t = ((body.x - seg.ax) * dx + (body.z - seg.az) * dz) / l2;
   if (t < 0) t = 0;
   else if (t > 1) t = 1;
   const cx = seg.ax + dx * t;
   const cz = seg.az + dz * t;
   const rx = body.x - cx;
   const rz = body.z - cz;
   const dist = Math.hypot(rx, rz);
   if (dist >= TRACTOR.radius) return false;
   const nx = dist > 1e-6 ? rx / dist : 0;
   const nz = dist > 1e-6 ? rz / dist : 1;
   body.x += nx * (TRACTOR.radius - dist);
   body.z += nz * (TRACTOR.radius - dist);
   const vx = Math.sin(body.yaw) * body.speed;
   const vz = Math.cos(body.yaw) * body.speed;
   return vx * nx + vz * nz < -0.02;
}

function pushPost(body: Run["tractor"], post: { x: number; z: number }): boolean {
   const min = TRACTOR.radius + POST_R;
   const dx = body.x - post.x;
   const dz = body.z - post.z;
   const dist = Math.hypot(dx, dz);
   if (dist >= min) return false;
   const nx = dist > 1e-6 ? dx / dist : 1;
   const nz = dist > 1e-6 ? dz / dist : 0;
   body.x = post.x + nx * min;
   body.z = post.z + nz * min;
   const vx = Math.sin(body.yaw) * body.speed;
   const vz = Math.cos(body.yaw) * body.speed;
   return vx * nx + vz * nz < -0.02;
}

function bump(run: Run): void {
   if (run.bumpLock > 0 || run.over) return;
   run.bumpLock = BUMP_LOCK;
   run.tripBumps += 1;
   run.lives -= 1;
   run.tractor.speed = 0;
   run.ev.lifeLost = true;
   run.ev.bump = true;
   if (run.lives <= 0) {
      run.over = "lose";
      run.ev.lost = true;
   }
}

function hitchedCount(run: Run): number {
   let n = 0;
   for (const bale of run.bales) if (bale.trip === run.trip && bale.state === "hitched") n += 1;
   return n;
}

function resolveWorld(run: Run): void {
   const body = run.tractor;
   let into = false;
   for (let pass = 0; pass < 2; pass++) {
      for (const seg of run.segs) if (pushSeg(body, seg)) into = true;
      for (const post of run.posts) if (pushPost(body, post)) into = true;
      const scratch = run.scratch;
      for (const box of run.treeBoxes) {
         scratch.x = body.x;
         scratch.y = 1;
         scratch.z = body.z;
         resolveSphereAabb(scratch, TRACTOR.radius, box, scratch);
         if (scratch.x !== body.x || scratch.z !== body.z) {
            const vx = Math.sin(body.yaw) * body.speed;
            const vz = Math.cos(body.yaw) * body.speed;
            const nx = scratch.x - body.x;
            const nz = scratch.z - body.z;
            body.x = scratch.x;
            body.z = scratch.z;
            if (vx * nx + vz * nz < -0.02) into = true;
         }
      }
   }
   body.x = clamp(body.x, -run.halfW + TRACTOR.radius, run.halfW - TRACTOR.radius);
   body.z = clamp(body.z, -run.halfD + TRACTOR.radius, run.halfD - TRACTOR.radius);
   if (!into) return;
   const fast = Math.abs(body.speed) > FENCE_BUMP_SPEED;
   if (fast) bump(run);
   else body.speed *= 0.15;
}

function tryHitch(run: Run, hitSpeed: number): void {
   const body = run.tractor;
   for (let i = 0; i < run.bales.length; i++) {
      const bale = run.bales[i];
      if (bale.state !== "field") continue;
      if (!circlesOverlap(body.x, body.z, TRACTOR.radius, bale.x, bale.z, BALE_R)) continue;
      const armed = bale.trip === run.trip;
      const room = hitchedCount(run) < run.level.balesPerTrip;
      if (armed && room && hitSpeed < HITCH_SPEED) {
         bale.state = "hitched";
         bale.slot = hitchedCount(run) - 1;
         run.ev.hitch = i;
         if (hitchedCount(run) >= run.level.balesPerTrip) return;
         continue;
      }
      if (hitSpeed >= HITCH_SPEED) {
         bump(run);
         return;
      }
   }
}

function slotsInBay(run: Run): boolean {
   for (const bale of run.bales) {
      if (bale.trip !== run.trip || bale.state !== "hitched") continue;
      const at = slotWorld(run.trailerX.x, run.trailerZ.x, run.tractor.yaw, bale.slot);
      if (!inBay(run, at.x, at.z)) return false;
   }
   return true;
}

function scoreTrip(run: Run, timeLeftMs: number, dt: number): void {
   const body = run.tractor;
   const ready = hitchedCount(run) === run.level.balesPerTrip
      && inBay(run, body.x, body.z)
      && slotsInBay(run)
      && Math.abs(body.speed) < PARK_SPEED;
   if (!ready) {
      run.park = 0;
      return;
   }
   run.park += dt;
   if (run.park < PARK_HOLD) return;
   let gained = TRIP_POINTS;
   if (run.tripBumps === 0) gained += CLEAN_POINTS;
   for (const bale of run.bales) {
      if (bale.trip === run.trip && bale.state === "hitched") bale.state = "delivered";
   }
   run.parked += 1;
   run.trip += 1;
   run.tripBumps = 0;
   run.park = 0;
   run.ev.trip = true;
   if (run.trip >= run.level.trips) {
      gained += timeBonus(timeLeftMs);
      run.over = "win";
      run.ev.won = true;
   }
   run.score += gained;
   run.ev.score += gained;
}

function followTrailer(run: Run, dt: number): void {
   const target = trailerAnchorTarget(run.tractor);
   spring(run.trailerX, target.x, SPRING_K, -1, dt);
   spring(run.trailerZ, target.z, SPRING_K, -1, dt);
}

export function step(run: Run, input: FarmInput, dt: number, timeLeftMs: number): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.hitch = -1;
   ev.trip = false;
   ev.bump = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   if (run.bumpLock > 0) run.bumpLock = Math.max(0, run.bumpLock - dt);
   const hitSpeed = run.tractor.speed;
   integrateTractor(run, input.moveX, input.moveY, dt);
   resolveWorld(run);
   followTrailer(run, dt);
   if (!run.over && !ev.bump) tryHitch(run, hitSpeed);
   if (!run.over && !ev.bump) scoreTrip(run, timeLeftMs, dt);
   return ev;
}

/** Every bale is on soil, at least 4 m from the others, and clear of mud and the bay. */
export function layoutClean(run: Run): boolean {
   const bay = bayRect(run);
   for (let i = 0; i < run.bales.length; i++) {
      const bale = run.bales[i];
      if (!onSoil(bale.x, bale.z, run.halfW, run.halfD, run.gateZ)) return false;
      if (inBay(run, bale.x, bale.z)) return false;
      if (rectsOverlap({ x0: bale.x, x1: bale.x, z0: bale.z, z1: bale.z }, bay)) return false;
      for (const rect of run.mud) if (rectHitsCircle(rect, bale.x, bale.z, BALE_R)) return false;
      for (let j = i + 1; j < run.bales.length; j++) {
         const other = run.bales[j];
         if ((bale.x - other.x) ** 2 + (bale.z - other.z) ** 2 < MIN_GAP * MIN_GAP) return false;
      }
   }
   for (const rect of run.mud) if (rectsOverlap(rect, bay)) return false;
   if (run.mud.length !== run.level.mud) return false;
   if (run.trees.length !== run.level.trees) return false;
   if (run.bales.length !== run.level.trips * run.level.balesPerTrip) return false;
   return true;
}
