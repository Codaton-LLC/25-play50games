// Dog Park Fetch rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// One fenced lawn (width x depth, centred on x = 0, the blanket at the south end). The owner
// throws one toy at a time. Every throw's landing point is drawn from the seed when the run is made,
// so the plan never depends on the player. Only one throw is active: the next starts THROW_GAP_S
// after the last one is resolved (returned, or fetched by the owner).
import { stepPatrol, type Agent, type PatrolState } from "@/arcade3d/core/ai";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { createPath, nearestS, pointAt, type Path } from "@/arcade3d/core/path";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type DogLevel } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

export const TOY_POINTS = 100;
/** A returned toy that landed (or was caught) at most this long ago pays the quick bonus. */
export const QUICK_POINTS = 40;
export const QUICK_S = 8;
export const FRISBEE_CATCH_POINTS = 60;
/** Win only: points per full second left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;
export const THROW_GAP_S = 0.8;

/**
 * A frisbee floats 1.6 s over the first 6 m and 0.13 s for every metre past that, so a dog that sets
 * off when it leaves the owner's hand can reach even an 18 m throw (spec: a flat 1.6 s, which made
 * the long L3-L5 frisbees uncatchable from the blanket).
 */
export const FRISBEE_FLIGHT_S = 1.6;
export const FRISBEE_FLIGHT_PER_M = 0.13;

export function frisbeeFlight(distance: number): number {
   return FRISBEE_FLIGHT_S + FRISBEE_FLIGHT_PER_M * Math.max(0, distance - 6);
}
export const FRISBEE_APEX = 1.5;
/** A frisbee is catchable in its last FRISBEE_WINDOW_S of flight, and only below CATCH_H. */
export const FRISBEE_WINDOW_S = 0.9;
export const CATCH_H = 1.4;

export const DOG_R = 0.32;
export const MAX_SPEED = 6.0;
export const ACCEL = 26;
export const BRAKE = 30;
/** A leap lasts LEAP_S and peaks at LEAP_H; catches need a leap. */
export const LEAP_S = 0.45;
export const LEAP_H = 0.8;
export const CATCH_R = 0.6;
/** A ground toy is picked up when the dog's centre is this close. */
export const PICK_R = 0.5;
export const BLANKET_R = 1.5;
export const BLANKET_INSET = 1.8;

export const MOWER_R = 0.6;
export const MOWER_MERCY_S = 0.8;
export const STUN_S = 0.6;
/** Mowers patrol a loop this far inside the fence. */
export const MOWER_INSET = 2.5;
export const EDGE_MARGIN = 1.0;
/** Throws land at least this far from a prop's edge. */
export const PROP_GAP = 1.5;
export const FOUNTAIN_R = 1.2;
export const BENCH_R = 0.5;
export const TREE_R = 0.7;

/**
 * Per level (README "Server limits"): base = Bobj (every toy with its quick bonus, every frisbee caught),
 * the win's time bonus 4 * floor(D - t) is largest at the earliest win M, so maxScore >= Bobj + 4 floor(D - M)
 * (+3 %) and pps >= 4 (D / M - 1). M = 0.8 x the fastest oracle win over 200 seeds at 30 / 60 / 144 Hz.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 680, D 90 s, oracle 12.57 s -> M 10.0 s, peak 1000; pps 4 * (90 / 10 - 1) = 32 */
   1: { kind: "points", maxScore: 1030, minDurationMs: 4000, maxDurationMs: 90_000, base: 680, maxPointsPerSec: 33, unitLabel: "pts", display: "int" },
   /** L2: Bobj 960, D 120 s, oracle 22.07 s -> M 17.65 s, peak 1368; pps 23.2 */
   2: { kind: "points", maxScore: 1410, minDurationMs: 4000, maxDurationMs: 120_000, base: 960, maxPointsPerSec: 24, unitLabel: "pts", display: "int" },
   /** L3: Bobj 1300, D 150 s, oracle 32.43 s -> M 25.95 s, peak 1796; pps 19.1 */
   3: { kind: "points", maxScore: 1850, minDurationMs: 4000, maxDurationMs: 150_000, base: 1300, maxPointsPerSec: 20, unitLabel: "pts", display: "int" },
   /** L4: Bobj 1640, D 150 s, oracle 42.95 s -> M 34.36 s, peak 2100; pps 13.5 */
   4: { kind: "points", maxScore: 2165, minDurationMs: 4000, maxDurationMs: 150_000, base: 1640, maxPointsPerSec: 14, unitLabel: "pts", display: "int" },
   /** L5: Bobj 1920, D 180 s, oracle 59.87 s -> M 47.89 s, peak 2448; pps 11.0 */
   5: { kind: "points", maxScore: 2525, minDurationMs: 4000, maxDurationMs: 180_000, base: 1920, maxPointsPerSec: 12, unitLabel: "pts", display: "int" },
};

/** The earliest win each proof assumes (s); the proof tests pin it against the bots. */
export const PROOF_EARLIEST_WIN_S: Record<LevelId, number> = { 1: 10.0, 2: 17.65, 3: 25.95, 4: 34.36, 5: 47.89 };

// ---------- state ----------

export type Kind = "ball" | "stick" | "frisbee";
export type ThrowState = "flying" | "ground" | "carried";

/** One planned throw, drawn from the seed when the run is made. */
export interface Plan {
   kind: Kind;
   lx: number;
   lz: number;
   flight: number;
   apex: number;
}

export interface Throw {
   index: number;
   kind: Kind;
   /** where the toy leaves the owner (or was dropped, once on the ground) */
   sx: number;
   sz: number;
   lx: number;
   lz: number;
   flight: number;
   apex: number;
   /** seconds since the throw (flying) */
   t: number;
   state: ThrowState;
   /** run time of landing (or of the catch); the quick bonus counts from here */
   landedAt: number;
}

export interface Dog {
   x: number;
   z: number;
   vx: number;
   vz: number;
   yaw: number;
   /** seconds of leap left (0 = on the ground) */
   leap: number;
   /** seconds of stun left (a mower knocked the dog over) */
   stun: number;
   /** seconds of mercy left after a mower hit */
   mercy: number;
}

export interface Prop {
   x: number;
   z: number;
   r: number;
}

export interface Mower {
   agent: Agent;
   patrol: PatrolState;
}

export interface StepEvents {
   score: number;
   thrown: number;
   landed: boolean;
   caught: boolean;
   returned: boolean;
   fetched: boolean;
   dropped: boolean;
   mowerHit: boolean;
   leap: boolean;
   won: boolean;
   lost: boolean;
}

export interface Run {
   level: DogLevel;
   time: number;
   over: "win" | "lose" | null;
   score: number;
   plan: Plan[];
   issued: number;
   resolved: number;
   returned: number;
   timedOut: number;
   caught: number;
   active: Throw | null;
   nextAt: number;
   dog: Dog;
   blanket: { x: number; z: number };
   props: Prop[];
   mowers: Mower[];
   route: Path;
   ev: StepEvents;
   /** the Fetched stat last written to the store (-1 = never) */
   syncedFetched: number;
}

export interface DogInput {
   moveX: number;
   moveY: number;
   jumpPressed: boolean;
   yaw: number;
}

export const idleInput = (): DogInput => ({ moveX: 0, moveY: 0, jumpPressed: false, yaw: 0 });

// ---------- layout and the throw plan ----------

const DIR = { x: 0, z: 0 };

/** Every third throw (the first, the fourth, ...) is a frisbee: frisbees = ceil(throws / 3). */
export function frisbeeCount(throws: number): number {
   return Math.ceil(throws / 3);
}

export function blanketOf(level: DogLevel): { x: number; z: number } {
   return { x: 0, z: level.depth / 2 - BLANKET_INSET };
}

/** Benches, trees and (L2+) the fountain: solid circles the dog and the throws keep clear of. */
export function propsOf(level: DogLevel): Prop[] {
   const props: Prop[] = [];
   if (level.fountain) props.push({ x: 0, z: 0, r: FOUNTAIN_R });
   props.push({ x: -level.width * 0.28, z: -level.depth * 0.15, r: BENCH_R });
   props.push({ x: level.width * 0.28, z: -level.depth * 0.15, r: BENCH_R });
   // Park bushes (L3+): low, so they never hide the dog from the camera.
   if (level.mowers > 0) {
      props.push({ x: -level.width * 0.36, z: -level.depth * 0.32, r: TREE_R });
      props.push({ x: level.width * 0.36, z: -level.depth * 0.32, r: TREE_R });
   }
   return props;
}

/** Inside the fence with the edge margin, and clear of every prop by PROP_GAP. */
export function landingOk(level: DogLevel, props: readonly Prop[], x: number, z: number): boolean {
   if (Math.abs(x) > level.width / 2 - EDGE_MARGIN) return false;
   if (Math.abs(z) > level.depth / 2 - EDGE_MARGIN) return false;
   for (const p of props) {
      if (Math.hypot(x - p.x, z - p.z) < p.r + PROP_GAP) return false;
   }
   return true;
}

function drawPlan(rng: () => number, level: DogLevel, props: readonly Prop[], blanket: { x: number; z: number }): Plan[] {
   const plan: Plan[] = [];
   for (let k = 0; k < level.throws; k++) {
      const frisbee = k % 3 === 0;
      const kind: Kind = frisbee ? "frisbee" : rng() < 0.5 ? "ball" : "stick";
      let found: { x: number; z: number; d: number } | null = null;
      for (let tries = 0; tries < 400 && !found; tries++) {
         const d = level.throwMin + rng() * (level.throwMax - level.throwMin);
         const angle = rng() * Math.PI * 2;
         const x = blanket.x + d * Math.sin(angle);
         const z = blanket.z + d * Math.cos(angle);
         if (landingOk(level, props, x, z)) found = { x, z, d };
      }
      if (!found) throw new Error("dog-park-fetch: no landing spot for throw " + k);
      plan.push({
         kind,
         lx: found.x,
         lz: found.z,
         flight: frisbee ? frisbeeFlight(found.d) : 0.9 + 0.05 * found.d,
         apex: frisbee ? FRISBEE_APEX : kind === "ball" ? 1.2 : 1.0,
      });
   }
   return plan;
}

/**
 * The mowers' closed loop: MOWER_INSET inside the fence on the north, east and west, and on the south
 * it runs north of the blanket (BLANKET_R + MOWER_R + 1 m clear), so a delivery is never mowed down.
 */
export function mowerLoop(level: DogLevel): { x: number; y: number; z: number }[] {
   const hw = level.width / 2 - MOWER_INSET;
   const north = -(level.depth / 2 - MOWER_INSET);
   const south = Math.min(level.depth / 2 - MOWER_INSET, blanketOf(level).z - BLANKET_R - MOWER_R - 1.0);
   return [
      { x: hw, y: 0, z: south },
      { x: hw, y: 0, z: north },
      { x: -hw, y: 0, z: north },
      { x: -hw, y: 0, z: south },
   ];
}

/** The lawn for one seed: the throw plan, the props, the mowers and the dog on the blanket. */
export function createRun(seed: number, level: DogLevel = LEVELS[1]): Run {
   const rng = createRng(seed);
   const blanket = blanketOf(level);
   const props = propsOf(level);
   const plan = drawPlan(rng, level, props, blanket);
   const corners = mowerLoop(level);
   const route = createPath(corners, { closed: true });
   const mowers: Mower[] = [];
   for (let k = 0; k < level.mowers; k++) {
      const at = (k * 2) % corners.length;
      const p = corners[at];
      mowers.push({
         agent: { x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0, yaw: 0 },
         patrol: { index: (at + 1) % corners.length, wait: 0, mode: "patrol", target: { x: p.x, y: 0, z: p.z } },
      });
   }
   return {
      level,
      time: 0,
      over: null,
      score: 0,
      plan,
      issued: 0,
      resolved: 0,
      returned: 0,
      timedOut: 0,
      caught: 0,
      active: null,
      nextAt: THROW_GAP_S,
      dog: { x: blanket.x, z: blanket.z, vx: 0, vz: 0, yaw: Math.PI, leap: 0, stun: 0, mercy: 0 },
      blanket,
      props,
      mowers,
      route,
      ev: { score: 0, thrown: -1, landed: false, caught: false, returned: false, fetched: false, dropped: false, mowerHit: false, leap: false, won: false, lost: false },
      syncedFetched: -1,
   };
}

/** Most points a full clear can score before the time bonus: every toy with its quick bonus, every catch. */
export function objectiveCeiling(level: DogLevel): number {
   return (TOY_POINTS + QUICK_POINTS) * level.throws + FRISBEE_CATCH_POINTS * frisbeeCount(level.throws);
}

/** Win only: full seconds left on the shell clock. */
export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

// ---------- the toy in the air ----------

/** Fraction of the flight done, 0..1. */
export function flightFraction(th: Throw): number {
   return Math.min(1, Math.max(0, th.t / th.flight));
}

/** Height of a flying toy (a parabola from the owner's hand to the ground). 0 once on the ground. */
export function heightOf(th: Throw): number {
   if (th.state !== "flying") return 0;
   const f = flightFraction(th);
   return 4 * th.apex * f * (1 - f);
}

/** Ground position of a toy: along the throw while it flies, the landing spot once it lies. */
export function toyXZ(th: Throw, out: { x: number; z: number }): { x: number; z: number } {
   if (th.state === "flying") {
      const f = flightFraction(th);
      out.x = th.sx + (th.lx - th.sx) * f;
      out.z = th.sz + (th.lz - th.sz) * f;
   } else {
      out.x = th.lx;
      out.z = th.lz;
   }
   return out;
}

const TOY = { x: 0, z: 0 };

/**
 * May the dog catch this toy now? Only a frisbee in flight, in its last FRISBEE_WINDOW_S, below
 * CATCH_H, while the dog leaps over it (within CATCH_R on the ground). Pure: the tests call it with
 * heights they pick.
 */
export function canCatch(th: Throw, leaping: boolean, dogX: number, dogZ: number): boolean {
   if (!leaping || th.state !== "flying" || th.kind !== "frisbee") return false;
   if (th.t < th.flight - FRISBEE_WINDOW_S) return false;
   if (heightOf(th) >= CATCH_H) return false;
   toyXZ(th, TOY);
   return Math.hypot(TOY.x - dogX, TOY.z - dogZ) <= CATCH_R;
}

// ---------- the dog ----------

function approach(value: number, target: number, maxDelta: number): number {
   const diff = target - value;
   if (diff > maxDelta) return value + maxDelta;
   if (diff < -maxDelta) return value - maxDelta;
   return target;
}

/** Pushes the dog's circle out of a prop circle. */
export function pushOutCircle(p: { x: number; z: number }, radius: number, c: Prop): void {
   const dx = p.x - c.x;
   const dz = p.z - c.z;
   const d = Math.hypot(dx, dz);
   const min = radius + c.r;
   if (d >= min) return;
   if (d > 1e-9) {
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
   } else p.x = c.x + min;
}

function integrate(dog: Dog, dirX: number, dirZ: number, dt: number): void {
   const moving = dirX !== 0 || dirZ !== 0;
   const rate = (moving ? ACCEL : BRAKE) * dt;
   dog.vx = approach(dog.vx, dirX * MAX_SPEED, rate);
   dog.vz = approach(dog.vz, dirZ * MAX_SPEED, rate);
   dog.x += dog.vx * dt;
   dog.z += dog.vz * dt;
   if (Math.hypot(dog.vx, dog.vz) > 0.3) dog.yaw = turnTowards(dog.yaw, Math.atan2(dog.vx, dog.vz), Math.min(1, dt * 12));
}

function clampLawn(dog: Dog, level: DogLevel): void {
   const hw = level.width / 2 - DOG_R;
   const hd = level.depth / 2 - DOG_R;
   if (dog.x < -hw) dog.x = -hw;
   if (dog.x > hw) dog.x = hw;
   if (dog.z < -hd) dog.z = -hd;
   if (dog.z > hd) dog.z = hd;
}

function award(run: Run, ev: StepEvents, points: number): void {
   run.score += points;
   ev.score += points;
}

// ---------- one frame ----------

function resolveThrow(run: Run): void {
   run.active = null;
   run.nextAt = run.time + THROW_GAP_S;
}

function advanceThrow(run: Run, dt: number, ev: StepEvents): void {
   if (!run.active) {
      if (run.issued < run.level.throws && run.time >= run.nextAt) {
         const p = run.plan[run.issued];
         run.active = {
            index: run.issued,
            kind: p.kind,
            sx: run.blanket.x,
            sz: run.blanket.z,
            lx: p.lx,
            lz: p.lz,
            flight: p.flight,
            apex: p.apex,
            t: 0,
            state: "flying",
            landedAt: 0,
         };
         run.issued += 1;
         ev.thrown = run.active.index;
      }
      return;
   }
   const th = run.active;
   if (th.state === "flying") {
      th.t += dt;
      if (th.t >= th.flight) {
         th.t = th.flight;
         th.state = "ground";
         th.landedAt = run.time;
         ev.landed = true;
      }
   } else if (th.state === "ground" && run.level.patienceS > 0 && run.time - th.landedAt >= run.level.patienceS) {
      // The owner fetches it: no points, the next throw starts.
      run.timedOut += 1;
      run.resolved += 1;
      ev.fetched = true;
      resolveThrow(run);
      if (run.timedOut >= 2 && !run.over) {
         run.over = "lose";
         ev.lost = true;
      }
   }
}

function collect(run: Run, ev: StepEvents): void {
   const th = run.active;
   const dog = run.dog;
   if (!th || dog.stun > 0) return;
   if (canCatch(th, dog.leap > 0, dog.x, dog.z)) {
      th.state = "carried";
      th.landedAt = run.time;
      run.caught += 1;
      award(run, ev, FRISBEE_CATCH_POINTS);
      ev.caught = true;
      return;
   }
   if (th.state === "ground") {
      toyXZ(th, TOY);
      if (Math.hypot(TOY.x - dog.x, TOY.z - dog.z) <= PICK_R) th.state = "carried";
   }
}

function deliver(run: Run, ev: StepEvents): void {
   const th = run.active;
   if (!th || th.state !== "carried") return;
   if (Math.hypot(run.dog.x - run.blanket.x, run.dog.z - run.blanket.z) > BLANKET_R) return;
   run.returned += 1;
   run.resolved += 1;
   award(run, ev, TOY_POINTS + (run.time - th.landedAt <= QUICK_S + 1e-9 ? QUICK_POINTS : 0));
   ev.returned = true;
   resolveThrow(run);
}

function mowers(run: Run, dt: number, ev: StepEvents): void {
   const dog = run.dog;
   for (const m of run.mowers) {
      stepPatrol(m.agent, m.patrol, run.route, dt, { speed: run.level.mowerSpeed });
      if (ev.mowerHit || dog.mercy > 0) continue;
      if (Math.hypot(m.agent.x - dog.x, m.agent.z - dog.z) < MOWER_R + DOG_R) {
         ev.mowerHit = true;
         dog.stun = STUN_S;
         dog.mercy = MOWER_MERCY_S;
         const th = run.active;
         if (th && th.state === "carried") {
            // Dropped where the dog stands; it lies there until someone picks it up again.
            th.lx = dog.x;
            th.lz = dog.z;
            th.sx = dog.x;
            th.sz = dog.z;
            th.state = "ground";
            ev.dropped = true;
         }
      }
   }
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share
 * this function: only the stick axes and jumpPressed matter, for the same durations.
 */
export function step(run: Run, input: DogInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.thrown = -1;
   ev.landed = false;
   ev.caught = false;
   ev.returned = false;
   ev.fetched = false;
   ev.dropped = false;
   ev.mowerHit = false;
   ev.leap = false;
   ev.won = false;
   ev.lost = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;

   const dog = run.dog;
   dog.leap = Math.max(0, dog.leap - dt);
   dog.stun = Math.max(0, dog.stun - dt);
   dog.mercy = Math.max(0, dog.mercy - dt);
   if (dog.stun > 0) {
      dog.vx = 0;
      dog.vz = 0;
   } else {
      if (input.jumpPressed && dog.leap <= 0) {
         dog.leap = LEAP_S;
         ev.leap = true;
      }
      inputToWorld(input.moveX, input.moveY, input.yaw, DIR);
      integrate(dog, DIR.x, DIR.z, dt);
   }
   for (const p of run.props) pushOutCircle(dog, DOG_R, p);
   clampLawn(dog, run.level);

   advanceThrow(run, dt, ev);
   if (run.over) return ev;
   collect(run, ev);
   deliver(run, ev);
   mowers(run, dt, ev);

   if (!run.over && run.resolved === run.level.throws && run.returned >= run.level.throws - 1) {
      award(run, ev, timeBonus(timeLeftMs));
      run.over = "win";
      ev.won = true;
   }
   return ev;
}

/** The bits of the arcade store a frame writes (the real store and the bots' createArcadeStore). */
export interface FrameStore {
   getState(): {
      timeLeftMs: number | null;
      addScore(points: number): void;
      setStat(key: string, value: number): void;
      end(reason: "win" | "lose"): void;
   };
}

/**
 * One played frame through the store: the Scene and the proof bots both call this. Score is added
 * as it is earned, the Fetched stat only when it changes, and the run ends in the store on a win or a
 * lose. Returns the step's events.
 */
export function frame(run: Run, input: DogInput, dt: number, store: FrameStore): StepEvents {
   const st = store.getState();
   const ev = step(run, input, dt, st.timeLeftMs ?? 0);
   if (ev.score) st.addScore(ev.score);
   if (run.syncedFetched !== run.returned) {
      run.syncedFetched = run.returned;
      st.setStat("fetched", run.returned);
   }
   if (ev.won) st.end("win");
   else if (ev.lost) st.end("lose");
   return ev;
}

/** Keeps one mower's route point reachable for tests and the Scene (nearest loop point). */
export function nearestLoopPoint(run: Run, agent: Agent): { x: number; z: number } {
   const out = { x: 0, y: 0, z: 0 };
   pointAt(run.route, nearestS(run.route, agent), out);
   return { x: out.x, z: out.z };
}

/** Height of the dog's leap t seconds in (visual only: the catch uses the toy's height). */
export function leapHeight(t: number): number {
   const f = Math.min(1, Math.max(0, t / LEAP_S));
   return 4 * LEAP_H * f * (1 - f);
}
