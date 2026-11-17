// Postman 3D rules (docs/menu1-new/specs-41-50.md §50). Pure and deterministic with a seed: no three.js,
// no React. The Scene calls createRun once per run and step + syncStore from one useRunFrame.
import { sweptAabbXZ, type AABB } from "@/arcade3d/core/collision";
import { createRng, inputToWorld } from "@/arcade3d/core/math";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { StoreApi } from "zustand/vanilla";
import type { PostLevel } from "./levels";

export const SPEED = 4.6;
export const CARRY_FACTOR = 0.85;
/** on-foot mover (robot-collector): accel 22 m/s², brake 28 m/s² */
export const ACCEL = 22;
export const BRAKE = 28;
export const RADIUS = 0.38;
export const REACH = 1.2;
export const WRONG_STUN = 0.4;
export const HIT_STUN = 0.6;
export const MERCY = 0.8;
export const DOG_NEAR = 4;
export const DOG_LEASH = 2.2;
export const DOG_RADIUS = 0.4;
export const PAY = 100;
export const ROUTE_BONUS = 40;
export const WIN_PER_SECOND = 5;
/** the post office counter (refill point), the office building north of it */
export const OFFICE = { x: -7, z: -4 };
export const OFFICE_BOX = { x: -7, z: -7, hx: 2.1, hz: 1.25 };
export const VAN_BOX = { minX: -11.5, maxX: -8.5, minZ: -4, maxZ: 0 };
export const STREET_GAP = 20;
export const HOUSE_GAP = 8;
/** a house's solid box: ±HOUSE_HX along the street, ±HOUSE_HZ deep, centred HOUSE_BACK behind its door */
export const HOUSE_HX = 2.5;
export const HOUSE_HZ = 1.5;
export const HOUSE_BACK = 1.9;
export const MAIL_OFFSET = 4;
/** the picket fences either side of a front path are solid: each runs FENCE_LEN along the street */
export const FENCE_LEN = 1.6;
/** distance from the house's centre line to the near end of a fence (the gate gap is twice this) */
export const FENCE_NEAR = 1.3;
/** a fence stands this far from the mailbox line, toward the house, and is this thin (half) */
export const FENCE_Z = 0.6;
export const FENCE_HT = 0.06;
export const DOOR_OFFSET = 3;
/** road half-width (the kerb), car lanes at ±LANE, the zebra crossing at x = ZEBRA_X */
export const ROAD_HALF = 2.8;
export const LANE = 1;
export const CAR_HX = 1.4;
export const CAR_HZ = 0.65;
export const ZEBRA_X = -5;
export const ADDRESS_COLORS = ["red", "blue", "yellow"] as const;

export interface House { number: number; color: number; kind: number; x: number; z: number; mailZ: number; doorZ: number; side: number; street: number }
export interface Item { house: number; color: number; kind: "letter" | "parcel"; delivered: boolean; loaded: boolean }
export interface Dog { x: number; z: number; homeX: number; homeZ: number; side: number; active: number }
export interface Car { x: number; z: number; direction: number; street: number; stopped: boolean }
export interface PostEvent { score: number; delivered: number; wrong: boolean; refill: boolean; hit: boolean; lifeLost: boolean }
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
   /** a parcel is in the hands (kept in step, read by the Scene) */
   carrying: boolean;
   /** letters in the bag */
   bag: number;
   over: "win" | "lose" | "timeup" | null;
   event: PostEvent;
   direction: { x: number; z: number };
   movingBox: AABB;
   hitBox: AABB;
   delta: { x: number; z: number };
   /** what the store last got (-1 = never), so the HUD updates only on a change */
   synced: { score: number; delivered: number; bag: number; lives: number };
}
export interface PostInput { moveX: number; moveY: number; yaw: number; actionPressed: boolean }

export { PROPOSED_LEVEL_LIMITS, PROOF_EARLIEST_WIN_S, objectiveCeiling } from "./scoring";

/** The east end of a street (cars wrap there) for this level. */
export const streetEnd = (level: PostLevel) => (level.housesPerStreet / 2 - 1) * HOUSE_GAP + 7;

export function boundsFor(level: PostLevel): AABB {
   return { min: { x: -13, y: 0, z: -11 }, max: { x: streetEnd(level), y: 3, z: (level.streets - 1) * STREET_GAP + 11 } };
}

function countLoad(run: Run) {
   let bag = 0;
   let parcel = false;
   for (const i of run.items) {
      if (!i.loaded || i.delivered) continue;
      if (i.kind === "letter") bag++;
      else parcel = true;
   }
   run.bag = bag;
   run.carrying = parcel;
}

/** The post office counter: top the bag up to bagCap letters (in list order) and take one parcel if the hands are free. */
export function refill(run: Run) {
   countLoad(run);
   for (const item of run.items) {
      if (item.delivered || item.loaded) continue;
      if (item.kind === "letter" && run.bag < run.level.bagCap) {
         item.loaded = true;
         run.bag++;
      }
      if (item.kind === "parcel" && !run.carrying) {
         item.loaded = true;
         run.carrying = true;
      }
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
         const mailZ = street * STREET_GAP + side * MAIL_OFFSET;
         const doorZ = mailZ + side * DOOR_OFFSET;
         houses.push({ number: houses.length + 1, color: ((slot % 3) + colorShift) % 3, kind: slot % 3, x, z: doorZ + side * HOUSE_BACK, mailZ, doorZ, side, street });
      }
   }
   // The list follows the streets in a serpentine, so a sane route earns the list bonus: the seed picks
   // which houses get mail (a seeded subset of the route, kept in route order) and the colours.
   const route = houses.slice().sort((a, b) => a.street - b.street || (a.street % 2 ? b.x - a.x : a.x - b.x) || a.side - b.side);
   const count = level.letters + level.parcels;
   const picks = route.map((_, i) => i);
   for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = picks[i];
      picks[i] = picks[j];
      picks[j] = t;
   }
   const chosen = picks.slice(0, Math.min(count, route.length)).sort((a, b) => a - b);
   const items: Item[] = [];
   for (let i = 0; i < count; i++) {
      const h = route[chosen[i % chosen.length]];
      items.push({ house: h.number, color: h.color, kind: i < level.letters ? "letter" : "parcel", loaded: false, delivered: false });
   }
   // parcels go last in the list (one in the hands at a time); letters keep route order among themselves
   // dogs guard seeded yards, never the yard of the first stop
   const dogs: Dog[] = [];
   const yards = houses.filter((h) => h.number !== items[0]?.house);
   for (let i = 0; i < level.dogs && yards.length > 0; i++) {
      const h = yards.splice(Math.floor(rng() * yards.length), 1)[0];
      dogs.push({ x: h.x + 2, z: h.doorZ, homeX: h.x + 2, homeZ: h.doorZ, side: h.side, active: 0 });
   }
   const cars: Car[] = [];
   const span = streetEnd(level) + 14;
   for (let i = 0; i < level.traffic; i++) {
      cars.push({ x: -12 + ((i / Math.max(1, level.traffic)) * span + rng() * 4) % span, z: (i % level.streets) * STREET_GAP + (i % 2 ? -LANE : LANE), direction: i % 2 ? -1 : 1, street: i % level.streets, stopped: false });
   }
   const box = (): AABB => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 2, z: 0 } });
   const run: Run = {
      level,
      bounds: boundsFor(level),
      houses,
      items,
      dogs,
      cars,
      hero: { x: OFFICE.x, y: 0, z: OFFICE.z, yaw: 0, stun: 0, mercy: 0, vx: 0, vz: 0 },
      elapsed: 0,
      delivered: 0,
      score: 0,
      lives: level.lives ?? null,
      carrying: false,
      bag: 0,
      over: null,
      event: { score: 0, delivered: -1, wrong: false, refill: false, hit: false, lifeLost: false },
      direction: { x: 0, z: 0 },
      movingBox: box(),
      hitBox: box(),
      delta: { x: 0, z: 0 },
      synced: { score: -1, delivered: -1, bag: -1, lives: -1 },
   };
   refill(run);
   return run;
}

export function targetFor(run: Run, item: Item, out = { x: 0, z: 0 }) {
   const h = run.houses[item.house - 1];
   out.x = h.x;
   out.z = item.kind === "letter" ? h.mailZ : h.doorZ;
   return out;
}

export function nextItem(run: Run): Item | undefined {
   for (const i of run.items) if (!i.delivered) return i;
   return undefined;
}

export function carrying(run: Run) {
   return run.carrying;
}

/** The centre x offset of a house's fences (one each side of the path). */
export const FENCE_CENTER = FENCE_NEAR + FENCE_LEN / 2;

/** Is (x, z) inside a solid (a house, the office, the van) for the postman's radius? */
export function solid(run: Run, x: number, z: number): boolean {
   if (Math.abs(x - OFFICE_BOX.x) < OFFICE_BOX.hx + RADIUS && Math.abs(z - OFFICE_BOX.z) < OFFICE_BOX.hz + RADIUS) return true;
   if (x > VAN_BOX.minX - RADIUS && x < VAN_BOX.maxX + RADIUS && z > VAN_BOX.minZ - RADIUS && z < VAN_BOX.maxZ + RADIUS) return true;
   for (const h of run.houses) {
      if (Math.abs(x - h.x) < HOUSE_HX + RADIUS && Math.abs(z - h.z) < HOUSE_HZ + RADIUS) return true;
      // the two fences (the path between them stays open)
      if (Math.abs(z - (h.mailZ + h.side * FENCE_Z)) < FENCE_HT + RADIUS && Math.abs(Math.abs(x - h.x) - FENCE_CENTER) < FENCE_LEN / 2 + RADIUS) return true;
   }
   return false;
}

/** One frame of play (dt = the run clock's play time). Mutates `run`; returns its reused event. */
export function step(run: Run, input: PostInput, dt: number): PostEvent {
   const e = run.event;
   e.score = 0;
   e.delivered = -1;
   e.wrong = false;
   e.refill = false;
   e.hit = false;
   e.lifeLost = false;
   if (run.over || !Number.isFinite(dt) || dt <= 0) return e;
   dt = Math.min(0.05, dt, run.level.durationMs / 1000 - run.elapsed);
   if (dt <= 0) dt = 1e-6;
   run.elapsed += dt;
   const p = run.hero;
   const wasStunned = p.stun > 0;
   p.stun = Math.max(0, p.stun - dt);
   p.mercy = Math.max(0, p.mercy - dt);
   const oldX = p.x;
   const oldZ = p.z;

   // on-foot mover: accelerate toward the stick's velocity, brake harder; a stun stops dead
   inputToWorld(input.moveX, input.moveY, input.yaw, run.direction);
   const len = Math.hypot(run.direction.x, run.direction.z);
   const top = wasStunned ? 0 : SPEED * (run.carrying ? CARRY_FACTOR : 1);
   const k = len > 1 ? 1 / len : 1;
   const tx = run.direction.x * k * top;
   const tz = run.direction.z * k * top;
   const dvx = tx - p.vx;
   const dvz = tz - p.vz;
   const dv = Math.hypot(dvx, dvz);
   const braking = tx * p.vx + tz * p.vz < 0 || Math.hypot(tx, tz) < Math.hypot(p.vx, p.vz);
   const maxDv = (braking ? BRAKE : ACCEL) * dt;
   if (wasStunned) {
      p.vx = 0;
      p.vz = 0;
   } else if (dv > maxDv) {
      p.vx += (dvx / dv) * maxDv;
      p.vz += (dvz / dv) * maxDv;
   } else {
      p.vx = tx;
      p.vz = tz;
   }
   const b = run.bounds;
   const nx = Math.max(b.min.x + RADIUS, Math.min(b.max.x - RADIUS, p.x + p.vx * dt));
   const nz = Math.max(b.min.z + RADIUS, Math.min(b.max.z - RADIUS, p.z + p.vz * dt));
   if (!solid(run, nx, p.z)) p.x = nx;
   else p.vx = 0;
   if (!solid(run, p.x, nz)) p.z = nz;
   else p.vz = 0;
   if (Math.hypot(p.x - oldX, p.z - oldZ) > 1e-4) p.yaw = Math.atan2(p.x - oldX, p.z - oldZ);

   for (const dog of run.dogs) {
      const near = Math.hypot(p.x - dog.homeX, p.z - dog.homeZ) < DOG_NEAR;
      dog.active = Math.max(0, Math.min(1, dog.active + dt * (near ? 2.5 : -1.5)));
      dog.x = dog.homeX;
      dog.z = dog.homeZ - dog.side * dog.active * DOG_LEASH;
      if (p.mercy === 0 && Math.hypot(p.x - dog.x, p.z - dog.z) < RADIUS + DOG_RADIUS) {
         p.stun = HIT_STUN;
         p.mercy = MERCY;
         e.hit = true;
      }
   }
   const end = streetEnd(run.level);
   for (const car of run.cars) {
      // the zebra: a postman on it has right of way; cars stop before it on the approach side only
      const pedestrian = Math.abs(p.x - ZEBRA_X) < 1.4 && Math.abs(p.z - car.street * STREET_GAP) < ROAD_HALF + 2;
      const beforeZebra = car.direction > 0 ? car.x < ZEBRA_X - 2.6 : car.x > ZEBRA_X + 2.6;
      car.stopped = pedestrian && beforeZebra && Math.abs(car.x - ZEBRA_X) < 8;
      const dx = car.stopped ? 0 : car.direction * run.level.trafficSpeed * dt;
      run.movingBox.min.x = car.x - CAR_HX;
      run.movingBox.max.x = car.x + CAR_HX;
      run.movingBox.min.z = car.z - CAR_HZ;
      run.movingBox.max.z = car.z + CAR_HZ;
      run.hitBox.min.x = oldX - RADIUS;
      run.hitBox.max.x = oldX + RADIUS;
      run.hitBox.min.z = oldZ - RADIUS;
      run.hitBox.max.z = oldZ + RADIUS;
      run.delta.x = dx - (p.x - oldX);
      run.delta.z = -(p.z - oldZ);
      if (p.mercy === 0 && sweptAabbXZ(run.movingBox, run.delta, run.hitBox) !== null) {
         p.stun = HIT_STUN;
         p.mercy = MERCY;
         e.hit = true;
         e.lifeLost = true;
         if (run.lives !== null) run.lives--;
      }
      car.x += dx;
      if (car.x > end + 2) car.x = -12;
      if (car.x < -12) car.x = end + 2;
   }
   if (run.lives !== null && run.lives <= 0) run.over = "lose";

   if (!run.over && !wasStunned && p.stun === 0 && input.actionPressed) {
      if (Math.hypot(p.x - OFFICE.x, p.z - OFFICE.z) <= REACH) {
         refill(run);
         e.refill = true;
      } else {
         let house: House | undefined;
         let atDoor = false;
         let best = REACH;
         for (const h of run.houses) {
            const dm = Math.hypot(p.x - h.x, p.z - h.mailZ);
            const dd = Math.hypot(p.x - h.x, p.z - h.doorZ);
            if (dm <= best) {
               best = dm;
               house = h;
               atDoor = false;
            }
            if (dd <= best) {
               best = dd;
               house = h;
               atDoor = true;
            }
         }
         if (house) {
            let index = -1;
            for (let i = 0; i < run.items.length; i++) {
               const it = run.items[i];
               if (it.house === house.number && it.loaded && !it.delivered && (it.kind === "parcel") === atDoor) {
                  index = i;
                  break;
               }
            }
            if (index < 0) {
               p.stun = WRONG_STUN;
               e.wrong = true;
            } else {
               let first = -1;
               for (let i = 0; i < run.items.length; i++) {
                  if (!run.items[i].delivered) {
                     first = i;
                     break;
                  }
               }
               const item = run.items[index];
               item.delivered = true;
               item.loaded = false;
               if (item.kind === "letter") run.bag--;
               else run.carrying = false;
               run.delivered++;
               e.delivered = index;
               e.score = index === first ? PAY + ROUTE_BONUS : PAY;
               if (run.delivered === run.items.length) {
                  e.score += WIN_PER_SECOND * Math.floor(Math.max(0, run.level.durationMs / 1000 - run.elapsed));
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

/** Push the run to the store (score and stats only when they change; life and end on their frame). */
export function syncStore(run: Run, store: StoreApi<ArcadeStore>): void {
   const s = store.getState();
   const synced = run.synced;
   if (synced.score !== run.score) s.setScore((synced.score = run.score));
   if (synced.delivered !== run.delivered) s.setStat("delivered", (synced.delivered = run.delivered));
   if (synced.bag !== run.bag) s.setStat("bag", (synced.bag = run.bag));
   if (run.event.lifeLost && run.lives !== null) s.loseLife();
   if (run.over) s.end(run.over);
}
