// Flooded Ruins Escape rules (the card's FLOOD verb): stone blocks and water chambers as data, the
// integer-ms clock and its cap, kinematic running and closed-form jumps, swimming (hold Jump to swim
// up, let go to sink, a Jump press at the surface leaps out), the air meter and bubble spouts, stone
// levers that set each chamber's water level (it moves at 0.8 m/s, a closed form of rules time),
// floating crates, the storm tide (the escape clock), steam jets, whirlpools and cave bats, the hero
// powers (Riko's dash breaks cracked brick, Nami's breach jump, Kiro's shield, Zuno's magnet pulls
// buried orbs, Vexa's phase passes ghost panels), checkpoints, losses and respawns, orbs and the
// flow meter (time bonuses), secrets, the level 5 boss (menu2/boss), the finish, and the lower bound
// behind the server limits. Pure and deterministic: no three.js, React, DOM, Math.random or
// Date.now. Scene.tsx maps the stick with inputToWorld(moveX, moveY, 0) and calls step() once per
// useRunFrame; the tests and bot.ts drive it directly.
//
// Clock: whole ms, the fraction carried to the next step, stepped 1 ms at a time, so every arc, swim
// and water level depends only on rules ms and is the same at 30, 60 or 144 fps. No allocation after
// createRun(): the hero and the events object are rewritten in place.
// README.md "Rules" and "Server limits" explain the design and the proof; the tests check them.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { BREACH_HEIGHT, DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS, type RuinLevel } from "./levels";
import { buildRuins, type Bat, type BossArena, type Jet, type Lever, type Orb, type RouteStep, type SecretSpot, type Spout, type Support, type Whirl, type Zone } from "./ruins";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, stepProgress, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { COMBO, COMBO_BASE_MS, SECRETS, UMBRA_ROLLER } from "./progression";

export type { Bat, BossArena, Jet, Lever, Orb, RouteStep, SecretSpot, Spout, Support, Whirl, Zone } from "./ruins";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

/** "Nothing": no support, no coyote, no buffered press. */
export const NONE = -1;
/** the most rules ms one frame may advance (the core caps dt at 1/20 s anyway) */
export const MAX_STEP_MS = 50;
/** the hero's collision: a vertical cylinder, feet at y */
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** top speed from the stick (m/s), and its acceleration (m/s²) on the ground, in the air and swimming */
export const V_RUN = 6.5;
export const ACCEL = { ground: 50, air: 32, swim: 20 } as const;
/** gravity (m/s²) and the jump's launch speed (m/s) */
export const G = 30;
export const V_JUMP = 14;
/** a jump still works this long after walking off an edge, and a press is kept this long */
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
/** the feet may stand this far past a block's edge (landing and walking) */
export const FOOT = 0.15;
/** a fall this far below the last top stood on (or the last swim) is lost */
export const FALL_DEPTH = 7;
/** after a loss: this long out of view, then this long frozen on the checkpoint (the time penalty) */
export const LOST_MS = 900;
export const SPAWN_MS = 600;
/** orbs: pickup radius around the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 0.95, bonusMs: 300, centerY: 0.6 } as const;

// ---------- water (the card's numbers) ----------

/** a chamber's water moves towards its lever's target at this speed (m/s) */
export const V_WATER = 0.8;
/** swimming: top horizontal speed, swim-up and sink speeds (m/s), and the vertical easing (m/s²) */
export const V_SWIM = 4;
export const V_SWIM_UP = 1.2;
export const V_SINK = 0.9;
export const SWIM_VACC = 6;
/** the feet this far under the surface = swimming; a swimmer floats with the feet this far under it */
export const SWIM_IN = 0.5;
export const FLOAT_DEPTH = 0.55;
/** a Jump press leaps out of the water within this of the floating height */
export const SURFACE_REACH = 0.25;
/** the air meter: 6 s with the head under water; it refills at the surface (this many ms per ms) and at once in a bubble column */
export const AIR_MS = 6000;
export const AIR_REFILL = 4;
/** the head's height over the feet (the air meter runs while it is under the surface) */
export const HEAD = 1.0;
/** a crate's top floats this far over its chamber's water */
export const CRATE_LIFT = 0.3;
/** levers: the trigger's radius round the lever (m), and how far the hero must step away before it can be pulled again */
export const LEVER_R = 0.9;
export const LEVER_REARM = 1.5;
/** the tide covers a checkpoint once it is within this of the top (the run then ends "flood") */
export const TIDE_SAFE = 1.0;
/** whirlpools pull at this rate (m/s²) */
export const WHIRL_PULL = 3;

/** apex heights and times (m, ms) */
export const H_JUMP = (V_JUMP * V_JUMP) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;
/** Nami's breach jump from the surface: the speed that reaches BREACH_HEIGHT */
export const V_BREACH = Math.sqrt(2 * G * BREACH_HEIGHT);
export const H_BREACH = BREACH_HEIGHT;
/**
 * The most a launch from water can rise over the water's surface (the proof's "water reach"): a
 * jump or breach from the floating feet (S - FLOAT_DEPTH), or a jump from a crate (S + CRATE_LIFT).
 */
export const WATER_REACH = Math.max(H_BREACH - FLOAT_DEPTH, H_JUMP - FLOAT_DEPTH, H_JUMP + CRATE_LIFT);

/** The boss: its ball's radius (m); its centre is this high over its feet point. */
export const BOSS_R = 1.1;

// ---------- the course ----------

export interface Course {
   supports: Support[];
   /** support indices of the checkpoints in order; [0] is the start */
   checkpoints: number[];
   goal: number;
   zones: Zone[];
   levers: Lever[];
   spouts: Spout[];
   jets: Jet[];
   whirls: Whirl[];
   bats: Bat[];
   orbs: Orb[];
   /** orbs every hero can reach (the all-orbs star) */
   mainOrbs: number;
   /** the level's secrets (progression.ts SECRETS, same order) */
   secrets: SecretSpot[];
   tide: RuinLevel["tide"];
   /** the run clock's cap (ms): "timeup" (unranked) */
   durationMs: number;
   boss: BossArena | null;
   /** the honest bot's route */
   route: RouteStep[];
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function buildCourse(level: RuinLevel = LEVELS[1]): Course {
   const d = buildRuins(level.id);
   const checkpoints = [d.supports.findIndex((s) => s.kind === "start")];
   d.supports.forEach((s, i) => {
      if (s.kind === "checkpoint") checkpoints.push(i);
   });
   const goal = d.supports.findIndex((s) => s.kind === "goal");
   // the secrets in progression.ts order (ruins.ts places them by id)
   const secrets = SECRETS[level.id].map((spec) => {
      const spot = d.secrets.find((s) => s.id === spec.id);
      if (!spot) return { id: spec.id, x: 0, y: -1000, z: 0, sunken: -1 }; // TODO-DEV
      return spot;
   });
   return {
      supports: d.supports,
      checkpoints,
      goal,
      zones: d.zones,
      levers: d.levers,
      spouts: d.spouts,
      jets: d.jets,
      whirls: d.whirls,
      bats: d.bats,
      orbs: d.orbs,
      mainOrbs: d.orbs.filter((o) => !o.bonus).length,
      secrets,
      tide: level.tide,
      durationMs: level.durationMs,
      boss: level.boss ? d.boss : null,
      route: d.route,
   };
}

/** The level's course (built once per level). */
export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** What the course can feed the flow meter: each orb, each first landing (the start excluded), each lever's first pull, each boss hit. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.supports.length - 1, base: COMBO_BASE_MS.block },
         { count: course.levers.length, base: COMBO_BASE_MS.lever },
         { count: course.boss ? UMBRA_ROLLER.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

// ---------- water: closed forms of rules time ----------

/** Each chamber's water: it moves from `fromY` (at `fromMs`) towards `target` at V_WATER. Shared by every hero of a multiplayer run. */
export interface WaterState {
   fromY: Float64Array;
   fromMs: Float64Array;
   target: Float64Array;
   /** 1 once the chamber reached its top level, 2 once it then drained to its bottom (the sunken secret) */
   cycle: Uint8Array;
}

export interface LeverState {
   pos: Int8Array;
   /** rules ms of the last pull (a pressure lever springs back after holdMs) */
   at: Float64Array;
}

export function createWater(course: Course): WaterState {
   const n = course.zones.length;
   const w: WaterState = { fromY: new Float64Array(n), fromMs: new Float64Array(n), target: new Float64Array(n), cycle: new Uint8Array(n) };
   course.zones.forEach((z, i) => {
      w.fromY[i] = z.levels[z.start];
      w.target[i] = z.levels[z.start];
   });
   return w;
}

export function createLeverState(course: Course): LeverState {
   const n = course.levers.length;
   return { pos: new Int8Array(n), at: new Float64Array(n).fill(NONE) };
}

/** Chamber `zi`'s water surface (m) at rules ms `ms`. */
export function zoneLevel(w: WaterState, zi: number, ms: number): number {
   const from = w.fromY[zi];
   const d = w.target[zi] - from;
   const travel = (V_WATER * Math.max(0, ms - w.fromMs[zi])) / 1000;
   if (d >= 0) return from + Math.min(d, travel);
   return from - Math.min(-d, travel);
}

function setTarget(w: WaterState, zi: number, y: number, ms: number): void {
   w.fromY[zi] = zoneLevel(w, zi, ms);
   w.fromMs[zi] = ms;
   w.target[zi] = y;
}

function inZone(z: Zone, x: number, zz: number): boolean {
   return x >= z.minX && x <= z.maxX && zz >= z.minZ && zz <= z.maxZ;
}

/** The chamber whose water covers (x, z) highest, NONE outside every chamber. */
export function zoneAt(course: Course, w: WaterState, x: number, z: number, ms: number): number {
   let best = NONE;
   let top = -Infinity;
   for (let i = 0; i < course.zones.length; i++) {
      if (!inZone(course.zones[i], x, z)) continue;
      const y = zoneLevel(w, i, ms);
      if (y > top) {
         top = y;
         best = i;
      }
   }
   return best;
}

/** The water surface over (x, z), -Infinity outside every chamber (or where the water is down at the floor). */
export function surfaceAt(course: Course, w: WaterState, x: number, z: number, ms: number): number {
   const zi = zoneAt(course, w, x, z, ms);
   if (zi === NONE) return -Infinity;
   const y = zoneLevel(w, zi, ms);
   return y > course.zones[zi].floor + 0.02 ? y : -Infinity;
}

/** A crate's top at `ms` (a stone block's top never moves). */
export function supportTop(course: Course, w: WaterState, s: Support, ms: number): number {
   if (s.float === NONE) return s.top;
   const y = zoneLevel(w, s.float, ms) + CRATE_LIFT;
   return Math.max(s.floatMin, Math.min(s.floatMax, y));
}

export function supportBottom(course: Course, w: WaterState, s: Support, ms: number): number {
   return s.float === NONE ? s.bottom : supportTop(course, w, s, ms) - 0.9;
}

/** The storm tide (m) at `ms`: -Infinity before it starts. */
export function tideY(run: { course: Course; tideFrom: number }, ms: number): number {
   if (run.tideFrom === NONE || ms < run.tideFrom) return -Infinity;
   const t = run.course.tide;
   return Math.min(t.maxY, t.y0 + (t.rate * (ms - run.tideFrom)) / 1000);
}

/** A steam jet is live this ms (the same fraction on every device). */
export function jetLive(j: Jet, ms: number): boolean {
   const t = ms / j.periodMs + j.phase;
   return t - Math.floor(t) < j.duty;
}

/** A smooth triangle wave in [-1, 1] (polynomials only: the same in every engine). */
function wave(t: number): number {
   const f = t - Math.floor(t);
   const tri = f < 0.5 ? 2 * f : 2 - 2 * f;
   return 2 * (tri * tri * (3 - 2 * tri)) - 1;
}

/** A bat's position (out) at `ms`, and whether it is swooping (its chamber's water is low). */
export function batPos(w: WaterState, bat: Bat, ms: number, out: Vec3Like): boolean {
   const active = zoneLevel(w, bat.zone, ms) < bat.dryBelow;
   if (!active) {
      out.x = bat.x;
      out.y = bat.y;
      out.z = bat.z;
      return false;
   }
   const t = ms / bat.periodMs + bat.phase;
   out.x = bat.x + bat.radius * wave(t);
   out.z = bat.z + bat.radius * wave(t + 0.25);
   out.y = bat.y - 1.4 - 0.6 * wave(t * 2);
   return true;
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

interface Rect {
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
}

/** The rectangle the feet can stand in on `s`, grown by FOOT. */
function standRect(s: Support): Rect {
   return { minX: s.cx - s.hw - FOOT, maxX: s.cx + s.hw + FOOT, minZ: s.cz - s.hd - FOOT, maxZ: s.cz + s.hd + FOOT };
}

function rectGap(a: Rect, b: Rect): number {
   const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
   const dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
   return Math.sqrt(dx * dx + dz * dz);
}

function rectPointGap(a: Rect, x: number, z: number): number {
   const dx = Math.max(0, a.minX - x, x - a.maxX);
   const dz = Math.max(0, a.minZ - z, z - a.maxZ);
   return Math.sqrt(dx * dx + dz * dz);
}

/** The shortest distance between two blocks' stand rectangles (0 when they touch or overlap). */
export function standGap(a: Support, b: Support): number {
   return rectGap(standRect(a), standRect(b));
}

/** The fastest a flight launched at `v` lands `dy` (> 0) above its launch: up through the apex and down to dy (s). */
export function riseLandS(v: number, dy: number): number {
   const h = (v * v) / (2 * G);
   if (dy >= h) return Infinity;
   return v / G + Math.sqrt((2 * (h - dy)) / G);
}

/** A block's lowest top (a crate's resting top): the height the direct edges launch from and land on. */
function nodeTop(s: Support): number {
   return s.float === NONE ? s.top : s.floatMin;
}

/**
 * The least ms of a direct move from standing on `a` to standing on `b`: max(the horizontal bound,
 * the rise bound of a jump from a's top). Infinity when a jump cannot reach. Ground time counts as 0.
 */
export function edgeMinMs(course: Course, from: number, to: number, vRun = V_RUN): number {
   const a = course.supports[from];
   const b = course.supports[to];
   const gap = standGap(a, b);
   // a flight cannot carry the hero further than it stays above b's top (double jump and dash included)
   if (gap > reachAbove(a, nodeTop(b), vRun)) return Infinity;
   const flat = (1000 * gap) / vRun;
   const dy = nodeTop(b) - nodeTop(a);
   if (dy <= 0) return flat;
   const vertical = riseLandS(V_JUMP, dy);
   if (!Number.isFinite(vertical)) return Infinity;
   return Math.max(flat, 1000 * vertical);
}

/**
 * The least ms by which chamber `zi`'s water can stand at `h` or higher (`leverArr`: each lever's
 * least pull ms): never above its highest lever target; at once if it starts that high; otherwise it
 * only moves once a lever acting on it is pulled, at V_WATER from its start level, and passing h also
 * needs a lever whose target is >= h, after which it still has to rise from the highest lower target.
 */
export function waterReadyMs(course: Course, leverArr: readonly number[], zi: number, h: number): number {
   const zone = course.zones[zi];
   const init = zone.levels[zone.start];
   if (h <= init) return 0;
   let anyPull = Infinity;
   let highPull = Infinity;
   for (let li = 0; li < course.levers.length; li++) {
      let acts = false;
      let high = false;
      for (const effects of course.levers[li].effects) {
         for (const [z, level] of effects) {
            if (z !== zi) continue;
            acts = true;
            if (zone.levels[level] >= h) high = true;
         }
      }
      if (!acts) continue;
      anyPull = Math.min(anyPull, leverArr[li]);
      if (high) highPull = Math.min(highPull, leverArr[li]);
   }
   if (!Number.isFinite(highPull)) return Infinity;
   // before the first pull of a lever with a target >= h, every target in force is under h, so the
   // water stands at most at the highest of those (or its start); from there it rises at V_WATER
   let low = init;
   for (const l of course.levers) for (const effects of l.effects) for (const [z, level] of effects) if (z === zi && zone.levels[level] < h) low = Math.max(low, zone.levels[level]);
   return Math.max(highPull + (1000 * (h - low)) / V_WATER, anyPull + (1000 * (h - init)) / V_WATER);
}

/** The strip just outside a chamber's rectangle that the hero's centre has to cross to get in (> 2 hero radii). */
export const SEAL_STRIP = 0.75;

/** A cell of a chamber's boundary strip and the height the hero must be at to pass it (the top of the stone over it, -Infinity if open). */
export interface SealCell {
   rect: Rect;
   top: number;
}

/**
 * The boundary of chamber `zi`, cut into cells by every block edge: each cell's centre is inside a
 * stone block that is always solid (not cracked brick, not a ghost panel, not a crate) and reaches
 * down to the chamber's floor, so a hero can only pass that cell above the block's top. A cell no
 * such block covers is open (-Infinity). This is how the proof sees the chambers' walls.
 */
export function sealCells(course: Course, zi: number): SealCell[] {
   const z = course.zones[zi];
   const D = SEAL_STRIP;
   const outer = { minX: z.minX - D, maxX: z.maxX + D, minZ: z.minZ - D, maxZ: z.maxZ + D };
   const xs = new Set<number>([outer.minX, z.minX, z.maxX, outer.maxX]);
   const zs = new Set<number>([outer.minZ, z.minZ, z.maxZ, outer.maxZ]);
   const walls = course.supports.filter((s) => !s.crack && !s.ghost && s.float === NONE && s.bottom <= z.floor + 1e-6);
   for (const s of walls) {
      for (const x of [s.cx - s.hw, s.cx + s.hw]) if (x > outer.minX && x < outer.maxX) xs.add(x);
      for (const zz of [s.cz - s.hd, s.cz + s.hd]) if (zz > outer.minZ && zz < outer.maxZ) zs.add(zz);
   }
   const X = [...xs].sort((p, q) => p - q);
   const Z = [...zs].sort((p, q) => p - q);
   const cells: SealCell[] = [];
   for (let i = 0; i + 1 < X.length; i++) {
      for (let j = 0; j + 1 < Z.length; j++) {
         const cx = (X[i] + X[i + 1]) / 2;
         const cz = (Z[j] + Z[j + 1]) / 2;
         if (cx > z.minX && cx < z.maxX && cz > z.minZ && cz < z.maxZ) continue; // inside the chamber
         let top = -Infinity;
         for (const s of walls) if (Math.abs(cx - s.cx) < s.hw && Math.abs(cz - s.cz) < s.hd && s.top > top) top = s.top;
         cells.push({ rect: { minX: X[i], maxX: X[i + 1], minZ: Z[j], maxZ: Z[j + 1] }, top });
      }
   }
   return cells;
}

const SEALS = new WeakMap<Course, SealCell[][]>();
function sealsOf(course: Course): SealCell[][] {
   let v = SEALS.get(course);
   if (!v) {
      v = course.zones.map((_z, zi) => sealCells(course, zi));
      SEALS.set(course, v);
   }
   return v;
}

/**
 * How far (m) a hero can travel from block `a` while staying at or above height `h`: a jump from its
 * top, the fall back to h, and (for safety, any hero) a mid-air double jump at h back to the apex and
 * a dash. -Infinity when a jump from a never gets that high.
 */
function reachAbove(a: Support, h: number, vRun: number): number {
   const apex = nodeTop(a) + H_JUMP;
   if (h > apex) return -Infinity;
   const t = V_JUMP / G + 3 * Math.sqrt((2 * (apex - h)) / G);
   return vRun * t + ((POWER_MS.dash + 1) / 1000) * (V_DASH - V_RUN);
}

/** Per chamber, per boundary cell: the least ms the hero can cross that cell into the chamber (proof step 5). */
interface Entry {
   /** cells[zi][k]: crossing cell k of chamber zi from outside */
   cells: number[][];
}

/**
 * The least ms the hero can be in chamber `zi` at a point of rectangle `r`: through one of its
 * boundary cells and on from there (the last time it came in from outside), or from a checkpoint in
 * the chamber it started or respawned on (`skip` is left out: a block's own arrival cannot bound itself).
 */
function zoneReachMs(course: Course, arr: readonly number[], T: Float64Array, entry: Entry, zi: number, r: Rect, vRun: number, skip = NONE): number {
   const zr = course.zones[zi];
   let best = Infinity;
   const cells = sealsOf(course)[zi];
   const into = entry.cells[zi];
   for (let k = 0; k < cells.length; k++) {
      if (!Number.isFinite(into[k])) continue;
      const t = into[k] + (1000 * rectGap(cells[k].rect, r)) / vRun;
      if (t < best) best = t;
   }
   // a respawn (or the start) on a checkpoint in the chamber: from there
   for (const a of course.checkpoints) {
      if (a === skip || !Number.isFinite(arr[a])) continue;
      const ra = standRect(course.supports[a]);
      if (rectGap(ra, zr) > 0) continue;
      const t = arr[a] + (1000 * rectGap(ra, r)) / vRun;
      if (t < best) best = t;
   }
   void T;
   return best;
}

/** Is block `s` wholly inside chamber `z` (the hero on it is in the chamber already)? */
function wholly(s: Support, z: Zone): boolean {
   return s.cx - s.hw >= z.minX - 1e-9 && s.cx + s.hw <= z.maxX + 1e-9 && s.cz - s.hd >= z.minZ - 1e-9 && s.cz + s.hd <= z.maxZ + 1e-9;
}

/**
 * The least ms the hero can cross cell k of chamber zi from outside: at least as high as the stone
 * there (open cells: any height), from a block outside whose jump gets that high and reaches that far,
 * or from another chamber's water once it can be high enough.
 */
function cellEntryMs(course: Course, arr: readonly number[], T: Float64Array, leverArr: readonly number[], entry: Entry, zi: number, k: number, vRun: number): number {
   const cell = sealsOf(course)[zi][k];
   let best = Infinity;
   for (let a = 0; a < arr.length; a++) {
      if (!Number.isFinite(arr[a])) continue;
      const s = course.supports[a];
      if (wholly(s, course.zones[zi])) continue; // a source outside the chamber
      const gap = rectGap(standRect(s), cell.rect);
      if (cell.top > -Infinity && gap > reachAbove(s, cell.top, vRun)) continue;
      const t = arr[a] + (1000 * gap) / vRun;
      if (t < best) best = t;
   }
   for (let yi = 0; yi < course.zones.length; yi++) {
      if (yi === zi) continue;
      const ready = cell.top > -Infinity ? waterReadyMs(course, leverArr, yi, cell.top - WATER_REACH) : 0;
      if (!Number.isFinite(ready)) continue;
      const t = Math.max(ready + (1000 * rectGap(course.zones[yi], cell.rect)) / vRun, zoneReachMs(course, arr, T, entry, yi, cell.rect, vRun));
      if (t < best) best = t;
   }
   return best;
}

/**
 * Arrival on `b` from the water: the last launch was from a chamber's water (or a crate in it), so it
 * lands no higher than that chamber's surface + WATER_REACH, and only once the hero was in the
 * chamber near enough: at least ready + the flight from the chamber, and at least the time to be in
 * the chamber at b. The least over the chambers (Infinity when no chamber's water is ever that high).
 */
function waterTermMs(course: Course, arr: readonly number[], T: Float64Array, leverArr: readonly number[], entry: Entry, bi: number, vRun: number): number {
   const rb = standRect(course.supports[bi]);
   let water = Infinity;
   for (let zi = 0; zi < course.zones.length; zi++) {
      const ready = waterReadyMs(course, leverArr, zi, nodeTop(course.supports[bi]) - WATER_REACH);
      if (!Number.isFinite(ready)) continue;
      const t = Math.max(ready + (1000 * rectGap(course.zones[zi], rb)) / vRun, zoneReachMs(course, arr, T, entry, zi, rb, vRun, bi));
      if (t < water) water = t;
   }
   return water;
}

/** The least ms to be at (x, z) within `reach`, from the relaxation's states (the block before counts too). */
function arrPointStates(course: Course, T: Float64Array, arr: readonly number[], x: number, z: number, reach: number, vRun: number): number {
   const n = course.supports.length;
   let best = Infinity;
   for (let b = 0; b < n; b++) {
      const gb = (1000 * Math.max(0, rectPointGap(standRect(course.supports[b]), x, z) - reach)) / vRun;
      for (let a = 0; a <= n; a++) {
         const t0 = T[a * n + b];
         if (!Number.isFinite(t0)) continue;
         let t = t0 + gb;
         if (a < n) {
            const line = arr[a] + (1000 * Math.max(0, rectPointGap(standRect(course.supports[a]), x, z) - reach)) / vRun;
            if (line > t) t = line;
         }
         if (t < best) best = t;
      }
   }
   return best;
}

/**
 * The least ms to stand on each block (Infinity = never), README proof step 5. A relaxation over
 * "standing on b, having last stood on a" (a = NONE after a respawn), so the ground time across a
 * block counts: a hero that stood on a, then b, then lands on c needs at least the move b -> c (a
 * jump, or the water) after T(a, b), AND the straight line from a's rectangle to c's. The chambers'
 * walls count through their sealed boundary cells (a block wholly inside a chamber is reached only
 * after getting into the chamber), and the water only lifts once a lever let it rise. Iterated from
 * the start until nothing improves (the least fixed point of these lower bounds, so every real run is
 * at or above it). `vRun` is the horizontal cap.
 */
export function minArrivalMs(course: Course, vRun = V_RUN): number[] {
   return relax(course, vRun).arr;
}

function relax(course: Course, vRun: number): { arr: number[]; T: Float64Array } {
   const n = course.supports.length;
   const P = n + 1; // predecessor index n = none
   const T = new Float64Array(P * n).fill(Infinity);
   const arr = new Array<number>(n).fill(Infinity);
   const start = course.checkpoints[0];
   T[n * n + start] = 0;
   arr[start] = 0;
   const edges = new Float64Array(n * n);
   const gaps = new Float64Array(n * n);
   const rects = course.supports.map(standRect);
   for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
         edges[x * n + y] = x === y ? Infinity : edgeMinMs(course, x, y, vRun);
         gaps[x * n + y] = (1000 * rectGap(rects[x], rects[y])) / vRun;
      }
   }
   const seals = sealsOf(course);
   const entry: Entry = { cells: seals.map((cells) => cells.map(() => Infinity)) };
   // blocks lying wholly inside a chamber: the hero stands on one only once he is in the chamber there
   const inside: number[][] = course.supports.map((s) => {
      const out: number[] = [];
      course.zones.forEach((z, zi) => {
         if (wholly(s, z)) out.push(zi);
      });
      return out;
   });
   const leverArr = new Array<number>(course.levers.length).fill(Infinity);
   const water = new Float64Array(n);
   const entered = new Float64Array(n);
   for (let round = 0; round < 40 * n + 40; round++) {
      let changed = false;
      for (let li = 0; li < leverArr.length; li++) {
         const l = course.levers[li];
         leverArr[li] = arrPointStates(course, T, arr, l.x, l.z, LEVER_R, vRun);
      }
      for (let zi = 0; zi < seals.length; zi++) {
         for (let k = 0; k < seals[zi].length; k++) {
            const t = cellEntryMs(course, arr, T, leverArr, entry, zi, k, vRun);
            if (t < entry.cells[zi][k] - 1e-9) {
               entry.cells[zi][k] = t;
               changed = true;
            }
         }
      }
      for (let c = 0; c < n; c++) {
         water[c] = waterTermMs(course, arr, T, leverArr, entry, c, vRun);
         let e = -Infinity;
         for (const zi of inside[c]) e = Math.max(e, zoneReachMs(course, arr, T, entry, zi, rects[c], vRun, c));
         entered[c] = e;
      }
      // respawns on a checkpoint forget the block before
      for (const c of course.checkpoints) {
         if (arr[c] < T[n * n + c] - 1e-9) {
            T[n * n + c] = arr[c];
            changed = true;
         }
      }
      for (let a = 0; a < P; a++) {
         for (let bb = 0; bb < n; bb++) {
            const tab = T[a * n + bb];
            if (!Number.isFinite(tab)) continue;
            const tailA = a < n ? arr[a] : -Infinity;
            for (let c = 0; c < n; c++) {
               if (c === bb) continue;
               // b -> c: a direct move, or through the water (entered after standing on b)
               let t = tab + edges[bb * n + c];
               const viaWater = Math.max(tab + gaps[bb * n + c], water[c]);
               if (viaWater < t) t = viaWater;
               if (!Number.isFinite(t)) continue;
               // and the straight line from the block before b, and into c's chamber first
               if (a < n && a !== c) {
                  const line = tailA + gaps[a * n + c];
                  if (line > t) t = line;
               }
               if (entered[c] > t) t = entered[c];
               if (t < T[bb * n + c] - 1e-9) {
                  T[bb * n + c] = t;
                  changed = true;
               }
            }
         }
      }
      for (let c = 0; c < n; c++) {
         let best = arr[c];
         for (let a = 0; a < P; a++) if (T[a * n + c] < best) best = T[a * n + c];
         arr[c] = best;
      }
      if (!changed) return { arr, T };
   }
   throw new Error("flooded-ruins minArrivalMs did not settle");
}

/**
 * The least ms the boss can be beaten by (level 5), with each phase's hit at the first ms of a
 * vulnerable window that is also no earlier than the hero can be there: the stuck spot with the ring
 * flooded (phase 1), the drain with every pressure lever pulled (phase 2), the floodgate lever (phase 3).
 * The boss's timeline only depends on when it is hit, and a later hit only delays the rest.
 */
export function bossDefeatMinMs(course: Course, vRun = V_RUN): number {
   const arena = course.boss;
   if (!arena) return 0;
   const { arr, T } = relax(course, vRun);
   const at = (x: number, z: number, reach: number) => arrPointStates(course, T, arr, x, z, reach, vRun);
   const leverArr = course.levers.map((l) => at(l.x, l.z, LEVER_R));
   const end1 = arena.rollPath[arena.rollPath.length - 1];
   const p1 = Math.max(at(end1[0], end1[2], BOSS_R + 0.4), waterReadyMs(course, leverArr, arena.ring, arena.ringLevel));
   let p2 = at(arena.drain[0], arena.drain[2], BOSS_R + 0.6);
   for (const li of arena.pressure) p2 = Math.max(p2, leverArr[li]);
   const p3 = leverArr[arena.gateLever];
   const earliest = [p1, p2, p3];
   if (!earliest.every(Number.isFinite)) return Infinity;
   const cfg = UMBRA_ROLLER;
   const s = createBoss(cfg);
   const ev = createBossEvents();
   for (let ms = 1; ms < 3_600_000; ms++) {
      stepBoss(s, cfg, 1, ev);
      if (s.step === "vulnerable" && ms >= earliest[Math.min(2, s.phase)]) {
         if (hitBoss(s, cfg, 1, ev) === "defeated") return ms;
      }
   }
   return Infinity;
}

/** The proven least finish ms of a course (README proof steps 4-6). */
export function minFinishMs(course: Course, vRun = V_RUN): number {
   let t = minArrivalMs(course, vRun)[course.goal];
   if (course.boss) {
      const lever = course.levers[course.boss.gateLever];
      const away = (1000 * Math.max(0, rectPointGap(standRect(course.supports[course.goal]), lever.x, lever.z) - LEVER_R)) / vRun;
      t = Math.max(t, bossDefeatMinMs(course, vRun) + away);
   }
   return t;
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus. */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

// ---------- limits per level (README "Server limits"; meta.ts and arcade-games.json copy these) ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/**
 * The least submitted duration with Riko's dashes: a dash is on for at most POWER_MS.dash + 1 ms at
 * V_DASH, so it saves at most (POWER_MS.dash + 1) (V_DASH - V_RUN) / V_RUN ms of the bound's
 * horizontal terms; a run that finishes at T fired at most 1 + floor(T / cooldown) dashes. The least
 * such T, less every orb's bonus and the most flow bonus.
 */
export function dashFloorMs(course: Course): number {
   const F = minFinishMs(course);
   const perDash = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
   const cooldown = heroById("riko").cooldownMs;
   let T = 0;
   while (T + perDash * (1 + Math.floor(T / cooldown)) < F) T += 1;
   return T - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

/**
 * minDurationMs = the bound less about 4.5 %, rounded down to 100 ms, still inside 94-100 % of the
 * bound, and never above Riko's dashed floor. The level's timer is timeBaseMs and maxDurationMs.
 */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   minDurationMs = Math.min(minDurationMs, Math.floor(dashFloorMs(course) / 100) * 100);
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}

// ---------- the run ----------

export type HeroState = "play" | "lost" | "spawn";
export type LossCause = "fall" | "tide" | "air" | "jet" | "bat" | "whirl" | "boss";

export interface Hero extends Vec3Like {
   /** feet centre: x right, y up (feet), z forward = -z */
   x: number;
   y: number;
   z: number;
   /** the stick's velocity (m/s), eased towards V_RUN (or V_SWIM) · stick */
   vx: number;
   vz: number;
   /** the swim's vertical speed (m/s); in the air the arc's */
   vy: number;
   state: HeroState;
   grounded: boolean;
   /** in a chamber's water */
   swim: boolean;
   /** the block stood on (on land, or on a flooded floor while swimming), NONE otherwise */
   support: number;
   /** the current arc in the air: y = arcY0 + arcV · t - G t² / 2, t = (ms - arcStart) / 1000 */
   arcStart: number;
   arcY0: number;
   arcV: number;
   /** the ms of the walk-off (coyote time runs from it), NONE otherwise */
   coyoteFrom: number;
   /** the top of the last block stood on, or the last swim height (the fall line is FALL_DEPTH under it) */
   lastTop: number;
   /** ms left in "lost" or "spawn" */
   timerMs: number;
   /** dash is on through this rules ms (NONE = off); dashX/Z is a unit vector */
   dashUntil: number;
   dashX: number;
   dashZ: number;
   /** Nami's extra jump is still available this flight */
   airJump: boolean;
   /** feet may not go above this on the current flight (a double jump cannot add reach) */
   apexCap: number;
   /** Kiro / Zuno / Vexa: the power is on through this rules ms (NONE = off) */
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** the air meter (ms of breath left) */
   air: number;
   /** why the hero was lost (the last loss) */
   lostCause: LossCause;
}

/** One frame of input. Scene fills one object per run and passes it every step. */
export interface StepInput {
   /**
    * The stick (moveX right, moveZ down the screen = the core's moveY), turned into the world by the
    * camera's `yaw` (core inputToWorld): with yaw 0 (today's camera behind the hero) up is -z, so a
    * stick given in world space with yaw 0 is used as is (the bots). Length <= 1 (longer is normalised).
    */
   moveX: number;
   moveZ: number;
   /** the camera's yaw (radians, 0 = behind the hero looking down -z): the stick is camera-relative */
   yaw: number;
   /** a jump press this frame (keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   /** Jump is held (swim up): the core's held `jump`, the same on touch and keyboard */
   jumpHeld: boolean;
   /** the hero power (E/Enter or the touch Power button), one press latched at the frame's first ms */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

/** What happened in one step. The same object every step, reset at its start. */
export interface StepEvents {
   jumped: boolean;
   /** a leap out of the water (a jump from the surface) */
   leapt: boolean;
   /** Nami's breach jump */
   breached: boolean;
   /** the hero went into the water */
   splash: boolean;
   landed: boolean;
   /** the block of the latest landing in this step, NONE without one */
   landedOn: number;
   /** the landing's fall speed (m/s) */
   landSpeed: number;
   /** a checkpoint (1..) activated in this step, NONE otherwise */
   checkpoint: number;
   /** orbs collected in this step: their indices in orbList[0..orbCount) */
   orbCount: number;
   orbList: number[];
   lost: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   /** the tide covered the checkpoint: the run ends unranked */
   flooded: boolean;
   /** a hero power actually fired this step (a press on cooldown does not) */
   powered: boolean;
   /** flow bonus (ms) paid in this step, and whether a link was added */
   comboBonus: number;
   comboLinked: boolean;
   /** secrets found in this step: their indices in secretList[0..secretCount) */
   secretCount: number;
   secretList: number[];
   /** a lever pulled in this step (NONE otherwise), and its new position */
   lever: number;
   leverPos: number;
   /** a cracked block Riko broke in this step, NONE otherwise */
   broke: number;
   /** the air meter refilled in a bubble column this step (from under 70 %) */
   bubbles: boolean;
   /** the tide started this step */
   tideStarted: boolean;
   /** the boss took a hit, was beaten, or changed phase this step */
   bossHit: boolean;
   bossDefeated: boolean;
   bossPhase: boolean;
   /** the boss's own events this step (telegraph, attack, vulnerable ...) */
   boss: BossEvents;
}

/** Where the boss is and what it is doing (rules.ts bossPose); the Scene draws it from this. */
export interface BossPose {
   x: number;
   y: number;
   z: number;
   /** idle, telegraph, roll (harmful), float (stompable), stuck (dry: harmful), drain, geyser (hittable), chase (harmful), gate, beaten */
   mode: "idle" | "telegraph" | "roll" | "float" | "stuck" | "drain" | "geyser" | "chase" | "gate" | "beaten";
}

export interface RuinRun {
   course: Course;
   level: LevelId;
   /** which Color Roll Hero this run plays (Riko unless createRun was given another) */
   heroId: HeroId;
   /** the seed: the course is fixed (a time leaderboard must be the same race for everyone); the Scene's decor uses it */
   seed: number;
   /** whole ms of play since "Go" */
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   /** the first ms of the frame with the latest jump press (the buffer runs from it), NONE */
   pressMs: number;
   jumpHeld: boolean;
   /** the ms a power press is applied, NONE if this frame had none. Cooldown is powerReadyAt. */
   actionMs: number;
   /** the power can fire again at this rules ms (0 = ready at the start) */
   powerReadyAt: number;
   /** the active checkpoint: 0 (the start) and up; respawns go to its block */
   checkpoint: number;
   respawns: number;
   /** 1 = collected, per course.orbs (shared in multiplayer) */
   collected: Uint8Array;
   orbs: number;
   /** orbs that are not bonus orbs (the all-orbs star) */
   mainOrbs: number;
   finishMs: number;
   /** the flow meter (menu2/combo): combo.bonusTotal ms come off the submitted time */
   combo: ComboState;
   /** 1 = landed on this block before (a first landing is a flow link) */
   visited: Uint8Array;
   /** 1 = this hero pulled the lever before (the first pull is a flow link) */
   pulled: Uint8Array;
   /** 1 = the lever can be pulled (the hero stepped away since the last pull) */
   armed: Uint8Array;
   /** the level's secrets found (progression.ts SECRETS order) */
   secrets: SecretTracker;
   /** losses taken (0 = the no-hit badge: never touched by the tide, a jet, a bat or the boss, never drowned, never fell) */
   hits: number;
   /** the highest top stood on (HUD "height") */
   bestTop: number;
   /** the tide's start (rules ms), NONE before it starts */
   tideFrom: number;
   /** the chambers' water, the levers and the broken bricks: shared by every hero of a multiplayer run */
   water: WaterState;
   levers: LeverState;
   broken: Uint8Array;
   /** level 5: the boss (shared in multiplayer; only the owner steps it) */
   boss: BossState | null;
   bossOwner: boolean;
   bossPose: BossPose;
   ended: "win" | "timeup" | "flood" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   const orbList = new Array<number>(48);
   for (let i = 0; i < orbList.length; i++) orbList[i] = 0;
   return {
      jumped: false,
      leapt: false,
      breached: false,
      splash: false,
      landed: false,
      landedOn: NONE,
      landSpeed: 0,
      checkpoint: NONE,
      orbCount: 0,
      orbList,
      lost: false,
      respawned: false,
      finished: false,
      timeup: false,
      flooded: false,
      powered: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      lever: NONE,
      leverPos: 0,
      broke: NONE,
      bubbles: false,
      tideStarted: false,
      bossHit: false,
      bossDefeated: false,
      bossPhase: false,
      boss: createBossEvents(),
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.leapt = false;
   ev.breached = false;
   ev.splash = false;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.landSpeed = 0;
   ev.checkpoint = NONE;
   ev.orbCount = 0;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.flooded = false;
   ev.powered = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.lever = NONE;
   ev.leverPos = 0;
   ev.broke = NONE;
   ev.bubbles = false;
   ev.tideStarted = false;
   ev.bossHit = false;
   ev.bossDefeated = false;
   ev.bossPhase = false;
   const b = ev.boss;
   b.telegraph = b.attack = b.vulnerable = b.recovered = b.phaseChanged = b.defeated = b.done = false;
}

/** Proposed server limits, one row per level, from that level's course. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

/** Level 1's row (the same object meta.ts ships as scoring). */
export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];

function freshHero(x: number, y: number, z: number, support: number): Hero {
   return {
      x,
      y,
      z,
      vx: 0,
      vz: 0,
      vy: 0,
      state: "play",
      grounded: true,
      swim: false,
      support,
      arcStart: 0,
      arcY0: y,
      arcV: 0,
      coyoteFrom: NONE,
      lastTop: y,
      timerMs: 0,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      airJump: true,
      apexCap: y + H_JUMP,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      air: AIR_MS,
      lostCause: "fall",
   };
}

/**
 * A new run on the start block: at rest, grounded (the countdown is the start freeze). Allocates
 * everything the run will ever use. `heroId` defaults to Nami (World 2's lead hero); the Scene passes the overlay's pick.
 * The power is ready at the start and its cooldown resets each run.
 */
export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): RuinRun {
   const course = courseFor(level);
   const start = course.supports[course.checkpoints[0]];
   const tide = course.tide;
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(start.cx, start.top, start.cz + Math.min(1.5, start.hd * 0.5), course.checkpoints[0]),
      pressMs: NONE,
      jumpHeld: false,
      actionMs: NONE,
      powerReadyAt: 0,
      checkpoint: 0,
      respawns: 0,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      finishMs: 0,
      combo: createCombo(),
      visited: new Uint8Array(course.supports.length),
      pulled: new Uint8Array(course.levers.length),
      armed: new Uint8Array(course.levers.length).fill(1),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      bestTop: start.top,
      tideFrom: tide.startCheckpoint === -1 ? tide.delayMs : tide.startCheckpoint === 0 ? 0 : NONE,
      water: createWater(course),
      levers: createLeverState(course),
      broken: new Uint8Array(course.supports.length),
      boss: course.boss ? createBoss(UMBRA_ROLLER) : null,
      bossOwner: true,
      bossPose: { x: 0, y: 0, z: 0, mode: "idle" },
      ended: null,
      events: createEvents(),
   };
}

/** The feet height of the hero's current arc at rules ms `ms`. */
export function arcY(h: Hero, ms: number): number {
   const t = (ms - h.arcStart) / 1000;
   return h.arcY0 + h.arcV * t - (G / 2) * t * t;
}

/** The arc's vertical speed (m/s) at `ms`. */
export function arcVy(h: Hero, ms: number): number {
   return h.arcV - (G * (ms - h.arcStart)) / 1000;
}

function startArc(h: Hero, ms: number, y0: number, v: number): void {
   const keep = h.apexCap;
   h.arcStart = ms;
   h.arcY0 = y0;
   h.arcV = v;
   h.y = y0;
   h.vy = v;
   h.grounded = false;
   h.swim = false;
   h.support = NONE;
   if (v > 0) h.apexCap = y0 + (v * v) / (2 * G);
   else h.apexCap = keep;
}

/** Shield or phase is up: jets, bats, whirlpools and the boss's roll do not touch the hero (the tide does). */
function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

/** Is block `i` solid for this hero at `ms`: not broken, and not a ghost panel while Vexa phases. */
function solid(run: RuinRun, i: number, ms: number): boolean {
   const s = run.course.supports[i];
   if (s.crack && run.broken[i]) return false;
   if (s.ghost && ms <= run.hero.phaseUntil) return false;
   return true;
}

/**
 * Nami's second jump in the air. Its apex is capped at the flight's existing apexCap, so it cannot
 * reach a block a single jump (or the leap that started the flight) could not already reach.
 */
function tryDoubleJump(run: RuinRun, ms: number): boolean {
   const h = run.hero;
   if (h.grounded || h.swim || !h.airJump) return false;
   const y = h.y;
   const cap = h.apexCap;
   if (!(y < cap - 0.04)) return false;
   const v = Math.min(V_JUMP, Math.sqrt(Math.max(0, 2 * G * (cap - y))));
   if (!(v >= 1)) return false;
   startArc(h, ms, y, v);
   h.apexCap = cap;
   h.airJump = false;
   return true;
}

/** At the surface: within SURFACE_REACH of the floating height. */
function atSurface(h: Hero, surface: number): boolean {
   return h.y >= surface - FLOAT_DEPTH - SURFACE_REACH;
}

/** Fire the run's hero power if it is off cooldown. A press that cannot fire does not start the cooldown. */
function tryPower(run: RuinRun, ms: number, mx: number, mz: number, surface: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   const ev = run.events;
   if (def.power === "dash") {
      let dx = mx;
      let dz = mz;
      let len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.25) {
         dx = h.vx;
         dz = h.vz;
         len = Math.sqrt(dx * dx + dz * dz);
      }
      if (len < 0.25) {
         dx = 0;
         dz = -1;
         len = 1;
      }
      h.dashX = dx / len;
      h.dashZ = dz / len;
      h.dashUntil = ms + POWER_MS.dash;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      return;
   }
   if (def.power === "doubleJump") {
      // in the water: the breach jump (only from the surface); in the air: the capped double jump
      if (h.swim) {
         if (!atSurface(h, surface)) return;
         startArc(h, ms, h.y, V_BREACH);
         h.coyoteFrom = NONE;
         ev.breached = true;
         ev.jumped = true;
      } else if (!tryDoubleJump(run, ms)) return;
      else ev.jumped = true;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      return;
   }
   if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** The whole ms to simulate for a frame of `dtMs` (clamped to MAX_STEP_MS), the fraction carried. */
export function advanceClock(run: RuinRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const STICK = { x: 0, z: 0 };

/**
 * One frame: `dtMs` is useRunFrame's dt · 1000. Each whole ms: simMs += 1; the ms that reaches the
 * cap ends with "timeup"; else the world and the hero act. A finish, a time-up or the tide over the
 * checkpoint ends the step, and every later step does nothing. Returns run.events. Allocates nothing.
 */
export function step(run: RuinRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   run.jumpHeld = !!input.jumpHeld;
   inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw ?? 0), STICK);
   let mx = STICK.x;
   let mz = STICK.z;
   const len = Math.sqrt(mx * mx + mz * mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= run.course.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, mx, mz);
      if (run.ended !== null) return ev;
   }
   return ev;
}

/** The world's own ms: pressure levers spring back, the chambers' flood cycle, the boss. */
function worldMs(run: RuinRun, ms: number): void {
   const course = run.course;
   const lv = run.levers;
   for (let i = 0; i < course.levers.length; i++) {
      const l = course.levers[i];
      if (l.holdMs > 0 && lv.pos[i] !== 0 && ms >= lv.at[i] + l.holdMs) {
         lv.pos[i] = 0;
         for (const [zi, level] of l.effects[0]) setTarget(run.water, zi, course.zones[zi].levels[level], ms);
      }
   }
   const w = run.water;
   for (let zi = 0; zi < course.zones.length; zi++) {
      const z = course.zones[zi];
      const y = zoneLevel(w, zi, ms);
      const top = z.levels[z.levels.length - 1];
      const low = z.levels[0];
      if (w.cycle[zi] === 0 && y >= top - 0.05 && top > low) w.cycle[zi] = 1;
      else if (w.cycle[zi] === 1 && y <= low + 0.05) w.cycle[zi] = 2;
   }
   if (run.boss && run.bossOwner) {
      const ev = run.events.boss;
      const before = run.boss.phase;
      stepBoss(run.boss, UMBRA_ROLLER, 1, ev);
      if (ev.phaseChanged || run.boss.phase !== before) run.events.bossPhase = true;
   }
   if (run.boss) {
      bossPose(run, ms, run.bossPose);
      // the storm tide of phase 3 starts with the phase
      if (course.tide.startCheckpoint === -2 && run.tideFrom === NONE && run.boss.phase >= 2) {
         run.tideFrom = ms;
         run.events.tideStarted = true;
      }
   }
}

function tick(run: RuinRun, mx: number, mz: number): void {
   const h = run.hero;
   worldMs(run, run.simMs);
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      // keep falling out of view (looks only: nothing collides)
      if (!h.swim) h.y = arcY(h, run.simMs);
      if (h.timerMs <= 0) respawn(run);
      return;
   }
   if (h.state === "spawn") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      if (h.timerMs <= 0) h.state = "play";
      return;
   }
   playMs(run, mx, mz);
}

// collision scratch (module-level: step() never yields)
const SCRATCH_P: Vec3Like = { x: 0, y: 0, z: 0 };
const SCRATCH_BOX: AABB = { min: { x: 0, y: -1000, z: 0 }, max: { x: 0, y: 1000, z: 0 } };
const SCRATCH_V: Vec3Like = { x: 0, y: 0, z: 0 };

function supportBox(s: Support): AABB {
   SCRATCH_BOX.min.x = s.cx - s.hw;
   SCRATCH_BOX.max.x = s.cx + s.hw;
   SCRATCH_BOX.min.z = s.cz - s.hd;
   SCRATCH_BOX.max.z = s.cz + s.hd;
   return SCRATCH_BOX;
}

/** Is (x, z) over the block's top (its rectangle grown by FOOT)? */
export function onSupport(s: Support, x: number, z: number): boolean {
   return Math.abs(x - s.cx) <= s.hw + FOOT && Math.abs(z - s.cz) <= s.hd + FOOT;
}

/** Pushes the hero out of every solid block its body overlaps; a dashing Riko breaks cracked brick instead. Returns a broken block or NONE. */
function sideCollisions(run: RuinRun, ms: number): number {
   const course = run.course;
   const h = run.hero;
   const feet = h.y;
   const head = h.y + HERO.height;
   const supports = course.supports;
   let broke = NONE;
   for (let i = 0; i < supports.length; i++) {
      if (!solid(run, i, ms)) continue;
      const s = supports[i];
      const top = supportTop(course, run.water, s, ms);
      const bottom = supportBottom(course, run.water, s, ms);
      if (!(feet < top - 1e-9 && head > bottom)) continue;
      SCRATCH_P.x = h.x;
      SCRATCH_P.y = 0;
      SCRATCH_P.z = h.z;
      const box = supportBox(s);
      resolveSphereAabb(SCRATCH_P, HERO.radius, box, SCRATCH_P);
      if (SCRATCH_P.x === h.x && SCRATCH_P.z === h.z) continue;
      if (s.crack && h.dashUntil >= ms) {
         run.broken[i] = 1;
         broke = i;
         continue;
      }
      h.x = SCRATCH_P.x;
      h.z = SCRATCH_P.z;
   }
   return broke;
}

/** Is the hero's centre inside a solid block at a height that collides (the progress guard's fallback)? */
function insideSolid(run: RuinRun, x: number, z: number, feet: number, ms: number): boolean {
   const course = run.course;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      if (!solid(run, i, ms)) continue;
      const s = supports[i];
      if (!(feet < supportTop(course, run.water, s, ms) - 1e-9 && feet + HERO.height > supportBottom(course, run.water, s, ms))) continue;
      if (Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd) return true;
   }
   return false;
}

/** The highest block whose top the feet crossed downwards this ms with the centre over it. */
function landingSupport(run: RuinRun, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   const course = run.course;
   let best = NONE;
   let bestTop = -Infinity;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!onSupport(s, x, z) || !solid(run, i, ms)) continue;
      const now = supportTop(course, run.water, s, ms);
      const prev = s.float === NONE ? now : supportTop(course, run.water, s, ms - 1);
      if (!(yOld >= prev - 1e-9 && now > yNew)) continue;
      if (now > bestTop) {
         bestTop = now;
         best = i;
      }
   }
   return best;
}

/** A rising head that crosses a block's underside (centre under it) stops rising. */
function headSupport(run: RuinRun, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   const course = run.course;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!solid(run, i, ms)) continue;
      const bottom = supportBottom(course, run.water, s, ms);
      if (!(yOld + HERO.height <= bottom + 1e-9 && bottom < yNew + HERO.height)) continue;
      if (Math.abs(x - s.cx) < s.hw && Math.abs(z - s.cz) < s.hd) return i;
   }
   return NONE;
}

/** The block under the feet (the one stood on first), NONE when the hero walked off. */
function supportUnder(run: RuinRun, ms: number): number {
   const course = run.course;
   const h = run.hero;
   if (h.support !== NONE && solid(run, h.support, ms) && onSupport(course.supports[h.support], h.x, h.z)) return h.support;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!solid(run, i, ms)) continue;
      if (Math.abs(supportTop(course, run.water, s, ms) - h.y) < 1e-6 && onSupport(s, h.x, h.z)) return i;
   }
   return NONE;
}

function land(run: RuinRun, s: number, top: number, ms: number, speed: number): void {
   const h = run.hero;
   const ev = run.events;
   h.y = top;
   h.vy = 0;
   h.support = s;
   h.coyoteFrom = NONE;
   h.lastTop = top;
   h.airJump = true;
   h.apexCap = top + H_JUMP;
   if (top > run.bestTop) run.bestTop = top;
   ev.landed = true;
   ev.landedOn = s;
   ev.landSpeed = speed;
   // a first landing on a block (the start excluded) is a flow link
   if (!run.visited[s] && s !== run.course.checkpoints[0]) {
      run.visited[s] = 1;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.block);
      ev.comboLinked = true;
   }
}

function playMs(run: RuinRun, mx: number, mz: number): void {
   const course = run.course;
   const h = run.hero;
   const ev = run.events;
   const ms = run.simMs;
   const x0 = h.x;
   const z0 = h.z;
   comboTick(run.combo, COMBO, ms);
   let surface = surfaceAt(course, run.water, h.x, h.z, ms);

   // 1. on a crate the feet ride its top (the water lifts it)
   if (h.grounded && !h.swim && h.support !== NONE) {
      const s = course.supports[h.support];
      if (s.float !== NONE) h.y = supportTop(course, run.water, s, ms);
   }

   // 2. jump: a buffered press, grounded or within coyote time, or at the surface (a leap out)
   if (run.pressMs !== NONE) {
      if (ms - run.pressMs > BUFFER_MS) {
         run.pressMs = NONE;
      } else if (h.swim) {
         if (atSurface(h, surface)) {
            startArc(h, ms, h.y, V_JUMP);
            h.coyoteFrom = NONE;
            run.pressMs = NONE;
            ev.jumped = true;
            ev.leapt = true;
         }
      } else if (h.grounded || (h.coyoteFrom !== NONE && ms - h.coyoteFrom <= COYOTE_MS)) {
         const y0 = h.grounded ? h.y : arcY(h, ms);
         startArc(h, ms, y0, V_JUMP);
         h.coyoteFrom = NONE;
         run.pressMs = NONE;
         ev.jumped = true;
      }
   }

   // 2b. hero power: the same action press on keyboard and touch. A double jump on the ms of a ground
   // jump would only replace that jump, so it waits for a later press.
   if (run.actionMs === ms) {
      run.actionMs = NONE;
      if (!(heroById(run.heroId).power === "doubleJump" && ev.jumped)) tryPower(run, ms, mx, mz, surface);
   }

   // 3. the stick velocity: towards V_RUN · stick on land, V_SWIM · stick in the water, or the dash
   const dashing = h.dashUntil >= ms;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else {
      const top = h.swim ? V_SWIM : V_RUN;
      const rate = (h.swim ? ACCEL.swim : h.grounded ? ACCEL.ground : ACCEL.air) / 1000;
      let dvx = top * mx - h.vx;
      let dvz = top * mz - h.vz;
      const dv = Math.sqrt(dvx * dvx + dvz * dvz);
      if (dv > rate) {
         dvx *= rate / dv;
         dvz *= rate / dv;
      }
      h.vx += dvx;
      h.vz += dvz;
      // a whirlpool pulls a swimmer towards its centre (shield and phase ignore it)
      if (h.swim && !hazardImmune(h, ms)) {
         for (const wh of course.whirls) {
            const dx = wh.x - h.x;
            const dz = wh.z - h.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d > wh.r || d < 1e-6 || zoneAt(course, run.water, h.x, h.z, ms) !== wh.zone) continue;
            h.vx += (dx / d) * (WHIRL_PULL / 1000);
            h.vz += (dz / d) * (WHIRL_PULL / 1000);
         }
      }
   }
   const speedCap = dashing ? V_DASH : h.swim ? V_SWIM : V_RUN;
   const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
   if (speed > speedCap) {
      h.vx *= speedCap / speed;
      h.vz *= speedCap / speed;
   }

   // 4. move
   h.x += h.vx / 1000;
   h.z += h.vz / 1000;

   // 5. vertical
   surface = surfaceAt(course, run.water, h.x, h.z, ms);
   if (h.swim) {
      // swim up while Jump is held, sink otherwise; a flooded floor holds the feet; float at the surface
      const want = run.jumpHeld ? V_SWIM_UP : -V_SINK;
      const k = SWIM_VACC / 1000;
      h.vy += Math.max(-k, Math.min(k, want - h.vy));
      if (h.support !== NONE && (h.vy > 0 || !solid(run, h.support, ms) || !onSupport(course.supports[h.support], h.x, h.z))) h.support = NONE;
      if (h.support !== NONE) {
         h.vy = 0;
         h.y = supportTop(course, run.water, course.supports[h.support], ms);
      } else {
         const yOld = h.y;
         const cap = surface > -Infinity ? surface - FLOAT_DEPTH : Infinity;
         let yNew = Math.min(h.y + h.vy / 1000, cap);
         if (yNew >= cap && h.vy > 0) h.vy = 0;
         if (yNew > yOld) {
            const hit = headSupport(run, h.x, h.z, yOld, yNew, ms);
            if (hit !== NONE) {
               yNew = yOld;
               h.vy = 0;
            }
         }
         h.y = yNew;
         if (yNew < yOld) {
            const s = landingSupport(run, h.x, h.z, yOld, yNew, ms);
            if (s !== NONE) land(run, s, supportTop(course, run.water, course.supports[s], ms), ms, Math.max(0, (yOld - yNew) * 1000));
         }
      }
      h.lastTop = h.y;
   } else if (h.grounded) {
      const s = supportUnder(run, ms);
      if (s === NONE) {
         startArc(h, ms, h.y, 0);
         h.coyoteFrom = ms;
      } else {
         h.support = s;
         h.airJump = true;
         h.apexCap = h.y + H_JUMP;
      }
   } else {
      const yOld = h.y;
      let yNew = arcY(h, ms);
      if (yNew > yOld) {
         const hit = headSupport(run, h.x, h.z, yOld, yNew, ms);
         if (hit !== NONE) {
            // bump: start falling from just under the block
            yNew = Math.min(yOld, supportBottom(course, run.water, course.supports[hit], ms) - HERO.height - 1e-6);
            startArc(h, ms, yNew, 0);
            h.coyoteFrom = NONE;
         }
      }
      h.y = yNew;
      h.vy = arcVy(h, ms);
      if (yNew < yOld) {
         const s = landingSupport(run, h.x, h.z, yOld, yNew, ms);
         if (s !== NONE) {
            const speedDown = Math.max(0, -arcVy(h, ms));
            h.grounded = true;
            land(run, s, supportTop(course, run.water, course.supports[s], ms), ms, speedDown);
         }
      }
   }

   // 6. side collisions (a dashing Riko breaks cracked brick)
   const broke = sideCollisions(run, ms);
   if (broke !== NONE) ev.broke = broke;

   // 7. progress guard: the step is at most the speed cap (push-outs and the whirlpool included)
   const maxMove = speedCap / 1000;
   const dx = h.x - x0;
   const dz = h.z - z0;
   const moved = Math.sqrt(dx * dx + dz * dz);
   if (moved > maxMove) {
      const k = maxMove / moved;
      h.x = x0 + dx * k;
      h.z = z0 + dz * k;
      if (insideSolid(run, h.x, h.z, h.y, ms)) {
         h.x = x0;
         h.z = z0;
      }
   }

   // 8. into the water, out of it
   surface = surfaceAt(course, run.water, h.x, h.z, ms);
   if (!h.swim) {
      // a leap out of the water starts under the surface: only a falling (or standing) hero goes in
      if (h.y < surface - SWIM_IN && (h.grounded || arcVy(h, ms) <= 0)) {
         const falling = h.grounded ? 0 : Math.max(-3, Math.min(0, arcVy(h, ms)));
         h.swim = true;
         h.vy = falling;
         if (h.grounded) {
            // the water rose over the block: keep the feet on it, swimming
            h.grounded = false;
         } else h.support = NONE;
         h.coyoteFrom = NONE;
         h.airJump = true;
         ev.splash = true;
      }
   } else if (!(surface > -Infinity)) {
      // swam out of every chamber (or the chamber drained under the feet): fall from here
      startArc(h, ms, h.y, Math.min(0, h.vy));
      h.coyoteFrom = NONE;
   } else if (h.support !== NONE && supportTop(course, run.water, course.supports[h.support], ms) > surface - SWIM_IN) {
      // the water went down past the knees: standing on the block again
      h.swim = false;
      h.grounded = true;
      h.vy = 0;
   }

   // 9. air: under water the meter runs; at the surface and in a bubble column it refills
   if (h.swim && h.y + HEAD < surface) {
      h.air -= 1;
      let bubbles = false;
      for (const sp of course.spouts) {
         const ox = h.x - sp.x;
         const oz = h.z - sp.z;
         if (ox * ox + oz * oz <= sp.r * sp.r && h.y + 0.6 >= sp.y0 && h.y <= sp.y1) bubbles = true;
      }
      if (bubbles) {
         if (h.air < AIR_MS * 0.7) ev.bubbles = true;
         h.air = AIR_MS;
      }
      if (h.air <= 0) {
         lose(run, "air");
         return;
      }
   } else h.air = Math.min(AIR_MS, h.air + AIR_REFILL);

   // 10. levers: walking (or swimming) into one moves it to its next position
   const lv = run.levers;
   for (let i = 0; i < course.levers.length; i++) {
      const l = course.levers[i];
      const ox = h.x - l.x;
      const oz = h.z - l.z;
      const d2 = ox * ox + oz * oz;
      const near = d2 <= LEVER_R * LEVER_R && h.y >= l.y - 1.2 && h.y <= l.y + 1.6;
      if (!run.armed[i]) {
         if (d2 > LEVER_REARM * LEVER_REARM || h.y < l.y - 2 || h.y > l.y + 2.5) run.armed[i] = 1;
         continue;
      }
      if (!near) continue;
      run.armed[i] = 0;
      const pos = (lv.pos[i] + 1) % l.positions;
      lv.pos[i] = pos;
      lv.at[i] = ms;
      for (const [zi, level] of l.effects[pos]) setTarget(run.water, zi, course.zones[zi].levels[level], ms);
      ev.lever = i;
      ev.leverPos = pos;
      if (!run.pulled[i]) {
         run.pulled[i] = 1;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.lever);
         ev.comboLinked = true;
      }
   }

   // 11. orbs (bonus orbs too); a buried orb needs the magnet and a drained floor
   const orbs = course.orbs;
   const my = h.y + ORB.centerY;
   const magnet = h.magnetUntil >= ms;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      if (o.buried !== NONE && (!magnet || zoneLevel(run.water, o.buried, ms) > o.y - 0.2)) continue;
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach) {
         run.collected[i] = 1;
         run.orbs += 1;
         if (!o.bonus) run.mainOrbs += 1;
         if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
         ev.comboLinked = true;
      }
   }

   // 11b. secrets (no score): the same reach as an orb; a sunken one only once its chamber flooded and drained
   const secrets = course.secrets;
   for (let i = 0; i < secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const o = secrets[i];
      if (o.sunken !== NONE && run.water.cycle[o.sunken] !== 2) continue;
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }

   // 12. the tide (nothing protects from it), then the fall line
   if (h.y <= tideY(run, ms)) {
      lose(run, "tide");
      return;
   }
   if (!h.swim && !h.grounded && h.y < h.lastTop - FALL_DEPTH) {
      lose(run, "fall");
      return;
   }

   // 13. steam jets, bats, whirlpool cores (shield and phase ignore them)
   if (!hazardImmune(h, ms)) {
      for (const j of course.jets) {
         if (!jetLive(j, ms)) continue;
         const ox = h.x - j.x;
         const oz = h.z - j.z;
         if (ox * ox + oz * oz <= j.r * j.r && h.y + HERO.height > j.y && h.y < j.y + j.h) {
            lose(run, "jet");
            return;
         }
      }
      for (const bat of course.bats) {
         if (!batPos(run.water, bat, ms, SCRATCH_V)) continue;
         const ox = h.x - SCRATCH_V.x;
         const oy = my - SCRATCH_V.y;
         const oz = h.z - SCRATCH_V.z;
         if (ox * ox + oy * oy + oz * oz <= 0.8 * 0.8) {
            lose(run, "bat");
            return;
         }
      }
      if (h.swim) {
         for (const wh of course.whirls) {
            const ox = h.x - wh.x;
            const oz = h.z - wh.z;
            if (ox * ox + oz * oz <= wh.core * wh.core && zoneAt(course, run.water, h.x, h.z, ms) === wh.zone) {
               lose(run, "whirl");
               return;
            }
         }
      }
   }

   // 14. the boss: its roll hurts, its back, the geyser and the floodgate hurt it
   if (run.boss && bossContact(run, ms)) return;

   if (!h.grounded || h.swim) return;

   // 15. checkpoints, forward only (one may start the tide)
   for (let k = run.checkpoint + 1; k < course.checkpoints.length; k++) {
      if (course.checkpoints[k] === h.support) {
         run.checkpoint = k;
         ev.checkpoint = k;
         if (course.tide.startCheckpoint === k && run.tideFrom === NONE) {
            run.tideFrom = ms;
            ev.tideStarted = true;
         }
         break;
      }
   }

   // 16. the goal (level 5: the Tide Bell rings only once the boss is beaten)
   if (h.support === course.goal && (!run.boss || run.boss.step === "defeat" || run.boss.step === "done")) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

// ---------- the boss (level 5) ----------

function pathPoint(path: [number, number, number][], k: number, out: Vec3Like): void {
   if (path.length === 1) {
      out.x = path[0][0];
      out.y = path[0][1];
      out.z = path[0][2];
      return;
   }
   // by length along the polyline
   let total = 0;
   for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
   let left = Math.max(0, Math.min(1, k)) * total;
   for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (left <= seg || i === path.length - 1) {
         const t = seg > 0 ? Math.min(1, left / seg) : 1;
         out.x = a[0] + (b[0] - a[0]) * t;
         out.y = a[1] + (b[1] - a[1]) * t;
         out.z = a[2] + (b[2] - a[2]) * t;
         return;
      }
      left -= seg;
   }
}

/** Every pressure lever is held down (phase 2's geyser). */
export function geyserUp(run: RuinRun): boolean {
   const arena = run.course.boss;
   if (!arena) return false;
   for (const li of arena.pressure) if (run.levers.pos[li] === 0) return false;
   return true;
}

/** Where the boss is now (its feet point) and what it is doing (pure; the Scene draws from it). */
export function bossPose(run: RuinRun, ms: number, out: BossPose): BossPose {
   const arena = run.course.boss;
   const b = run.boss;
   if (!arena || !b) return out;
   const k = stepProgress(b, UMBRA_ROLLER);
   const roll = arena.rollPath;
   const chase = arena.chasePath;
   if (b.step === "defeat" || b.step === "done") {
      pathPoint(chase, 1, out);
      out.mode = "beaten";
      return out;
   }
   if (b.step === "intro") {
      pathPoint(roll, 0, out);
      out.mode = "idle";
      return out;
   }
   if (b.phase === 0) {
      if (b.step === "telegraph") {
         pathPoint(roll, 0, out);
         out.mode = "telegraph";
      } else if (b.step === "attack") {
         pathPoint(roll, k, out);
         out.mode = "roll";
      } else {
         pathPoint(roll, 1, out);
         const level = zoneLevel(run.water, arena.ring, ms);
         if (level >= arena.ringLevel) {
            out.y = Math.max(out.y, level - BOSS_R * 0.6);
            out.mode = "float";
         } else out.mode = "stuck";
      }
      return out;
   }
   if (b.phase === 1) {
      out.x = arena.drain[0];
      out.z = arena.drain[2];
      if (b.step === "vulnerable" && geyserUp(run)) {
         out.y = arena.geyserTop;
         out.mode = "geyser";
      } else {
         out.y = arena.drain[1] - (b.step === "transition" ? 0 : 0.6);
         out.mode = b.step === "telegraph" ? "telegraph" : "drain";
      }
      return out;
   }
   if (b.step === "telegraph" || b.step === "transition") {
      pathPoint(chase, 0, out);
      out.mode = "telegraph";
   } else if (b.step === "attack") {
      pathPoint(chase, k, out);
      out.mode = "chase";
   } else {
      pathPoint(chase, 1, out);
      out.mode = "gate";
   }
   return out;
}

/** Is the boss's body harmful to touch now (rolling, stuck and spinning, in the drain, chasing)? */
export function bossHarmful(pose: BossPose): boolean {
   return pose.mode === "roll" || pose.mode === "stuck" || pose.mode === "drain" || pose.mode === "chase";
}

function strikeBoss(run: RuinRun, ms: number): void {
   const b = run.boss!;
   const ev = run.events;
   const r = hitBoss(b, UMBRA_ROLLER, 1, ev.boss);
   if (r === "ignored") return;
   ev.bossHit = true;
   if (r === "defeated") ev.bossDefeated = true;
   if (r === "phase") ev.bossPhase = true;
   ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.boss);
   ev.comboLinked = true;
}

/** The hero against the boss this ms. Returns true when the hero was lost. */
function bossContact(run: RuinRun, ms: number): boolean {
   const arena = run.course.boss!;
   const h = run.hero;
   const p = run.bossPose;
   const b = run.boss!;
   const cy = p.y + BOSS_R;
   const ox = h.x - p.x;
   const oz = h.z - p.z;
   const flat = Math.sqrt(ox * ox + oz * oz);
   const oy = h.y + ORB.centerY - cy;
   const dist = Math.sqrt(flat * flat + oy * oy);
   // phase 3: the floodgate lever, pulled while the boss sits on the gate
   if (run.events.lever === arena.gateLever && b.step === "vulnerable" && b.phase === 2) strikeBoss(run, ms);
   if (b.step === "vulnerable" && b.phase === 0 && p.mode === "float" && !h.grounded && !h.swim && arcVy(h, ms) < 0) {
      // phase 1: the feet come down on its back
      const back = cy + BOSS_R * 0.75;
      if (flat <= BOSS_R + 0.3 && h.y <= back && h.y >= back - 0.6) {
         strikeBoss(run, ms);
         startArc(h, ms, back, V_JUMP * 0.8);
         run.events.jumped = true;
         return false;
      }
   }
   if (b.step === "vulnerable" && b.phase === 1 && p.mode === "geyser" && dist <= BOSS_R + 0.6) {
      strikeBoss(run, ms);
      if (!h.swim) {
         startArc(h, ms, h.y, V_JUMP * 0.6);
         h.vx = -h.vx * 0.5;
         h.vz = -h.vz * 0.5;
      }
      return false;
   }
   if (bossHarmful(p) && dist <= BOSS_R + 0.35 && !hazardImmune(h, ms)) {
      lose(run, "boss");
      return true;
   }
   return false;
}

function lose(run: RuinRun, cause: LossCause): void {
   const h = run.hero;
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.vx = 0;
   h.vz = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   h.lostCause = cause;
   if (h.grounded || h.swim) {
      // struck where it stands: a little hop out of view
      startArc(h, run.simMs, h.y, cause === "tide" || cause === "air" || cause === "whirl" ? 0 : 6);
      if (cause === "tide" || cause === "air" || cause === "whirl") h.swim = true;
   }
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
}

/** Back on the active checkpoint, at rest, frozen for SPAWN_MS; the run ends "flood" if the tide covers it. */
function respawn(run: RuinRun): void {
   const h = run.hero;
   const index = run.course.checkpoints[run.checkpoint];
   const s = run.course.supports[index];
   if (s.top <= tideY(run, run.simMs) + TIDE_SAFE) {
      run.ended = "flood";
      run.events.flooded = true;
      return;
   }
   h.x = s.cx;
   h.y = s.top;
   h.z = s.cz + (run.checkpoint === 0 ? Math.min(1.5, s.hd * 0.5) : 0);
   h.vx = 0;
   h.vz = 0;
   h.vy = 0;
   h.grounded = true;
   h.swim = false;
   h.support = index;
   h.arcStart = run.simMs;
   h.arcY0 = s.top;
   h.arcV = 0;
   h.coyoteFrom = NONE;
   h.lastTop = s.top;
   h.dashUntil = NONE;
   h.airJump = true;
   h.apexCap = s.top + H_JUMP;
   h.air = AIR_MS;
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- solid boxes (for a camera-collision pass, e.g. the coming menu2/camera orbit camera) ----------

/** An axis-aligned box of world metres. */
export interface SolidBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/**
 * Every solid block of the run as a box at rules ms `ms` (crates at their floating height; broken
 * brick left out; ghost panels kept, the camera does not phase). Writes into `out` (grown once, then
 * reused) and returns the count, so a camera pass can call it every frame without allocating.
 */
export function solidBoxes(run: RuinRun, ms: number, out: SolidBox[]): number {
   const course = run.course;
   let n = 0;
   for (let i = 0; i < course.supports.length; i++) {
      const s = course.supports[i];
      if (s.crack && run.broken[i]) continue;
      const b = out[n] ?? (out[n] = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
      b.minX = s.cx - s.hw;
      b.maxX = s.cx + s.hw;
      b.minZ = s.cz - s.hd;
      b.maxZ = s.cz + s.hd;
      b.maxY = supportTop(course, run.water, s, ms);
      b.minY = supportBottom(course, run.water, s, ms);
      n += 1;
   }
   return n;
}

// ---------- the store hand-off (README "Scoring") ----------

/** HUD and hand-off stats. */
export const STAT = {
   orbs: "orbs",
   height: "height",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   /** air left (tenths of the meter, 0..10) and 1 while swimming */
   air: "air",
   swim: "swim",
   /** the tide's distance under the hero's feet (dm, capped), -1 before it starts */
   tide: "tide",
   /** the flow bonus (ms) so far: comes off the submitted time */
   comboMs: "comboMs",
   /** the HUD meter: chain length, multiplier x100, window left in tenths */
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   /** level 5: the boss's hp, phase, step index and hit flash (1/0) */
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossStep: "bossStep",
   bossFlash: "bossFlash",
   /** set before end("win") for the star screen: STAR_BIT mask, new-star mask, no-hit (1/0), secrets mask, new-secret count, XP gained */
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The run time a player sees and submits: play ms minus the orb bonus and the flow bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

/**
 * GameDefinition.finalScore: a win submits the finish ms minus the orb and flow bonus (the Scene
 * publishes finishMs, orbs and comboMs with setStat before end("win")); any other end keeps elapsedMs (unranked anyway).
 */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
