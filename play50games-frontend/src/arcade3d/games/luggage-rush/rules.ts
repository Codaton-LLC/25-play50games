// Airport Luggage Rush rules. Pure and seeded: no three.js, React, DOM, Math.random or Date.now.
// One stepRun from the Scene's useRunFrame. The belt is a core/path graph; a diverter is read
// only when a bag's step overflows the segment end (the crossing line).
import type { ScoringRules } from "@/arcade3d/types";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { rngNext, type RngState } from "@/arcade3d/core/math";
import { advanceGraph, createPath, createPathGraph, type Path, type RiderState } from "@/arcade3d/core/path";

export const DURATION_MS = 120_000;
export const RESULT_DELAY_MS = 900;
export const POOL = 40;
export const GAP = 1.1;
export const STRIKE_LIMIT = 3;
export const PHASE_D3 = 40;
export const PHASE_D4 = 70;
export const SHORTEST_M = 8.4;
export const TAG_M = 0.45;
export const MOUTH_M = 0.9;

export const HALL = {
   minX: 0.4,
   maxX: 11.6,
   minY: 0,
   maxY: 2.6,
   minZ: -0.6,
   maxZ: 14.8,
   beltY: 0.45,
   spineX: 3.4,
   gateX: 7.4,
   spawnZ: 0,
} as const;

export const BELT = { base: 1.35, step: 1.03, heavy: 0.7 } as const;
const SPEED_AT = [15, 30, 45, 60, 75, 90, 105] as const;

export const SPAWN = { start: 2.2, end: 0.9, rampS: 120 } as const;

/** 0 red circle, 1 blue square, 2 green triangle, 3 yellow star. VIP is not a fifth colour. */
export const FLIGHTS = [
   { color: "#f87171", symbol: "circle" },
   { color: "#60a5fa", symbol: "square" },
   { color: "#34d399", symbol: "triangle" },
   { color: "#fbbf24", symbol: "star" },
] as const;
export const VIP_RIM = "#fde68a";

export const SCORE = { bag: 20, comboStep: 0.25, comboCap: 3, vip: 2 } as const;

/** Proposed server limits (user 2026-10-08). meta.ts stays on the provisional numbers until Claude's limits PR. */
export const PROPOSED_LIMITS: ScoringRules = {
   kind: "points",
   maxScore: 7620,
   minDurationMs: 10_000,
   maxDurationMs: 122_000,
   base: 0,
   maxPointsPerSec: 64,
   unitLabel: "pts",
   display: "int",
};

const Y = HALL.beltY;
const X = HALL.spineX;
const Z1 = HALL.spawnZ + 4.4;
const Z2 = Z1 + 3.6;
const Z3 = Z2 + 3.2;
const Z4 = Z3 + 3.0;

export const DIVERTER_AT = [
   { x: X, y: Y, z: Z1 },
   { x: X, y: Y, z: Z2 },
   { x: X, y: Y, z: Z3 },
   { x: X, y: Y, z: Z4 },
] as const;

const p = (x: number, z: number) => ({ x, y: Y, z });

/** Segment index. choose() returns one of these, not a 0/1 choice. */
export const SEG = {
   entry: 0,
   mid: 1,
   chuteR: 2,
   chuteB: 3,
   toD3: 4,
   chuteG: 5,
   hold: 6,
   chuteY: 7,
   overflow: 8,
} as const;

export const PATHS: Path[] = [
   createPath([p(X, HALL.spawnZ), p(X, Z1)]),
   createPath([p(X, Z1), p(X, Z2)]),
   createPath([p(X, Z1), p(HALL.gateX, Z1)]),
   createPath([p(X, Z2), p(HALL.gateX, Z2)]),
   createPath([p(X, Z2), p(X, Z3)]),
   createPath([p(X, Z3), p(HALL.gateX, Z3)]),
   createPath([p(X, Z3), p(X, Z4)]),
   createPath([p(X, Z4), p(HALL.gateX, Z4)]),
   createPath([p(X, Z4), p(X - 2.8, Z4)]),
];

/** One mesh for the spine (entry + mid + toD3 + hold). Not a second belt on toD3. */
export const SPINE_PATH = createPath([p(X, HALL.spawnZ), p(X, Z1), p(X, Z2), p(X, Z3), p(X, Z4)]);
export const CHUTE_PATHS = [PATHS[SEG.chuteR], PATHS[SEG.chuteB], PATHS[SEG.chuteG], PATHS[SEG.chuteY]];
export const OVERFLOW_PATH = PATHS[SEG.overflow];

const GRAPH = createPathGraph(PATHS, [
   [SEG.chuteR, SEG.mid],
   [SEG.chuteB, SEG.toD3],
   [],
   [],
   [SEG.chuteG, SEG.hold],
   [],
   [SEG.chuteY, SEG.overflow],
   [],
   [],
]);

/** Chute segment → flight. -1 if the segment is not a gate. */
const CHUTE_FLIGHT = [-1, -1, 0, 1, -1, 2, -1, 3, -1];

export interface Bag {
   alive: boolean;
   /** seconds of the strike tumble still to show; the slot stays taken */
   tumble: number;
   segment: number;
   s: number;
   flight: number;
   vip: boolean;
   heavy: boolean;
   born: number;
   x: number;
   y: number;
   z: number;
}

export interface StepEvent {
   kind: "deliver" | "strike" | "flip";
   points: number;
   x: number;
   y: number;
   z: number;
   overflow: boolean;
   flight: number;
   diverter: number;
}

export interface StepInput {
   flip: [boolean, boolean, boolean, boolean];
}

export interface RunState {
   rng: RngState;
   /** D1..D4, each 0 or 1. Start on 0. */
   choices: [number, number, number, number];
   bags: Bag[];
   order: number[];
   nextSpawn: number;
   born: number;
   streak: number;
   strikes: number;
   score: number;
   lost: boolean;
   time: number;
   events: StepEvent[];
   eventCount: number;
}

const emptyInput = (): StepInput => ({ flip: [false, false, false, false] });
export const NO_FLIP: StepInput = emptyInput();

function blankBag(): Bag {
   return { alive: false, tumble: 0, segment: 0, s: 0, flight: 0, vip: false, heavy: false, born: 0, x: X, y: Y, z: HALL.spawnZ };
}

export function createRun(seed: number): RunState {
   const bags: Bag[] = [];
   for (let i = 0; i < POOL; i++) bags.push(blankBag());
   return {
      rng: { s: seed >>> 0 },
      choices: [0, 0, 0, 0],
      bags,
      order: bags.map((_, i) => i),
      nextSpawn: 0,
      born: 1,
      streak: 0,
      strikes: 0,
      score: 0,
      lost: false,
      time: 0,
      events: Array.from({ length: 16 }, () => ({ kind: "deliver", points: 0, x: 0, y: 0, z: 0, overflow: false, flight: 0, diverter: -1 })),
      eventCount: 0,
   };
}

export function beltSpeed(t: number): number {
   let steps = 0;
   for (let i = 0; i < SPEED_AT.length; i++) if (t >= SPEED_AT[i]) steps++;
   return BELT.base * BELT.step ** steps;
}

export function intervalAt(t: number): number {
   const u = t < SPAWN.rampS ? t : SPAWN.rampS;
   return SPAWN.start - (SPAWN.start - SPAWN.end) * (u / SPAWN.rampS);
}

/** Seconds to ride `distance` metres starting at time `t0`, at the normal belt speed. */
export function travelTime(distance: number, t0: number): number {
   let t = t0;
   let left = distance;
   for (let guard = 0; left > 1e-9 && guard < 16; guard++) {
      const v = beltSpeed(t);
      let next = Infinity;
      for (let i = 0; i < SPEED_AT.length; i++) if (SPEED_AT[i] > t + 1e-12 && SPEED_AT[i] < next) next = SPEED_AT[i];
      const dt = Math.min(left / v, next - t);
      left -= v * dt;
      t += dt;
      if (!(next < Infinity)) break;
   }
   if (left > 1e-6) t += left / beltSpeed(t);
   return t - t0;
}

export function comboMult(streak: number): number {
   const raw = 1 + SCORE.comboStep * (streak - 1);
   return raw < SCORE.comboCap ? raw : SCORE.comboCap;
}

/** Streak already includes this bag. Always an integer. */
export function deliveryPoints(streak: number, vip: boolean): number {
   return SCORE.bag * comboMult(streak) * (vip ? SCORE.vip : 1);
}

export function diverterLocked(index: number, time: number): boolean {
   if (index === 2) return time < PHASE_D3;
   if (index === 3) return time < PHASE_D4;
   return false;
}

/** The segment a bag on `segment` will enter under the current choices. -1 at a gate or a dead end. */
export function outgoing(run: RunState, segment: number): number {
   const c = run.choices;
   if (segment === SEG.entry) return c[0] === 0 ? SEG.chuteR : SEG.mid;
   if (segment === SEG.mid) return c[1] === 0 ? SEG.chuteB : SEG.toD3;
   if (segment === SEG.toD3) return run.time < PHASE_D3 || c[2] === 0 ? SEG.chuteG : SEG.hold;
   if (segment === SEG.hold) return run.time >= PHASE_D4 && c[3] === 1 ? SEG.overflow : SEG.chuteY;
   return -1;
}

function pushEvent(run: RunState, event: StepEvent): void {
   const slot = run.events[run.eventCount];
   if (!slot) return;
   slot.kind = event.kind;
   slot.points = event.points;
   slot.x = event.x;
   slot.y = event.y;
   slot.z = event.z;
   slot.overflow = event.overflow;
   slot.flight = event.flight;
   slot.diverter = event.diverter;
   run.eventCount++;
}

function strike(run: RunState, bag: Bag, overflow: boolean): void {
   bag.alive = false;
   bag.tumble = 0.9;
   run.streak = 0;
   run.strikes++;
   pushEvent(run, { kind: "strike", points: 0, x: bag.x, y: bag.y, z: bag.z, overflow, flight: bag.flight, diverter: -1 });
   if (run.strikes >= STRIKE_LIMIT) run.lost = true;
}

function deliver(run: RunState, bag: Bag): void {
   run.streak++;
   const points = deliveryPoints(run.streak, bag.vip);
   run.score += points;
   bag.alive = false;
   bag.tumble = 0;
   pushEvent(run, { kind: "deliver", points, x: bag.x, y: bag.y, z: bag.z, overflow: false, flight: bag.flight, diverter: -1 });
}

/** Gap along the follower's own branch (this frame's diverters) to the bag ahead. Infinity if none. */
export function gapAhead(run: RunState, index: number): number {
   const bag = run.bags[index];
   let best = Infinity;
   for (let i = 0; i < POOL; i++) {
      const other = run.bags[i];
      if (i === index || !other.alive) continue;
      if (other.segment === bag.segment && other.s > bag.s) {
         const gap = other.s - bag.s;
         if (gap < best) best = gap;
      }
   }
   const next = outgoing(run, bag.segment);
   if (next >= 0) {
      let lead = Infinity;
      for (let i = 0; i < POOL; i++) {
         const other = run.bags[i];
         if (!other.alive || other.segment !== next) continue;
         if (other.s < lead) lead = other.s;
      }
      if (lead < Infinity) {
         const gap = PATHS[bag.segment].total - bag.s + lead;
         if (gap < best) best = gap;
      }
   }
   return best;
}

export function placeBag(run: RunState, flight: number, heavy: boolean, vip: boolean, segment: number = SEG.entry, s = 0): number {
   for (let i = 0; i < POOL; i++) {
      const bag = run.bags[i];
      if (bag.alive || bag.tumble > 0) continue;
      bag.alive = true;
      bag.tumble = 0;
      bag.segment = segment;
      bag.s = s;
      bag.flight = flight;
      bag.heavy = heavy;
      bag.vip = vip;
      bag.born = run.born++;
      const at = PATHS[segment];
      bag.x = at.points[0].x;
      bag.y = at.points[0].y;
      bag.z = at.points[0].z;
      if (s > 0) {
         const rider = RIDER;
         rider.path = at;
         rider.segment = segment;
         rider.s = 0;
         rider.overflow = 0;
         rider.position.x = bag.x;
         rider.position.y = bag.y;
         rider.position.z = bag.z;
         advanceGraph(rider, GRAPH, () => -1, s);
         bag.s = rider.s;
         bag.x = rider.position.x;
         bag.y = rider.position.y;
         bag.z = rider.position.z;
      }
      return i;
   }
   return -1;
}

function entryBlocked(run: RunState): boolean {
   for (let i = 0; i < POOL; i++) {
      const bag = run.bags[i];
      if (bag.alive && bag.segment === SEG.entry && bag.s < GAP) return true;
   }
   return false;
}

function rollFlight(run: RunState, time: number): { flight: number; heavy: boolean; vip: boolean } {
   const span = time >= PHASE_D4 ? 4 : 3;
   const flight = Math.floor(rngNext(run.rng) * span);
   let heavy = false;
   let vip = false;
   if (time >= 50) {
      const roll = rngNext(run.rng);
      if (roll < 0.12) vip = true;
      else if (roll < 0.3) heavy = true;
   } else if (time >= 30) heavy = rngNext(run.rng) < 0.2;
   return { flight, heavy, vip };
}

function trySpawn(run: RunState, time: number): void {
   if (time < run.nextSpawn || entryBlocked(run)) return;
   const rolled = rollFlight(run, time);
   if (placeBag(run, rolled.flight, rolled.heavy, rolled.vip) < 0) return;
   run.nextSpawn = time + intervalAt(time);
}

let ACTIVE: RunState | null = null;
const RIDER: RiderState = { path: PATHS[0], s: 0, position: { x: 0, y: 0, z: 0 }, segment: 0 };

function choose(ending: number): number {
   const run = ACTIVE;
   if (!run) return -1;
   const next = outgoing(run, ending);
   // Before 70 s the hold is not a belt: stop on the D3 line so the bag can strike there.
   if (ending === SEG.toD3 && next === SEG.hold && run.time < PHASE_D4) return -1;
   return next;
}

function moveBag(run: RunState, bag: Bag, ds: number): void {
   const rider = RIDER;
   rider.path = PATHS[bag.segment];
   rider.segment = bag.segment;
   rider.s = bag.s;
   rider.overflow = 0;
   rider.position.x = bag.x;
   rider.position.y = bag.y;
   rider.position.z = bag.z;
   ACTIVE = run;
   advanceGraph(rider, GRAPH, choose, ds);
   bag.segment = rider.segment ?? bag.segment;
   bag.s = rider.s;
   bag.x = rider.position.x;
   bag.y = rider.position.y;
   bag.z = rider.position.z;
   if (!((rider.overflow ?? 0) > 1e-8)) return;
   if (bag.segment === SEG.toD3 && run.time < PHASE_D4 && run.choices[2] === 1 && run.time >= PHASE_D3) {
      strike(run, bag, false);
      return;
   }
   const flight = CHUTE_FLIGHT[bag.segment];
   if (flight >= 0) {
      if (flight === bag.flight) deliver(run, bag);
      else strike(run, bag, false);
      return;
   }
   if (bag.segment === SEG.overflow) strike(run, bag, true);
}

function stepBags(run: RunState, dt: number): void {
   const speed = beltSpeed(run.time);
   const order = run.order;
   let n = 0;
   for (let i = 0; i < POOL; i++) if (run.bags[i].alive) order[n++] = i;
   for (let a = 1; a < n; a++) {
      const id = order[a];
      let b = a;
      while (b > 0 && run.bags[order[b - 1]].born > run.bags[id].born) {
         order[b] = order[b - 1];
         b--;
      }
      order[b] = id;
   }
   for (let k = 0; k < n; k++) {
      if (run.lost) return;
      const bag = run.bags[order[k]];
      if (!bag.alive) continue;
      let ds = speed * (bag.heavy ? BELT.heavy : 1) * dt;
      const gap = gapAhead(run, order[k]);
      if (gap < Infinity && gap - GAP < ds) ds = gap - GAP > 0 ? gap - GAP : 0;
      if (ds > 0) moveBag(run, bag, ds);
   }
}

/** Flips, then spawns, then movement, so a flip on the crossing frame counts. */
export function stepRun(run: RunState, input: StepInput, dt: number, time: number): void {
   run.eventCount = 0;
   run.time = time;
   if (run.lost || !(dt > 0)) return;
   for (let i = 0; i < 4; i++) {
      if (!input.flip[i] || diverterLocked(i, time)) continue;
      run.choices[i] = run.choices[i] === 0 ? 1 : 0;
      const at = DIVERTER_AT[i];
      pushEvent(run, { kind: "flip", points: 0, x: at.x, y: at.y, z: at.z, overflow: false, flight: -1, diverter: i });
   }
   trySpawn(run, time);
   for (let i = 0; i < POOL; i++) {
      const bag = run.bags[i];
      if (bag.tumble > 0) bag.tumble = bag.tumble > dt ? bag.tumble - dt : 0;
   }
   stepBags(run, dt);
}

export function aliveCount(run: RunState): number {
   let n = 0;
   for (let i = 0; i < POOL; i++) if (run.bags[i].alive) n++;
   return n;
}

/**
 * Analytic ceiling: every bag takes the 8.4 m chute, never strikes, and every spawn at or after
 * 50 s is VIP. 77 bags, 7500 points; the 78th arrives after 120 s.
 */
export function oracleCeiling(limit = 120): { bags: number; score: number; peak: number; last: number; missed: number } {
   let t = 0;
   let streak = 0;
   let score = 0;
   let bags = 0;
   let peak = 0;
   let last = 0;
   let missed = 0;
   for (let i = 0; i < 200; i++) {
      const arrive = t + travelTime(SHORTEST_M, t);
      if (arrive > limit) {
         missed = arrive;
         break;
      }
      bags++;
      streak++;
      score += deliveryPoints(streak, t >= 50);
      const chord = score / arrive;
      if (chord > peak) peak = chord;
      last = arrive;
      t += intervalAt(t);
   }
   return { bags, score, peak, last, missed };
}

export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, PROPOSED_LIMITS);
}

export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, PROPOSED_LIMITS);
}
