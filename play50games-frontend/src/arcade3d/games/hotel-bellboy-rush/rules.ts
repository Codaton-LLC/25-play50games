// Hotel Bellboy Rush rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// One corridor, 4 m wide (x -2..2) and doors * 3.2 + 6 m long (z 0..length). The reception desk
// stands against the lobby's end wall (z 0), the elevator on the door wall (x +2) at z 4.4, and the
// room doors on that wall every 3.2 m from z 7.6. There is no second storey: the elevator pad
// changes which floor the doors are wearing (labels floor * 100 + index).
// Movement is the on-foot mover (accel 22, brake 28, radius 0.4, top speed 4.0, x 0.85 loaded).
import { resolveSphereAabb, type AABB } from "@/arcade3d/core/collision";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { spring, type SpringState } from "@/arcade3d/core/motion";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { AXLE_BACK, CART_GAP, GRIP_AHEAD, HITCH_STIFFNESS, REAR_BACK, REAR_RADIUS, clampSwing, hitchPoint } from "./cart";
import { LEVELS, type HotelLevel } from "./levels";

// ---------- tuning (the scoring proof in README cites these) ----------

export const LIVES = 3;
/** a correct door takes the bag */
export const DELIVER_POINTS = 80;
/** extra when that bag's 30 s clock is still above half */
export const QUICK_POINTS = 40;
export const BAG_CLOCK_S = 30;
/** Win only: per full second left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 5;

export const HALF_W = 2;
export const LOBBY_LEN = 6;
export const DOOR_SPACING = 3.2;
export const RADIUS = 0.4;
export const MAX_SPEED = 4;
export const LOADED_SCALE = 0.85;
export const ACCEL = 22;
export const BRAKE = 28;
/** actionPressed reaches a desk, pad or door within this distance of its point */
export const USE_RANGE = 1.3;
/** the elevator ride locks movement for this much play time */
export const RIDE_S = 1;
/** a wrong door locks movement for this much play time */
export const STUN_S = 0.4;
/** His centre to the cart's centre when it is straight behind him (cart.ts: the hitch plus the bar). */
export const TROLLEY_GAP = CART_GAP;
export const TROLLEY_RADIUS = 0.45;
/** A start or a stop may leave the bar this far off the hitch (m); the spring takes it back. */
export const TROLLEY_LAG = 0.12;

/** The reception desk against the lobby's end wall. Its point is the middle of its front edge. */
export const DESK: AABB = { min: { x: -1.1, y: 0, z: 0 }, max: { x: 1.1, y: 3, z: 0.9 } };
export const DESK_POINT = { x: 0, z: 0.9 } as const;
/** The elevator pad in front of the elevator door (x +2, z 4.4). */
export const PAD_POINT = { x: 1.2, z: 4.4 } as const;
export const ELEVATOR_Z = 4.4;
export const START = { x: 0, z: 2.6 } as const;

/** Decor that blocks: sofas and guests (sizes in metres, the drawn GLB fits to them: assets.ts). */
export const SOFA_SIZE = { x: 0.82, y: 0.85, z: 1.7 } as const;
export const PLANTER_SIZE = { x: 0.6, y: 0.62, z: 1.3 } as const;
export const GUEST_RADIUS = 0.3;

export const corridorLength = (level: HotelLevel) => level.doors * DOOR_SPACING + LOBBY_LEN;
/** Door i (0-based) sits on the x +2 wall at this z. Its label on floor f is f * 100 + i + 1. */
export const doorZ = (i: number) => LOBBY_LEN + DOOR_SPACING / 2 + DOOR_SPACING * i;
export const doorLabel = (floor: number, index: number) => floor * 100 + index;
export const DOOR_X = HALF_W;

/**
 * Per-level server limits (README "Server limits and why they hold"). A win at time t scores at most
 * 120 * bags + 5 * floor(clock - t); no win can come before earliestWinS(level) (provable, from the
 * geometry and the top speeds), so maxScore = that ceiling at the earliest win, base = 120 * bags
 * (every score before a win), and pps = ceil(5 * floor(clock - T0) / T0). minDurationMs is 2 s on every
 * level: no run ends sooner (earliestEndS: three wrong doors need a bag at a door and two 0.40 s stuns).
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: T0 9.56 s, 360 + 5 x 110 */
   1: { kind: "points", maxScore: 910, minDurationMs: 2000, maxDurationMs: 122_000, base: 360, maxPointsPerSec: 58, unitLabel: "pts", display: "int" },
   /** L2: T0 19.90 s (5 rides), 600 + 5 x 130 */
   2: { kind: "points", maxScore: 1250, minDurationMs: 2000, maxDurationMs: 152_000, base: 600, maxPointsPerSec: 33, unitLabel: "pts", display: "int" },
   /** L3: T0 32.93 s (7 rides), 840 + 5 x 147 */
   3: { kind: "points", maxScore: 1575, minDurationMs: 2000, maxDurationMs: 182_000, base: 840, maxPointsPerSec: 23, unitLabel: "pts", display: "int" },
   /** L4: T0 46.74 s (9 rides), 1080 + 5 x 133 */
   4: { kind: "points", maxScore: 1745, minDurationMs: 2000, maxDurationMs: 182_000, base: 1080, maxPointsPerSec: 15, unitLabel: "pts", display: "int" },
   /** L5: T0 77.93 s (12 rides), 1440 + 5 x 132 */
   5: { kind: "points", maxScore: 2100, minDurationMs: 2000, maxDurationMs: 212_000, base: 1440, maxPointsPerSec: 9, unitLabel: "pts", display: "int" },
};

// ---------- state ----------

export interface Bag {
   floor: number;
   /** door index, 1-based (the label's last digit) */
   index: number;
}

export interface Solid {
   kind: "sofa" | "planter" | "guest";
   x: number;
   z: number;
   rotY: number;
   box: AABB;
}

export interface StepEvents {
   score: number;
   /** a bag was taken at the desk */
   took: boolean;
   /** door index (0-based) of a correct delivery, else -1 */
   delivered: number;
   /** door index (0-based) of a wrong try, else -1 */
   wrong: number;
   rideStart: boolean;
   /** the ride ended: the labels now show run.floor */
   arrived: boolean;
   /** Use with nothing to do (pad without a ride, desk while loaded, door without a bag) */
   buzz: boolean;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
}

export interface Run {
   seed: number;
   level: HotelLevel;
   length: number;
   hero: { x: number; z: number; vx: number; vz: number; yaw: number; stun: number; ride: number };
   /**
    * The cart (looks only): its centre (x.x, z.x; .v its velocity) and heading, the bar's offset from
    * the hitch (ox, oz: springs to 0) and the hitch's last point and velocity (hx, hz, hvx, hvz).
    */
   trolley: { x: SpringState; z: SpringState; yaw: number; ox: SpringState; oz: SpringState; hx: number; hz: number; hvx: number; hvz: number };
   floor: number;
   bags: Bag[];
   /** the bag on the trolley or the next one at the desk */
   next: number;
   carrying: boolean;
   /** s left on the carried bag's clock */
   bagClock: number;
   delivered: number;
   wrongs: number;
   lives: number;
   score: number;
   time: number;
   over: "win" | "lose" | null;
   solids: Solid[];
   ev: StepEvents;
}

export interface HotelInput {
   moveX: number;
   moveY: number;
   actionPressed: boolean;
   /** camera yaw, the same value useFittedView returns; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): HotelInput => ({ moveX: 0, moveY: 0, actionPressed: false, yaw: 0 });

/** A floor-standing blocker. Every collision box runs 0..3 m high, so the 0.5 m body centre always meets its sides, never its top. */
function boxAt(x: number, z: number, sx: number, sz: number): AABB {
   return { min: { x: x - sx / 2, y: 0, z: z - sz / 2 }, max: { x: x + sx / 2, y: 3, z: z + sz / 2 } };
}

/** Sofas in the lobby, planters between the doors on both walls, two guests opposite doors 1 and 3. */
export function decorFor(level: HotelLevel): Solid[] {
   const out: Solid[] = [];
   const sofa = (x: number, z: number, rotY: number) => out.push({ kind: "sofa", x, z, rotY, box: boxAt(x, z, SOFA_SIZE.x, SOFA_SIZE.z) });
   const planter = (x: number, z: number) => out.push({ kind: "planter", x, z, rotY: Math.PI / 2, box: boxAt(x, z, PLANTER_SIZE.x, PLANTER_SIZE.z) });
   sofa(-HALF_W + SOFA_SIZE.x / 2, 3.2, Math.PI / 2);
   for (let i = 0; i < level.doors - 1; i++) {
      const z = doorZ(i) + DOOR_SPACING / 2;
      planter(HALF_W - PLANTER_SIZE.x / 2, z);
      if (i % 2 === 1) planter(-HALF_W + PLANTER_SIZE.x / 2, z);
   }
   for (const i of [0, 2]) {
      if (i >= level.doors) continue;
      const x = -HALF_W + 0.5;
      // across the corridor from the door, a step past it: never a pocket with a planter
      const z = doorZ(i) + 0.9;
      out.push({ kind: "guest", x, z, rotY: Math.PI / 2, box: boxAt(x, z, GUEST_RADIUS * 2, GUEST_RADIUS * 2) });
   }
   return out;
}

/**
 * The bag queue. Rooms come from a shuffle bag: every `doors` bags in a row use each door once (in a
 * seeded order), so no seed is all near doors or all far ones, and the earliest win is tight. Floors:
 * L1 every bag is for floor 1; from L2 each bag's floor differs from the one before (the first from
 * floor 1), so every delivery needs exactly one ride.
 */
export function bagQueue(seed: number, level: HotelLevel): Bag[] {
   const rng = createRng((seed >>> 0) ^ 0x5bd1e995);
   const bags: Bag[] = [];
   let floor = 1;
   let round: number[] = [];
   for (let k = 0; k < level.bags; k++) {
      if (round.length === 0) {
         round = Array.from({ length: level.doors }, (_, i) => i + 1);
         for (let i = round.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [round[i], round[j]] = [round[j], round[i]];
         }
      }
      let next = 1;
      if (level.floors > 1) {
         next = 1 + Math.floor(rng() * (level.floors - 1));
         if (next >= floor) next += 1;
      }
      // the same room twice in a row reads as a bug: take the round's next door first
      const prev = bags[k - 1];
      if (prev && prev.floor === next && prev.index === round[0] && round.length > 1) [round[0], round[1]] = [round[1], round[0]];
      bags.push({ floor: next, index: round.shift()! });
      floor = next;
   }
   return bags;
}

const freshEvents = (): StepEvents => ({ score: 0, took: false, delivered: -1, wrong: -1, rideStart: false, arrived: false, buzz: false, lifeLost: false, won: false, lost: false });

export function createRun(seed: number, level: HotelLevel = LEVELS[1]): Run {
   const length = corridorLength(level);
   return {
      seed: seed >>> 0,
      level,
      length,
      hero: { x: START.x, z: START.z, vx: 0, vz: 0, yaw: 0, stun: 0, ride: 0 },
      trolley: {
         x: { x: START.x, v: 0 },
         z: { x: START.z - TROLLEY_GAP, v: 0 },
         yaw: 0,
         ox: { x: 0, v: 0 },
         oz: { x: 0, v: 0 },
         hx: START.x,
         hz: START.z - TROLLEY_GAP + GRIP_AHEAD,
         hvx: 0,
         hvz: 0,
      },
      floor: 1,
      bags: bagQueue(seed, level),
      next: 0,
      carrying: false,
      bagClock: 0,
      delivered: 0,
      wrongs: 0,
      lives: LIVES,
      score: 0,
      time: 0,
      over: null,
      solids: decorFor(level),
      ev: freshEvents(),
   };
}

// ---------- geometry ----------

/** Is a body of `radius` at (x, z) clear of the walls, the desk and every solid? */
export function standable(run: Run, x: number, z: number, radius = RADIUS): boolean {
   if (Math.abs(x) > HALF_W - radius + 1e-9 || z < radius - 1e-9 || z > run.length - radius + 1e-9) return false;
   const inside = (b: AABB) => x > b.min.x - radius && x < b.max.x + radius && z > b.min.z - radius && z < b.max.z + radius;
   if (inside(DESK)) {
      const cx = Math.min(DESK.max.x, Math.max(DESK.min.x, x));
      const cz = Math.min(DESK.max.z, Math.max(DESK.min.z, z));
      if (Math.hypot(x - cx, z - cz) < radius - 1e-9) return false;
   }
   for (const solid of run.solids) {
      const b = solid.box;
      if (!inside(b)) continue;
      const cx = Math.min(b.max.x, Math.max(b.min.x, x));
      const cz = Math.min(b.max.z, Math.max(b.min.z, z));
      if (Math.hypot(x - cx, z - cz) < radius - 1e-9) return false;
   }
   return true;
}

const CENTER = { x: 0, y: 0.5, z: 0 };

function collide(run: Run, body: { x: number; z: number }, radius: number): void {
   CENTER.x = body.x;
   CENTER.z = body.z;
   resolveSphereAabb(CENTER, radius, DESK, CENTER);
   for (const solid of run.solids) resolveSphereAabb(CENTER, radius, solid.box, CENTER);
   body.x = Math.min(HALF_W - radius, Math.max(-HALF_W + radius, CENTER.x));
   body.z = Math.min(run.length - radius, Math.max(radius, CENTER.z));
}

function integrate(body: { vx: number; vz: number }, dirX: number, dirZ: number, dt: number, top: number): void {
   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }
   let dvx = dirX * top - body.vx;
   let dvz = dirZ * top - body.vz;
   const dv = Math.hypot(dvx, dvz);
   const cap = (len > 0.01 ? ACCEL : BRAKE) * dt;
   if (dv > cap && dv > 0) {
      dvx *= cap / dv;
      dvz *= cap / dv;
   }
   body.vx += dvx;
   body.vz += dvz;
}

export type Target = { kind: "desk" } | { kind: "pad" } | { kind: "door"; index: number };

/** What Use reaches from (x, z): the nearest desk, pad or door point within USE_RANGE, else null. */
export function targetAt(run: Run, x: number, z: number): Target | null {
   let best: Target | null = null;
   let bestD = USE_RANGE + 1e-9;
   const consider = (t: Target, px: number, pz: number) => {
      const d = Math.hypot(x - px, z - pz);
      if (d <= bestD) {
         bestD = d;
         best = t;
      }
   };
   consider({ kind: "desk" }, DESK_POINT.x, DESK_POINT.z);
   consider({ kind: "pad" }, PAD_POINT.x, PAD_POINT.z);
   for (let i = 0; i < run.level.doors; i++) consider({ kind: "door", index: i }, DOOR_X, doorZ(i));
   return best;
}

/** Would Use on `target` do something now (take, ride or try a door)? The Scene's highlight ring; it never says which door is right. */
export function targetUseful(run: Run, target: Target | null): boolean {
   if (!target || run.over) return false;
   const bag = run.bags[run.next];
   if (!bag) return false;
   if (target.kind === "desk") return !run.carrying;
   if (target.kind === "pad") return run.level.floors > 1 && run.carrying && run.floor !== bag.floor;
   return run.carrying;
}

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** Every point a level can pay before its time bonus: every bag delivered while still quick. */
export function objectiveCeiling(level: HotelLevel): number {
   return (DELIVER_POINTS + QUICK_POINTS) * level.bags;
}

function use(run: Run, target: Target | null, timeLeftMs: number): void {
   const ev = run.ev;
   if (!target) return;
   const bag = run.bags[run.next];
   if (target.kind === "desk") {
      if (run.carrying || !bag) {
         ev.buzz = true;
         return;
      }
      run.carrying = true;
      run.bagClock = BAG_CLOCK_S;
      ev.took = true;
      return;
   }
   if (target.kind === "pad") {
      // level 1: the pad is dark and Use on it does nothing. Otherwise it only rides with a bag for another floor.
      if (run.level.floors <= 1) return;
      if (!run.carrying || !bag || bag.floor === run.floor) {
         ev.buzz = true;
         return;
      }
      run.hero.ride = RIDE_S;
      run.hero.vx = 0;
      run.hero.vz = 0;
      ev.rideStart = true;
      return;
   }
   if (!run.carrying || !bag) {
      ev.buzz = true;
      return;
   }
   if (run.floor === bag.floor && target.index + 1 === bag.index) {
      const points = DELIVER_POINTS + (run.bagClock > BAG_CLOCK_S / 2 ? QUICK_POINTS : 0);
      run.score += points;
      ev.score += points;
      ev.delivered = target.index;
      run.carrying = false;
      run.bagClock = 0;
      run.delivered += 1;
      run.next += 1;
      if (run.delivered >= run.level.bags) {
         const bonus = timeBonus(timeLeftMs);
         run.score += bonus;
         ev.score += bonus;
         run.over = "win";
         ev.won = true;
      }
      return;
   }
   // wrong door: the bag stays on the trolley
   ev.wrong = target.index;
   ev.lifeLost = true;
   run.wrongs += 1;
   run.lives -= 1;
   run.hero.stun = STUN_S;
   run.hero.vx = 0;
   run.hero.vz = 0;
   if (run.lives <= 0) {
      run.over = "lose";
      ev.lost = true;
   }
}

const DIR = { x: 0, z: 0 };
const TROLLEY = { x: 0, z: 0 };
const HITCH_AT = { x: 0, z: 0 };
const REAR = { x: 0, z: 0 };

/**
 * The cart (looks only, it never moves the bellboy): its T-grip hangs on the hitch behind him
 * (cart.ts) on a stiff critically damped spring that only his starts, stops and turns disturb (no lag
 * at a steady walk); it heads from its rear axle to the bar, so it pivots instead of sliding sideways,
 * at most MAX_SWING off his heading; its far end turns about the bar to clear walls and decor, and its
 * centre is kept inside the corridor.
 */
export function stepTrolley(run: Run, dt: number): void {
   const h = run.hero;
   const t = run.trolley;
   hitchPoint(h.x, h.z, h.yaw, HITCH_AT);
   if (dt > 0) {
      // the bar's offset lives in the hitch's moving frame: only the hitch's acceleration pushes it
      const hvx = (HITCH_AT.x - t.hx) / dt;
      const hvz = (HITCH_AT.z - t.hz) / dt;
      const before = Math.hypot(t.ox.x, t.oz.x);
      t.ox.v -= hvx - t.hvx;
      t.oz.v -= hvz - t.hvz;
      spring(t.ox, 0, HITCH_STIFFNESS, -1, dt);
      spring(t.oz, 0, HITCH_STIFFNESS, -1, dt);
      const cap = Math.min(1, Math.max(TROLLEY_LAG, before));
      const lag = Math.hypot(t.ox.x, t.oz.x);
      if (lag > cap) {
         t.ox.x *= cap / lag;
         t.oz.x *= cap / lag;
      }
      t.hvx = hvx;
      t.hvz = hvz;
   }
   t.hx = HITCH_AT.x;
   t.hz = HITCH_AT.z;
   const bx = HITCH_AT.x + t.ox.x;
   const bz = HITCH_AT.z + t.oz.x;
   // the heading: from the rear axle to the bar, never more than MAX_SWING off his
   const ax = t.x.x - Math.sin(t.yaw) * AXLE_BACK;
   const az = t.z.x - Math.cos(t.yaw) * AXLE_BACK;
   let yaw = Math.hypot(bx - ax, bz - az) > 1e-6 ? Math.atan2(bx - ax, bz - az) : t.yaw;
   yaw = clampSwing(yaw, h.yaw);
   // the far end scrapes along walls: it turns about the bar
   for (let k = 0; k < 3; k++) {
      REAR.x = bx - Math.sin(yaw) * (GRIP_AHEAD + REAR_BACK);
      REAR.z = bz - Math.cos(yaw) * (GRIP_AHEAD + REAR_BACK);
      const rx = REAR.x;
      const rz = REAR.z;
      collide(run, REAR, REAR_RADIUS);
      if (REAR.x === rx && REAR.z === rz) break;
      yaw = Math.atan2(bx - REAR.x, bz - REAR.z);
   }
   TROLLEY.x = bx - Math.sin(yaw) * GRIP_AHEAD;
   TROLLEY.z = bz - Math.cos(yaw) * GRIP_AHEAD;
   collide(run, TROLLEY, TROLLEY_RADIUS);
   if (dt > 0) {
      t.x.v = (TROLLEY.x - t.x.x) / dt;
      t.z.v = (TROLLEY.z - t.z.x) / dt;
   }
   t.x.x = TROLLEY.x;
   t.z.x = TROLLEY.z;
   t.yaw = yaw;
   // a push-out leaves the bar off the hitch: the spring brings it back
   t.ox.x = TROLLEY.x + Math.sin(yaw) * GRIP_AHEAD - HITCH_AT.x;
   t.oz.x = TROLLEY.z + Math.cos(yaw) * GRIP_AHEAD - HITCH_AT.z;
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share this
 * function: only the stick axes and `actionPressed` matter, with the same ride and stun times.
 */
export function step(run: Run, input: HotelInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.took = false;
   ev.delivered = -1;
   ev.wrong = -1;
   ev.rideStart = false;
   ev.arrived = false;
   ev.buzz = false;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   const h = run.hero;
   if (run.carrying) run.bagClock = Math.max(0, run.bagClock - dt);

   let locked = false;
   if (h.ride > 0) {
      locked = true;
      h.ride -= dt;
      if (h.ride <= 1e-9) {
         h.ride = 0;
         const bag = run.bags[run.next];
         if (bag) run.floor = bag.floor;
         ev.arrived = true;
      }
   } else if (h.stun > 0) {
      locked = true;
      h.stun = Math.max(0, h.stun - dt);
   }

   if (locked) {
      h.vx = 0;
      h.vz = 0;
   } else {
      inputToWorld(input.moveX, input.moveY, input.yaw, DIR);
      integrate(h, DIR.x, DIR.z, dt, MAX_SPEED * (run.carrying ? LOADED_SCALE : 1));
      const ox = h.x;
      const oz = h.z;
      const reach = Math.hypot(h.vx, h.vz) * dt;
      h.x += h.vx * dt;
      h.z += h.vz * dt;
      collide(run, h, RADIUS);
      // a push-out round a corner may not carry the body further than its own step (the proof's
      // speed bound): shorten it, or stay put when the shortened point is not clear
      const moved = Math.hypot(h.x - ox, h.z - oz);
      if (!standable(run, h.x, h.z, RADIUS)) {
         // pushed out of one blocker into another: stay where he stood
         h.x = ox;
         h.z = oz;
      } else if (moved > reach + 1e-12) {
         const k = reach / moved;
         const sx = ox + (h.x - ox) * k;
         const sz = oz + (h.z - oz) * k;
         if (standable(run, sx, sz, RADIUS)) {
            h.x = sx;
            h.z = sz;
         } else {
            h.x = ox;
            h.z = oz;
         }
      }
      // a wall stop kills the speed into it (never above the integrated speed)
      h.vx = (h.x - ox) / dt;
      h.vz = (h.z - oz) / dt;
      const speed = Math.hypot(h.vx, h.vz);
      if (speed > 0.25) h.yaw = turnTowards(h.yaw, Math.atan2(h.vx, h.vz), Math.min(1, dt * 12));
      if (input.actionPressed) use(run, targetAt(run, h.x, h.z), timeLeftMs);
   }
   stepTrolley(run, dt);
   return ev;
}

// ---------- the earliest win (README proof) ----------

/** Shortest walk between two Use zones: their points' distance less both reaches. */
const legBetween = (ax: number, az: number, bx: number, bz: number) => Math.max(0, Math.hypot(ax - bx, az - bz) - 2 * USE_RANGE);
/**
 * Extra metres a just-loaded bellboy can cover while his speed falls from 4.0 to 3.4 m/s
 * ((4 - 3.4) / ACCEL s at under 0.6 m/s over the loaded top, at most 0.01 m): 0.05 is generous.
 */
export const LOADED_SLACK = 0.05;

/**
 * No win can come sooner (s). Every bag is walked loaded from the desk's Use zone to its door's (via
 * the pad's zone and a 1.00 s locked ride from L2, where every bag is for another floor than the
 * last), and every bag but the last is followed by a walk back to the desk's zone at top speed. The
 * shuffle bag fixes how often each door comes up (each once per `doors` bags); the bound takes the
 * cheapest rooms for the part round and the most distant door for the last bag (no walk back).
 */
export function earliestWinS(level: HotelLevel): number {
   const n = level.doors;
   const loaded: number[] = [];
   const back: number[] = [];
   for (let i = 0; i < n; i++) {
      const z = doorZ(i);
      loaded.push(level.floors > 1
         ? legBetween(DESK_POINT.x, DESK_POINT.z, PAD_POINT.x, PAD_POINT.z) + legBetween(PAD_POINT.x, PAD_POINT.z, DOOR_X, z)
         : legBetween(DESK_POINT.x, DESK_POINT.z, DOOR_X, z));
      back.push(legBetween(DOOR_X, z, DESK_POINT.x, DESK_POINT.z));
   }
   const full = Math.floor(level.bags / n);
   const part = level.bags % n;
   const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
   const loadedV = MAX_SPEED * LOADED_SCALE;
   let best = Infinity;
   for (let mask = 0; mask < 1 << n; mask++) {
      let size = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) size++;
      if (size !== part) continue;
      const inPart = (i: number) => (mask & (1 << i)) !== 0;
      let walkLoaded = full * sum(loaded);
      let walkBack = full * sum(back);
      for (let i = 0; i < n; i++) if (inPart(i)) {
         walkLoaded += loaded[i];
         walkBack += back[i];
      }
      for (let last = 0; last < n; last++) {
         if (full === 0 && !inPart(last)) continue;
         const t = Math.max(0, walkLoaded - level.bags * LOADED_SLACK) / loadedV + (walkBack - back[last]) / MAX_SPEED;
         best = Math.min(best, t);
      }
   }
   return best + (level.floors > 1 ? level.bags * RIDE_S : 0);
}

/**
 * No run ends sooner (s), win or lose: a loss needs three wrong doors, so a bag walked loaded from the
 * desk's zone to door 1's and the two 0.40 s stuns before the third try.
 */
export function earliestEndS(level: HotelLevel): number {
   const lose = Math.max(0, legBetween(DESK_POINT.x, DESK_POINT.z, DOOR_X, doorZ(0)) - LOADED_SLACK) / (MAX_SPEED * LOADED_SCALE) + (LIVES - 1) * STUN_S;
   return Math.min(lose, earliestWinS(level));
}

/** The highest score a win at time t (s) can carry on this level. */
export function winCeiling(level: HotelLevel, t: number): number {
   return objectiveCeiling(level) + TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, level.durationMs / 1000 - t) + 1e-9);
}
