import { rngNext } from "../../core/math";
import type { LevelId } from "../../types";
import { LEVELS, type BurgerLevel } from "./levels";
export interface Point { x: number; z: number; }
export interface Rect extends Point { hx: number; hz: number; }
export interface Controls { moveX: number; moveY: number; jumpPressed: boolean; }
export const VEHICLE = { topSpeed: 11, accel: 14, brake: 16, reverse: 2.5, steer: 2.6, radius: 0.55, drag: 0.35 };
export const PAD_SECONDS = 0.45;
export const PAD_RADIUS = 1.1;
export const HOP_SECONDS = 0.4;
export interface Run {
   id: LevelId; config: BurgerLevel; player: Point & { y: number; yaw: number; speed: number };
   shop: Point; doors: Point[]; buildings: Rect[]; barriers: Rect[]; cars: Rect[]; wet: Rect[];
   elapsed: number; score: number; quality: number; qualitySum: number; delivered: number; misses: number;
   carrying: boolean; accepted: number; dwell: number; hop: number; hopHeld: boolean; contact: boolean;
   end: "win" | "lose" | "timeup" | null;
}
export function inside(p: Point, b: Rect, radius = 0): boolean {
   return Math.abs(p.x - b.x) < b.hx + radius && Math.abs(p.z - b.z) < b.hz + radius;
}
export function createRun(seed: number, id: LevelId = 1): Run {
   const config = LEVELS[id], rng = { s: seed };
   const shop = { x: -config.blocksX * 9, z: -config.blocksZ * 9 };
   const candidates: Point[] = [], buildings: Rect[] = [], lanes: Rect[] = [];
   for (let x = 0; x <= config.blocksX; x++) for (let z = 0; z <= config.blocksZ; z++) {
      const p = { x: shop.x + x * 18, z: shop.z + z * 18 };
      if (x + z > 0) candidates.push(p);
      if (x < config.blocksX && z < config.blocksZ) buildings.push({ x: p.x + 9, z: p.z + 9, hx: 6, hz: 6 });
      if (x < config.blocksX) lanes.push({ x: p.x + 9, z: p.z + 1.65, hx: 0.65, hz: 0.65 });
   }
   // Farthest intersections keep trips substantial. Shuffle only after selecting the quota.
   candidates.sort((a, b) => (b.x - shop.x + b.z - shop.z) - (a.x - shop.x + a.z - shop.z));
   const doors = candidates.slice(0, config.orders);
   for (let i = doors.length - 1; i > 0; i--) { const j = Math.floor(rngNext(rng) * (i + 1)); [doors[i], doors[j]] = [doors[j], doors[i]]; }
   const barriers = lanes.slice(0, config.barriers);
   const cars = buildings.flatMap((b) => [-1, 1].map((s) => ({ x: b.x + s * 3.8, z: b.z, hx: 0.8, hz: 1.7 }))).slice(0, config.traffic);
   const wet = config.wet ? lanes.filter((_, i) => i % 2 === 0).map((b) => ({ x: b.x, z: b.z - 2, hx: 2.3, hz: 0.9 })) : [];
   return { id, config, player: { ...shop, y: 0, yaw: Math.PI / 2, speed: 0 }, shop, doors, buildings, barriers, cars, wet,
      elapsed: 0, score: 0, quality: 100, qualitySum: 0, delivered: 0, misses: 0, carrying: false,
      accepted: 0, dwell: 0, hop: 0, hopHeld: false, contact: false, end: null };
}
export function target(r: Run): Point { return r.carrying ? r.doors[Math.min(r.delivered, r.doors.length - 1)] : r.shop; }
export function stepRun(r: Run, input: Controls, seconds: number): void {
   if (r.end || !Number.isFinite(seconds) || seconds <= 0) return;
   const dt = Math.min(seconds, 0.05, r.config.durationMs / 1000 - r.elapsed);
   r.elapsed += dt;
   const p = r.player;
   const steer = Math.max(-1, Math.min(1, input.moveX)), throttle = -Math.max(-1, Math.min(1, input.moveY));
   p.yaw += steer * VEHICLE.steer * dt * (p.speed < 0 ? -1 : 1);
   if (throttle > 0) p.speed = Math.min(11, p.speed + throttle * 14 * dt);
   else if (throttle < 0) p.speed = p.speed > 0 ? Math.max(0, p.speed - 16 * dt) : Math.max(-2.5, p.speed - 14 * dt);
   else p.speed *= Math.exp(-0.35 * dt);
   if (Math.abs(p.speed) < 0.02) p.speed = 0;
   if (input.jumpPressed && !r.hopHeld && r.hop === 0) r.hop = HOP_SECONDS;
   r.hopHeld = input.jumpPressed;
   r.hop = Math.max(0, r.hop - dt);
   p.y = r.hop > 0 ? 0.15 * Math.sin(Math.PI * r.hop / HOP_SECONDS) : 0;
   const x = p.x, z = p.z;
   p.x += Math.sin(p.yaw) * p.speed * dt; p.z += Math.cos(p.yaw) * p.speed * dt;
   p.x = Math.max(r.shop.x - 2.4, Math.min(-r.shop.x + 2.4, p.x));
   p.z = Math.max(r.shop.z - 2.4, Math.min(-r.shop.z + 2.4, p.z));
   const wall = r.buildings.some((b) => inside(p, b, VEHICLE.radius));
   const car = r.cars.some((b) => inside(p, b, VEHICLE.radius));
   const barrier = !(r.hop > 0.1 && r.hop <= 0.3) && r.barriers.some((b) => inside(p, b, VEHICLE.radius));
   const hit = barrier || (car && Math.abs(p.speed) > 3);
   if (hit && !r.contact && r.carrying) r.quality -= 12;
   r.contact = hit;
   if (wall || car || barrier) { p.x = x; p.z = z; p.speed = 0; }
   if (r.carrying && r.wet.some((b) => inside(p, b))) r.quality -= r.config.wetDrain * dt;
   r.quality = Math.max(0, Math.min(100, r.quality));
   if (r.carrying && r.quality <= 0) {
      r.misses++; r.quality = 100; r.dwell = 0;
      if (r.misses >= 3) r.end = "lose";
      // accepted is unchanged: a miss cannot refresh the 25-second bonus.
   }
   if (!r.end) {
      const goal = target(r);
      r.dwell = Math.hypot(p.x - goal.x, p.z - goal.z) < PAD_RADIUS && Math.abs(p.speed) < 0.5 ? r.dwell + dt : 0;
      if (r.dwell + 1e-9 >= PAD_SECONDS) {
         r.dwell = 0;
         if (!r.carrying) { r.carrying = true; r.quality = 100; r.accepted = r.elapsed; }
         else {
            r.score += Math.floor(r.quality) + (r.elapsed - r.accepted <= 25 ? 40 : 0);
            r.qualitySum += r.quality; r.delivered++; r.carrying = false;
            if (r.delivered === r.config.orders) {
               r.end = r.qualitySum / r.delivered + 1e-9 >= r.config.qualityMin ? "win" : "lose";
               if (r.end === "win") r.score += 4 * Math.floor(Math.max(0, r.config.durationMs / 1000 - r.elapsed));
            }
         }
      }
   }
   if (!r.end && r.elapsed + 1e-9 >= r.config.durationMs / 1000) r.end = "timeup";
}
