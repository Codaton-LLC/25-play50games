// Train Station Rush rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// The concourse runs across the top (z 0..8, the entrance at z 0). Platforms run down from it
// (z 8..19) in back-to-back pairs on islands, each with its own track bed on its outer side:
// track | platform | platform | track, pairs side by side. A boarding pad sits in the middle of
// each platform. Movement is the on-foot mover (accel 22, brake 28, radius 0.38, top speed 4.6,
// x 0.80 with a bag in hand). Passengers follow at 3.0 m/s with a 1.0 m gap and the firefighter's
// 1.2 s free-point rule; the crowd wanders the concourse (wander + separate) as solid circles.
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { arrive, separate, wander } from "@/arcade3d/core/ai/steering";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, passengerCount, type StationLevel } from "./levels";

// ---------- tuning (the scoring proof in README cites these) ----------

export const LIVES = 3;
export const DELIVER_POINTS = 100;
/** extra when more than half of that train's dwell was left */
export const PROMPT_POINTS = 50;
/** Win only: per full second left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 5;

export const CONCOURSE_DEPTH = 8;
export const PLATFORM_LEN = 11;
export const PLATFORM_W = 2.8;
export const TRACK_W = 2.4;
export const PAIR_W = TRACK_W * 2 + PLATFORM_W * 2;
export const PAD_Z = CONCOURSE_DEPTH + PLATFORM_LEN / 2;
export const STATION_END = CONCOURSE_DEPTH + PLATFORM_LEN;
/** the concourse reaches this far past the outermost tracks */
export const CONCOURSE_MARGIN = 1.5;

export const RADIUS = 0.38;
export const MAX_SPEED = 4.6;
export const BAG_SCALE = 0.8;
export const ACCEL = 22;
export const BRAKE = 28;
/** actionPressed reaches an entrance spot or a pad within this distance of its point */
export const USE_RANGE = 1.2;

export const FOLLOW_SPEED = 3;
export const FOLLOW_GAP = 1;
export const FOLLOW_RADIUS = 0.32;
/** a led passenger must stand this close to the pad's point for the hand-over */
export const BOARD_REACH = 2.2;
export const STUCK_SPEED = 0.15;
export const STUCK_TIME = 1.2;
export const STUCK_AWAY = 1.8;
/**
 * A stuck passenger's jump towards the worker is at most this long: with the stuck time it never
 * beats walking (0.15 m/s x 1.2 s + 3.42 m = 3.0 m/s x 1.2 s), so a passenger never travels faster
 * than FOLLOW_SPEED on average (the proof's passenger bound).
 */
export const MAX_JUMP = FOLLOW_SPEED * STUCK_TIME - STUCK_SPEED * STUCK_TIME;

export const CROWD_RADIUS = 0.3;
export const CROWD_SPEED = 0.9;
/** the crowd stays between the entrance area and a free lane along the platform edge (z > 6.9) */
export const CROWD_ZONE = { z0: 2.8, z1: 6.6 } as const;

export const START = { x: 0, z: 2.4 } as const;
/** a train needs this long to pull out before another may come in on its track (looks; the queue keeps it) */
export const DEPART_S = 4;
/** where open tasks wait: one spot with one task open at a time, two with two */
export const SPOTS: Record<number, readonly { x: number; z: number }[]> = {
   1: [{ x: 0, z: 1.2 }],
   2: [{ x: -1.5, z: 1.2 }, { x: 1.5, z: 1.2 }],
};

/**
 * Per-level server limits (README "Server limits and why they hold"). A win at time t scores at
 * most 150 * tasks + 5 * floor(clock - t); no win can come before earliestWinS(level), so
 * maxScore = that ceiling at the earliest win, base = 150 * tasks, pps = ceil(5 * floor(clock - T0) / T0);
 * minDurationMs = no run of any kind ends sooner (earliestEndS).
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: T0 17.30 s, 600 + 5 x 102; no run ends before 17.30 s */
   1: { kind: "points", maxScore: 1110, minDurationMs: 17_200, maxDurationMs: 122_000, base: 600, maxPointsPerSec: 30, unitLabel: "pts", display: "int" },
   /** L2: T0 26.00 s (a win with one train missed), 900 + 5 x 124 */
   2: { kind: "points", maxScore: 1520, minDurationMs: 25_900, maxDurationMs: 152_000, base: 900, maxPointsPerSec: 24, unitLabel: "pts", display: "int" },
   /** L3: T0 36.30 s, 1200 + 5 x 143; a loss can come at 23 s (trains leave 3 + 20 s after opening) */
   3: { kind: "points", maxScore: 1915, minDurationMs: 22_900, maxDurationMs: 182_000, base: 1200, maxPointsPerSec: 20, unitLabel: "pts", display: "int" },
   /** L4: T0 45.31 s, 1500 + 5 x 134; a loss at 27 s at the soonest */
   4: { kind: "points", maxScore: 2170, minDurationMs: 26_900, maxDurationMs: 182_000, base: 1500, maxPointsPerSec: 15, unitLabel: "pts", display: "int" },
   /** L5: T0 63.35 s, 1800 + 5 x 146; a loss at 25 s at the soonest */
   5: { kind: "points", maxScore: 2530, minDurationMs: 24_900, maxDurationMs: 212_000, base: 1800, maxPointsPerSec: 12, unitLabel: "pts", display: "int" },
};

// ---------- layout ----------

export const stationWidth = (level: StationLevel) => (level.platforms / 2) * PAIR_W;
const pairX0 = (level: StationLevel, pair: number) => -stationWidth(level) / 2 + pair * PAIR_W;
/** Platform p's centre line (x). Even p is the left of its pair, odd the right. */
export function platformX(level: StationLevel, p: number): number {
   return pairX0(level, p >> 1) + TRACK_W + PLATFORM_W / 2 + (p & 1) * PLATFORM_W;
}
/** The track bed beside platform p (outer side): its centre line. */
export function trackX(level: StationLevel, p: number): number {
   return (p & 1) === 0 ? pairX0(level, p >> 1) + TRACK_W / 2 : pairX0(level, p >> 1) + PAIR_W - TRACK_W / 2;
}
export const padPoint = (level: StationLevel, p: number) => ({ x: platformX(level, p), z: PAD_Z });
/** The island of pair k: x range. */
export function islandX(level: StationLevel, pair: number): [number, number] {
   const x0 = pairX0(level, pair) + TRACK_W;
   return [x0, x0 + PLATFORM_W * 2];
}
export const concourseHalf = (level: StationLevel) => stationWidth(level) / 2 + CONCOURSE_MARGIN;

export interface Solid {
   kind: "bench" | "ticket" | "lamp" | "canopy" | "trolley" | "sign";
   x: number;
   z: number;
   /** half sizes of the blocking box */
   hx: number;
   hz: number;
   rotY: number;
}

/** Concourse benches, ticket machines and a luggage trolley; two lamps and a canopy on every island, a sign behind every pad. */
export function solidsFor(level: StationLevel): Solid[] {
   const half = concourseHalf(level);
   const out: Solid[] = [
      { kind: "ticket", x: -3.4, z: 0.45, hx: 0.46, hz: 0.44, rotY: 0 },
      { kind: "ticket", x: 3.4, z: 0.45, hx: 0.46, hz: 0.44, rotY: 0 },
      { kind: "bench", x: -half + 0.4, z: 5.5, hx: 0.38, hz: 0.95, rotY: Math.PI / 2 },
      { kind: "bench", x: half - 0.4, z: 5.5, hx: 0.38, hz: 0.95, rotY: -Math.PI / 2 },
      { kind: "trolley", x: -half + 1.2, z: 1.0, hx: 0.52, hz: 0.3, rotY: Math.PI / 2 },
   ];
   for (let k = 0; k < level.platforms / 2; k++) {
      const [x0, x1] = islandX(level, k);
      const cx = (x0 + x1) / 2;
      out.push({ kind: "lamp", x: cx, z: CONCOURSE_DEPTH + 2.2, hx: 0.18, hz: 0.18, rotY: 0 });
      out.push({ kind: "lamp", x: cx, z: PAD_Z + 2.1, hx: 0.18, hz: 0.18, rotY: 0 });
      out.push({ kind: "canopy", x: cx, z: STATION_END - 1, hx: 1.9, hz: 0.55, rotY: 0 });
   }
   // each platform's sign stands behind its pad, facing the camera
   for (let p = 0; p < level.platforms; p++) out.push({ kind: "sign", x: platformX(level, p), z: PAD_Z + 2.8, hx: 0.6, hz: 0.22, rotY: 0 });
   return out;
}

// ---------- state ----------

export type TaskKind = "bag" | "passenger";
export type TaskState = "queued" | "open" | "taken" | "delivered" | "missed";

export interface Task {
   kind: TaskKind;
   platform: number;
   /** looks: 0 suitcase, 1 backpack */
   look: number;
   state: TaskState;
   spot: number;
   openAt: number;
   arriveAt: number;
   leaveAt: number;
   /** when it resolved (delivered or missed), else -1 */
   doneAt: number;
}

export interface Agent { x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; phase: number }

export interface Follower extends Agent { task: number; stuck: number }

export interface StepEvents {
   score: number;
   /** task index taken at the entrance, else -1 */
   took: number;
   delivered: number;
   missed: number;
   opened: number;
   /** Use with nothing to do here (a wrong platform, an empty hand, a train not in) */
   buzz: boolean;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
}

export interface Run {
   seed: number;
   level: StationLevel;
   hero: { x: number; z: number; vx: number; vz: number; yaw: number };
   tasks: Task[];
   /** the next queued task to open */
   nextOpen: number;
   /** the task in hand (a bag) or being led (a passenger), else -1 */
   holding: number;
   follower: Follower;
   crowd: Agent[];
   crowdState: { angle: number }[];
   solids: Solid[];
   delivered: number;
   missed: number;
   lives: number;
   score: number;
   time: number;
   over: "win" | "lose" | null;
   rng: () => number;
   ev: StepEvents;
}

export interface StationInput {
   moveX: number;
   moveY: number;
   actionPressed: boolean;
   /** camera yaw, the same value useFittedView returns; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): StationInput => ({ moveX: 0, moveY: 0, actionPressed: false, yaw: 0 });

const freshEvents = (): StepEvents => ({ score: 0, took: -1, delivered: -1, missed: -1, opened: -1, buzz: false, lifeLost: false, won: false, lost: false });
const agent = (x: number, z: number): Agent => ({ x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, phase: 0 });

/**
 * The task queue. Platforms come from a shuffle bag (every `platforms` tasks in a row use each
 * platform once), passengers are `passengerCount` of the tasks in a seeded order, and with two tasks
 * open at once the queue is reordered at open time so two open tasks never share a platform.
 */
export function taskQueue(seed: number, level: StationLevel): Task[] {
   const rng = createRng((seed >>> 0) ^ 0x2f6b9a1d);
   const platforms: number[] = [];
   let round: number[] = [];
   for (let k = 0; k < level.tasks; k++) {
      if (round.length === 0) {
         round = Array.from({ length: level.platforms }, (_, i) => i);
         for (let i = round.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [round[i], round[j]] = [round[j], round[i]];
         }
         // the same platform twice in a row across a round's edge: take the round's next one first
         if (platforms.length && round[0] === platforms[platforms.length - 1] && round.length > 1) [round[0], round[1]] = [round[1], round[0]];
      }
      platforms.push(round.shift()!);
   }
   const kinds: TaskKind[] = Array.from({ length: level.tasks }, (_, i) => (i < passengerCount(level) ? "passenger" : "bag"));
   for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
   }
   return platforms.map((platform, i) => ({
      kind: kinds[i], platform, look: Math.floor(rng() * 2), state: "queued", spot: 0, openAt: -1, arriveAt: -1, leaveAt: -1, doneAt: -1,
   }));
}

function openNext(run: Run, spot: number): void {
   const tasks = run.tasks;
   if (run.nextOpen >= tasks.length) return;
   // never two open tasks for one platform (one track), nor a train arriving where the last one is
   // still pulling out (DEPART_S): pull a later task forward
   const busy = (p: number) => tasks.some((t) => t.platform === p && (t.state === "open" || t.state === "taken" || (t.doneAt >= 0 && run.time - t.doneAt < DEPART_S)));
   if (busy(tasks[run.nextOpen].platform)) {
      for (let j = run.nextOpen + 1; j < tasks.length; j++) {
         if (!busy(tasks[j].platform)) {
            const t = tasks[run.nextOpen];
            tasks[run.nextOpen] = tasks[j];
            tasks[j] = t;
            break;
         }
      }
   }
   const task = tasks[run.nextOpen];
   task.state = "open";
   task.spot = spot;
   task.openAt = run.time;
   task.arriveAt = run.time + run.level.arriveS;
   task.leaveAt = task.arriveAt + run.level.dwellS;
   run.ev.opened = run.nextOpen;
   run.nextOpen += 1;
}

export function createRun(seed: number, level: StationLevel = LEVELS[1]): Run {
   const rng = createRng((seed >>> 0) ^ 0x6c8e9cf5);
   const half = concourseHalf(level);
   const crowd: Agent[] = [];
   for (let i = 0; i < level.crowd; i++) {
      // spread along the concourse, clear of the start and the entrance
      const x = Math.min(half - 1.4, Math.max(-half + 1.4, -half + 1.4 + ((i + 0.5) / level.crowd) * (half * 2 - 2.8) + (rng() - 0.5) * 0.8));
      const z = CROWD_ZONE.z0 + 0.4 + rng() * (CROWD_ZONE.z1 - CROWD_ZONE.z0 - 0.8);
      crowd.push(agent(Math.abs(x - START.x) < 1.2 ? x + 1.6 : x, z));
   }
   const run: Run = {
      seed: seed >>> 0,
      level,
      hero: { x: START.x, z: START.z, vx: 0, vz: 0, yaw: Math.PI, },
      tasks: taskQueue(seed, level),
      nextOpen: 0,
      holding: -1,
      follower: { ...agent(0, 0), task: -1, stuck: 0 },
      crowd,
      crowdState: crowd.map(() => ({ angle: rng() * Math.PI * 2 })),
      solids: solidsFor(level),
      delivered: 0,
      missed: 0,
      lives: LIVES,
      score: 0,
      time: 0,
      over: null,
      rng,
      ev: freshEvents(),
   };
   const spots = SPOTS[level.parallel] ?? SPOTS[1];
   for (let s = 0; s < spots.length; s++) openNext(run, s);
   run.ev = freshEvents();
   return run;
}

// ---------- geometry ----------

/** Inside the walkable station (concourse or an island), clear of walls by `radius`. Tracks are not walkable. */
export function inStation(level: StationLevel, x: number, z: number, radius: number): boolean {
   const half = concourseHalf(level);
   // the concourse; its platform edge keeps a body's circle off the track beds' ends
   if (z >= radius - 1e-9 && z <= CONCOURSE_DEPTH - radius + 1e-9 && Math.abs(x) <= half - radius + 1e-9) return true;
   for (let k = 0; k < level.platforms / 2; k++) {
      const [x0, x1] = islandX(level, k);
      if (x >= x0 + radius - 1e-9 && x <= x1 - radius + 1e-9 && z >= CONCOURSE_DEPTH - radius && z <= STATION_END - radius + 1e-9) return true;
   }
   return false;
}

function solidHit(s: Solid, x: number, z: number, radius: number): boolean {
   const cx = Math.min(s.x + s.hx, Math.max(s.x - s.hx, x));
   const cz = Math.min(s.z + s.hz, Math.max(s.z - s.hz, z));
   return (x - cx) * (x - cx) + (z - cz) * (z - cz) < radius * radius - 1e-9;
}

/** Clear of the station's walls and track beds, every solid and (optionally) the crowd. */
export function standable(run: Run, x: number, z: number, radius = RADIUS, crowd = true): boolean {
   if (!inStation(run.level, x, z, radius)) return false;
   for (const s of run.solids) if (solidHit(s, x, z, radius)) return false;
   if (crowd) {
      for (const a of run.crowd) {
         const r = radius + CROWD_RADIUS;
         if ((a.x - x) * (a.x - x) + (a.z - z) * (a.z - z) < r * r - 1e-9) return false;
      }
   }
   return true;
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

/**
 * Moves a body by its velocity, sliding along whatever blocks it (one axis at a time), never further
 * than its own step. Ends standable or where it started; the velocity becomes the move.
 */
function slide(run: Run, body: { x: number; z: number; vx: number; vz: number }, radius: number, dt: number, crowd: boolean): void {
   const ox = body.x;
   const oz = body.z;
   const nx = ox + body.vx * dt;
   const nz = oz + body.vz * dt;
   if (standable(run, nx, nz, radius, crowd)) {
      body.x = nx;
      body.z = nz;
   } else if (standable(run, nx, oz, radius, crowd)) {
      body.x = nx;
      body.vz = 0;
   } else if (standable(run, ox, nz, radius, crowd)) {
      body.z = nz;
      body.vx = 0;
   } else {
      body.vx = 0;
      body.vz = 0;
   }
}

export type Target = { kind: "spot"; task: number } | { kind: "pad"; platform: number };

/** What Use reaches from (x, z): the nearest open task's spot or pad within USE_RANGE, else null. */
export function targetAt(run: Run, x: number, z: number): Target | null {
   let best: Target | null = null;
   let bestD = USE_RANGE + 1e-9;
   const spots = SPOTS[run.level.parallel] ?? SPOTS[1];
   for (let i = 0; i < run.tasks.length; i++) {
      const t = run.tasks[i];
      if (t.state !== "open") continue;
      const s = spots[t.spot];
      const d = Math.hypot(x - s.x, z - s.z);
      if (d <= bestD) {
         bestD = d;
         best = { kind: "spot", task: i };
      }
   }
   for (let p = 0; p < run.level.platforms; p++) {
      const pad = padPoint(run.level, p);
      const d = Math.hypot(x - pad.x, z - pad.z);
      if (d <= bestD) {
         bestD = d;
         best = { kind: "pad", platform: p };
      }
   }
   return best;
}

/** Is this task's train at its platform now? */
export const trainIn = (task: Task, time: number) => (task.state === "open" || task.state === "taken") && time >= task.arriveAt && time < task.leaveAt;

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

export function objectiveCeiling(level: StationLevel): number {
   return (DELIVER_POINTS + PROMPT_POINTS) * level.tasks;
}

function resolve(run: Run, index: number, state: "delivered" | "missed"): void {
   const task = run.tasks[index];
   task.state = state;
   task.doneAt = run.time;
   if (run.holding === index) {
      run.holding = -1;
      run.follower.task = -1;
   }
   openNext(run, task.spot);
}

function finishCheck(run: Run, timeLeftMs: number): void {
   if (run.over) return;
   const left = run.tasks.some((t) => t.state === "queued" || t.state === "open" || t.state === "taken");
   if (left) return;
   if (run.delivered >= run.level.tasks - 1) {
      const bonus = timeBonus(timeLeftMs);
      run.score += bonus;
      run.ev.score += bonus;
      run.over = "win";
      run.ev.won = true;
   } else {
      run.over = "lose";
      run.ev.lost = true;
   }
}

function use(run: Run, target: Target | null): void {
   const ev = run.ev;
   if (!target) return;
   if (target.kind === "spot") {
      if (run.holding >= 0) {
         ev.buzz = true;
         return;
      }
      const task = run.tasks[target.task];
      task.state = "taken";
      run.holding = target.task;
      ev.took = target.task;
      if (task.kind === "passenger") {
         const spot = (SPOTS[run.level.parallel] ?? SPOTS[1])[task.spot];
         const f = run.follower;
         f.task = target.task;
         f.x = spot.x;
         f.z = spot.z;
         f.vx = f.vz = 0;
         f.stuck = 0;
      }
      return;
   }
   const index = run.holding;
   const task = index >= 0 ? run.tasks[index] : null;
   if (!task || task.platform !== target.platform || !trainIn(task, run.time)) {
      ev.buzz = true;
      return;
   }
   if (task.kind === "passenger") {
      const pad = padPoint(run.level, task.platform);
      if (Math.hypot(run.follower.x - pad.x, run.follower.z - pad.z) > BOARD_REACH) {
         ev.buzz = true;
         return;
      }
   }
   const points = DELIVER_POINTS + (task.leaveAt - run.time > run.level.dwellS / 2 ? PROMPT_POINTS : 0);
   run.score += points;
   ev.score += points;
   ev.delivered = index;
   run.delivered += 1;
   resolve(run, index, "delivered");
}

const DIR = { x: 0, z: 0 };
const STEER = { x: 0, y: 0, z: 0 };
const FORCE = { x: 0, y: 0, z: 0 };
const FREE = { x: 0, z: 0 };

/** Nearest standable point on the segment within MAX_JUMP of its start, preferring the hero's end. False when none. */
export function nearestFreePoint(run: Run, x0: number, z0: number, x1: number, z1: number, out = FREE): boolean {
   const dist = Math.hypot(x1 - x0, z1 - z0);
   const steps = Math.max(2, Math.ceil(dist / 0.25));
   let best = Infinity;
   let found = false;
   for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (Math.hypot(x - x0, z - z0) > MAX_JUMP) break;
      if (!standable(run, x, z, FOLLOW_RADIUS)) continue;
      if (Math.hypot(x - x1, z - z1) < RADIUS + FOLLOW_RADIUS) continue;
      const d = (x - x1) * (x - x1) + (z - z1) * (z - z1);
      if (d < best) {
         best = d;
         out.x = x;
         out.z = z;
         found = true;
      }
   }
   return found;
}

function stepFollower(run: Run, dt: number): void {
   const f = run.follower;
   if (f.task < 0) return;
   const h = run.hero;
   const dx = h.x - f.x;
   const dz = h.z - f.z;
   const dist = Math.hypot(dx, dz);
   const k = dist > 1e-4 ? FOLLOW_GAP / dist : 0;
   STEER.x = h.x - dx * k;
   STEER.z = h.z - dz * k;
   STEER.y = 0;
   arrive(f, STEER, FOLLOW_SPEED, 1.1, FORCE);
   f.vx += FORCE.x * dt * 8;
   f.vz += FORCE.z * dt * 8;
   const sp = Math.hypot(f.vx, f.vz);
   if (sp > FOLLOW_SPEED) {
      f.vx = (f.vx / sp) * FOLLOW_SPEED;
      f.vz = (f.vz / sp) * FOLLOW_SPEED;
   }
   const bx = f.x;
   const bz = f.z;
   slide(run, f, FOLLOW_RADIUS, dt, true);
   const moved = Math.hypot(f.x - bx, f.z - bz) / dt;
   f.phase += moved * dt * 5;
   if (moved > 0.2) f.yaw = turnTowards(f.yaw, Math.atan2(f.vx, f.vz), Math.min(1, dt * 10));
   if (moved < STUCK_SPEED && dist > STUCK_AWAY) f.stuck += dt;
   else f.stuck = 0;
   if (f.stuck >= STUCK_TIME && nearestFreePoint(run, f.x, f.z, h.x, h.z, FREE)) {
      f.x = FREE.x;
      f.z = FREE.z;
      f.vx = f.vz = 0;
      f.stuck = 0;
   }
}

function stepCrowd(run: Run, dt: number): void {
   const half = concourseHalf(run.level);
   for (let i = 0; i < run.crowd.length; i++) {
      const a = run.crowd[i];
      wander(a, run.crowdState[i], run.rng, CROWD_SPEED, 1.2, dt, FORCE);
      a.vx += FORCE.x * dt * 2;
      a.vz += FORCE.z * dt * 2;
      separate(a, run.crowd, 1.1, 3, FORCE);
      a.vx += FORCE.x * dt;
      a.vz += FORCE.z * dt;
      // step aside for the worker and the passenger
      for (const o of [run.hero, run.follower.task >= 0 ? run.follower : null]) {
         if (!o) continue;
         const dx = a.x - o.x;
         const dz = a.z - o.z;
         const d = Math.hypot(dx, dz);
         if (d < 1.6 && d > 1e-6) {
            a.vx += (dx / d) * (1.6 - d) * 4 * dt;
            a.vz += (dz / d) * (1.6 - d) * 4 * dt;
         }
      }
      const sp = Math.hypot(a.vx, a.vz);
      if (sp > CROWD_SPEED) {
         a.vx = (a.vx / sp) * CROWD_SPEED;
         a.vz = (a.vz / sp) * CROWD_SPEED;
      }
      const nx = Math.min(half - 0.8, Math.max(-half + 0.8, a.x + a.vx * dt));
      const nz = Math.min(CROWD_ZONE.z1, Math.max(CROWD_ZONE.z0, a.z + a.vz * dt));
      // never into the worker, the passenger or a solid
      let ok = true;
      for (const s of run.solids) if (solidHit(s, nx, nz, CROWD_RADIUS)) ok = false;
      const rh = RADIUS + CROWD_RADIUS;
      if ((nx - run.hero.x) ** 2 + (nz - run.hero.z) ** 2 < rh * rh) ok = false;
      const f = run.follower;
      const rf = FOLLOW_RADIUS + CROWD_RADIUS;
      if (f.task >= 0 && (nx - f.x) ** 2 + (nz - f.z) ** 2 < rf * rf) ok = false;
      if (ok) {
         a.x = nx;
         a.z = nz;
      } else {
         a.vx = -a.vx * 0.5;
         a.vz = -a.vz * 0.5;
         run.crowdState[i].angle += Math.PI / 2;
      }
      const m = Math.hypot(a.vx, a.vz);
      a.phase += m * dt * 5;
      if (m > 0.1) a.yaw = turnTowards(a.yaw, Math.atan2(a.vx, a.vz), Math.min(1, dt * 6));
   }
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share this
 * function: only the stick axes and `actionPressed` reach it.
 */
export function step(run: Run, input: StationInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.took = -1;
   ev.delivered = -1;
   ev.missed = -1;
   ev.opened = -1;
   ev.buzz = false;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   const h = run.hero;

   inputToWorld(input.moveX, input.moveY, input.yaw, DIR);
   const top = MAX_SPEED * (run.holding >= 0 && run.tasks[run.holding].kind === "bag" ? BAG_SCALE : 1);
   integrate(h, DIR.x, DIR.z, dt, top);
   const ox = h.x;
   const oz = h.z;
   slide(run, h, RADIUS, dt, true);
   h.vx = (h.x - ox) / dt;
   h.vz = (h.z - oz) / dt;
   if (Math.hypot(h.vx, h.vz) > 0.25) h.yaw = turnTowards(h.yaw, Math.atan2(h.vx, h.vz), Math.min(1, dt * 12));

   stepCrowd(run, dt);
   stepFollower(run, dt);
   if (input.actionPressed) use(run, targetAt(run, h.x, h.z));

   // trains that pull out take their task with them
   for (let i = 0; i < run.tasks.length; i++) {
      const t = run.tasks[i];
      if ((t.state === "open" || t.state === "taken") && run.time >= t.leaveAt) {
         ev.missed = i;
         ev.lifeLost = true;
         run.missed += 1;
         run.lives -= 1;
         resolve(run, i, "missed");
         if (run.lives <= 0) {
            run.over = "lose";
            ev.lost = true;
            return ev;
         }
      }
   }
   finishCheck(run, timeLeftMs);
   return ev;
}

// ---------- the earliest win and end (README proof) ----------

/**
 * Extra metres a worker who just took a bag can cover while his speed falls from 4.6 to 3.68 m/s
 * ((4.6 - 3.68) / ACCEL s, at most 0.02 m): 0.05 is generous.
 */
export const LOADED_SLACK = 0.05;

/** Shortest walk between two Use zones: their points' distance less both reaches. */
const legBetween = (ax: number, az: number, bx: number, bz: number) => Math.max(0, Math.hypot(ax - bx, az - bz) - 2 * USE_RANGE);

/**
 * No win can come sooner (s). A bag is walked from an entrance spot's Use zone to its pad's at
 * 3.68 m/s; a passenger walks from the spot to within BOARD_REACH of the pad at FOLLOW_SPEED (a
 * stuck jump never beats that: MAX_JUMP). Every delivery but the last is followed by a walk back to
 * an entrance zone at 4.6. The shuffle bag fixes how often each platform comes up; the bound takes
 * the nearest platforms for the part round, the passengers on the shortest walks and the farthest
 * pad last (no walk back), by brute force. A win with one task missed needs that task's train to
 * leave: arriveS + dwellS after it opened at the soonest.
 */
export function earliestWinS(level: StationLevel): number {
   const n = level.platforms;
   const spots = SPOTS[level.parallel] ?? SPOTS[1];
   const dist: number[] = [];
   const back: number[] = [];
   for (let p = 0; p < n; p++) {
      const pad = padPoint(level, p);
      dist.push(Math.min(...spots.map((s) => Math.hypot(s.x - pad.x, s.z - pad.z))));
      back.push(Math.min(...spots.map((s) => legBetween(pad.x, pad.z, s.x, s.z))));
   }
   const bagTime = (d: number) => Math.max(0, d - 2 * USE_RANGE - LOADED_SLACK) / (MAX_SPEED * BAG_SCALE);
   const paxTime = (d: number) => Math.max(0, d - BOARD_REACH) / FOLLOW_SPEED;
   const full = Math.floor(level.tasks / n);
   const part = level.tasks % n;
   const passengers = passengerCount(level);
   /** the least time to deliver the platforms in `kept` with `pax` of them passengers */
   const walk = (kept: number[], pax: number) => {
      const ds = kept.map((p) => dist[p]).sort((a, b) => a - b);
      let t = 0;
      ds.forEach((d, i) => { t += i < pax ? paxTime(d) : bagTime(d); });
      const backs = kept.map((p) => back[p]);
      return t + (backs.reduce((a, b) => a + b, 0) - Math.max(...backs)) / MAX_SPEED;
   };
   let best = Infinity;
   for (let mask = 0; mask < 1 << n; mask++) {
      let size = 0;
      for (let p = 0; p < n; p++) if (mask & (1 << p)) size++;
      if (size !== part) continue;
      const all: number[] = [];
      for (let p = 0; p < n; p++) for (let c = 0; c < full + ((mask >> p) & 1); c++) all.push(p);
      best = Math.min(best, walk(all, passengers));
      // one task missed (a bag or a passenger), its train gone at the soonest arriveS + dwellS
      for (let drop = 0; drop < all.length; drop++) {
         const kept = all.filter((_, i) => i !== drop);
         for (const pax of [passengers, passengers - 1]) {
            if (pax < 0 || pax > kept.length) continue;
            best = Math.min(best, Math.max(walk(kept, pax), level.arriveS + level.dwellS));
         }
      }
   }
   return best;
}

/** No run ends sooner (s), win or lose: a loss needs trains to leave (arriveS + dwellS after the first task opens). */
export function earliestEndS(level: StationLevel): number {
   return Math.min(earliestWinS(level), level.arriveS + level.dwellS);
}

/** The highest score a win at time t (s) can carry on this level. */
export function winCeiling(level: StationLevel, t: number): number {
   return objectiveCeiling(level) + TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, level.durationMs / 1000 - t) + 1e-9);
}
