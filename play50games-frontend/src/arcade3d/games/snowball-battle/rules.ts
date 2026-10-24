// Snowball Battle simulation. Pure: seeded rngNext, no three / React / DOM / Math.random / Date.
// Decisions (user, 2026-10-24) override the design's open questions: any overlap on a living
// rival scores, a dodge spoils any ball already in the air, an off-screen arrow is a legal tap
// target (the Scene resolves the arrow; rules still require line of sight), a knockdown does not
// accrue open time, and camping one fort for CAMP_FLUSH_S draws a volley that costs that fort 1 HP.

import {
   clampToBounds,
   distanceToBoxXZ,
   spheresOverlap,
   sweptAabbXZ,
   type AABB,
   type SweepHit,
   type Vec3Like,
} from "@/arcade3d/core/collision";
import { substep } from "@/arcade3d/core/kinematics";
import { launchForTime, landingPoint, type BallisticParams, type Projectile } from "@/arcade3d/core/ballistics";
import { arrive, flee, separate, type Agent } from "@/arcade3d/core/ai/steering";
import { hasLineOfSightXZ, inViewCone } from "@/arcade3d/core/ai/vision";
import { inputToWorld, rngNext, turnTowards, type RngState } from "@/arcade3d/core/math";
import type { ScoringRules } from "@/arcade3d/types";

export const POCKET_OUT = 0.45;
export const SCOOP_S = 0.5;
export const RELOCATE_MIN_S = 0.9;
export const CAMP_FLUSH_S = 6;
export const SUBSTEP_S = 1 / 120;
export const GRAVITY = 9.81;

export const YARD = {
   minX: -12, maxX: 12, minZ: -9, maxZ: 9,
   inset: 0.35,
   snowHalf: 0.7,
   snowHeight: 1.6,
   startX: 0, startZ: 6.2, startYaw: Math.PI,
} as const;

export const KID = {
   radius: 0.35, speed: 4.5, accel: 22, brake: 30, turn: 10, height: 1.3,
   standBodyY: 0.62, standBodyR: 0.32, standHeadY: 1.05, standHeadR: 0.2,
   crouchBodyY: 0.42, crouchBodyR: 0.32, crouchHeadY: 0.72, crouchHeadR: 0.18,
   crouchSpeed: 0.25, crouchBand: 0.5,
} as const;

export const SCOOP = {
   min: 0.5, max: 1.5, maxAmmo: 3, throwGap: 0.4,
   playerStart: 0, rivalStart: 1, rivalMax: 2,
} as const;

export const THROW = {
   halfAngle: (38 * Math.PI) / 180,
   range: 36,
   flightNear: 0.65, flightFar: 0.85, distNear: 6, distFar: 14,
   launchY: 1, launchForward: 0.35, targetY: 0.62,
   ballR: 0.25, coarseR: 0.33, tapPx: 56,
   rollerR: 0.45, rollerY: 0.45, rollerSpeed: 6, rollerLife: 2.2,
} as const;

export const FORT = {
   count: 7, hp: 3, footprint: 1.8, half: 0.9,
   heights: [1.4, 0.95, 0.55] as const,
   gap: 3.6, snowGap: 3.2,
   areaX: 8.5, areaZ: 5.5,
} as const;

export const AI = {
   cover: 0.8, peek: 0.4, windup: 1.2, recover: 0.3,
   stagger: 0.45, knockdown: 1.5,
   dodgeTime: 0.6, dodgeRange: 1, separateRadius: 1.2, separateSpeed: 1.5,
   slowRadius: 0.8, openLimit: 2, sneakerAt: 10, slotAt: 60,
   arriveReach: 0.35,
   dodgeAt: [0.35, 0.27, 0.2] as const,
} as const;

export const SCORE = {
   hit: 100, out: 300, win: 500, health: 50,
   tagsOut: 3, tagsLose: 5, rivals: 3, duration: 90, healthMax: 5,
} as const;

export const PINE = { count: 10, trunk: 0.3, gap: 2.2, bandX: 9.2, bandZ: 6.6 } as const;

/** Proven limits. meta.scoring stays the provisional main values; Claude copies these at merge. */
export const PROPOSED_LIMITS: ScoringRules = {
   kind: "points",
   maxScore: 2550,
   minDurationMs: 10000,
   maxDurationMs: 92000,
   base: 600,
   maxPointsPerSec: 190,
   unitLabel: "pts",
   display: "int",
};

/**
 * Upper bound B(t) after Q1 (any hit scores). A scoop-throw cycle is one ball per 0.50 s,
 * first arrival at 0.50 + 0.65 = 1.15, same-rival hits at least STAGGER apart (the cycle is
 * slower). Two rivals exist from 0 (6 hits, 2 outs) and the sneaker from 10.00 (3 more, the
 * third carrying the win). Stagger stops a stacked arrival from scoring twice.
 */
export const EARLIEST: readonly { t: number; score: number }[] = [
   { t: 1.15, score: 100 },
   { t: 1.65, score: 200 },
   { t: 2.15, score: 600 },
   { t: 2.65, score: 700 },
   { t: 3.15, score: 800 },
   { t: 3.65, score: 1200 },
   { t: 10, score: 1300 },
   { t: 10.45, score: 1400 },
   { t: 10.9, score: 2550 },
];

export function earliestScore(t: number): number {
   let score = 0;
   for (let i = 0; i < EARLIEST.length; i++) if (t >= EARLIEST[i].t - 1e-9) score = EARLIEST[i].score;
   return score;
}

export function flightTime(distance: number): number {
   if (distance <= THROW.distNear) return THROW.flightNear;
   if (distance >= THROW.distFar) return THROW.flightFar;
   const k = (distance - THROW.distNear) / (THROW.distFar - THROW.distNear);
   return THROW.flightNear + (THROW.flightFar - THROW.flightNear) * k;
}

export function dodgeDelay(t: number): number {
   const [a, b, c] = AI.dodgeAt;
   if (t <= 0) return a;
   if (t >= 60) return c;
   if (t <= 30) return a + (b - a) * (t / 30);
   return b + (c - b) * ((t - 30) / 30);
}

export function runScore(hits: number, outs: number, won: boolean, playerTags: number): number {
   return SCORE.hit * hits + SCORE.out * outs + (won ? SCORE.win + SCORE.health * (SCORE.healthMax - playerTags) : 0);
}

export type KidState = "play" | "cover" | "ready" | "peek" | "windup" | "recover" | "relocate" | "stagger" | "knockdown";
export type EndName = "win" | "lose" | "timeup";
export type FxKind = "scoop" | "throw" | "tag" | "hurt" | "crumble" | "splat" | "down";

export interface FortState { x: number; z: number; hp: number }
export interface PineState { x: number; z: number; scale: number; rotY: number }
export interface Yard { forts: FortState[]; pines: PineState[] }

export interface Kid extends Agent {
   id: number;
   present: boolean;
   alive: boolean;
   tags: number;
   ammo: number;
   state: KidState;
   timer: number;
   scoopT: number;
   immune: number;
   dodge: number;
   dodgeX: number;
   dodgeZ: number;
   openT: number;
   relocateQueued: boolean;
   fort: number;
   destX: number;
   destZ: number;
   peekX: number;
   peekZ: number;
   throwAnim: number;
   flail: number;
   stuck: number;
   markX: number;
   markZ: number;
}

export interface Ball {
   alive: boolean;
   roller: boolean;
   owner: number;
   x0: number; y0: number; z0: number;
   vx: number; vy: number; vz: number;
   age: number;
   flight: number;
   ix: number; iy: number; iz: number;
   r: number;
   x: number; y: number; z: number;
}

export interface SimEvent { kind: FxKind; x: number; y: number; z: number; n: number }

export interface StepInput {
   moveX: number;
   moveY: number;
   /** camera yaw passed to inputToWorld (the fitted view's yaw; 0 in this game) */
   camYaw: number;
   scoop: boolean;
   /** fine pointer: Space / aimFired this frame */
   fire: boolean;
   /** coarse pointer: rival id under the tap or its edge arrow, else -1 */
   tapId: number;
   /** desktop aim (pointer on y = 0). Touch highlight uses facing when this matches yaw. */
   aimYaw: number;
}

export interface Run {
   seed: number;
   coarse: boolean;
   fallback: boolean;
   time: number;
   forts: FortState[];
   pines: PineState[];
   kids: Kid[];
   balls: Ball[];
   hits: number;
   outs: number;
   playerTags: number;
   bank: number;
   score: number;
   scoreDelta: number;
   endReason: EndName | null;
   scooping: boolean;
   scoopT: number;
   /** big-roller press already fired; ignore scoop until the button is released */
   scoopLock: boolean;
   throwCd: number;
   campFort: number;
   campT: number;
   lastX: number;
   lastZ: number;
   highlight: number;
   events: SimEvent[];
   eventCount: number;
}

const BALLS = 10;
const EVENTS = 24;
const GRAV: BallisticParams = { gravity: GRAVITY, wind: { x: 0, z: 0 } };

const BASE_FORTS: readonly (readonly [number, number])[] = [
   [0, -5.2], [6.4, -3.3], [7.5, 1.5], [3.4, 4.9], [-3.4, 4.9], [-7.5, 1.5], [-6.4, -3.3],
];
const BASE_PINES: readonly (readonly [number, number])[] = [
   [10.6, 0], [-10.6, 0], [11.1, 3.6], [11.1, -3.6], [-11.1, 3.6], [-11.1, -3.6],
   [0, 7.5], [5.5, 7.6], [-5.5, 7.6], [0, -7.5],
];

const BOUNDS: AABB = { min: { x: YARD.minX, y: -10, z: YARD.minZ }, max: { x: YARD.maxX, y: 10, z: YARD.maxZ } };
const BOXES: AABB[] = Array.from({ length: 8 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
const PA: Vec3Like = { x: 0, y: 0, z: 0 };
const PB: Vec3Like = { x: 0, y: 0, z: 0 };
const DIR = { x: 0, z: 0 };
const STEER: Vec3Like = { x: 0, y: 0, z: 0 };
const SEP_OUT: Vec3Like = { x: 0, y: 0, z: 0 };
const TARGET: Vec3Like = { x: 0, y: 0, z: 0 };
const FROM: Vec3Like = { x: 0, y: 0, z: 0 };
const LEAD: Vec3Like = { x: 0, y: 0, z: 0 };
const VEL: Vec3Like = { x: 0, y: 0, z: 0 };
const SAMPLE: Vec3Like = { x: 0, y: 0, z: 0 };
const PREV: Vec3Like = { x: 0, y: 0, z: 0 };
const CLAMP: Vec3Like = { x: 0, y: 0, z: 0 };
const CENTRE: Vec3Like = { x: 0, y: 0, z: 0 };
const SPHERE: Vec3Like = { x: 0, y: 0, z: 0 };
const SWEEP: SweepHit = { time: 0, normalX: 0, normalZ: 0 };
const MOVE_BOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const STILL: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const SEP: Kid[] = [];
const PROJ: Projectile = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

function kid(id: number): Kid {
   return {
      id, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
      present: false, alive: false, tags: 0, ammo: 0, state: "play", timer: 0, scoopT: 0,
      immune: 0, dodge: 0, dodgeX: 0, dodgeZ: 0, openT: 0, relocateQueued: false,
      fort: -1, destX: 0, destZ: 0, peekX: 0, peekZ: 0, throwAnim: 0, flail: 0,
      stuck: 0, markX: 0, markZ: 0,
   };
}

function emptyBall(): Ball {
   return {
      alive: false, roller: false, owner: -1,
      x0: 0, y0: 0, z0: 0, vx: 0, vy: 0, vz: 0, age: 0, flight: 0,
      ix: 0, iy: 0, iz: 0, r: THROW.ballR, x: 0, y: 0, z: 0,
   };
}

export function fortHeight(hp: number): number {
   if (hp >= 3) return FORT.heights[0];
   if (hp === 2) return FORT.heights[1];
   if (hp === 1) return FORT.heights[2];
   return 0;
}

export function pocketsOf(x: number, z: number, out: number): number {
   // writes 4 pockets into POCKETS starting at out (x, z, nx, nz) * 4 numbers, returns nothing useful
   const d = FORT.half + POCKET_OUT;
   const o = out * 4;
   POCKETS[o] = x + d; POCKETS[o + 1] = z; POCKETS[o + 2] = 1; POCKETS[o + 3] = 0;
   POCKETS[o + 4] = x - d; POCKETS[o + 5] = z; POCKETS[o + 6] = -1; POCKETS[o + 7] = 0;
   POCKETS[o + 8] = x; POCKETS[o + 9] = z + d; POCKETS[o + 10] = 0; POCKETS[o + 11] = 1;
   POCKETS[o + 12] = x; POCKETS[o + 13] = z - d; POCKETS[o + 14] = 0; POCKETS[o + 15] = -1;
   return 4;
}

const POCKETS = new Float64Array(8 * 4);

export function peekIndex(x: number, z: number): number {
   return facePair(x, z, 0, 0).peek;
}

/** Peek faces the point. Cover is the opposite face, so the fort blocks sight while a rival scoops. */
function facePair(x: number, z: number, tx: number, tz: number): { peek: number; peekX: number; peekZ: number; coverX: number; coverZ: number } {
   pocketsOf(x, z, 0);
   let peek = 0;
   let dot = -Infinity;
   const dx = tx - x;
   const dz = tz - z;
   const len = Math.hypot(dx, dz) || 1;
   for (let i = 0; i < 4; i++) {
      const d = POCKETS[i * 4 + 2] * (dx / len) + POCKETS[i * 4 + 3] * (dz / len);
      if (d > dot) { dot = d; peek = i; }
   }
   const cover = peek ^ 1;
   return {
      peek,
      peekX: POCKETS[peek * 4], peekZ: POCKETS[peek * 4 + 1],
      coverX: POCKETS[cover * 4], coverZ: POCKETS[cover * 4 + 1],
   };
}

function writeBox(box: AABB, x: number, z: number, half: number, height: number): void {
   box.min.x = x - half; box.max.x = x + half;
   box.min.z = z - half; box.max.z = z + half;
   box.min.y = 0; box.max.y = height;
}

/** Active sight boxes (snowman, then forts with HP >= 1). Length is restored by the caller via sight(). */
function fillSight(forts: readonly FortState[]): number {
   writeBox(BOXES[0], 0, 0, YARD.snowHalf, YARD.snowHeight);
   let n = 1;
   for (let i = 0; i < forts.length; i++) {
      const f = forts[i];
      if (f.hp < 1) continue;
      writeBox(BOXES[n], f.x, f.z, FORT.half, fortHeight(f.hp));
      n++;
   }
   return n;
}

export function lineOfSight(forts: readonly FortState[], ax: number, az: number, bx: number, bz: number): boolean {
   const n = fillSight(forts);
   for (let i = n; i < BOXES.length; i++) writeBox(BOXES[i], 400 + i, 400, 0.01, 0.01);
   PA.x = ax; PA.y = 0; PA.z = az;
   PB.x = bx; PB.y = 0; PB.z = bz;
   return hasLineOfSightXZ(PA, PB, BOXES);
}

function cellFree(x: number, z: number, yard: Yard): boolean {
   if (x < YARD.minX + YARD.inset || x > YARD.maxX - YARD.inset) return false;
   if (z < YARD.minZ + YARD.inset || z > YARD.maxZ - YARD.inset) return false;
   writeBox(STILL, 0, 0, YARD.snowHalf, YARD.snowHeight);
   if (distanceToBoxXZ(x, z, STILL) < KID.radius - 1e-6) return false;
   for (let i = 0; i < yard.forts.length; i++) {
      const f = yard.forts[i];
      writeBox(STILL, f.x, f.z, FORT.half, 1);
      if (distanceToBoxXZ(x, z, STILL) < KID.radius - 1e-6) return false;
   }
   for (let i = 0; i < yard.pines.length; i++) {
      const p = yard.pines[i];
      if (Math.hypot(x - p.x, z - p.z) < KID.radius + PINE.trunk - 1e-6) return false;
   }
   return true;
}

const NX = 48;
const NZ = 36;

function cellAt(x: number, z: number): number {
   const ix = Math.max(0, Math.min(NX - 1, Math.floor((x - YARD.minX) / 0.5)));
   const iz = Math.max(0, Math.min(NZ - 1, Math.floor((z - YARD.minZ) / 0.5)));
   return iz * NX + ix;
}

export function pocketsConnected(yard: Yard): boolean {
   return floodReaches(yard);
}

function floodReaches(yard: Yard): boolean {
   const free = new Uint8Array(NX * NZ);
   for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const x = YARD.minX + (ix + 0.5) * 0.5;
      const z = YARD.minZ + (iz + 0.5) * 0.5;
      if (cellFree(x, z, yard)) free[iz * NX + ix] = 1;
   }
   const start = nearestFree(free, YARD.startX, YARD.startZ);
   if (start < 0) return false;
   const seen = new Uint8Array(NX * NZ);
   const queue = new Int32Array(NX * NZ);
   let head = 0;
   let tail = 0;
   queue[tail++] = start;
   seen[start] = 1;
   while (head < tail) {
      const id = queue[head++];
      const ix = id % NX;
      const iz = (id / NX) | 0;
      const next = [ix - 1, iz, ix + 1, iz, ix, iz - 1, ix, iz + 1];
      for (let k = 0; k < 8; k += 2) {
         const jx = next[k];
         const jz = next[k + 1];
         if (jx < 0 || jz < 0 || jx >= NX || jz >= NZ) continue;
         const nid = jz * NX + jx;
         if (seen[nid] || !free[nid]) continue;
         seen[nid] = 1;
         queue[tail++] = nid;
      }
   }
   const goals: number[] = [];
   for (let i = 0; i < yard.forts.length; i++) {
      pocketsOf(yard.forts[i].x, yard.forts[i].z, 0);
      for (let p = 0; p < 4; p++) goals.push(POCKETS[p * 4], POCKETS[p * 4 + 1]);
   }
   const snowD = YARD.snowHalf + POCKET_OUT;
   goals.push(snowD, 0, -snowD, 0, 0, snowD, 0, -snowD);
   for (let i = 0; i < goals.length; i += 2) {
      const id = nearestFree(free, goals[i], goals[i + 1]);
      if (id < 0 || !seen[id]) return false;
      if (Math.hypot(centreX(id) - goals[i], centreZ(id) - goals[i + 1]) > 0.75) return false;
   }
   return true;
}

function centreX(id: number): number {
   return YARD.minX + ((id % NX) + 0.5) * 0.5;
}
function centreZ(id: number): number {
   return YARD.minZ + (((id / NX) | 0) + 0.5) * 0.5;
}

function nearestFree(free: Uint8Array, x: number, z: number): number {
   let best = -1;
   let bestD = Infinity;
   for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const id = iz * NX + ix;
      if (!free[id]) continue;
      const d = Math.hypot(centreX(id) - x, centreZ(id) - z);
      if (d < bestD) { bestD = d; best = id; }
   }
   return bestD <= 0.75 ? best : -1;
}

function pineBand(x: number, z: number): boolean {
   if (x < YARD.minX + 0.4 || x > YARD.maxX - 0.4 || z < YARD.minZ + 0.4 || z > YARD.maxZ - 0.4) return false;
   return Math.abs(x) >= PINE.bandX || Math.abs(z) >= PINE.bandZ;
}

/** null when the yard is legal. A short code otherwise, so each rule has a reject fixture. */
export function checkYard(yard: Yard): string | null {
   if (yard.forts.length !== FORT.count) return "count";
   if (yard.pines.length !== PINE.count) return "pine-count";
   for (let i = 0; i < yard.forts.length; i++) {
      const f = yard.forts[i];
      if (Math.abs(f.x) > FORT.areaX + 1e-6 || Math.abs(f.z) > FORT.areaZ + 1e-6) return "bounds";
      if (Math.hypot(f.x, f.z) < FORT.snowGap - 1e-6) return "snowman";
      for (let j = 0; j < i; j++) {
         const g = yard.forts[j];
         if (Math.hypot(f.x - g.x, f.z - g.z) < FORT.gap - 1e-6) return "gap";
      }
   }
   for (let i = 0; i < yard.pines.length; i++) {
      const p = yard.pines[i];
      if (!pineBand(p.x, p.z)) return "pine-band";
      for (let j = 0; j < i; j++) {
         const q = yard.pines[j];
         if (Math.hypot(p.x - q.x, p.z - q.z) < PINE.gap - 1e-6) return "pine-gap";
      }
   }
   if (!floodReaches(yard)) return "flood";
   if (!peekPocketsCovered(yard)) return "los";
   return null;
}

export function peeksCovered(yard: Yard): boolean {
   return peekPocketsCovered(yard);
}

function peekPocketsCovered(yard: Yard): boolean {
   const snowD = YARD.snowHalf + POCKET_OUT;
   const spots: number[] = [snowD, 0, -snowD, 0, 0, snowD, 0, -snowD];
   for (let i = 0; i < yard.forts.length; i++) {
      pocketsOf(yard.forts[i].x, yard.forts[i].z, 0);
      for (let p = 0; p < 4; p++) spots.push(POCKETS[p * 4], POCKETS[p * 4 + 1]);
   }
   for (let i = 0; i < yard.forts.length; i++) {
      const f = yard.forts[i];
      const pi = peekIndex(f.x, f.z);
      pocketsOf(f.x, f.z, 0);
      const px = POCKETS[pi * 4];
      const pz = POCKETS[pi * 4 + 1];
      let ok = false;
      for (let s = 0; s < spots.length; s += 2) {
         const d = Math.hypot(spots[s] - px, spots[s + 1] - pz);
         if (d < 0.2 || d > 6) continue;
         if (lineOfSight(yard.forts, px, pz, spots[s], spots[s + 1])) { ok = true; break; }
      }
      if (!ok) return false;
   }
   return true;
}

function baseYard(): Yard {
   return {
      forts: BASE_FORTS.map(([x, z]) => ({ x, z, hp: FORT.hp })),
      pines: BASE_PINES.map(([x, z], i) => ({ x, z, scale: 0.9 + (i % 3) * 0.15, rotY: i * 0.7 })),
   };
}

function jitterYard(rng: RngState): Yard {
   return {
      forts: BASE_FORTS.map(([x, z]) => ({
         x: x + (rngNext(rng) * 2 - 1) * 0.22,
         z: z + (rngNext(rng) * 2 - 1) * 0.22,
         hp: FORT.hp,
      })),
      pines: BASE_PINES.map(([x, z]) => ({
         x: x + (rngNext(rng) * 2 - 1) * 0.28,
         z: z + (rngNext(rng) * 2 - 1) * 0.28,
         scale: 0.75 + rngNext(rng) * 0.5,
         rotY: rngNext(rng) * Math.PI * 2,
      })),
   };
}

export function generateYard(seed: number): { yard: Yard; fallback: boolean } {
   const rng: RngState = { s: seed >>> 0 };
   for (let attempt = 0; attempt < 40; attempt++) {
      const yard = jitterYard(rng);
      if (checkYard(yard) === null) return { yard, fallback: false };
   }
   return { yard: baseYard(), fallback: true };
}

export function fallbackYard(): Yard {
   return baseYard();
}

function park(kid: Kid): void {
   kid.x = 80 + kid.id;
   kid.z = 80;
   kid.vx = 0;
   kid.vz = 0;
   kid.present = false;
}

function placeOnFort(kid: Kid, yard: { forts: readonly FortState[] }, fort: number, peek: boolean): void {
   if (fort < 0) {
      const snowD = YARD.snowHalf + POCKET_OUT;
      kid.x = 0; kid.z = -snowD; kid.fort = -1;
      kid.peekX = 0; kid.peekZ = -snowD;
      kid.destX = 0; kid.destZ = -snowD;
      return;
   }
   const f = yard.forts[fort];
   const pi = peekIndex(f.x, f.z);
   pocketsOf(f.x, f.z, 0);
   kid.fort = fort;
   kid.peekX = POCKETS[pi * 4];
   kid.peekZ = POCKETS[pi * 4 + 1];
   kid.x = kid.peekX;
   kid.z = kid.peekZ;
   kid.destX = kid.peekX;
   kid.destZ = kid.peekZ;
   if (!peek) { /* cover and peek share the inward pocket */ }
}

function nearestFort(yard: Yard, x: number, z: number, exclude: number): number {
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < yard.forts.length; i++) {
      if (i === exclude || yard.forts[i].hp < 1) continue;
      const d = Math.hypot(yard.forts[i].x - x, yard.forts[i].z - z);
      if (d < bestD) { bestD = d; best = i; }
   }
   return best;
}

function farthestFort(yard: Yard, x: number, z: number, exclude: number): number {
   let best = -1;
   let bestD = -1;
   for (let i = 0; i < yard.forts.length; i++) {
      if (i === exclude || yard.forts[i].hp < 1) continue;
      const d = Math.hypot(yard.forts[i].x - x, yard.forts[i].z - z);
      if (d > bestD) { bestD = d; best = i; }
   }
   return best;
}

function northernFort(yard: Yard): number {
   let best = -1;
   let bestZ = Infinity;
   for (let i = 0; i < yard.forts.length; i++) {
      if (yard.forts[i].hp < 1) continue;
      if (yard.forts[i].z < bestZ) { bestZ = yard.forts[i].z; best = i; }
   }
   return best;
}

export function createRun(seed: number, coarse: boolean): Run {
   const generated = generateYard(seed);
   const yard = generated.yard;
   const kids = [kid(0), kid(1), kid(2), kid(3)];
   const player = kids[0];
   player.present = true;
   player.alive = true;
   player.x = YARD.startX;
   player.z = YARD.startZ;
   player.yaw = YARD.startYaw;
   player.ammo = SCOOP.playerStart;
   player.state = "play";
   const thrower = kids[1];
   const dodger = kids[2];
   const sneaker = kids[3];
   const tFort = nearestFort(yard, player.x, player.z, -1);
   const dFort = farthestFort(yard, player.x, player.z, tFort);
   armRival(thrower, yard, tFort);
   armRival(dodger, yard, dFort < 0 ? tFort : dFort);
   sneaker.alive = true;
   sneaker.present = false;
   sneaker.ammo = 0;
   park(sneaker);
   const balls = Array.from({ length: BALLS }, emptyBall);
   const events = Array.from({ length: EVENTS }, () => ({ kind: "splat" as FxKind, x: 0, y: 0, z: 0, n: 0 }));
   return {
      seed, coarse, fallback: generated.fallback, time: 0,
      forts: yard.forts, pines: yard.pines, kids, balls,
      hits: 0, outs: 0, playerTags: 0, bank: 0, score: 0, scoreDelta: 0, endReason: null,
      scooping: false, scoopT: 0, scoopLock: false, throwCd: 0, campFort: -1, campT: 0,
      lastX: player.x, lastZ: player.z, highlight: -1, events, eventCount: 0,
   };
}

function armRival(kid: Kid, yard: Yard, fort: number): void {
   kid.present = true;
   kid.alive = true;
   kid.ammo = SCOOP.rivalStart;
   kid.state = "cover";
   kid.timer = AI.cover;
   kid.yaw = Math.atan2(-kid.x, -kid.z);
   placeOnFort(kid, yard, fort, true);
   kid.yaw = Math.atan2(YARD.startX - kid.x, YARD.startZ - kid.z);
}

function pushEvent(run: Run, kind: FxKind, x: number, y: number, z: number, n: number): void {
   if (run.eventCount >= EVENTS) return;
   const e = run.events[run.eventCount++];
   e.kind = kind; e.x = x; e.y = y; e.z = z; e.n = n;
}

function living(kid: Kid): boolean {
   return kid.present && kid.alive;
}

export function isCrouch(run: Run, kid: Kid): boolean {
   if (!living(kid)) return false;
   if (Math.hypot(kid.vx, kid.vz) >= KID.crouchSpeed) return false;
   writeBox(STILL, 0, 0, YARD.snowHalf, YARD.snowHeight);
   if (distanceToBoxXZ(kid.x, kid.z, STILL) <= KID.crouchBand) return true;
   for (let i = 0; i < run.forts.length; i++) {
      const f = run.forts[i];
      if (f.hp < 1) continue;
      writeBox(STILL, f.x, f.z, FORT.half, 1);
      if (distanceToBoxXZ(kid.x, kid.z, STILL) <= KID.crouchBand) return true;
   }
   return false;
}

function nearCover(run: Run, kid: Kid): boolean {
   writeBox(STILL, 0, 0, YARD.snowHalf, YARD.snowHeight);
   if (distanceToBoxXZ(kid.x, kid.z, STILL) <= KID.crouchBand) return true;
   for (let i = 0; i < run.forts.length; i++) {
      if (run.forts[i].hp < 1) continue;
      writeBox(STILL, run.forts[i].x, run.forts[i].z, FORT.half, 1);
      if (distanceToBoxXZ(kid.x, kid.z, STILL) <= KID.crouchBand) return true;
   }
   return false;
}

function rooted(kid: Kid): boolean {
   return kid.state === "windup" || kid.state === "recover" || kid.state === "stagger" || kid.state === "knockdown";
}

function inSlot(kid: Kid): boolean {
   return kid.state === "peek" || kid.state === "windup" || kid.state === "recover";
}

function yawBetween(from: number, to: number): number {
   let diff = (to - from) % (2 * Math.PI);
   if (diff > Math.PI) diff -= 2 * Math.PI;
   if (diff < -Math.PI) diff += 2 * Math.PI;
   return diff;
}

function turnFrac(from: number, to: number, rate: number, dt: number): number {
   const ad = Math.abs(yawBetween(from, to));
   if (ad < 1e-6) return 1;
   return Math.min(1, (rate * dt) / ad);
}

function face(kid: Kid, x: number, z: number, dt: number): void {
   const yaw = Math.atan2(x - kid.x, z - kid.z);
   kid.yaw = turnTowards(kid.yaw, yaw, turnFrac(kid.yaw, yaw, KID.turn, dt));
}

function accelerate(kid: Kid, desX: number, desZ: number, dt: number): void {
   const desLen = Math.hypot(desX, desZ);
   let tx = 0;
   let tz = 0;
   if (desLen > 1e-6) {
      const s = Math.min(KID.speed, desLen) / desLen;
      tx = desX * s;
      tz = desZ * s;
   }
   const dx = tx - kid.vx;
   const dz = tz - kid.vz;
   const err = Math.hypot(dx, dz);
   if (err < 1e-8) return;
   const speeding = tx * kid.vx + tz * kid.vz >= kid.vx * kid.vx + kid.vz * kid.vz - 1e-6;
   const rate = speeding ? KID.accel : KID.brake;
   const step = Math.min(err, rate * dt);
   kid.vx += (dx / err) * step;
   kid.vz += (dz / err) * step;
   const sp = Math.hypot(kid.vx, kid.vz);
   if (sp > KID.speed) {
      kid.vx = (kid.vx / sp) * KID.speed;
      kid.vz = (kid.vz / sp) * KID.speed;
   }
}

function fillSep(run: Run): void {
   SEP.length = 0;
   for (let i = 0; i < run.kids.length; i++) if (living(run.kids[i])) SEP.push(run.kids[i]);
}

function steerToward(run: Run, kid: Kid, x: number, z: number, slow: number, dt: number, fleeFrom: boolean): void {
   TARGET.x = x; TARGET.y = 0; TARGET.z = z;
   if (fleeFrom) flee(kid, TARGET, KID.speed, STEER);
   else arrive(kid, TARGET, KID.speed, slow, STEER);
   fillSep(run);
   separate(kid, SEP, AI.separateRadius, AI.separateSpeed, SEP_OUT);
   accelerate(kid, STEER.x + kid.vx + SEP_OUT.x, STEER.z + kid.vz + SEP_OUT.z, dt);
   const sp = Math.hypot(kid.vx, kid.vz);
   if (sp > 0.15) face(kid, kid.x + kid.vx, kid.z + kid.vz, dt);
}

function clampKid(kid: Kid): void {
   CLAMP.x = kid.x; CLAMP.y = 0; CLAMP.z = kid.z;
   clampToBounds(CLAMP, BOUNDS, YARD.inset, CLAMP);
   kid.x = CLAMP.x;
   kid.z = CLAMP.z;
}

const BEST: SweepHit = { time: 0, normalX: 0, normalZ: 0 };
const DELTA = { x: 0, z: 0 };

function noteSweep(found: boolean): boolean {
   const t = SWEEP.time;
   if (!found || t < BEST.time) {
      BEST.time = t;
      BEST.normalX = SWEEP.normalX;
      BEST.normalZ = SWEEP.normalZ;
      return true;
   }
   return found;
}

function staticHit(run: Run, kid: Kid, dx: number, dz: number): SweepHit | null {
   MOVE_BOX.min.x = kid.x - KID.radius; MOVE_BOX.max.x = kid.x + KID.radius;
   MOVE_BOX.min.z = kid.z - KID.radius; MOVE_BOX.max.z = kid.z + KID.radius;
   MOVE_BOX.min.y = 0; MOVE_BOX.max.y = 1;
   DELTA.x = dx; DELTA.z = dz;
   let found = false;
   writeBox(STILL, 0, 0, YARD.snowHalf, YARD.snowHeight);
   if (sweptAabbXZ(MOVE_BOX, DELTA, STILL, SWEEP) !== null) found = noteSweep(found);
   for (let i = 0; i < run.forts.length; i++) {
      if (run.forts[i].hp < 1) continue;
      writeBox(STILL, run.forts[i].x, run.forts[i].z, FORT.half, 1);
      if (sweptAabbXZ(MOVE_BOX, DELTA, STILL, SWEEP) !== null) found = noteSweep(found);
   }
   return found ? BEST : null;
}

function pushOut(kid: Kid, cx: number, cz: number, half: number): void {
   writeBox(STILL, cx, cz, half, 1);
   const r = KID.radius;
   const gap = 0.04;
   if (kid.x + r + gap <= STILL.min.x || kid.x - r - gap >= STILL.max.x) return;
   if (kid.z + r + gap <= STILL.min.z || kid.z - r - gap >= STILL.max.z) return;
   const left = kid.x + r - STILL.min.x;
   const right = STILL.max.x - (kid.x - r);
   const down = kid.z + r - STILL.min.z;
   const up = STILL.max.z - (kid.z - r);
   const skin = 0.04;
   const m = Math.min(left, right, down, up);
   if (m === left) kid.x = STILL.min.x - r - skin;
   else if (m === right) kid.x = STILL.max.x + r + skin;
   else if (m === down) kid.z = STILL.min.z - r - skin;
   else kid.z = STILL.max.z + r + skin;
}

function depenetrate(run: Run, kid: Kid): void {
   pushOut(kid, 0, 0, YARD.snowHalf);
   for (let i = 0; i < run.forts.length; i++) {
      if (run.forts[i].hp < 1) continue;
      pushOut(kid, run.forts[i].x, run.forts[i].z, FORT.half);
   }
}

function separateCircles(run: Run): void {
   const kids = run.kids;
   for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      if (!living(kids[i]) || !living(kids[j])) continue;
      let dx = kids[j].x - kids[i].x;
      let dz = kids[j].z - kids[i].z;
      let dist = Math.hypot(dx, dz);
      const need = KID.radius * 2;
      if (dist >= need) continue;
      if (dist < 1e-6) { dx = 1; dz = 0; dist = 1; }
      const push = (need - dist) / 2 / dist;
      kids[i].x -= dx * push;
      kids[i].z -= dz * push;
      kids[j].x += dx * push;
      kids[j].z += dz * push;
   }
   for (let i = 0; i < kids.length; i++) {
      if (!living(kids[i])) continue;
      for (let p = 0; p < run.pines.length; p++) {
         const pine = run.pines[p];
         let dx = kids[i].x - pine.x;
         let dz = kids[i].z - pine.z;
         let dist = Math.hypot(dx, dz);
         const need = KID.radius + PINE.trunk;
         if (dist >= need) continue;
         if (dist < 1e-6) { dx = 1; dz = 0; dist = 1; }
         const push = (need - dist) / dist;
         kids[i].x += dx * push;
         kids[i].z += dz * push;
      }
   }
}

function integrate(run: Run, kid: Kid, h: number): void {
   if (!living(kid)) return;
   const sp = Math.hypot(kid.vx, kid.vz);
   if (sp > KID.speed) {
      kid.vx = (kid.vx / sp) * KID.speed;
      kid.vz = (kid.vz / sp) * KID.speed;
   }
   const dx = kid.vx * h;
   const dz = kid.vz * h;
   const max = KID.speed * h + 1e-9;
   const moved = Math.hypot(dx, dz);
   const scale = moved > max ? max / moved : 1;
   const hit = staticHit(run, kid, dx * scale, dz * scale);
   if (!hit) {
      kid.x += dx * scale;
      kid.z += dz * scale;
   } else {
      const t = hit.time <= 0 ? 0 : Math.min(1, hit.time);
      kid.x += dx * scale * t;
      kid.z += dz * scale * t;
      let lx = dx * scale * (1 - t);
      let lz = dz * scale * (1 - t);
      const into = lx * hit.normalX + lz * hit.normalZ;
      if (into < 0) { lx -= hit.normalX * into; lz -= hit.normalZ * into; }
      if (hit.normalX < 0) kid.vx = Math.min(kid.vx, 0);
      else if (hit.normalX > 0) kid.vx = Math.max(kid.vx, 0);
      if (hit.normalZ < 0) kid.vz = Math.min(kid.vz, 0);
      else if (hit.normalZ > 0) kid.vz = Math.max(kid.vz, 0);
      const slide = Math.abs(lx) > 1e-8 || Math.abs(lz) > 1e-8;
      if (slide && !staticHit(run, kid, lx, lz)) {
         kid.x += lx;
         kid.z += lz;
      } else if (hit.normalX !== 0 || hit.normalZ !== 0) {
         const tx = -hit.normalZ;
         const tz = hit.normalX;
         const step = 0.04;
         const dir = kid.id % 2 === 0 ? 1 : -1;
         if (!staticHit(run, kid, tx * step * dir, tz * step * dir)) {
            kid.x += tx * step * dir;
            kid.z += tz * step * dir;
         } else if (!staticHit(run, kid, -tx * step * dir, -tz * step * dir)) {
            kid.x -= tx * step * dir;
            kid.z -= tz * step * dir;
         }
      }
   }
}

function moveAll(run: Run, h: number): void {
   for (let i = 0; i < run.kids.length; i++) integrate(run, run.kids[i], h);
   separateCircles(run);
   for (let i = 0; i < run.kids.length; i++) if (living(run.kids[i])) {
      depenetrate(run, run.kids[i]);
      clampKid(run.kids[i]);
   }
}

export function highlightOf(run: Run, yaw: number): number {
   const player = run.kids[0];
   PA.x = player.x; PA.y = 0; PA.z = player.z;
   let best = -1;
   let bestAng = Infinity;
   for (let i = 1; i < run.kids.length; i++) {
      const rival = run.kids[i];
      if (!living(rival)) continue;
      PB.x = rival.x; PB.y = 0; PB.z = rival.z;
      if (!inViewCone(PA, yaw, THROW.halfAngle, THROW.range, PB)) continue;
      if (!lineOfSight(run.forts, player.x, player.z, rival.x, rival.z)) continue;
      const ang = Math.abs(yawBetween(yaw, Math.atan2(rival.x - player.x, rival.z - player.z)));
      if (ang < bestAng - 1e-9 || (Math.abs(ang - bestAng) <= 1e-9 && (best < 0 || rival.id < best))) {
         bestAng = ang;
         best = rival.id;
      }
   }
   return best;
}

function allocBall(run: Run): Ball | null {
   for (let i = 0; i < run.balls.length; i++) if (!run.balls[i].alive) return run.balls[i];
   return null;
}

function launchOrigin(kid: Kid): void {
   FROM.x = kid.x + Math.sin(kid.yaw) * THROW.launchForward;
   FROM.y = THROW.launchY;
   FROM.z = kid.z + Math.cos(kid.yaw) * THROW.launchForward;
}

function launchLob(run: Run, owner: Kid, tx: number, tz: number, targetVx: number, targetVz: number, radius: number): Ball | null {
   const dist = Math.hypot(tx - owner.x, tz - owner.z);
   const ft = flightTime(dist);
   let lx = tx + targetVx * ft;
   let lz = tz + targetVz * ft;
   CLAMP.x = lx; CLAMP.y = 0; CLAMP.z = lz;
   clampToBounds(CLAMP, BOUNDS, YARD.inset, CLAMP);
   lx = CLAMP.x; lz = CLAMP.z;
   launchOrigin(owner);
   LEAD.x = lx; LEAD.y = THROW.targetY; LEAD.z = lz;
   launchForTime(FROM, LEAD, ft, GRAV, VEL);
   const ball = allocBall(run);
   if (!ball) return null;
   ball.alive = true;
   ball.roller = false;
   ball.owner = owner.id;
   ball.x0 = FROM.x; ball.y0 = FROM.y; ball.z0 = FROM.z;
   ball.vx = VEL.x; ball.vy = VEL.y; ball.vz = VEL.z;
   ball.age = 0;
   ball.flight = ft;
   ball.ix = lx; ball.iy = THROW.targetY; ball.iz = lz;
   ball.r = radius;
   ball.x = FROM.x; ball.y = FROM.y; ball.z = FROM.z;
   PROJ.x = ball.x0; PROJ.y = ball.y0; PROJ.z = ball.z0;
   PROJ.vx = ball.vx; PROJ.vy = ball.vy; PROJ.vz = ball.vz;
   // The intercept is the closed-form point at flight time (landingPoint against y = targetY).
   const land = landingPoint(PROJ, GRAV, THROW.targetY, SAMPLE);
   ball.ix = land ? land.x : lx;
   ball.iz = land ? land.z : lz;
   ball.iy = 0.04;
   run.lastX = lx;
   run.lastZ = lz;
   owner.throwAnim = 1;
   pushEvent(run, "throw", FROM.x, FROM.y, FROM.z, owner.id);
   return ball;
}

function launchRoller(run: Run): void {
   const player = run.kids[0];
   let rollers = 0;
   for (let i = 0; i < run.balls.length; i++) if (run.balls[i].alive && run.balls[i].roller) rollers++;
   if (rollers >= 2) return;
   const ball = allocBall(run);
   if (!ball) return;
   const yaw = player.yaw;
   ball.alive = true;
   ball.roller = true;
   ball.owner = 0;
   ball.x0 = player.x + Math.sin(yaw) * 0.5;
   ball.y0 = THROW.rollerY;
   ball.z0 = player.z + Math.cos(yaw) * 0.5;
   ball.vx = Math.sin(yaw) * THROW.rollerSpeed;
   ball.vy = 0;
   ball.vz = Math.cos(yaw) * THROW.rollerSpeed;
   ball.age = 0;
   ball.flight = THROW.rollerLife;
   ball.r = THROW.rollerR;
   ball.x = ball.x0; ball.y = ball.y0; ball.z = ball.z0;
   ball.ix = ball.x0 + ball.vx * THROW.rollerLife;
   ball.iy = THROW.rollerY;
   ball.iz = ball.z0 + ball.vz * THROW.rollerLife;
   pushEvent(run, "throw", ball.x0, ball.y0, ball.z0, 0);
}

function tryThrow(run: Run, input: StepInput): void {
   const player = run.kids[0];
   if (run.scooping || run.throwCd > 0 || player.ammo <= 0 || run.endReason) return;
   let target = -1;
   if (run.coarse) {
      if (input.tapId < 1) return;
      const rival = run.kids[input.tapId];
      if (!rival || !living(rival)) return;
      if (!lineOfSight(run.forts, player.x, player.z, rival.x, rival.z)) return;
      target = input.tapId;
   } else {
      if (!input.fire) return;
      target = highlightOf(run, input.aimYaw);
      if (target < 0) return;
   }
   const rival = run.kids[target];
   player.yaw = Math.atan2(rival.x - player.x, rival.z - player.z);
   const radius = run.coarse ? THROW.coarseR : THROW.ballR;
   const ball = launchLob(run, player, rival.x, rival.z, rival.vx, rival.vz, radius);
   if (!ball) return;
   player.ammo -= 1;
   run.throwCd = SCOOP.throwGap;
}

function addPoints(run: Run, out: boolean): void {
   run.hits += 1;
   let delta = SCORE.hit;
   if (out) {
      run.outs += 1;
      delta += SCORE.out;
   }
   run.bank += delta;
   run.scoreDelta += delta;
   run.score = run.bank;
}

function tagRival(run: Run, rival: Kid, roller: boolean): "score" | "immune" | "no" {
   if (!living(rival)) return "no";
   if (rival.immune > 0) return "immune";
   rival.tags += 1;
   const out = rival.tags >= SCORE.tagsOut;
   addPoints(run, out);
   pushEvent(run, "tag", rival.x, 1.7, rival.z, out ? SCORE.hit + SCORE.out : SCORE.hit);
   rival.vx = 0;
   rival.vz = 0;
   rival.dodge = 0;
   rival.state = roller ? "knockdown" : "stagger";
   rival.timer = roller ? AI.knockdown : AI.stagger;
   rival.immune = rival.timer;
   rival.flail = 0;
   if (roller) pushEvent(run, "down", rival.x, 0.6, rival.z, 0);
   if (out) {
      rival.alive = false;
      park(rival);
   }
   return "score";
}

function tagPlayer(run: Run, x: number, z: number): void {
   run.playerTags += 1;
   pushEvent(run, "hurt", x, 1, z, run.playerTags);
}

function finish(run: Run, reason: EndName): void {
   if (run.endReason) return;
   run.endReason = reason;
   run.score = runScore(run.hits, run.outs, reason === "win", run.playerTags);
}

function maybeEnd(run: Run): void {
   if (run.endReason) return;
   if (run.outs >= SCORE.rivals) finish(run, "win");
   else if (run.playerTags >= SCORE.tagsLose) finish(run, "lose");
}

function entryT(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, box: AABB, maxY: number): number | null {
   const dx = x1 - x0;
   const dy = y1 - y0;
   const dz = z1 - z0;
   let lo = 0;
   let hi = 1;
   const slab = (p: number, d: number, min: number, max: number): boolean => {
      if (Math.abs(d) < 1e-12) return p >= min - 1e-8 && p <= max + 1e-8;
      let t0 = (min - p) / d;
      let t1 = (max - p) / d;
      if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
      if (t0 > lo) lo = t0;
      if (t1 < hi) hi = t1;
      return lo <= hi + 1e-8;
   };
   if (!slab(x0, dx, box.min.x, box.max.x)) return null;
   if (!slab(z0, dz, box.min.z, box.max.z)) return null;
   if (!slab(y0, dy, 0, maxY)) return null;
   if (hi < 0 || lo > 1) return null;
   return Math.max(0, lo);
}

function blockBall(run: Run, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
   let best = 2;
   let which = -2;
   writeBox(STILL, 0, 0, YARD.snowHalf, YARD.snowHeight);
   const snow = entryT(x0, y0, z0, x1, y1, z1, STILL, YARD.snowHeight);
   if (snow !== null && snow < best) { best = snow; which = -1; }
   for (let i = 0; i < run.forts.length; i++) {
      if (run.forts[i].hp < 1) continue;
      const h = fortHeight(run.forts[i].hp);
      writeBox(STILL, run.forts[i].x, run.forts[i].z, FORT.half, h);
      const t = entryT(x0, y0, z0, x1, y1, z1, STILL, h);
      if (t !== null && t < best) { best = t; which = i; }
   }
   return which;
}

function hurtFort(run: Run, index: number): void {
   const fort = run.forts[index];
   if (fort.hp < 1) return;
   fort.hp -= 1;
   pushEvent(run, "crumble", fort.x, Math.max(0.3, fortHeight(fort.hp)), fort.z, fort.hp);
}

function overlaps(run: Run, ball: Ball, x: number, y: number, z: number, kid: Kid): boolean {
   if (!living(kid)) return false;
   const crouch = isCrouch(run, kid);
   CENTRE.x = x; CENTRE.y = y; CENTRE.z = z;
   SPHERE.x = kid.x; SPHERE.z = kid.z;
   SPHERE.y = crouch ? KID.crouchBodyY : KID.standBodyY;
   const bodyR = crouch ? KID.crouchBodyR : KID.standBodyR;
   if (spheresOverlap(CENTRE, ball.r, SPHERE, bodyR)) return true;
   SPHERE.y = crouch ? KID.crouchHeadY : KID.standHeadY;
   const headR = crouch ? KID.crouchHeadR : KID.standHeadR;
   return spheresOverlap(CENTRE, ball.r, SPHERE, headR);
}

function resolveBall(run: Run, ball: Ball, h: number): void {
   if (!ball.alive || run.endReason) return;
   const age0 = ball.age;
   const age1 = age0 + h;
   if (ball.roller) {
      PREV.x = ball.x0 + ball.vx * age0;
      PREV.y = THROW.rollerY;
      PREV.z = ball.z0 + ball.vz * age0;
      const end = Math.min(age1, ball.flight);
      SAMPLE.x = ball.x0 + ball.vx * end;
      SAMPLE.y = THROW.rollerY;
      SAMPLE.z = ball.z0 + ball.vz * end;
      const blocked = blockBall(run, PREV.x, PREV.y, PREV.z, SAMPLE.x, SAMPLE.y, SAMPLE.z);
      if (blocked >= 0) {
         hurtFort(run, blocked);
         ball.alive = false;
         pushEvent(run, "splat", run.forts[blocked].x, 0.4, run.forts[blocked].z, 0);
         return;
      }
      if (blocked === -1) {
         ball.alive = false;
         pushEvent(run, "splat", 0, 0.4, 0, 0);
         return;
      }
      ball.age = end;
      ball.x = SAMPLE.x; ball.y = SAMPLE.y; ball.z = SAMPLE.z;
      // A rolling ball's stored impact follows it, so a dodge reads the threat that is actually arriving.
      ball.ix = SAMPLE.x + ball.vx * 0.25;
      ball.iz = SAMPLE.z + ball.vz * 0.25;
      for (let i = 1; i < run.kids.length; i++) {
         if (!overlaps(run, ball, ball.x, ball.y, ball.z, run.kids[i])) continue;
         const result = tagRival(run, run.kids[i], true);
         if (result !== "no") {
            ball.alive = false;
            return;
         }
      }
      if (end >= ball.flight - 1e-9) {
         ball.alive = false;
         pushEvent(run, "splat", ball.x, 0.2, ball.z, 0);
      }
      return;
   }
   const sampleAt = (age: number, out: Vec3Like) => {
      const t = age;
      out.x = ball.x0 + ball.vx * t;
      out.y = ball.y0 + ball.vy * t - GRAVITY * t * t * 0.5;
      out.z = ball.z0 + ball.vz * t;
   };
   sampleAt(age0, PREV);
   const end = Math.min(age1, ball.flight);
   sampleAt(end, SAMPLE);
   const blocked = blockBall(run, PREV.x, PREV.y, PREV.z, SAMPLE.x, SAMPLE.y, SAMPLE.z);
   if (blocked >= 0) {
      hurtFort(run, blocked);
      ball.alive = false;
      pushEvent(run, "splat", run.forts[blocked].x, 0.45, run.forts[blocked].z, 0);
      return;
   }
   if (blocked === -1) {
      ball.alive = false;
      pushEvent(run, "splat", SAMPLE.x, 0.4, SAMPLE.z, 0);
      return;
   }
   ball.age = end;
   ball.x = SAMPLE.x; ball.y = SAMPLE.y; ball.z = SAMPLE.z;
   const playerBall = ball.owner === 0;
   if (playerBall) {
      for (let i = 1; i < run.kids.length; i++) {
         if (!overlaps(run, ball, ball.x, ball.y, ball.z, run.kids[i])) continue;
         const result = tagRival(run, run.kids[i], false);
         if (result !== "no") { ball.alive = false; return; }
      }
   } else if (overlaps(run, ball, ball.x, ball.y, ball.z, run.kids[0])) {
      tagPlayer(run, run.kids[0].x, run.kids[0].z);
      ball.alive = false;
      return;
   }
   if (end >= ball.flight - 1e-8) {
      ball.alive = false;
      pushEvent(run, "splat", ball.ix, 0.15, ball.iz, 0);
   }
}

function resolveOwned(run: Run, h: number, player: boolean): void {
   for (let i = 0; i < run.balls.length; i++) {
      const ball = run.balls[i];
      if (!ball.alive) continue;
      if ((ball.owner === 0) !== player) continue;
      resolveBall(run, ball, h);
      if (run.endReason) return;
   }
}

function considerDodge(run: Run, kid: Kid): void {
   if (!living(kid) || rooted(kid) || kid.dodge > 0) return;
   const delay = dodgeDelay(run.time);
   let best: number = AI.dodgeRange;
   let bx = 0;
   let bz = 0;
   let found = false;
   for (let i = 0; i < run.balls.length; i++) {
      const ball = run.balls[i];
      if (!ball.alive || ball.owner === kid.id) continue;
      if (ball.age < delay) continue;
      const d = Math.hypot(ball.ix - kid.x, ball.iz - kid.z);
      if (d <= best) { best = d; bx = ball.ix; bz = ball.iz; found = true; }
   }
   if (!found) return;
   kid.dodge = AI.dodgeTime;
   kid.dodgeX = bx;
   kid.dodgeZ = bz;
}

function startRelocate(run: Run, kid: Kid): void {
   const player = run.kids[0];
   let fort = -1;
   if (kid.fort >= 0 && run.forts[kid.fort].hp >= 1) fort = kid.fort;
   else if (kid.id === 1) fort = nearestFort(run, player.x, player.z, kid.fort);
   else if (kid.id === 2) fort = farthestFort(run, run.lastX, run.lastZ, kid.fort);
   else {
      let best = -1;
      let bestAng = -1;
      for (let i = 0; i < run.forts.length; i++) {
         if (i === kid.fort || run.forts[i].hp < 1) continue;
         const ang = Math.abs(yawBetween(player.yaw, Math.atan2(run.forts[i].x - player.x, run.forts[i].z - player.z)));
         if (ang > bestAng) { bestAng = ang; best = i; }
      }
      fort = best;
   }
   if (fort < 0) {
      const snowD = YARD.snowHalf + POCKET_OUT;
      const options = [[snowD, 0], [-snowD, 0], [0, snowD], [0, -snowD]];
      let best = 0;
      let bestD = -1;
      for (let i = 0; i < options.length; i++) {
         const d = Math.hypot(options[i][0] - player.x, options[i][1] - player.z);
         if (d > bestD) { bestD = d; best = i; }
      }
      kid.destX = options[best][0];
      kid.destZ = options[best][1];
      kid.peekX = kid.destX;
      kid.peekZ = kid.destZ;
      kid.fort = -1;
   } else {
      const f = run.forts[fort];
      const face = facePair(f.x, f.z, player.x, player.z);
      pocketsOf(f.x, f.z, 0);
      const sideA = face.peek < 2 ? 2 : 0;
      const sideB = sideA + 1;
      let cover = sideA;
      let best = -1;
      for (let s = 0; s < 2; s++) {
         const i = s === 0 ? sideA : sideB;
         const px = POCKETS[i * 4];
         const pz = POCKETS[i * 4 + 1];
         const blocked = lineOfSight(run.forts, px, pz, player.x, player.z) ? 0 : 100;
         const score = blocked + Math.hypot(px - player.x, pz - player.z);
         if (score > best) { best = score; cover = i; }
      }
      if (best < 100) cover = face.peek ^ 1;
      kid.peekX = face.peekX;
      kid.peekZ = face.peekZ;
      kid.destX = POCKETS[cover * 4];
      kid.destZ = POCKETS[cover * 4 + 1];
      kid.fort = fort;
   }
   kid.state = "relocate";
   kid.timer = 0;
   kid.scoopT = 0;
}

function updateOpen(run: Run, kid: Kid, h: number): void {
   if (!living(kid)) return;
   const root = rooted(kid);
   const exposed = !root && lineOfSight(run.forts, kid.x, kid.z, run.kids[0].x, run.kids[0].z) && !nearCover(run, kid);
   if (exposed) kid.openT += h;
   else if (!root) {
      kid.openT = 0;
      kid.relocateQueued = false;
   }
   if (kid.openT >= AI.openLimit) kid.relocateQueued = true;
   if (kid.relocateQueued && !root && kid.state !== "relocate" && kid.state !== "cover" && kid.state !== "peek") {
      startRelocate(run, kid);
      kid.relocateQueued = false;
      kid.openT = 0;
   }
}

const GOAL = { x: 0, z: 0 };

function segmentHitsBox(x0: number, z0: number, x1: number, z1: number, fx: number, fz: number, half: number): boolean {
   writeBox(STILL, fx, fz, half, 1);
   return entryT(x0, 0.4, z0, x1, 0.4, z1, STILL, 1) !== null;
}

/** Walk to a point. A straight line through a fort or the snowman takes an outside corner. */
function routeTo(run: Run, x: number, z: number, tx: number, tz: number): { x: number; z: number } {
   GOAL.x = tx;
   GOAL.z = tz;
   let fx = 0;
   let fz = 0;
   let half = 0;
   const body = KID.radius;
   let blocked = segmentHitsBox(x, z, tx, tz, 0, 0, YARD.snowHalf + body);
   if (blocked) half = YARD.snowHalf;
   if (!blocked) {
      for (let i = 0; i < run.forts.length; i++) {
         if (run.forts[i].hp < 1) continue;
         if (!segmentHitsBox(x, z, tx, tz, run.forts[i].x, run.forts[i].z, FORT.half + body)) continue;
         blocked = true;
         fx = run.forts[i].x;
         fz = run.forts[i].z;
         half = FORT.half;
         break;
      }
   }
   if (!blocked) return GOAL;
   const out = half + 0.7;
   let best = Infinity;
   for (let i = 0; i < 4; i++) {
      const cx = fx + (i & 1 ? out : -out);
      const cz = fz + (i & 2 ? out : -out);
      if (segmentHitsBox(x, z, cx, cz, fx, fz, half)) continue;
      const cost = Math.hypot(x - cx, z - cz) + Math.hypot(tx - cx, tz - cz);
      if (cost < best) { best = cost; GOAL.x = cx; GOAL.z = cz; }
   }
   return GOAL;
}

function stepClear(run: Run, x: number, z: number, tx: number, tz: number): boolean {
   if (tx < YARD.minX + YARD.inset || tx > YARD.maxX - YARD.inset) return false;
   if (tz < YARD.minZ + YARD.inset || tz > YARD.maxZ - YARD.inset) return false;
   if (segmentHitsBox(x, z, tx, tz, 0, 0, YARD.snowHalf + KID.radius)) return false;
   for (let i = 0; i < run.forts.length; i++) {
      if (run.forts[i].hp < 1) continue;
      if (segmentHitsBox(x, z, tx, tz, run.forts[i].x, run.forts[i].z, FORT.half + KID.radius)) return false;
   }
   return true;
}

/** A rival pressed into a corner takes a short step that still gets closer to the goal. */
function unstick(run: Run, kid: Kid, tx: number, tz: number): void {
   const fort = kid.fort >= 0 ? run.forts[kid.fort] : undefined;
   if (fort && fort.hp >= 1) {
      const out = FORT.half + KID.radius + 0.55;
      const want = Math.atan2(tx - fort.x, tz - fort.z);
      const have = Math.atan2(kid.x - fort.x, kid.z - fort.z);
      let diff = want - have;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      const ang = have + Math.max(-0.35, Math.min(0.35, diff));
      const sx = fort.x + Math.sin(ang) * out;
      const sz = fort.z + Math.cos(ang) * out;
      if (stepClear(run, kid.x, kid.z, sx, sz)) {
         kid.x = sx;
         kid.z = sz;
         kid.vx = 0;
         kid.vz = 0;
         return;
      }
   }
   const dx = tx - kid.x;
   const dz = tz - kid.z;
   const len = Math.hypot(dx, dz) || 1;
   const sx = kid.x + (-dz / len) * 0.6;
   const sz = kid.z + (dx / len) * 0.6;
   if (!stepClear(run, kid.x, kid.z, sx, sz)) return;
   kid.x = sx;
   kid.z = sz;
   kid.vx = 0;
   kid.vz = 0;
}

function watchStuck(run: Run, kid: Kid, h: number, tx: number, tz: number): void {
   if (kid.stuck === 0) { kid.markX = kid.x; kid.markZ = kid.z; }
   kid.stuck += h;
   if (kid.stuck < 0.3) return;
   if (Math.hypot(kid.x - kid.markX, kid.z - kid.markZ) < 0.25) unstick(run, kid, tx, tz);
   kid.stuck = 0;
   kid.markX = kid.x;
   kid.markZ = kid.z;
}

function aiKid(run: Run, kid: Kid, h: number): void {
   if (!living(kid) || run.endReason) return;
   if (kid.immune > 0) kid.immune = Math.max(0, kid.immune - h);
   if (kid.throwAnim > 0) kid.throwAnim = Math.max(0, kid.throwAnim - h / 0.35);
   considerDodge(run, kid);
   updateOpen(run, kid, h);
   if (kid.state === "stagger" || kid.state === "knockdown") {
      kid.flail += h;
      kid.vx = 0; kid.vz = 0;
      kid.timer -= h;
      if (kid.timer <= 0) startRelocate(run, kid);
      return;
   }
   if (kid.dodge > 0) {
      kid.dodge -= h;
      steerToward(run, kid, kid.dodgeX, kid.dodgeZ, 0, h, true);
      return;
   }
   if (kid.state === "windup" || kid.state === "recover") {
      kid.vx = 0; kid.vz = 0;
      face(kid, run.kids[0].x, run.kids[0].z, h);
      kid.timer -= h;
      if (kid.state === "windup" && kid.timer <= 0) {
         const see = lineOfSight(run.forts, kid.x, kid.z, run.kids[0].x, run.kids[0].z);
         if (see && kid.ammo > 0) {
            const player = run.kids[0];
            const ball = launchLob(run, kid, player.x, player.z, player.vx, player.vz, THROW.ballR);
            if (ball) kid.ammo -= 1;
         }
         kid.state = "recover";
         kid.timer = AI.recover;
      } else if (kid.state === "recover" && kid.timer <= 0) startRelocate(run, kid);
      return;
   }
   if (kid.state === "cover") {
      steerToward(run, kid, kid.destX, kid.destZ, AI.slowRadius, h, false);
      const blocked = !lineOfSight(run.forts, kid.x, kid.z, run.kids[0].x, run.kids[0].z);
      if (blocked && kid.ammo < 1 && kid.scoopT < SCOOP_S) {
         kid.scoopT += h;
         kid.vx = 0; kid.vz = 0;
         if (kid.scoopT >= SCOOP_S) kid.ammo = Math.min(SCOOP.rivalMax, kid.ammo + 1);
      }
      kid.timer -= h;
      if (kid.timer <= 0) kid.state = "ready";
      return;
   }
   if (kid.state === "ready" && kid.ammo < 1) {
      startRelocate(run, kid);
      return;
   }
   if (kid.state === "ready" || kid.state === "peek") {
      const goal = routeTo(run, kid.x, kid.z, kid.peekX, kid.peekZ);
      steerToward(run, kid, goal.x, goal.z, AI.slowRadius, h, false);
      if (kid.state === "peek") {
         kid.timer -= h;
         const arrived = Math.hypot(kid.x - kid.peekX, kid.z - kid.peekZ) <= AI.arriveReach;
         if (kid.timer <= 0 && arrived) {
            if (kid.ammo > 0 && lineOfSight(run.forts, kid.x, kid.z, run.kids[0].x, run.kids[0].z)) {
               kid.state = "windup";
               kid.timer = AI.windup;
               kid.vx = 0; kid.vz = 0;
            } else kid.state = "ready";
         }
      }
      watchStuck(run, kid, h, kid.peekX, kid.peekZ);
      return;
   }
   if (kid.state === "relocate") {
      const goal = routeTo(run, kid.x, kid.z, kid.destX, kid.destZ);
      steerToward(run, kid, goal.x, goal.z, 0, h, false);
      watchStuck(run, kid, h, kid.destX, kid.destZ);
      kid.timer += h;
      const arrived = Math.hypot(kid.x - kid.destX, kid.z - kid.destZ) <= AI.arriveReach;
      if (kid.timer >= RELOCATE_MIN_S && arrived) {
         kid.state = "cover";
         kid.timer = AI.cover;
         kid.scoopT = 0;
      }
   }
}

function fillSlot(run: Run): void {
   if (run.endReason) return;
   const cap = run.time >= AI.slotAt ? 2 : 1;
   let used = 0;
   for (let i = 1; i < run.kids.length; i++) if (living(run.kids[i]) && inSlot(run.kids[i])) used++;
   if (used >= cap) return;
   for (let i = 1; i < run.kids.length; i++) {
      const kid = run.kids[i];
      if (!living(kid) || kid.state !== "ready" || kid.ammo <= 0) continue;
      if (Math.hypot(kid.x - kid.peekX, kid.z - kid.peekZ) > AI.arriveReach) continue;
      if (!lineOfSight(run.forts, kid.x, kid.z, run.kids[0].x, run.kids[0].z)) continue;
      kid.state = "peek";
      kid.timer = AI.peek;
      used++;
      if (used >= cap) return;
   }
}

function spawnSneaker(run: Run): void {
   const sneaker = run.kids[3];
   if (sneaker.present || sneaker.tags > 0) return;
   const fort = northernFort(run);
   sneaker.alive = true;
   sneaker.present = true;
   sneaker.tags = 0;
   sneaker.ammo = SCOOP.rivalStart;
   sneaker.state = "cover";
   sneaker.timer = AI.cover;
   sneaker.immune = 0;
   sneaker.scoopT = 0;
   if (fort < 0) placeOnFort(sneaker, run, -1, true);
   else placeOnFort(sneaker, run, fort, true);
   sneaker.yaw = Math.atan2(run.kids[0].x - sneaker.x, run.kids[0].z - sneaker.z);
}

function updateCamp(run: Run, h: number): void {
   const player = run.kids[0];
   let fort = -1;
   let best: number = KID.crouchBand;
   for (let i = 0; i < run.forts.length; i++) {
      if (run.forts[i].hp < 1) continue;
      writeBox(STILL, run.forts[i].x, run.forts[i].z, FORT.half, 1);
      const d = distanceToBoxXZ(player.x, player.z, STILL);
      if (d <= best) { best = d; fort = i; }
   }
   if (fort >= 0 && fort === run.campFort) run.campT += h;
   else { run.campFort = fort; run.campT = fort >= 0 ? 0 : 0; }
   if (fort >= 0 && run.campT >= CAMP_FLUSH_S) {
      run.campT = 0;
      hurtFort(run, fort);
   }
}

function inputScoop(run: Run, input: StepInput, h: number): void {
   const player = run.kids[0];
   if (!input.scoop) {
      run.scoopLock = false;
      if (!run.scooping) return;
      const held = run.scoopT;
      run.scooping = false;
      run.scoopT = 0;
      if (held >= SCOOP.max - 1e-4) {
         launchRoller(run);
         pushEvent(run, "scoop", player.x, 0.2, player.z, 2);
      } else if (held >= SCOOP.min && player.ammo < SCOOP.maxAmmo) {
         player.ammo += 1;
         pushEvent(run, "scoop", player.x, 0.2, player.z, 1);
      }
      return;
   }
   if (run.scoopLock) {
      player.vx = 0;
      player.vz = 0;
      return;
   }
   if (!run.scooping) { run.scooping = true; run.scoopT = 0; }
   run.scoopT += h;
   player.vx = 0;
   player.vz = 0;
   if (run.scoopT >= SCOOP.max - 1e-4) {
      launchRoller(run);
      run.scooping = false;
      run.scoopT = 0;
      run.scoopLock = true;
      pushEvent(run, "scoop", player.x, 0.2, player.z, 2);
   }
}

function movePlayer(run: Run, input: StepInput, h: number): void {
   const player = run.kids[0];
   if (run.scooping) {
      player.vx = 0;
      player.vz = 0;
      return;
   }
   inputToWorld(input.moveX, input.moveY, input.camYaw, DIR);
   let mx = DIR.x;
   let mz = DIR.z;
   const mag = Math.hypot(mx, mz);
   if (mag > 1) { mx /= mag; mz /= mag; }
   accelerate(player, mx * KID.speed, mz * KID.speed, h);
   if (mag > 0.2) {
      const yaw = Math.atan2(mx, mz);
      player.yaw = turnTowards(player.yaw, yaw, turnFrac(player.yaw, yaw, KID.turn, h));
   }
   if (player.throwAnim > 0) player.throwAnim = Math.max(0, player.throwAnim - h / 0.35);
}

let ACTIVE: Run | null = null;
let INPUT: StepInput = { moveX: 0, moveY: 0, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: 0 };
let SHOT = false;

function onSub(h: number): void {
   const run = ACTIVE;
   if (!run) return;
   run.time += h;
   if (run.endReason) return;
   if (run.time >= AI.sneakerAt) spawnSneaker(run);
   if (run.throwCd > 0) run.throwCd = Math.max(0, run.throwCd - h);
   inputScoop(run, INPUT, h);
   updateCamp(run, h);
   if (!SHOT) {
      SHOT = true;
      tryThrow(run, INPUT);
   }
   for (let i = 1; i < run.kids.length; i++) aiKid(run, run.kids[i], h);
   movePlayer(run, INPUT, h);
   moveAll(run, h);
   resolveOwned(run, h, true);
   maybeEnd(run);
   if (!run.endReason) resolveOwned(run, h, false);
   maybeEnd(run);
   fillSlot(run);
}

export function stepRun(run: Run, dt: number, input: StepInput): void {
   if (!(dt > 0) || run.endReason) return;
   run.scoreDelta = 0;
   run.eventCount = 0;
   ACTIVE = run;
   INPUT = input;
   SHOT = false;
   substep(dt, SUBSTEP_S, onSub);
   if (!run.endReason && run.time >= SCORE.duration) finish(run, "timeup");
   run.highlight = run.coarse ? highlightOf(run, run.kids[0].yaw) : highlightOf(run, input.aimYaw);
   ACTIVE = null;
}

/** Screen-space pick: rival body projections and off-screen arrow centres, within THROW.tapPx. */
export function pickTap(px: number, py: number, points: readonly { id: number; x: number; y: number; live: boolean }[]): number {
   let best = -1;
   let bestD: number = THROW.tapPx;
   for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.live) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= bestD) { bestD = d; best = p.id; }
   }
   return best;
}

export function healthLeft(run: Run): number {
   return SCORE.healthMax - run.playerTags;
}
