// Aquarium Cleaner rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// A tank (width x depth) with glass on the back and both sides; the front is open to the camera.
// The diver walks the floor in lead boots (on-foot mover, radius 0.38, top speed 3.0, accel 12).
// Tasks: scrub the algae on the glass (hold 1.00 s), check each filter (hold 1.50 s), carry the
// trash to the basket. Air runs down; the bubble column refills it. Sharks patrol a loop (L3+).
import { stepPatrol, type PatrolState } from "@/arcade3d/core/ai/patrol";
import { createPath, type Path } from "@/arcade3d/core/path";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, tasksOf, type AquariumLayout, type AquariumLevel } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

export const LIVES = 3;
/** One finished task (an algae patch, a filter, one binned item). */
export const TASK_POINTS = 120;
/** Extra when the task finished with air above AIR_BONUS_ABOVE. */
export const CLEAN_POINTS = 30;
export const AIR_BONUS_ABOVE = 50;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;

export const RADIUS = 0.38;
export const MAX_SPEED = 3.0;
export const ACCEL = 12;
export const BRAKE = 12;
export const WORK_RANGE = 1.2;
export const ALGAE_HOLD_S = 1.0;
export const FILTER_HOLD_S = 1.5;
export const FLOAT_S = 0.9;
export const FLOAT_H = 1.8;
/** A high patch scrubs only while the diver's feet are above this. */
export const HIGH_MIN_Y = 1.0;
export const HIGH_ALGAE_Y = 2.0;
export const LOW_ALGAE_Y = 0.9;
export const CARRY_MAX = 3;
export const TRASH_R = 0.25;
export const BASKET_R = 0.9;
export const HATCH_R = 1.0;

export const AIR_MAX = 100;
export const WORK_DRAIN_MULT = 1.5;
export const COLUMN_R = 1.2;
export const COLUMN_RATE = 25;

export const SHARK_HIT = 1.0;
export const SHARK_MERCY_S = 0.8;
export const SHARK_AIR = 30;
export const SHARK_PUSH = 1.5;
/** The shark's loop sits this far in from the glass: a 2 m lane stays free for the diver. */
export const LOOP_INSET = 3.4;
export const LOOP_CHAMFER = 1.8;

/** The current is 0.5 m/s² for the 1 s the water takes to settle: a 0.5 m/s drift in world x. */
export const CURRENT_ACCEL = 0.5;
export const CURRENT_SETTLE_S = 1;

export const CASTLE_R = 1.25;
export const ROCK_R = 0.8;
export const FILTER_R = 0.65;

/** The castle per layout: hunting box as fractions of hx/hz (z negative is the back glass) and size.
 * On shark levels the box must sit inside the loop's fat middle band (solids stay 1.2 m + r off
 * the loop), so the tunnel and the abyss keep their castles in the centre strip. */
export const CASTLE_PLACE: Record<AquariumLayout, { x0: number; x1: number; z0: number; z1: number; scale: number }> = {
   small: { x0: -0.3, x1: 0.3, z0: -0.4, z1: 0.05, scale: 1 },
   garden: { x0: -0.55, x1: -0.05, z0: -0.55, z1: -0.05, scale: 1.1 },
   tunnel: { x0: -0.15, x1: 0.15, z0: -0.16, z1: -0.02, scale: 1.1 },
   expanse: { x0: -0.5, x1: -0.1, z0: -0.1, z1: 0.15, scale: 1.3 },
   abyss: { x0: 0.05, x1: 0.5, z0: -0.45, z1: -0.1, scale: 1.2 },
};

/** The rocks per layout: count beyond the base 3, the z band (fractions of hz), the scale range.
 * The back band only fits on the wide abyss tank (the shark loop there leaves room for it). */
export const ROCK_PLACE: Record<AquariumLayout, { extra: number; zBack: boolean; zBackAt: number; s0: number; s1: number }> = {
   small: { extra: 0, zBack: false, zBackAt: 0, s0: 0.8, s1: 1.25 },
   garden: { extra: 1, zBack: false, zBackAt: 0, s0: 0.75, s1: 1.2 },
   tunnel: { extra: 1, zBack: false, zBackAt: 0, s0: 0.8, s1: 1.25 },
   expanse: { extra: 1, zBack: false, zBackAt: 0, s0: 0.85, s1: 1.35 },
   abyss: { extra: 0, zBack: true, zBackAt: 0.1, s0: 0.85, s1: 1.35 },
};

/**
 * The earliest win measured per level (ms): the fastest of the oracle and the honest bot over 200 seeds
 * each at 30 / 60 / 144 Hz (two measurements, the lower kept). The proof allows a win at 0.85 x this.
 */
export const EARLIEST_WIN_MS: Record<LevelId, number> = { 1: 10_180, 2: 15_980, 3: 17_270, 4: 23_950, 5: 32_200 };

/** Per-level limits (README "Server limits"): base = 150 x tasks, peak at 0.85 x EARLIEST_WIN_MS, +3 %. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 925, minDurationMs: 4000, maxDurationMs: 120_000, base: 450, maxPointsPerSec: 52, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1180, minDurationMs: 4000, maxDurationMs: 150_000, base: 600, maxPointsPerSec: 41, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1450, minDurationMs: 4000, maxDurationMs: 180_000, base: 750, maxPointsPerSec: 46, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 1580, minDurationMs: 4000, maxDurationMs: 180_000, base: 900, maxPointsPerSec: 32, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 1990, minDurationMs: 4000, maxDurationMs: 210_000, base: 1200, maxPointsPerSec: 27, unitLabel: "pts", display: "int" },
};

// ---------- layout ----------
//
// Each level has its own map flavour (level.layout): the castle's hunting box and size and the
// rocks' count, size and spread differ per level name. "small" is level 1 and reproduces the
// original placement exactly (same regions, same rng consumption, so same seed = same run).

export type SolidKind = "castle" | "rock" | "filter";

export interface Solid {
   kind: SolidKind;
   x: number;
   z: number;
   r: number;
   rotY: number;
   /** drawn size relative to the asset's fit (1 = the fit) */
   scale: number;
}

/** Wall 0 = back glass (z = -hz), 1 = left glass (x = -hx), 2 = right glass (x = +hx). */
export interface Algae {
   x: number;
   z: number;
   y: number;
   wall: 0 | 1 | 2;
   high: boolean;
   /** a standable spot within reach, for bots and markers */
   stand: { x: number; z: number };
   done: boolean;
}

export interface Filter {
   /** index into run.solids */
   solid: number;
   x: number;
   z: number;
   done: boolean;
}

/** state 0 = on the floor, 1 = carried, 2 = in the basket */
export interface Trash {
   x: number;
   z: number;
   state: 0 | 1 | 2;
   spin: number;
}

export interface Shark {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   yaw: number;
   state: PatrolState;
}

export interface Zone { x: number; z: number }

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   /** 1 algae, 2 filter, 3 trash binned: kind of the task finished this frame */
   task: 0 | 1 | 2 | 3;
   taskX: number;
   taskZ: number;
   pick: boolean;
   bin: boolean;
   float: boolean;
   sharkHit: boolean;
   airOut: boolean;
   /** the hold is waiting for the diver to float higher */
   tooLow: boolean;
   working: boolean;
}

export interface Run {
   seed: number;
   level: AquariumLevel;
   hx: number;
   hz: number;
   hero: { x: number; y: number; z: number; vx: number; vz: number; yaw: number; float: number; air: number };
   solids: Solid[];
   algae: Algae[];
   filters: Filter[];
   trash: Trash[];
   /** trash indices in pickup order */
   carried: number[];
   sharks: Shark[];
   route: Path | null;
   entry: Zone;
   basket: Zone;
   column: Zone;
   hatch: Zone;
   lives: number;
   score: number;
   tasks: number;
   done: number;
   algaeDone: number;
   filtersDone: number;
   trashDone: number;
   mercy: number;
   over: "win" | "lose" | null;
   holdKind: 0 | 1 | 2;
   holdIndex: number;
   holdTime: number;
   time: number;
   ev: StepEvents;
}

export interface AquariumInput {
   moveX: number;
   moveY: number;
   action: boolean;
   jumpPressed: boolean;
   /** camera yaw, the same value useFittedView returns; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): AquariumInput => ({ moveX: 0, moveY: 0, action: false, jumpPressed: false, yaw: 0 });

export const tankHalf = (level: AquariumLevel): { hx: number; hz: number } => ({ hx: level.width / 2, hz: level.depth / 2 });

export function entryOf(level: AquariumLevel): Zone {
   const { hx, hz } = tankHalf(level);
   return { x: -hx + 2.2, z: hz - 2.2 };
}
export function basketOf(level: AquariumLevel): Zone {
   const { hx, hz } = tankHalf(level);
   return { x: -hx + 3.9, z: hz - 1.5 };
}
export function columnOf(level: AquariumLevel): Zone {
   const { hz } = tankHalf(level);
   return { x: 0, z: hz - 1.9 };
}
export function hatchOf(level: AquariumLevel): Zone {
   const { hx, hz } = tankHalf(level);
   return { x: hx - 2.2, z: hz - 2.2 };
}

export interface Loop { x0: number; x1: number; z0: number; z1: number }

/** The shark loop's rectangle: 3.4 m in from the glass, the front edge 4.4 m in from the front. */
export function loopOf(level: AquariumLevel): Loop {
   const { hx, hz } = tankHalf(level);
   return { x0: -hx + LOOP_INSET, x1: hx - LOOP_INSET, z0: -hz + LOOP_INSET, z1: hz - 4.4 };
}

/** Eight waypoints: the rectangle with its corners cut, so a shark curves round them. */
export function loopPoints(level: AquariumLevel): Array<{ x: number; y: number; z: number }> {
   const { x0, x1, z0, z1 } = loopOf(level);
   const c = LOOP_CHAMFER;
   const p = (x: number, z: number) => ({ x, y: 0, z });
   return [p(x0 + c, z0), p(x1 - c, z0), p(x1, z0 + c), p(x1, z1 - c), p(x1 - c, z1), p(x0 + c, z1), p(x0, z1 - c), p(x0, z0 + c)];
}

/** Distance from a point to the loop polyline. */
export function distanceToLoop(points: ReadonlyArray<{ x: number; z: number }>, x: number, z: number): number {
   let best = Infinity;
   for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
   }
   return best;
}

/** Can a diver of `radius` stand here: inside the glass, clear of every solid? */
export function standable(run: Run, x: number, z: number, radius = RADIUS): boolean {
   if (Math.abs(x) > run.hx - radius || Math.abs(z) > run.hz - radius) return false;
   for (const s of run.solids) {
      const dx = x - s.x;
      const dz = z - s.z;
      const m = s.r + radius;
      if (dx * dx + dz * dz < m * m) return false;
   }
   return true;
}

// ---------- building a run ----------

interface Spot { x: number; z: number; r: number }

function build(seed: number, attempt: number, level: AquariumLevel): Run | null {
   const rng = createRng((seed + attempt * 7919) >>> 0);
   const { hx, hz } = tankHalf(level);
   const entry = entryOf(level);
   const basket = basketOf(level);
   const column = columnOf(level);
   const hatch = hatchOf(level);
   const points = level.sharks > 0 ? loopPoints(level) : null;
   const run: Run = {
      seed: seed >>> 0,
      level,
      hx,
      hz,
      hero: { x: entry.x, y: 0, z: entry.z, vx: 0, vz: 0, yaw: 0, float: 0, air: AIR_MAX },
      solids: [],
      algae: [],
      filters: [],
      trash: [],
      carried: [],
      sharks: [],
      route: points ? createPath(points, { closed: true }) : null,
      entry,
      basket,
      column,
      hatch,
      lives: LIVES,
      score: 0,
      tasks: tasksOf(level),
      done: 0,
      algaeDone: 0,
      filtersDone: 0,
      trashDone: 0,
      mercy: 0,
      over: null,
      holdKind: 0,
      holdIndex: -1,
      holdTime: 0,
      time: 0,
      ev: { score: 0, lifeLost: false, won: false, lost: false, task: 0, taskX: 0, taskZ: 0, pick: false, bin: false, float: false, sharkHit: false, airOut: false, tooLow: false, working: false },
   };

   const zones: Spot[] = [
      { x: entry.x, z: entry.z, r: 1.7 },
      { x: basket.x, z: basket.z, r: 1.5 },
      { x: column.x, z: column.z, r: COLUMN_R + 0.8 },
      { x: hatch.x, z: hatch.z, r: 1.5 },
   ];
   const used: Spot[] = [];
   const between = (a: Spot, b: Spot, gap: number) => Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r + gap;
   const place = (r: number, x0: number, x1: number, z0: number, z1: number, gap: number, solid: boolean): Spot | null => {
      for (let tries = 0; tries < 160; tries++) {
         const spot = { x: x0 + (x1 - x0) * rng(), z: z0 + (z1 - z0) * rng(), r };
         if (!zones.every((zone) => between(spot, zone, 0.3))) continue;
         if (!used.every((other) => between(spot, other, gap))) continue;
         if (solid && points && distanceToLoop(points, spot.x, spot.z) < r + 1.25) continue;
         used.push(spot);
         return spot;
      }
      return null;
   };

   // the centre-piece, then the filter machines, then rocks: all solid
   const castleSpec = CASTLE_PLACE[level.layout];
   const castleScale = castleSpec.scale;
   const castleR = CASTLE_R * castleScale;
   const castle = place(castleR, hx * castleSpec.x0, hx * castleSpec.x1, hz * castleSpec.z0, hz * castleSpec.z1, 1.2, true);
   if (!castle) return null;
   run.solids.push({ kind: "castle", x: castle.x, z: castle.z, r: castleR, rotY: 0, scale: castleScale });
   for (let i = 0; i < level.filters; i++) {
      const f = place(FILTER_R, -hx + FILTER_R + 2.4, hx - FILTER_R - 2.4, -hz + FILTER_R + 1.6, hz - 4.6, 1.2, true);
      if (!f) return null;
      run.solids.push({ kind: "filter", x: f.x, z: f.z, r: FILTER_R, rotY: (rng() - 0.5) * 0.8, scale: 1 });
      run.filters.push({ solid: run.solids.length - 1, x: f.x, z: f.z, done: false });
   }
   const rockSpec = ROCK_PLACE[level.layout];
   const rocks = 3 + Math.floor(level.width / 8) + rockSpec.extra;
   for (let i = 0; i < rocks; i++) {
      const scale = rockSpec.s0 + rng() * (rockSpec.s1 - rockSpec.s0);
      const r = ROCK_R * scale;
      const z0 = -hz + r + 1.2;
      const z1 = rockSpec.zBack ? Math.max(z0 + 0.4, -hz * rockSpec.zBackAt) : hz - 4.6;
      const spot = place(r, -hx + r + 1.2, hx - r - 1.2, z0, z1, 1.1, true);
      if (!spot) continue;
      run.solids.push({ kind: "rock", x: spot.x, z: spot.z, r, rotY: rng() * Math.PI * 2, scale });
   }

   // algae on the glass, 3 m apart along it
   const claimed: Array<{ x: number; z: number }> = [];
   for (let i = 0; i < level.algae; i++) {
      const high = i >= level.algae - level.highAlgae;
      let ok = false;
      for (let tries = 0; tries < 120 && !ok; tries++) {
         const wall = ((i + Math.floor(rng() * 3)) % 3) as 0 | 1 | 2;
         let x: number;
         let z: number;
         if (wall === 0) {
            x = -hx + 2.6 + (level.width - 5.2) * rng();
            z = -hz;
         } else {
            x = wall === 1 ? -hx : hx;
            z = -hz + 2.6 + (level.depth - 5.2 - 2.4) * rng();
         }
         if (claimed.some((c) => Math.hypot(c.x - x, c.z - z) < 3.4)) continue;
         const standAt = standFor(run, x, z, wall);
         if (!standAt) continue;
         claimed.push({ x, z });
         run.algae.push({ x, z, y: high ? HIGH_ALGAE_Y : LOW_ALGAE_Y, wall, high, stand: standAt, done: false });
         ok = true;
      }
      if (!ok) return null;
   }

   // trash on the floor, apart from everything
   for (let i = 0; i < level.trash; i++) {
      const spot = place(TRASH_R + 0.2, -hx + 1.2, hx - 1.2, -hz + 1.2, hz - 1.2, 0.9, false);
      if (!spot) return null;
      run.trash.push({ x: spot.x, z: spot.z, state: 0, spin: rng() * Math.PI * 2 });
   }

   if (points && run.route) {
      const n = points.length;
      const first = Math.floor(rng() * n);
      for (let k = 0; k < level.sharks; k++) {
         const at = (first + Math.floor((k * n) / level.sharks)) % n;
         const next = (at + 1) % n;
         const p = points[at];
         const q = points[next];
         run.sharks.push({
            x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(q.x - p.x, q.z - p.z),
            state: { index: next, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } },
         });
      }
   }
   return run;
}

/** A standable spot 0.9 m in from the glass at an algae patch (or the nearest free one within reach). */
function standFor(run: Run, x: number, z: number, wall: 0 | 1 | 2): { x: number; z: number } | null {
   const inward = { x: wall === 1 ? 1 : wall === 2 ? -1 : 0, z: wall === 0 ? 1 : 0 };
   for (const d of [0.9, 0.7, 1.0, 0.55]) {
      for (const side of [0, 0.35, -0.35, 0.7, -0.7]) {
         const px = x + inward.x * d + (wall === 0 ? side : 0);
         const pz = z + inward.z * d + (wall === 0 ? 0 : side);
         if (standable(run, px, pz, RADIUS + 0.1)) return { x: px, z: pz };
      }
   }
   return null;
}

export function createRun(seed: number, level: AquariumLevel = LEVELS[1]): Run {
   for (let attempt = 0; attempt < 80; attempt++) {
      const run = build(seed, attempt, level);
      if (run && objectivesReachable(run)) return run;
   }
   throw new Error(`aquarium layout unreachable (seed ${seed})`);
}

// ---------- reachability ----------

const CELL = 0.3;

interface Grid { cols: number; rows: number; seen: Uint8Array }

function flood(run: Run): Grid {
   const cols = Math.ceil((run.hx * 2) / CELL) + 1;
   const rows = Math.ceil((run.hz * 2) / CELL) + 1;
   const open = new Uint8Array(cols * rows);
   const seen = new Uint8Array(cols * rows);
   const wx = (c: number) => -run.hx + c * CELL;
   const wz = (r: number) => -run.hz + r * CELL;
   for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (standable(run, wx(c), wz(r), RADIUS * 0.95)) open[r * cols + c] = 1;
   const qx = new Int32Array(cols * rows);
   const qz = new Int32Array(cols * rows);
   let head = 0;
   let tail = 0;
   const push = (c: number, r: number) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      const id = r * cols + c;
      if (!open[id] || seen[id]) return;
      seen[id] = 1;
      qx[tail] = c;
      qz[tail] = r;
      tail += 1;
   };
   push(Math.round((run.entry.x + run.hx) / CELL), Math.round((run.entry.z + run.hz) / CELL));
   while (head < tail) {
      const c = qx[head];
      const r = qz[head];
      head += 1;
      push(c + 1, r);
      push(c - 1, r);
      push(c, r + 1);
      push(c, r - 1);
   }
   return { cols, rows, seen };
}

function nearReach(run: Run, g: Grid, x: number, z: number, within: number): boolean {
   const c0 = Math.round((x + run.hx) / CELL);
   const r0 = Math.round((z + run.hz) / CELL);
   const span = Math.ceil(within / CELL);
   for (let r = r0 - span; r <= r0 + span; r++) {
      for (let c = c0 - span; c <= c0 + span; c++) {
         if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || !g.seen[r * g.cols + c]) continue;
         if (Math.hypot(-run.hx + c * CELL - x, -run.hz + r * CELL - z) <= within) return true;
      }
   }
   return false;
}

/** Every algae patch (a spot within 1.0 m, so the 1.2 m work range holds), filter, item, the basket, the column and the hatch can be reached from the entry. */
export function objectivesReachable(run: Run): boolean {
   const g = flood(run);
   if (!run.algae.every((a) => nearReach(run, g, a.x, a.z, 1.0))) return false;
   if (!run.filters.every((f) => nearReach(run, g, f.x, f.z, 1.1))) return false;
   if (!run.trash.every((t) => nearReach(run, g, t.x, t.z, RADIUS + TRASH_R))) return false;
   return nearReach(run, g, run.basket.x, run.basket.z, BASKET_R - 0.15) &&
      nearReach(run, g, run.column.x, run.column.z, COLUMN_R - 0.2) &&
      nearReach(run, g, run.hatch.x, run.hatch.z, HATCH_R - 0.15);
}

// ---------- step ----------

const DIR = { x: 0, z: 0 };

function slide(run: Run, x0: number, z0: number): void {
   const h = run.hero;
   for (let pass = 0; pass < 2; pass++) {
      for (const s of run.solids) {
         const dx = h.x - s.x;
         const dz = h.z - s.z;
         const m = s.r + RADIUS;
         const d2 = dx * dx + dz * dz;
         if (d2 >= m * m) continue;
         const d = Math.sqrt(d2);
         const nx = d > 1e-6 ? dx / d : 0;
         const nz = d > 1e-6 ? dz / d : 1;
         h.x = s.x + nx * m;
         h.z = s.z + nz * m;
         const vn = h.vx * nx + h.vz * nz;
         if (vn < 0) {
            h.vx -= vn * nx;
            h.vz -= vn * nz;
         }
      }
      const maxX = run.hx - RADIUS;
      const maxZ = run.hz - RADIUS;
      if (h.x > maxX) { h.x = maxX; if (h.vx > 0) h.vx = 0; }
      if (h.x < -maxX) { h.x = -maxX; if (h.vx < 0) h.vx = 0; }
      if (h.z > maxZ) { h.z = maxZ; if (h.vz > 0) h.vz = 0; }
      if (h.z < -maxZ) { h.z = -maxZ; if (h.vz < 0) h.vz = 0; }
   }
   if (!Number.isFinite(h.x)) { h.x = x0; h.z = z0; }
}

function integrate(run: Run, dirX: number, dirZ: number, dt: number): void {
   const h = run.hero;
   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }
   const drift = run.level.current ? CURRENT_ACCEL * CURRENT_SETTLE_S : 0;
   let dvx = dirX * MAX_SPEED + drift - h.vx;
   let dvz = dirZ * MAX_SPEED - h.vz;
   const dv = Math.hypot(dvx, dvz);
   const cap = (len > 0.01 ? ACCEL : BRAKE) * dt;
   if (dv > cap && dv > 0) {
      dvx *= cap / dv;
      dvz *= cap / dv;
   }
   h.vx += dvx;
   h.vz += dvz;
}

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** Objective points only: every task with the air bonus. The clock bonus is separate and win-only. */
export function objectiveCeiling(level: AquariumLevel): number {
   return (TASK_POINTS + CLEAN_POINTS) * tasksOf(level);
}

function clearHold(run: Run): void {
   run.holdKind = 0;
   run.holdIndex = -1;
   run.holdTime = 0;
}

function finishTask(run: Run, kind: 1 | 2 | 3, x: number, z: number): void {
   const bonus = run.hero.air > AIR_BONUS_ABOVE ? CLEAN_POINTS : 0;
   const pts = TASK_POINTS + bonus;
   run.score += pts;
   run.ev.score += pts;
   run.ev.task = kind;
   run.ev.taskX = x;
   run.ev.taskZ = z;
   run.done += 1;
}

function holdTarget(run: Run, kind: 1 | 2, index: number): { x: number; z: number } {
   return kind === 1 ? run.algae[index] : run.filters[index];
}

function inRange(run: Run, kind: 1 | 2, index: number): boolean {
   const t = holdTarget(run, kind, index);
   return Math.hypot(run.hero.x - t.x, run.hero.z - t.z) <= WORK_RANGE;
}

function pickTarget(run: Run): { kind: 1 | 2; index: number } | null {
   let best: { kind: 1 | 2; index: number } | null = null;
   let bestD = Infinity;
   for (let i = 0; i < run.algae.length; i++) {
      if (run.algae[i].done || !inRange(run, 1, i)) continue;
      const d = Math.hypot(run.hero.x - run.algae[i].x, run.hero.z - run.algae[i].z);
      if (d < bestD) { bestD = d; best = { kind: 1, index: i }; }
   }
   for (let i = 0; i < run.filters.length; i++) {
      if (run.filters[i].done || !inRange(run, 2, i)) continue;
      const d = Math.hypot(run.hero.x - run.filters[i].x, run.hero.z - run.filters[i].z);
      if (d < bestD) { bestD = d; best = { kind: 2, index: i }; }
   }
   return best;
}

/** Hold-to-work. Returns true while the diver is working (drains 1.5x), even when waiting to float up. */
function stepHold(run: Run, action: boolean, dt: number): boolean {
   if (!action) {
      clearHold(run);
      return false;
   }
   if (run.holdKind !== 0) {
      const kind = run.holdKind;
      const done = kind === 1 ? run.algae[run.holdIndex].done : run.filters[run.holdIndex].done;
      if (done || !inRange(run, kind, run.holdIndex)) clearHold(run);
   }
   if (run.holdKind === 0) {
      const t = pickTarget(run);
      if (!t) return false;
      run.holdKind = t.kind;
      run.holdIndex = t.index;
      run.holdTime = 0;
   }
   const kind = run.holdKind as 1 | 2;
   const index = run.holdIndex;
   if (kind === 1 && run.algae[index].high && run.hero.y <= HIGH_MIN_Y) {
      run.ev.tooLow = true;
      return true;
   }
   run.holdTime += dt;
   const need = kind === 1 ? ALGAE_HOLD_S : FILTER_HOLD_S;
   if (run.holdTime >= need) {
      const t = holdTarget(run, kind, index);
      if (kind === 1) {
         run.algae[index].done = true;
         run.algaeDone += 1;
      } else {
         run.filters[index].done = true;
         run.filtersDone += 1;
      }
      finishTask(run, kind, t.x, t.z);
      clearHold(run);
   }
   return true;
}

function pushHero(run: Run, fromX: number, fromZ: number, dist: number): void {
   const h = run.hero;
   let dx = h.x - fromX;
   let dz = h.z - fromZ;
   const d = Math.hypot(dx, dz);
   if (d < 1e-6) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
   const steps = 5;
   for (let i = 0; i < steps; i++) {
      h.x += (dx * dist) / steps;
      h.z += (dz * dist) / steps;
      slide(run, h.x, h.z);
   }
}

function loseAir(run: Run): void {
   const h = run.hero;
   run.ev.airOut = true;
   run.ev.lifeLost = true;
   run.lives -= 1;
   for (const i of run.carried) {
      run.trash[i].state = 0;
      run.trash[i].x = h.x;
      run.trash[i].z = h.z;
   }
   run.carried.length = 0;
   clearHold(run);
   if (run.lives <= 0) {
      run.over = "lose";
      run.ev.lost = true;
      return;
   }
   h.x = run.entry.x;
   h.z = run.entry.z;
   h.vx = 0;
   h.vz = 0;
   h.y = 0;
   h.float = 0;
   h.air = AIR_MAX;
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share
 * this function: only `action`, `jumpPressed` and the stick axes matter, for the same durations.
 */
export function step(run: Run, input: AquariumInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.task = 0;
   ev.pick = false;
   ev.bin = false;
   ev.float = false;
   ev.sharkHit = false;
   ev.airOut = false;
   ev.tooLow = false;
   ev.working = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   run.mercy = Math.max(0, run.mercy - dt);
   const h = run.hero;

   // float: one 0.9 s arc, 1.8 m high, only from the floor
   if (input.jumpPressed && h.float <= 0) {
      h.float = FLOAT_S;
      ev.float = true;
   }
   if (h.float > 0) {
      h.float = Math.max(0, h.float - dt);
      h.y = h.float > 0 ? Math.sin(Math.PI * (1 - h.float / FLOAT_S)) * FLOAT_H : 0;
   } else h.y = 0;

   if (run.route) {
      for (const shark of run.sharks) stepPatrol(shark, shark.state, run.route, dt, { speed: run.level.sharkSpeed });
   }

   inputToWorld(input.moveX, input.moveY, input.yaw, DIR);
   integrate(run, DIR.x, DIR.z, dt);
   const ox = h.x;
   const oz = h.z;
   h.x += h.vx * dt;
   h.z += h.vz * dt;
   slide(run, ox, oz);
   if (Math.hypot(h.vx, h.vz) > 0.25) h.yaw = turnTowards(h.yaw, Math.atan2(h.vx, h.vz), Math.min(1, dt * 10));

   // trash: collected on overlap, up to three
   for (let i = 0; i < run.trash.length && run.carried.length < CARRY_MAX; i++) {
      const t = run.trash[i];
      if (t.state !== 0) continue;
      if (Math.hypot(h.x - t.x, h.z - t.z) <= RADIUS + TRASH_R) {
         t.state = 1;
         run.carried.push(i);
         ev.pick = true;
      }
   }
   // the basket takes everything carried, one task each
   if (run.carried.length > 0 && Math.hypot(h.x - run.basket.x, h.z - run.basket.z) <= BASKET_R) {
      for (const i of run.carried) {
         run.trash[i].state = 2;
         run.trashDone += 1;
         finishTask(run, 3, run.basket.x, run.basket.z);
      }
      run.carried.length = 0;
      ev.bin = true;
   }

   // the hold
   const working = stepHold(run, input.action, dt);
   ev.working = working;

   // sharks
   if (run.mercy <= 0) {
      for (const shark of run.sharks) {
         if (Math.hypot(h.x - shark.x, h.z - shark.z) <= SHARK_HIT) {
            h.air -= SHARK_AIR;
            run.mercy = SHARK_MERCY_S;
            ev.sharkHit = true;
            clearHold(run);
            pushHero(run, shark.x, shark.z, SHARK_PUSH);
            break;
         }
      }
   }

   // air: the bubble column refills it, everything else drains it
   if (Math.hypot(h.x - run.column.x, h.z - run.column.z) <= COLUMN_R) h.air = Math.min(AIR_MAX, h.air + COLUMN_RATE * dt);
   else h.air -= run.level.airDrain * (working ? WORK_DRAIN_MULT : 1) * dt;
   if (h.air <= 0) {
      loseAir(run);
      if (run.over) return ev;
   }

   if (!run.over && run.done === run.tasks && Math.hypot(h.x - run.hatch.x, h.z - run.hatch.z) <= HATCH_R) {
      const bonus = timeBonus(timeLeftMs);
      run.score += bonus;
      ev.score += bonus;
      run.over = "win";
      ev.won = true;
   }
   return ev;
}

/** Nearest open task or the next stop, for the target marker: item, patch, filter, basket or hatch. */
export function nextTarget(run: Run): { x: number; z: number } | null {
   let best: { x: number; z: number } | null = null;
   let bestD = Infinity;
   const consider = (x: number, z: number) => {
      const d = Math.hypot(run.hero.x - x, run.hero.z - z);
      if (d < bestD) { bestD = d; best = { x, z }; }
   };
   if (run.done === run.tasks) return { x: run.hatch.x, z: run.hatch.z };
   for (const a of run.algae) if (!a.done) consider(a.x, a.z);
   for (const f of run.filters) if (!f.done) consider(f.x, f.z);
   if (run.carried.length > 0) consider(run.basket.x, run.basket.z);
   if (run.carried.length < CARRY_MAX) for (const t of run.trash) if (t.state === 0) consider(t.x, t.z);
   return best;
}
