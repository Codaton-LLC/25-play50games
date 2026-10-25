import { createRng, inputToWorld } from "@/arcade3d/core/math";
import { sweptAabbXZ, type AABB } from "@/arcade3d/core/collision";
import type { PostLevel } from "./levels";

export const SPEED = 4.6;
export const RADIUS = 0.38;
export const REACH = 1.2;
export const OFFICE = { x: -7, z: -4 };
export const STREET_GAP = 20;
export const HOUSE_GAP = 8;
export const ADDRESS_COLORS = ["red", "blue", "yellow"] as const;
export interface House { number: number; color: number; kind: number; x: number; z: number; mailZ: number; doorZ: number; side: number }
export interface Item { house: number; color: number; kind: "letter" | "parcel"; delivered: boolean; loaded: boolean }
export interface Dog { x: number; z: number; homeX: number; homeZ: number; side: number; active: number }
export interface Car { x: number; z: number; direction: number; street: number; stopped: boolean }
export interface Run {
   level: PostLevel;
   bounds: AABB;
   houses: House[];
   items: Item[];
   dogs: Dog[];
   cars: Car[];
   hero: { x: number; y: number; z: number; yaw: number; stun: number; mercy: number; vx: number; vz: number };
   elapsed: number;
   delivered: number;
   score: number;
   lives: number | null;
   over: "win" | "lose" | "timeup" | null;
   event: { score: number; delivered: number; wrong: boolean; refill: boolean; hit: boolean; lifeLost: boolean };
   direction: { x: number; z: number };
   movingBox: AABB;
   hitBox: AABB;
   delta: { x: number; z: number };
}
export interface PostInput { moveX: number; moveY: number; yaw: number; actionPressed: boolean }

export { PROPOSED_LEVEL_LIMITS } from "./scoring";

export function boundsFor(level: PostLevel): AABB {
   return { min: { x: -13, y: 0, z: -11 }, max: { x: (level.housesPerStreet / 2 - 1) * HOUSE_GAP + 7, y: 3, z: (level.streets - 1) * STREET_GAP + 11 } };
}

function refill(run: Run) {
   let letters = run.items.filter((i) => i.loaded && !i.delivered && i.kind === "letter").length;
   let parcel = run.items.some((i) => i.loaded && !i.delivered && i.kind === "parcel");
   for (const item of run.items) {
      if (item.delivered || item.loaded) continue;
      if (item.kind === "letter" && letters < run.level.bagCap) { item.loaded = true; letters++; }
      if (item.kind === "parcel" && !parcel) { item.loaded = true; parcel = true; }
   }
}

export function createRun(seed: number, level: PostLevel): Run {
   const rng = createRng(seed);
   const houses: House[] = [];
   const colorShift = Math.floor(rng() * 3);
   for (let street = 0; street < level.streets; street++) {
      for (let slot = 0; slot < level.housesPerStreet; slot++) {
         const side = slot % 2 ? 1 : -1;
         const x = Math.floor(slot / 2) * HOUSE_GAP;
         const mailZ = street * STREET_GAP + side * 4;
         houses.push({ number: houses.length + 1, color: (slot % 3 + colorShift) % 3, kind: slot % 3, x, z: mailZ + side * 5, mailZ, doorZ: mailZ + side * 3, side });
      }
   }
   // Serpentine along the street; randomness chooses a side, never shuffles a sensible route.
   const route = houses.slice().sort((a, b) => {
      const sa = Math.floor((a.number - 1) / level.housesPerStreet);
      const sb = Math.floor((b.number - 1) / level.housesPerStreet);
      return sa - sb || (sa % 2 ? b.x - a.x : a.x - b.x) || a.side - b.side;
   });
   const count = level.letters + level.parcels;
   const offset = rng() < 0.5 ? 0 : 1;
   const items: Item[] = Array.from({ length: count }, (_, i) => {
      const h = route[Math.min(route.length - 1, Math.floor(i * route.length / count) + offset)];
      return { house: h.number, color: h.color, kind: i < level.letters ? "letter" : "parcel", loaded: false, delivered: false };
   });
   const dogs = Array.from({ length: level.dogs }, (_, i) => {
      const h = houses[(i * 5 + 3) % houses.length];
      return { x: h.x + 2, z: h.doorZ, homeX: h.x + 2, homeZ: h.doorZ, side: h.side, active: 0 };
   });
   const cars = Array.from({ length: level.traffic }, (_, i) => ({ x: 8 + i * 9, z: (i % level.streets) * STREET_GAP + (i % 2 ? -1 : 1), direction: i % 2 ? -1 : 1, street: i % level.streets, stopped: false }));
   const box = (): AABB => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 2, z: 0 } });
   const run: Run = { level, bounds: boundsFor(level), houses, items, dogs, cars, hero: { ...OFFICE, y: 0, yaw: 0, stun: 0, mercy: 0, vx: 0, vz: 0 }, elapsed: 0, delivered: 0, score: 0, lives: level.lives ?? null, over: null, event: { score: 0, delivered: -1, wrong: false, refill: false, hit: false, lifeLost: false }, direction: { x: 0, z: 0 }, movingBox: box(), hitBox: box(), delta: { x: 0, z: 0 } };
   refill(run);
   return run;
}

export function targetFor(run: Run, item: Item, out = { x: 0, z: 0 }) {
   const h = run.houses[item.house - 1];
   out.x = h.x; out.z = item.kind === "letter" ? h.mailZ : h.doorZ;
   return out;
}

export function nextItem(run: Run) { return run.items.find((i) => !i.delivered); }
export function carrying(run: Run) { return run.items.some((i) => i.kind === "parcel" && i.loaded && !i.delivered); }

function solid(run: Run, x: number, z: number) {
   // Front paths, both pavements, and the cross street are always open.
   if (Math.abs(x - OFFICE.x) < 2.1 + RADIUS && Math.abs(z + 7) < 1.25 + RADIUS) return true;
   if (x > -11.5 && x < -8.5 && z > -4 && z < 0) return true; // parked van
   for (const h of run.houses) {
      if (Math.abs(x - h.x) < 2.5 + RADIUS && Math.abs(z - (h.doorZ + h.side * 1.9)) < 1.5 + RADIUS) return true;
   }
   return false;
}

export function step(run: Run, input: PostInput, dt: number) {
   const e = run.event;
   e.score = 0; e.delivered = -1; e.wrong = false; e.refill = false; e.hit = false; e.lifeLost = false;
   if (run.over || !Number.isFinite(dt) || dt <= 0) return e;
   dt = Math.min(0.05, dt, (run.level.durationMs / 1000) - run.elapsed);
   run.elapsed += dt;
   const p = run.hero;
   const wasStunned = p.stun > 0;
   p.stun = Math.max(0, p.stun - dt);
   p.mercy = Math.max(0, p.mercy - dt);
   const oldX = p.x, oldZ = p.z;
   inputToWorld(input.moveX, input.moveY, input.yaw, run.direction);
   const length = Math.max(1, Math.hypot(run.direction.x, run.direction.z));
   const speed = wasStunned ? 0 : SPEED * (carrying(run) ? 0.85 : 1);
   const b = run.bounds;
   const x = Math.max(b.min.x + RADIUS, Math.min(b.max.x - RADIUS, p.x + run.direction.x / length * speed * dt));
   const z = Math.max(b.min.z + RADIUS, Math.min(b.max.z - RADIUS, p.z + run.direction.z / length * speed * dt));
   if (!solid(run, x, p.z)) p.x = x;
   if (!solid(run, p.x, z)) p.z = z;
   p.vx = (p.x - oldX) / dt; p.vz = (p.z - oldZ) / dt;
   if (Math.hypot(p.vx, p.vz) > 0.01) p.yaw = Math.atan2(p.vx, p.vz);
   for (const dog of run.dogs) {
      const near = Math.hypot(p.x - dog.homeX, p.z - dog.homeZ) < 4;
      dog.active = Math.max(0, Math.min(1, dog.active + dt * (near ? 2.5 : -1.5)));
      dog.x = dog.homeX;
      dog.z = dog.homeZ - dog.side * dog.active * 2.2;
      if (p.mercy === 0 && Math.hypot(p.x - dog.x, p.z - dog.z) < RADIUS + 0.4) {
         p.stun = 0.6; p.mercy = 0.8; e.hit = true;
      }
   }
   for (const car of run.cars) {
      const end = (run.level.housesPerStreet / 2 - 1) * HOUSE_GAP + 7;
      // Zebra at x=-5: a pedestrian on it always has right of way.
      const pedestrian = Math.abs(p.x + 5) < 1.4 && Math.abs(p.z - car.street * STREET_GAP) < 4.8;
      // Stop outside the zebra, only on the approach side (never freeze on it).
      const beforeZebra = car.direction > 0 ? car.x < -7.6 : car.x > -2.4;
      car.stopped = pedestrian && beforeZebra && Math.abs(car.x + 5) < 8;
      const dx = car.stopped ? 0 : car.direction * run.level.trafficSpeed * dt;
      run.movingBox.min.x = car.x - 1.4; run.movingBox.max.x = car.x + 1.4;
      run.movingBox.min.z = car.z - 0.65; run.movingBox.max.z = car.z + 0.65;
      run.hitBox.min.x = oldX - RADIUS; run.hitBox.max.x = oldX + RADIUS;
      run.hitBox.min.z = oldZ - RADIUS; run.hitBox.max.z = oldZ + RADIUS;
      run.delta.x = dx - (p.x - oldX); run.delta.z = -(p.z - oldZ);
      if (p.mercy === 0 && sweptAabbXZ(run.movingBox, run.delta, run.hitBox) !== null) {
         p.stun = 0.6; p.mercy = 0.8; e.hit = true; e.lifeLost = true;
         if (run.lives !== null) run.lives--;
      }
      car.x += dx;
      if (car.x > end + 2) car.x = -12;
      if (car.x < -12) car.x = end + 2;
   }
   if (run.lives !== null && run.lives <= 0) run.over = "lose";
   if (!run.over && !wasStunned && p.stun === 0 && input.actionPressed) {
      if (Math.hypot(p.x - OFFICE.x, p.z - OFFICE.z) <= REACH) { refill(run); e.refill = true; }
      else {
         let house: House | undefined;
         let atDoor = false;
         for (const h of run.houses) {
            if (Math.hypot(p.x - h.x, p.z - h.mailZ) <= REACH) { house = h; break; }
            if (Math.hypot(p.x - h.x, p.z - h.doorZ) <= REACH) { house = h; atDoor = true; break; }
         }
         if (house) {
            const index = run.items.findIndex((i) => i.house === house!.number && i.loaded && !i.delivered && (i.kind === "parcel") === atDoor);
            if (index < 0) { p.stun = 0.4; e.wrong = true; }
            else {
               const first = run.items.findIndex((i) => !i.delivered);
               const item = run.items[index];
               item.delivered = true; item.loaded = false;
               run.delivered++; e.delivered = index;
               e.score = index === first ? 140 : 100;
               if (run.delivered === run.items.length) {
                  e.score += 5 * Math.floor(Math.max(0, run.level.durationMs / 1000 - run.elapsed));
                  run.over = "win";
               }
               run.score += e.score;
            }
         }
      }
   }
   if (!run.over && run.elapsed >= run.level.durationMs / 1000 - 1e-7) run.over = "timeup";
   return e;
}
