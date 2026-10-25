// Alien Farm rules: pure, seeded, no three.js / React / DOM, no Math.random / Date.now.
// Nine plots pulse through fixed cycles; a press inside a crop's ripe window plants the alien for
// 0.30 s and picks it (perfect near the peak), up to four crops ride in the basket, and walking into
// the saucer's moving beam unloads them all for 25 x n^2. A pure 100 s score attack: the shell's
// timer (durationMs) ends the run with "timeup" (README "Decisions (user, 2026-10-24)").
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { clampToBounds, type AABB } from "@/arcade3d/core/collision";
import { substep } from "@/arcade3d/core/kinematics";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng, turnTowards } from "@/arcade3d/core/math";
import { createPath, pointAt, tangentAt } from "@/arcade3d/core/path";

import { BASE_PLOTS, LEVELS, type AlienFarmLevel, type PlotConfig } from "./levels";

export { capScore, withinServerLimits };
export type { AlienFarmLevel, PlotConfig };

export const DURATION_MS = 100_000;
export const DURATION_S = DURATION_MS / 1000;
/** The farmer's cheer / shrug after time-up, before the result panel. */
export const RESULT_DELAY_MS = 1600;
/** Largest simulation step (s): every frame is split into equal steps no longer than this. */
export const MAX_STEP_S = 1 / 120;

export type CropKind = "glowPod" | "gourd";

export const FARM = {
   /** where the farmer's centre may go (walkable x +/-10.5, z +/-8.5 inset by the radius) */
   bounds: { min: { x: -10.1, y: 0, z: -8.1 }, max: { x: 10.1, y: 0, z: 8.1 } } as AABB,
   bedHalf: 0.8,
   bedTopY: 0.08,
} as const;

export const FARMER = {
   startX: 0,
   startZ: 6,
   /** yaw pi faces -z (north, away from the camera) */
   startYaw: Math.PI,
   radius: 0.4,
   accel: 24,
   brake: 30,
   turnRate: 14,
   /** top speed by occupied basket slots: 4.5 * (1 - 0.08 n) */
   speeds: [4.5, 4.14, 3.78, 3.42, 3.06] as readonly number[],
} as const;

/** Row-major, x = -5 / 0 / 5, z = -4 / 0 / 4. Level 1's plot layout. */
export const PLOTS: readonly PlotConfig[] = BASE_PLOTS;
export const PLOT_COUNT = 9;

/** Offset ticks T[t][i] = (t + 5 i + 3 floor(i / 3)) mod 16, frozen; delta = T / 8 s. */
export const OFFSET_TABLES: readonly (readonly number[])[] = [
   [0, 5, 10, 2, 7, 12, 4, 9, 14],
   [1, 6, 11, 3, 8, 13, 5, 10, 15],
   [2, 7, 12, 4, 9, 14, 6, 11, 0],
   [3, 8, 13, 5, 10, 15, 7, 12, 1],
   [4, 9, 14, 6, 11, 0, 8, 13, 2],
   [5, 10, 15, 7, 12, 1, 9, 14, 3],
   [6, 11, 0, 8, 13, 2, 10, 15, 4],
   [7, 12, 1, 9, 14, 3, 11, 0, 5],
   [8, 13, 2, 10, 15, 4, 12, 1, 6],
   [9, 14, 3, 11, 0, 5, 13, 2, 7],
   [10, 15, 4, 12, 1, 6, 14, 3, 8],
   [11, 0, 5, 13, 2, 7, 15, 4, 9],
   [12, 1, 6, 14, 3, 8, 0, 5, 10],
   [13, 2, 7, 15, 4, 9, 1, 6, 11],
   [14, 3, 8, 0, 5, 10, 2, 7, 12],
   [15, 4, 9, 1, 6, 11, 3, 8, 13],
];

export const CYCLE = {
   tickS: 0.125,
   /** fractions of the cycle C: sprout [0, 0.2), growing, ripe p +/- w around 0.5, burst at 0.85 */
   growFrac: 0.2,
   peakFrac: 0.5,
   burstFrac: 0.85,
   /** ripe half-window by the cycle's peak time: < 40 s, < 70 s, later */
   halfEarly: 0.9,
   halfMid: 0.75,
   halfLate: 0.6,
   midAt: 40,
   lateAt: 70,
} as const;

export const HARVEST = {
   /** farmer centre to crop centre, inclusive */
   reach: 0.9,
   /** |press - peak| <= this is perfect: the same for touch and keyboard (standing decision 7) */
   perfectHalf: 0.25,
   channelS: 0.3,
   /** a press that does not start a harvest (early, late, nothing ripe, full basket, cooling) */
   cooldownS: 0.6,
   /** a mistimed press bursts the crop in the farmer's face: planted (no movement) this long */
   burstStunS: 2,
   capacity: 4,
} as const;

export const SHIP = {
   waypoints: [
      { x: -9, y: 0, z: -7 },
      { x: 9, y: 0, z: -7 },
      { x: 9, y: 0, z: 7 },
      { x: -9, y: 0, z: 7 },
   ],
   length: 64,
   hoverY: 3.2,
   beamRadius: 2,
   /** m/s before 40 s, 40-70 s, after 70 s */
   speeds: [2, 2.5, 3] as readonly number[],
} as const;
export const SHIP_PATH = createPath(SHIP.waypoints, { closed: true });

export const SPORES = { radius: 2, lifeS: 5, slow: 0.6 } as const;

export const SCORE = {
   harvest: 50,
   perfect: 100,
   /** a delivery of n crops pays loadUnit * n * n */
   loadUnit: 25,
   /** delivered crops that complete a shipment (a banner, no points) */
   shipment: 16,
} as const;

/**
 * Proposed server limits (README "Server limits and why they hold"). meta.scoring stays the
 * provisional main value until Claude's go-live PR copies these into meta + arcade-games.json.
 */
export const PROPOSED_LIMITS: ScoringRules = {
   kind: "points",
   maxScore: 12900,
   minDurationMs: 99_000,
   maxDurationMs: 102_000,
   base: 200,
   maxPointsPerSec: 250,
   unitLabel: "pts",
   display: "int",
};

/**
 * Proposed server limits per level (README "Server limits and why they hold", arcade-score-limits skill).
 * Copied into meta.levels and arcade-games.json. Level 1 equals PROPOSED_LIMITS byte-for-byte.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: PROPOSED_LIMITS,
   2: {
      kind: "points",
      maxScore: 20600,
      minDurationMs: 148_000,
      maxDurationMs: 153_000,
      base: 200,
      maxPointsPerSec: 250,
      unitLabel: "pts",
      display: "int",
   },
   3: {
      kind: "points",
      maxScore: 26900,
      minDurationMs: 178_000,
      maxDurationMs: 183_000,
      base: 200,
      maxPointsPerSec: 260,
      unitLabel: "pts",
      display: "int",
   },
   4: {
      kind: "points",
      maxScore: 22100,
      minDurationMs: 178_000,
      maxDurationMs: 183_000,
      base: 200,
      maxPointsPerSec: 260,
      unitLabel: "pts",
      display: "int",
   },
   5: {
      kind: "points",
      maxScore: 30500,
      minDurationMs: 208_000,
      maxDurationMs: 213_000,
      base: 200,
      maxPointsPerSec: 260,
      unitLabel: "pts",
      display: "int",
   },
};

// ---------- cycles ----------

export const halfWindow = (peak: number, halfLate: number = CYCLE.halfLate): number =>
   peak < CYCLE.midAt ? CYCLE.halfEarly : peak < CYCLE.lateAt ? CYCLE.halfMid : halfLate;

/** The ship's speed at play time t. */
export const shipSpeed = (t: number, speeds: readonly number[] = SHIP.speeds): number =>
   t < CYCLE.midAt ? speeds[0] : t < CYCLE.lateAt ? speeds[1] : speeds[2];

/** Distance the ship has travelled by play time t (the exact integral of shipSpeed). */
export function shipDistance(t: number, speeds: readonly number[] = SHIP.speeds): number {
   const a = Math.min(t, CYCLE.midAt);
   const b = Math.min(Math.max(t - CYCLE.midAt, 0), CYCLE.lateAt - CYCLE.midAt);
   const c = Math.max(t - CYCLE.lateAt, 0);
   return speeds[0] * a + speeds[1] * b + speeds[2] * c;
}

export type Stage = "locked" | "waiting" | "sprout" | "growing" | "ripe" | "overripe" | "spent";

export interface Plot extends PlotConfig {
   /** first cycle start: activateAt + delta */
   b0: number;
   /** the cycle that was picked / missed (-1 none); a cycle is done once either is set */
   picked: number;
   missed: number;
   /** the latest cycle whose burst has been handled */
   burst: number;
   /** a reserved crop (the channel is picking it) */
   reserved: boolean;
   /** spore zone [sporeFrom, sporeTo) */
   sporeFrom: number;
   sporeTo: number;
}

/** Cycle index at time t (-1 before the first cycle starts). */
export const cycleIndex = (plot: Plot, t: number): number => (t < plot.b0 ? -1 : Math.floor((t - plot.b0) / plot.cycleS));
export const cycleStart = (plot: Plot, k: number): number => plot.b0 + k * plot.cycleS;
export const cyclePeak = (plot: Plot, k: number): number => cycleStart(plot, k) + plot.cycleS * CYCLE.peakFrac;
export const cycleBurst = (plot: Plot, k: number): number => cycleStart(plot, k) + plot.cycleS * CYCLE.burstFrac;

/** The plot's stage at t (ripe endpoints are ripe; a picked or burst cycle is spent). */
export function stageAt(plot: Plot, t: number): Stage {
   if (t < plot.activateAt) return "locked";
   const k = cycleIndex(plot, t);
   if (k < 0) return "waiting";
   if (plot.picked === k || plot.missed === k) return "spent";
   const b = cycleStart(plot, k), p = cyclePeak(plot, k), w = halfWindow(p, plot.halfLate);
   if (t < b + plot.cycleS * CYCLE.growFrac) return "sprout";
   if (t < p - w) return "growing";
   if (t <= p + w) return "ripe";
   if (t < cycleBurst(plot, k)) return "overripe";
   return "spent";
}

/** Crop growth 0..1 for the drawing: height 0.5 + 0.5 g (held at 1 after the peak until spent). */
export function growthAt(plot: Plot, t: number): number {
   const k = cycleIndex(plot, t);
   if (k < 0) return 0;
   const g = (t - cycleStart(plot, k)) / (plot.cycleS * CYCLE.peakFrac);
   return g < 0 ? 0 : g > 1 ? 1 : g;
}

/** Ring fill: 0 until 1.5 s before the peak, 1 at the peak (held while ripe). */
export function ringFill(plot: Plot, t: number): number {
   const k = cycleIndex(plot, t);
   if (k < 0) return 0;
   const q = (t - (cyclePeak(plot, k) - 1.5)) / 1.5;
   return q < 0 ? 0 : q > 1 ? 1 : q;
}

// ---------- the run ----------

export interface Cargo {
   plot: number;
   cycle: number;
   perfect: boolean;
   kind: CropKind;
}

export interface Farmer {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   yaw: number;
   inSpore: boolean;
}

export interface Ship {
   s0: number;
   dir: 1 | -1;
   x: number;
   y: number;
   z: number;
   /** heading of travel (rad, 0 = +z) */
   yaw: number;
}

export interface Channel {
   active: boolean;
   plot: number;
   cycle: number;
   perfect: boolean;
   start: number;
   end: number;
}

export interface StepInput {
   dirX: number;
   dirZ: number;
   /** one press this frame (action or jump, read once) */
   press: boolean;
}

/** What happened during one stepRun (reset at its start; read by the Scene for feedback). */
export interface StepEvents {
   /** plot id of a completed harvest (-1 none) and whether it was perfect */
   picked: number;
   pickedPerfect: boolean;
   pickedPoints: number;
   /** a press that started a harvest */
   started: number;
   /** plot whose cycle a mistimed press locked (-1 none) */
   missed: number;
   /** a press refused (cooling, nothing ripe in reach, full basket) */
   refused: boolean;
   /** crops unloaded into the beam (0 none) and the points */
   delivered: number;
   deliveredPoints: number;
   /** bit i: plot i burst into spores */
   bursts: number;
   /** the delivery that completed the shipment of 16 */
   shipment: boolean;
}

export interface RunState {
   seed: number;
   level: AlienFarmLevel;
   table: number;
   time: number;
   plots: Plot[];
   farmer: Farmer;
   ship: Ship;
   cargo: Cargo[];
   cargoCount: number;
   channel: Channel;
   cooldownUntil: number;
   /** a burst's spores stagger the farmer until then (no movement) */
   stunUntil: number;
   harvested: number;
   perfects: number;
   delivered: number;
   perfectDelivered: number;
   loads: number;
   sources: number;
   streak: number;
   bestStreak: number;
   score: number;
   events: StepEvents;
   /** scratch: this frame's input for the substeps */
   input: StepInput;
}

const SHIP_TANGENT = { x: 0, y: 0, z: 0 };

/** Places the ship for play time t (exact, independent of the frame split). */
export function placeShip(ship: Ship, t: number, speeds: readonly number[] = SHIP.speeds): Ship {
   const s = ship.s0 + ship.dir * shipDistance(t, speeds);
   pointAt(SHIP_PATH, s, ship);
   tangentAt(SHIP_PATH, s, SHIP_TANGENT);
   ship.yaw = Math.atan2(SHIP_TANGENT.x * ship.dir, SHIP_TANGENT.z * ship.dir);
   return ship;
}

/** Seed order: table index, then direction, then the ship's start distance (README "Seed"). */
export function createRun(seed: number, level?: AlienFarmLevel | LevelId): RunState {
   const lvl: AlienFarmLevel = typeof level === "object" ? level : level !== undefined ? LEVELS[level] : LEVELS[1];
   const rng = createRng(seed);
   const table = Math.floor(16 * rng());
   const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
   const s0 = SHIP.length * rng();
   const plots: Plot[] = lvl.plots.map((c, i) => ({
      ...c,
      b0: c.activateAt + OFFSET_TABLES[table][i] * CYCLE.tickS,
      picked: -1,
      missed: -1,
      burst: -1,
      reserved: false,
      sporeFrom: -1,
      sporeTo: -1,
   }));
   const ship: Ship = { s0, dir, x: 0, y: 0, z: 0, yaw: 0 };
   placeShip(ship, 0, lvl.shipSpeeds);
   return {
      seed,
      level: lvl,
      table,
      time: 0,
      plots,
      farmer: { x: FARMER.startX, y: 0, z: FARMER.startZ, vx: 0, vz: 0, yaw: FARMER.startYaw, inSpore: false },
      ship,
      cargo: Array.from({ length: lvl.capacity }, () => ({ plot: -1, cycle: -1, perfect: false, kind: "glowPod" as CropKind })),
      cargoCount: 0,
      channel: { active: false, plot: -1, cycle: -1, perfect: false, start: 0, end: 0 },
      cooldownUntil: 0,
      stunUntil: 0,
      harvested: 0,
      perfects: 0,
      delivered: 0,
      perfectDelivered: 0,
      loads: 0,
      sources: 0,
      streak: 0,
      bestStreak: 0,
      score: 0,
      events: { picked: -1, pickedPerfect: false, pickedPoints: 0, started: -1, missed: -1, refused: false, delivered: 0, deliveredPoints: 0, bursts: 0, shipment: false },
      input: { dirX: 0, dirZ: 0, press: false },
   };
}

/** Score formula: 50 per harvest, +50 if perfect, 25 n^2 per delivered load (README "Scoring"). */
export function runScore(harvested: number, perfects: number, loadSquares: number): number {
   return SCORE.harvest * harvested + (SCORE.perfect - SCORE.harvest) * perfects + SCORE.loadUnit * loadSquares;
}

const distXZ = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** The nearest plot within reach whose current cycle can still be picked or missed (-1 none; ties: lower id). */
export function targetPlot(run: RunState, t: number): number {
   const f = run.farmer;
   let best = -1, bestD = Infinity;
   for (const plot of run.plots) {
      const d = distXZ(f.x, f.z, plot.x, plot.z);
      if (d > HARVEST.reach || d >= bestD) continue;
      const k = cycleIndex(plot, t);
      if (k < 0 || t < plot.activateAt || plot.picked === k || plot.missed === k || plot.reserved) continue;
      if (t >= cycleBurst(plot, k)) continue;
      best = plot.id;
      bestD = d;
   }
   return best;
}

function press(run: RunState, t: number): void {
   const ev = run.events;
   if (run.channel.active) return; // the hands are busy: a second tap during the pick is ignored
   if (t < run.cooldownUntil) {
      run.cooldownUntil = t + HARVEST.cooldownS; // repeated taps keep the tool cooling
      ev.refused = true;
      return;
   }
   // full hands never harm a crop: nothing in reach or a full basket only cools the tool
   const id = run.cargoCount < (run.level?.capacity ?? HARVEST.capacity) ? targetPlot(run, t) : -1;
   const stage = id >= 0 ? stageAt(run.plots[id], t) : "spent";
   if (id < 0) {
      run.cooldownUntil = t + HARVEST.cooldownS;
      ev.refused = true;
      return;
   }
   const plot = run.plots[id];
   const k = cycleIndex(plot, t);
   if (stage !== "ripe") {
      // sprout, growing or overripe: the mistimed press bursts the crop at once (README "Press"):
      // this cycle is lost and its spores land now, around the farmer
      plot.missed = k;
      plot.burst = k;
      plot.sporeFrom = t;
      plot.sporeTo = t + (run.level?.sporesLifeS ?? SPORES.lifeS);
      run.streak = 0;
      run.cooldownUntil = t + HARVEST.cooldownS;
      run.stunUntil = t + HARVEST.burstStunS;
      const f0 = run.farmer;
      f0.vx = 0;
      f0.vz = 0;
      ev.missed = id;
      ev.bursts |= 1 << id;
      return;
   }
   const c = run.channel;
   c.active = true;
   c.plot = id;
   c.cycle = k;
   c.perfect = Math.abs(t - cyclePeak(plot, k)) <= HARVEST.perfectHalf;
   c.start = t;
   c.end = t + HARVEST.channelS;
   plot.reserved = true;
   const f = run.farmer;
   f.vx = 0;
   f.vz = 0;
   if (plot.x !== f.x || plot.z !== f.z) f.yaw = Math.atan2(plot.x - f.x, plot.z - f.z);
   ev.started = id;
}

function completeChannel(run: RunState): void {
   const c = run.channel;
   const plot = run.plots[c.plot];
   plot.reserved = false;
   plot.picked = c.cycle;
   c.active = false;
   const slot = run.cargo[run.cargoCount++];
   slot.plot = c.plot;
   slot.cycle = c.cycle;
   slot.perfect = c.perfect;
   slot.kind = plot.kind;
   run.harvested++;
   const points = c.perfect ? SCORE.perfect : SCORE.harvest;
   if (c.perfect) {
      run.perfects++;
      run.streak++;
      if (run.streak > run.bestStreak) run.bestStreak = run.streak;
   } else run.streak = 0;
   run.score += points;
   const ev = run.events;
   ev.picked = c.plot;
   ev.pickedPerfect = c.perfect;
   ev.pickedPoints += points;
}

function unload(run: RunState): void {
   const n = run.cargoCount;
   const before = run.delivered;
   for (let i = 0; i < n; i++) {
      const slot = run.cargo[i];
      if (slot.perfect) run.perfectDelivered++;
      run.sources |= 1 << slot.plot;
      slot.plot = -1;
   }
   run.delivered += n;
   run.loads++;
   run.cargoCount = 0;
   const points = SCORE.loadUnit * n * n;
   run.score += points;
   const ev = run.events;
   ev.delivered += n;
   ev.deliveredPoints += points;
   if (before < SCORE.shipment && run.delivered >= SCORE.shipment) ev.shipment = true;
}

/** Number of distinct plots that have delivered a crop. */
export function sourceCount(run: RunState): number {
   let n = 0;
   for (let m = run.sources; m; m &= m - 1) n++;
   return n;
}

/** Burst every cycle whose burst time has passed by t (once each), unless it was picked. */
function updateBursts(run: RunState, t: number): void {
   for (const plot of run.plots) {
      if (t < plot.b0) continue;
      const kb = Math.floor((t - plot.b0 - plot.cycleS * CYCLE.burstFrac) / plot.cycleS);
      if (kb <= plot.burst) continue;
      plot.burst = kb;
      if (plot.picked === kb || plot.reserved) continue;
      // one zone per plot: when a level's spore life outlasts the cycle, the next burst's zone (same spot) takes over the rest of it
      plot.sporeFrom = cycleBurst(plot, kb);
      plot.sporeTo = plot.sporeFrom + (run.level?.sporesLifeS ?? SPORES.lifeS);
      if (t < plot.sporeTo) run.events.bursts |= 1 << plot.id;
   }
}

export function inSpores(run: RunState, x: number, z: number, t: number): boolean {
   for (const plot of run.plots) {
      if (t >= plot.sporeFrom && t < plot.sporeTo && distXZ(x, z, plot.x, plot.z) <= SPORES.radius) return true;
   }
   return false;
}

/** The farmer's top speed now: by basket slots, x0.6 inside spores. */
export const topSpeed = (cargo: number, spores: boolean): number => FARMER.speeds[cargo] * (spores ? SPORES.slow : 1);

function moveFarmer(run: RunState, h: number, t: number): void {
   const f = run.farmer;
   f.inSpore = inSpores(run, f.x, f.z, t);
   if (run.channel.active || t <= run.stunUntil) {
      f.vx = 0;
      f.vz = 0;
      return;
   }
   const { dirX, dirZ } = run.input;
   let len = Math.hypot(dirX, dirZ);
   const ux = len > 1 ? dirX / len : dirX, uz = len > 1 ? dirZ / len : dirZ;
   len = Math.min(1, len);
   const top = topSpeed(run.cargoCount, f.inSpore);
   // velocity eases towards the wanted one: accelerating at 24 m/s^2, braking (no stick) at 30
   const wx = ux * top, wz = uz * top;
   let dx = wx - f.vx, dz = wz - f.vz;
   const dv = Math.hypot(dx, dz), max = (len > 0.05 ? FARMER.accel : FARMER.brake) * h;
   if (dv > max) {
      dx *= max / dv;
      dz *= max / dv;
   }
   f.vx += dx;
   f.vz += dz;
   const v = Math.hypot(f.vx, f.vz);
   if (v > top) {
      f.vx *= top / v;
      f.vz *= top / v;
   }
   const ox = f.x, oz = f.z;
   f.x += f.vx * h;
   f.z += f.vz * h;
   clampToBounds(f, FARM.bounds, 0, f);
   if (f.x !== ox + f.vx * h) f.vx = 0;
   if (f.z !== oz + f.vz * h) f.vz = 0;
   // never more than the active speed x dt (the limit proof relies on it)
   const moved = Math.hypot(f.x - ox, f.z - oz), cap = top * h;
   if (moved > cap) {
      f.x = ox + ((f.x - ox) * cap) / moved;
      f.z = oz + ((f.z - oz) * cap) / moved;
   }
   if (v > 0.2) f.yaw = turnTowards(f.yaw, Math.atan2(f.vx, f.vz), Math.min(1, FARMER.turnRate * h));
}

function subStep(run: RunState, h: number): void {
   const t0 = run.time, t1 = t0 + h;
   run.time = t1;
   let move = h;
   if (run.channel.active && run.channel.end <= t1) {
      // planted until the pick completes: only the rest of this step moves
      move = t1 - run.channel.end;
      completeChannel(run);
   }
   moveFarmer(run, move, t1);
   placeShip(run.ship, t1, run.level?.shipSpeeds ?? SHIP.speeds);
   updateBursts(run, t1);
   const f = run.farmer;
   if (run.cargoCount > 0 && distXZ(f.x, f.z, run.ship.x, run.ship.z) <= SHIP.beamRadius) unload(run);
}

function resetEvents(ev: StepEvents): void {
   ev.picked = -1;
   ev.pickedPerfect = false;
   ev.pickedPoints = 0;
   ev.started = -1;
   ev.missed = -1;
   ev.refused = false;
   ev.delivered = 0;
   ev.deliveredPoints = 0;
   ev.bursts = 0;
   ev.shipment = false;
}

const SUBSTEPS = new WeakMap<RunState, (h: number) => void>();

/**
 * One played frame of dt seconds: the press is read once at the frame's start, then the frame is
 * split into equal steps <= 1/120 s (channel completion, movement, ship, bursts, beam loading).
 * No allocation after the run's first frame.
 */
export function stepRun(run: RunState, input: StepInput, dt: number): StepEvents {
   resetEvents(run.events);
   if (!(dt > 0)) return run.events;
   run.input.dirX = input.dirX;
   run.input.dirZ = input.dirZ;
   if (input.press) press(run, run.time);
   let sub = SUBSTEPS.get(run);
   if (!sub) {
      sub = (h: number) => subStep(run, h);
      SUBSTEPS.set(run, sub);
   }
   substep(dt, MAX_STEP_S, sub);
   return run.events;
}

/** The store calls a played frame makes (the Scene and the bots share this path). */
export interface StoreSink {
   addScore(delta: number): void;
   setStat(key: string, value: number): void;
}

/** HUD stats: delivered crops, basket, perfect harvests. */
export const HUD_STATS = [
   { key: "delivered", label: "Delivered" },
   { key: "carry", label: "Basket", max: HARVEST.capacity },
   { key: "perfect", label: "Perfect" },
];

/** Feeds one frame's events into the store: points live, stats when they change. */
export function feedStore(run: RunState, ev: StepEvents, store: StoreSink): void {
   const points = ev.pickedPoints + ev.deliveredPoints;
   if (points > 0) store.addScore(points);
   if (ev.picked >= 0 || ev.delivered > 0) {
      store.setStat("delivered", run.delivered);
      store.setStat("carry", run.cargoCount);
      store.setStat("perfect", run.perfects);
   }
}

// ---------- what the screen and the sound point at ----------

/** The next opening of a pickable ripe window for a plot at or after t: [open, close, peak, cycle] or null. */
export function nextWindow(plot: Plot, t: number, out: { open: number; close: number; peak: number; cycle: number }, deadline = DURATION_S): boolean {
   if (t >= deadline) return false;
   let k = Math.max(0, cycleIndex(plot, Math.max(t, plot.b0)));
   for (let n = 0; n < 3; n++, k++) {
      if (plot.picked === k || plot.missed === k) continue;
      const p = cyclePeak(plot, k), w = halfWindow(p, plot.halfLate);
      if (p + w < t) continue;
      out.open = p - w;
      out.close = p + w;
      out.peak = p;
      out.cycle = k;
      return out.open < deadline;
   }
   return false;
}

const WIN = { open: 0, close: 0, peak: 0, cycle: 0 };

/**
 * The plot the arrow points at: the nearest ripe, pickable crop; otherwise the earliest next ripe
 * opening (ties: distance, then id). -1 when nothing is left. Not auto-steering: it only points.
 */
export function guidePlot(run: RunState): number {
   const t = run.time, f = run.farmer;
   const deadline = (run.level?.durationMs ?? DURATION_MS) / 1000;
   let ripe = -1, ripeD = Infinity, next = -1, nextOpen = Infinity, nextD = Infinity;
   for (const plot of run.plots) {
      if (plot.reserved || !nextWindow(plot, t, WIN, deadline)) continue;
      const d = distXZ(f.x, f.z, plot.x, plot.z);
      if (WIN.open <= t) {
         if (d < ripeD) {
            ripe = plot.id;
            ripeD = d;
         }
      } else if (WIN.open < nextOpen - 1e-9 || (Math.abs(WIN.open - nextOpen) <= 1e-9 && d < nextD)) {
         next = plot.id;
         nextOpen = WIN.open;
         nextD = d;
      }
   }
   return ripe >= 0 ? ripe : next;
}
