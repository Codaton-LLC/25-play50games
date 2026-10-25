// Burger Delivery Scooter rules (docs/menu1-new/specs-31-40.md §33). Pure and seeded: no three.js, no React.
// The street-vehicle integrator runs through createFixedStep(1/120), so 30 / 60 / 144 Hz play the same.
import { createFixedStep, fixedStep, type FixedStepState } from "../../core/kinematics";
import { rngNext } from "../../core/math";
import type { LevelId } from "../../types";
import { LEVELS, type BurgerLevel } from "./levels";

export interface Point { x: number; z: number; }
export interface Rect extends Point { hx: number; hz: number; }
export interface Controls { moveX: number; moveY: number; jumpPressed: boolean; }

export const VEHICLE = { topSpeed: 11, accel: 14, brake: 16, reverse: 2.5, steer: 2.6, radius: 0.55, drag: 0.35 };
/** stick dead zone on both axes (keys give ±1, so keyboard and touch share it) */
export const DEAD_ZONE = 0.2;
/** a car hit above this speed costs quality and bounces */
export const STRIKE_SPEED = 3;
export const HIT_QUALITY = 12;
export const PAD_SECONDS = 0.45;
export const PAD_RADIUS = 1.1;
export const PAD_SPEED = 0.5;
export const HOP_SECONDS = 0.4;
/** the barrier is ignored while hop is in (HOP_CLEAR_LO, HOP_CLEAR_HI]: the middle 0.20 s */
export const HOP_CLEAR_LO = 0.1;
export const HOP_CLEAR_HI = 0.3;
export const ORDER_CLOCK = 25;
export const ON_TIME_BONUS = 40;
export const WIN_BONUS_PER_SECOND = 4;
export const MAX_MISSES = 3;
/** block pitch: a 12 m block and a 6 m street */
export const PITCH = 18;
export const BLOCK_HALF = 6;
export const SIM_STEP = 1 / 120;

export interface Run {
   id: LevelId; config: BurgerLevel; player: Point & { y: number; yaw: number; speed: number };
   shop: Point; doors: Point[]; buildings: Rect[]; barriers: Rect[]; cars: Rect[]; wet: Rect[];
   elapsed: number; score: number; quality: number; qualitySum: number; delivered: number; misses: number;
   carrying: boolean; accepted: number; dwell: number; hop: number; contact: boolean;
   /** a pending hop press (latched between fixed steps, so a one-frame press is never lost) */
   hopQueued: boolean;
   clock: FixedStepState;
   end: "win" | "lose" | "timeup" | null;
}

export function inside(p: Point, b: Rect, radius = 0): boolean {
   return Math.abs(p.x - b.x) < b.hx + radius && Math.abs(p.z - b.z) < b.hz + radius;
}

function shuffle<T>(items: T[], rng: { s: number }): T[] {
   for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
   }
   return items;
}

/** Barrier footprint (the GLB fitted to it): 1.30 m across the lane, 0.66 m deep. */
export const BARRIER = { hx: 0.65, hz: 0.33 };
export const CAR = { hx: 0.8, hz: 1.7 };
/** a barrier stands this far off the x street's centre line (1.0 m of clearance for the scooter on the line) */
export const BARRIER_OFFSET = 1.9;

/** Half extents of the street grid's drivable area (outer street centre lines ± 2.4). */
export function cityHalf(config: BurgerLevel): { x: number; z: number } {
   return { x: config.blocksX * 9 + 2.4, z: config.blocksZ * 9 + 2.4 };
}

/**
 * Pure, seeded layout. The shop sits on the south-west intersection (+z is the camera's side), so its
 * block and every other block stand north of the pads the player stops on. Doors are the farthest
 * intersections (only their order is seeded); barrier lanes and parked-car slots are seeded.
 */
export function createRun(seed: number, id: LevelId = 1, level: BurgerLevel = LEVELS[id]): Run {
   const config = level, rng = { s: seed };
   const shop = { x: -config.blocksX * 9, z: config.blocksZ * 9 };
   const candidates: Point[] = [], buildings: Rect[] = [], lanes: Rect[] = [], curbs: Rect[] = [];
   for (let x = 0; x <= config.blocksX; x++) for (let z = 0; z <= config.blocksZ; z++) {
      const p = { x: shop.x + x * PITCH, z: shop.z - z * PITCH };
      if (x + z > 0) candidates.push(p);
      if (x < config.blocksX && z < config.blocksZ) buildings.push({ x: p.x + 9, z: p.z - 9, hx: BLOCK_HALF, hz: BLOCK_HALF });
      // barrier slots: mid-block on the streets that run along x, off the centre line
      if (x < config.blocksX) lanes.push({ x: p.x + 9, z: p.z + BARRIER_OFFSET, hx: BARRIER.hx, hz: BARRIER.hz });
   }
   // parked cars: at the curb of the streets that run along z, mid-block (the centre line stays clear)
   for (const b of buildings) for (const s of [-1, 1]) curbs.push({ x: b.x + s * (BLOCK_HALF + 0.85), z: b.z, hx: CAR.hx, hz: CAR.hz });
   candidates.sort((a, b) => (b.x - shop.x + shop.z - b.z) - (a.x - shop.x + shop.z - a.z));
   const doors = shuffle(candidates.slice(0, config.orders), rng);
   const barriers = shuffle(lanes.slice(), rng).slice(0, config.barriers);
   // only curbs inside the grid (an outer curb would sit on the city edge)
   const cars = shuffle(curbs.filter((c) => Math.abs(c.x) < Math.abs(shop.x)), rng).slice(0, config.traffic);
   // wet patches across the x streets, mid-block (never on an intersection pad)
   const wet = config.wet ? lanes.filter((_, i) => i % 2 === 0).map((b) => ({ x: b.x, z: b.z - BARRIER_OFFSET - 0.35, hx: 2.3, hz: 0.9 })) : [];
   return { id, config, player: { ...shop, y: 0, yaw: Math.PI / 2, speed: 0 }, shop, doors, buildings, barriers, cars, wet,
      elapsed: 0, score: 0, quality: 100, qualitySum: 0, delivered: 0, misses: 0, carrying: false,
      accepted: 0, dwell: 0, hop: 0, contact: false, hopQueued: false, clock: createFixedStep(SIM_STEP), end: null };
}

export function target(r: Run): Point { return r.carrying ? r.doors[Math.min(r.delivered, r.doors.length - 1)] : r.shop; }

const axis = (v: number) => (Math.abs(v) > DEAD_ZONE ? Math.max(-1, Math.min(1, v)) : 0);

/** Push the scooter out of a rect; returns true on contact. */
function pushOut(p: Point, b: Rect): boolean {
   const r = VEHICLE.radius;
   const cx = Math.max(b.x - b.hx, Math.min(b.x + b.hx, p.x));
   const cz = Math.max(b.z - b.hz, Math.min(b.z + b.hz, p.z));
   const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
   if (d2 >= r * r) return false;
   if (d2 > 1e-12) {
      const d = Math.sqrt(d2), k = (r - d) / d;
      p.x += dx * k; p.z += dz * k;
   } else {
      // centre inside: out through the nearest face
      const ex = b.hx - Math.abs(p.x - b.x), ez = b.hz - Math.abs(p.z - b.z);
      if (ex < ez) p.x = b.x + Math.sign(p.x - b.x || 1) * (b.hx + r);
      else p.z = b.z + Math.sign(p.z - b.z || 1) * (b.hz + r);
   }
   return true;
}

function substep(r: Run, input: Controls, dt: number): void {
   if (r.end) return;
   r.elapsed += dt;
   const p = r.player;
   const steer = axis(input.moveX), throttle = -axis(input.moveY);
   // street-vehicle integrator: turn rate grows with speed (turnScale), reverse steers mirrored
   const turnScale = Math.max(0.35, Math.min(1, Math.abs(p.speed) / 2));
   if (p.speed !== 0 || throttle !== 0) p.yaw += steer * VEHICLE.steer * turnScale * dt * (p.speed < 0 ? -1 : 1);
   if (throttle > 0) p.speed = p.speed < 0 ? Math.min(0, p.speed + VEHICLE.brake * dt) : Math.min(VEHICLE.topSpeed, p.speed + throttle * VEHICLE.accel * dt);
   else if (throttle < 0) p.speed = p.speed > 0 ? Math.max(0, p.speed + throttle * VEHICLE.brake * dt) : Math.max(-VEHICLE.reverse, p.speed + throttle * VEHICLE.accel * dt);
   else p.speed *= Math.exp(-VEHICLE.drag * dt);
   if (Math.abs(p.speed) < 0.02 && throttle === 0) p.speed = 0;

   if (r.hopQueued && r.hop === 0) r.hop = HOP_SECONDS;
   r.hopQueued = false;
   r.hop = Math.max(0, r.hop - dt);
   p.y = r.hop > 0 ? 0.15 * Math.sin((Math.PI * r.hop) / HOP_SECONDS) : 0;

   p.x += Math.sin(p.yaw) * p.speed * dt;
   p.z += Math.cos(p.yaw) * p.speed * dt;
   const half = cityHalf(r.config);
   if (Math.abs(p.x) > half.x) { p.x = Math.sign(p.x) * half.x; p.speed *= 0.5; }
   if (Math.abs(p.z) > half.z) { p.z = Math.sign(p.z) * half.z; p.speed *= 0.5; }

   // buildings: slide along the wall, a head-on hit stops; no quality cost
   for (const b of r.buildings) {
      const bx = p.x, bz = p.z;
      if (!pushOut(p, b)) continue;
      const nx = p.x - bx, nz = p.z - bz, n = Math.hypot(nx, nz) || 1;
      const into = -(Math.sin(p.yaw) * nx + Math.cos(p.yaw) * nz) / n * Math.sign(p.speed || 1);
      if (into > 0.7) p.speed = 0;
      else p.speed *= 1 - Math.max(0, into) * 0.5;
   }
   // barriers (any speed, unless in the hop's middle) and cars (above strike speed): quality -12 once per contact, bounce
   let strike = false;
   const clear = r.hop > HOP_CLEAR_LO && r.hop <= HOP_CLEAR_HI;
   const fast = Math.abs(p.speed) > STRIKE_SPEED;
   for (const b of r.barriers) if (!clear && pushOut(p, b)) { strike = true; p.speed *= -0.3; }
   for (const c of r.cars) if (pushOut(p, c)) { if (fast) { strike = true; p.speed *= -0.3; } else p.speed *= 0.5; }
   if (strike && !r.contact && r.carrying) r.quality -= HIT_QUALITY;
   r.contact = strike;

   if (r.carrying && r.config.wetDrain > 0) for (const w of r.wet) if (inside(p, w)) { r.quality -= r.config.wetDrain * dt; break; }
   r.quality = Math.max(0, Math.min(100, r.quality));
   if (r.carrying && r.quality <= 0) {
      // a miss: one life, quality back to 100, the same slot stays (the order clock keeps running)
      r.misses++; r.quality = 100; r.dwell = 0;
      if (r.misses >= MAX_MISSES) r.end = "lose";
   }
   if (!r.end) {
      const goal = target(r);
      r.dwell = Math.hypot(p.x - goal.x, p.z - goal.z) < PAD_RADIUS && Math.abs(p.speed) < PAD_SPEED ? r.dwell + dt : 0;
      if (r.dwell + 1e-9 >= PAD_SECONDS) {
         r.dwell = 0;
         if (!r.carrying) { r.carrying = true; r.quality = 100; r.accepted = r.elapsed; }
         else {
            r.score += Math.floor(r.quality) + (r.elapsed - r.accepted <= ORDER_CLOCK ? ON_TIME_BONUS : 0);
            r.qualitySum += r.quality; r.delivered++; r.carrying = false;
            if (r.delivered === r.config.orders) {
               r.end = r.qualitySum / r.delivered + 1e-9 >= r.config.qualityMin ? "win" : "lose";
               if (r.end === "win") r.score += WIN_BONUS_PER_SECOND * Math.floor(Math.max(0, r.config.durationMs / 1000 - r.elapsed));
            }
         }
      }
   }
   if (!r.end && r.elapsed + 1e-9 >= r.config.durationMs / 1000) r.end = "timeup";
}

/** One frame (seconds = the run clock's play time): fixed 1/120 s substeps, no allocation. */
export function stepRun(r: Run, input: Controls, seconds: number): void {
   if (r.end || !Number.isFinite(seconds) || seconds <= 0) return;
   if (input.jumpPressed) r.hopQueued = true;
   fixedStep(r.clock, Math.min(seconds, 0.05), (dt) => substep(r, input, dt));
}
