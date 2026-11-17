// Paint the Platforms rules (the design card's area-painting challenge): every tile the hero stands on
// takes the hero's colour; the level is won when the target share of the arena's tiles is painted. A
// full row of one platform "sets" (locks: nothing wipes it again). Grey blots crawl their loops and wipe
// the unset paint they cross (and stun the hero they touch); moving rafts carry tiles of their own; the
// roller sweeps a lane after a glow; level 5's Paint Blob slams rings of grey and must be splatted.
// A fall puts the hero back on the platform he last stood on. The card's timer ends the run "timeup".
// A time game: the finish less the flow bonus is the submitted time.
//
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Whole ms, stepped 1 ms at
// a time, the fraction carried: the same at 30, 60 or 144 fps.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, FREEZE_MS, HERO_IDS, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { TILE, courseFor, loopPoint, raftOffset, type Box, type Course, type Platform, type Point } from "./course";
import { BLOB, COMBO, COMBO_BASE_MS, SECRETS, SLAM_R } from "./progression";

export { courseFor, buildCourse } from "./course";
export type { Course, Box } from "./course";

// ---------- tuning (1 unit = 1 m) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const V_RUN = 6;
export const ACCEL_GROUND = 50;
export const ACCEL_AIR = 22;
export const GRAV = 24;
export const V_JUMP = 11.2;
export const V_JUMP2 = 9;
export const COYOTE_MS = 90;
export const BUFFER_MS = 110;
export const HERO_R = 0.35;
export const HERO_H = 1.5;
export const VOID_Y = -10;
export const DEAD_MS = 800;
export const STUN_MS = 700;
export const PICK_R = 1.0;
/** a grey blot's radius and height (m) */
export const BLOT_R = 0.6;
export const BLOT_H = 1;
/** the roller: its cycle (ms), the parts of it, its radius (m) */
export const ROLLER = { idleMs: 2000, glowMs: 1500, rollMs: 2500, restMs: 1000, r: 0.8 } as const;
export const ROLLER_CYCLE_MS = ROLLER.idleMs + ROLLER.glowMs + ROLLER.rollMs + ROLLER.restMs;
/** splatting the open Blob: from this far beyond its body (m) */
export const SPLAT_REACH = 1.6;
/** a paint blob splashes its own tile and the four next to it */
export const SPLASH: readonly [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
/**
 * The bound's average speed (m/s): his own 6 m/s, plus Riko's dash (4 m in 0.2 s, once per 1.2 s:
 * 14 m/s more for a sixth of the time) = 8.33 m/s; DASH_EXTRA_M is one more dash's worth (a run that
 * starts with a dash).
 */
export const V_AVG = V_RUN + ((V_DASH - V_RUN) * POWER_MS.dash) / heroById("riko").cooldownMs;
export const DASH_EXTRA_M = ((V_DASH - V_RUN) * POWER_MS.dash) / 1000;

// ---------- state ----------

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   vy: number;
   facing: number;
   ground: number;
   leftGroundMs: number;
   jumpedSinceGround: boolean;
   jumps: number;
   jumpBuf: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   stunUntil: number;
   deadMs: number;
   spawn: Point;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   doubled: boolean;
   landed: boolean;
   died: boolean;
   respawned: boolean;
   hurt: boolean;
   /** tiles freshly painted (grey -> colour) and wiped (colour -> grey) this step */
   painted: number;
   wiped: number;
   /** the last tile painted this step, or -1 */
   tile: number;
   /** a row that set this step, or -1 */
   rowSet: number;
   pickup: number;
   frozen: number;
   powered: boolean;
   splat: boolean;
   comboBonus: number;
   secretList: number[];
   secretCount: number;
   finished: boolean;
   timeup: boolean;
   rollerGlow: boolean;
   rollerGo: boolean;
   rollerStopped: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      doubled: false,
      landed: false,
      died: false,
      respawned: false,
      hurt: false,
      painted: 0,
      wiped: 0,
      tile: NONE,
      rowSet: NONE,
      pickup: NONE,
      frozen: NONE,
      powered: false,
      splat: false,
      comboBonus: 0,
      secretList: [],
      secretCount: 0,
      finished: false,
      timeup: false,
      rollerGlow: false,
      rollerGo: false,
      rollerStopped: false,
      bossTelegraph: false,
      bossAttack: false,
      bossOpen: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function clearEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.doubled = false;
   ev.landed = false;
   ev.died = false;
   ev.respawned = false;
   ev.hurt = false;
   ev.painted = 0;
   ev.wiped = 0;
   ev.tile = NONE;
   ev.rowSet = NONE;
   ev.pickup = NONE;
   ev.frozen = NONE;
   ev.powered = false;
   ev.splat = false;
   ev.comboBonus = 0;
   ev.secretCount = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.rollerGlow = false;
   ev.rollerGo = false;
   ev.rollerStopped = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossOpen = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

/**
 * The shared board (co-op shares one; solo and versus have their own): each tile's colour (the
 * painter's hero index, -1 grey), the rows set, the paint blobs taken.
 */
export interface Board {
   paint: Int8Array;
   paid: Uint8Array;
   set: Uint8Array;
   taken: Uint8Array;
   painted: number;
   rowsSet: number;
}

export function createBoard(c: Course): Board {
   return { paint: new Int8Array(c.tiles.length).fill(-1), paid: new Uint8Array(c.tiles.length), set: new Uint8Array(c.rows.length), taken: new Uint8Array(c.pickups.length), painted: 0, rowsSet: 0 };
}

export interface PaintRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   carry: number;
   hero: Hero;
   board: Board;
   /** per blot: how far along its loop (m), frozen until (ms), the tile it last stood on */
   blotAt: Float64Array;
   blotFrozen: Float64Array;
   blotTile: Int32Array;
   blots: number;
   wipedTotal: number;
   deaths: number;
   hurts: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   combo: ComboState;
   secrets: SecretTracker;
   powerReadyAt: number;
   /** this run steps the shared hazards (blots, roller, Blob): solo always; co-op one run */
   owner: boolean;
   /** the roller cycle Kiro's shield stopped (-1), the column its drum last wiped, the Blob's last step */
   hz: { rollerStopped: number; rollerCol: number; prevBossStep: string };
   boss: BossState | null;
   bossEv: BossEvents;
   /** the slam's ring centres (the second one only in a twin slam) */
   ring: { x: number; z: number; twin: boolean };
   events: StepEvents;
}

function freshHero(c: Course): Hero {
   return {
      x: c.start.x,
      y: c.start.y,
      z: c.start.z,
      vx: 0,
      vz: 0,
      vy: 0,
      facing: Math.PI,
      ground: NONE,
      leftGroundMs: NONE,
      jumpedSinceGround: false,
      jumps: 0,
      jumpBuf: NONE,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      stunUntil: NONE,
      deadMs: NONE,
      spawn: { ...c.start },
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, course: Course = courseFor(level), board: Board = createBoard(course)): PaintRun {
   const run: PaintRun = {
      course,
      level,
      heroId,
      seed: (seed >>> 0) || 1,
      simMs: 0,
      carry: 0,
      hero: freshHero(course),
      board,
      blotAt: Float64Array.from(course.blots, (b) => b.start),
      blotFrozen: new Float64Array(course.blots.length).fill(-1),
      blotTile: new Int32Array(course.blots.length).fill(-1),
      blots: 0,
      wipedTotal: 0,
      deaths: 0,
      hurts: 0,
      ended: null,
      finishMs: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      powerReadyAt: 0,
      owner: true,
      hz: { rollerStopped: NONE, rollerCol: NONE, prevBossStep: "intro" },
      boss: course.boss ? createBoss(BLOB) : null,
      bossEv: createBossEvents(),
      ring: { x: 0, z: 0, twin: false },
      events: createEvents(),
   };
   run.hero.ground = support(run);
   return run;
}

// ---------- the arena (shared with the bot and the scene) ----------

const BP = { x: 0, z: 0 };

/** A raft's offset now. */
export function raftOff(run: Pick<PaintRun, "simMs" | "course">, raft: number, out = BP): { x: number; z: number } {
   const r = run.course.rafts[raft];
   const o = raftOffset(run.simMs, r.amp);
   out.x = r.ax * o;
   out.z = r.az * o;
   return out;
}

/** Box b's offset now (a raft's box rides its rail). */
export function boxOffset(run: Pick<PaintRun, "simMs" | "course">, b: Box, out = BP): { x: number; z: number } {
   if (b.raft < 0) {
      out.x = 0;
      out.z = 0;
      return out;
   }
   return raftOff(run, b.raft, out);
}

/** The platform a box is the floor of, or -1. */
export function platOfBox(c: Course, box: number): number {
   const b = c.boxes[box];
   if (!b || b.kind !== "floor") return NONE;
   for (const p of c.platforms) if (p.box === box) return p.id;
   return NONE;
}

/** The tile of platform p under (x, z) now (a raft's tiles ride it), or -1. */
export function tileOn(run: Pick<PaintRun, "simMs" | "course">, p: Platform, x: number, z: number): number {
   let ox = 0;
   let oz = 0;
   if (p.raft >= 0) {
      const o = raftOff(run, p.raft, { x: 0, z: 0 });
      ox = o.x;
      oz = o.z;
   }
   const ix = Math.floor((x - ox - p.x0) / TILE);
   const iz = Math.floor((z - oz - p.z0) / TILE);
   if (ix < 0 || iz < 0 || ix >= p.nx || iz >= p.nz) return NONE;
   return p.cells[iz * p.nx + ix];
}

/** The fixed tile under (x, z), or -1. */
export function fixedTileAt(c: Course, x: number, z: number): number {
   for (const p of c.platforms) {
      if (p.raft >= 0) continue;
      const ix = Math.floor((x - p.x0) / TILE);
      const iz = Math.floor((z - p.z0) / TILE);
      if (ix < 0 || iz < 0 || ix >= p.nx || iz >= p.nz) continue;
      return p.cells[iz * p.nx + ix];
   }
   return NONE;
}

/** A tile's centre now. */
export function tileCentre(run: Pick<PaintRun, "simMs" | "course">, tile: number, out: { x: number; z: number }): { x: number; z: number } {
   const t = run.course.tiles[tile];
   const p = run.course.platforms[t.plat];
   if (p.raft >= 0) {
      raftOff(run, p.raft, out);
      out.x += t.x;
      out.z += t.z;
   } else {
      out.x = t.x;
      out.z = t.z;
   }
   return out;
}

const LP = { x: 0, z: 0 };

/** Blot i's position now. */
export function blotPos(run: Pick<PaintRun, "course" | "blotAt">, i: number, out = LP): { x: number; z: number } {
   return loopPoint(run.course.blots[i].path, run.blotAt[i], out);
}

/** The roller now: its cycle, step and lane, and (rolling) its x. */
export interface RollerView {
   cycle: number;
   step: "idle" | "glow" | "roll" | "rest";
   lane: number;
   x: number;
   /** 0..1 through the current step */
   t: number;
}

export function laneFor(seed: number, cycle: number, lanes: number): number {
   return ((seed % 7) + cycle * 3) % lanes;
}

export function rollerAt(run: Pick<PaintRun, "course" | "simMs" | "seed">, out: RollerView): RollerView | null {
   const c = run.course;
   if (c.roller < 0) return null;
   const p = c.platforms[c.roller];
   const cycle = Math.floor(run.simMs / ROLLER_CYCLE_MS);
   const u = run.simMs - cycle * ROLLER_CYCLE_MS;
   out.cycle = cycle;
   out.lane = laneFor(run.seed, cycle, Math.floor(p.nz / 2));
   const x0 = p.x0 - 1;
   const x1 = p.x0 + p.nx * TILE + 1;
   out.x = x0;
   if (u < ROLLER.idleMs) {
      out.step = "idle";
      out.t = u / ROLLER.idleMs;
   } else if (u < ROLLER.idleMs + ROLLER.glowMs) {
      out.step = "glow";
      out.t = (u - ROLLER.idleMs) / ROLLER.glowMs;
   } else if (u < ROLLER.idleMs + ROLLER.glowMs + ROLLER.rollMs) {
      out.step = "roll";
      out.t = (u - ROLLER.idleMs - ROLLER.glowMs) / ROLLER.rollMs;
      out.x = x0 + (x1 - x0) * out.t;
   } else {
      out.step = "rest";
      out.t = (u - ROLLER.idleMs - ROLLER.glowMs - ROLLER.rollMs) / ROLLER.restMs;
      out.x = x1;
   }
   return out;
}

/** The lane's z band (min, max) on the roller's platform. */
export function laneBand(c: Course, lane: number): [number, number] {
   const p = c.platforms[c.roller];
   return [p.z0 + lane * 2 * TILE, p.z0 + (lane + 1) * 2 * TILE];
}

// ---------- the bound (README "Scoring and server limits") ----------

export function bossMinMs(): number {
   const b = createBoss(BLOB);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(b, BLOB, 1, ev);
      if (b.step === "vulnerable") hitBoss(b, BLOB, 1, ev);
      if (b.step === "defeat" || b.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** The fixed tiles whose cells overlap the rectangle. */
function tilesIn(c: Course, minX: number, maxX: number, minZ: number, maxZ: number, into: Set<number>): void {
   for (const t of c.tiles) {
      if (c.platforms[t.plat].raft >= 0) continue;
      const x0 = t.x - TILE / 2;
      const z0 = t.z - TILE / 2;
      if (x0 < maxX && x0 + TILE > minX && z0 < maxZ && z0 + TILE > minZ) into.add(t.id);
   }
}

/**
 * A way to paint tiles without walking the fixed lattice to them, and how far from the start (m, a
 * straight line, less its reach) the hero must get before it pays: a paint blob (its splash; collected
 * from as far as Zuno's magnet reaches) or a raft (its own tiles, and every fixed tile within 2.5 m of
 * its swept path: stepping or jumping off a raft starts a new stretch of path there).
 */
export interface FreeSource {
   reachM: number;
   tiles: Set<number>;
}

export function freeSources(c: Course): FreeSource[] {
   const out: FreeSource[] = [];
   const s = c.start;
   for (const p of c.pickups) {
      const tiles = new Set<number>();
      const t = c.tiles[p.tile];
      const plat = c.platforms[t.plat];
      for (const [dx, dz] of SPLASH) {
         const ix = t.ix + dx;
         const iz = t.iz + dz;
         if (ix < 0 || iz < 0 || ix >= plat.nx || iz >= plat.nz) continue;
         const id = plat.cells[iz * plat.nx + ix];
         if (id >= 0) tiles.add(id);
      }
      out.push({ reachM: Math.max(0, Math.hypot(p.x - s.x, p.z - s.z) - MAGNET_REACH), tiles });
   }
   for (const r of c.rafts) {
      const b = c.boxes[r.box];
      const tiles = new Set<number>();
      for (const t of c.tiles) if (t.plat === r.plat) tiles.add(t.id);
      const reach = 2.5;
      const minX = b.minX - Math.abs(r.ax) * r.amp;
      const maxX = b.maxX + Math.abs(r.ax) * r.amp;
      const minZ = b.minZ - Math.abs(r.az) * r.amp;
      const maxZ = b.maxZ + Math.abs(r.az) * r.amp;
      tilesIn(c, minX - reach, maxX + reach, minZ - reach, maxZ + reach, tiles);
      // to board it the hero's feet must reach its swept rectangle (within the support margin)
      const dx = Math.max(0, minX - s.x, s.x - maxX);
      const dz = Math.max(0, minZ - s.z, s.z - maxZ);
      out.push({ reachM: Math.max(0, Math.hypot(dx, dz) - HERO_R), tiles });
   }
   return out;
}

/** The fixed-lattice path (m) that meets `cells` cells: a stretch shorter than a tile meets at most 4. */
function cellPathM(cells: number): number {
   return Math.max(0, (cells / 4 - 1) * TILE);
}

/**
 * The least distance (m) the hero must cover to paint the target. A stretch of path shorter than one
 * tile lies inside a one-tile square and so meets at most 4 cells of the fixed lattice: the path from
 * the start (and from each respawn, which costs DEAD_MS, more than its 4 cells are worth) meets at most
 * 4 (L / TILE + 1) cells. Whichever free sources (freeSources) a run uses, it must also reach each of
 * them: the least over every choice of sources of the longer of the two.
 */
export function minPathM(c: Course): number {
   const src = freeSources(c);
   let best = Infinity;
   for (let mask = 0; mask < 1 << src.length; mask++) {
      const free = new Set<number>();
      let reach = 0;
      for (let k = 0; k < src.length; k++) {
         if (!(mask & (1 << k))) continue;
         reach = Math.max(reach, src[k].reachM);
         for (const t of src[k].tiles) free.add(t);
      }
      best = Math.min(best, Math.max(reach, cellPathM(c.need - free.size)));
   }
   return best;
}

/** The least finish (ms): the least path at V_AVG (less one extra dash); level 5 also the Blob's least defeat. */
export function minFinishMs(c: Course): number {
   const paint = (Math.max(0, minPathM(c) - DASH_EXTRA_M) / V_AVG) * 1000;
   return c.boss ? Math.max(paint, BOSS_MIN_MS) : paint;
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   const sources: { count: number; base: number }[] = [
      { count: c.tiles.length, base: COMBO_BASE_MS.tile },
      { count: c.pickups.length, base: COMBO_BASE_MS.blob },
      { count: c.rows.length, base: COMBO_BASE_MS.row },
   ];
   if (c.boss) sources.push({ count: BLOB.maxHp, base: COMBO_BASE_MS.boss });
   return { combo: COMBO, sources };
}

export function maxBonusMs(c: Course): number {
   return comboMaxBonus(comboSpecOf(c));
}

export function bonusMs(run: Pick<PaintRun, "combo">): number {
   return run.combo.bonusTotal;
}

export function runTimeMs(finishMs: number, bonus: number): number {
   return Math.max(0, finishMs - bonus);
}

export const submittedMs = (run: PaintRun): number => runTimeMs(run.finishMs, bonusMs(run));

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(c: Course): LevelLimits {
   const floor = Math.max(0, minFinishMs(c) - maxBonusMs(c));
   const minDurationMs = Math.floor((floor * 0.94) / 100) * 100;
   const timeBaseMs = c.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

// ---------- the step ----------

const STICK = { x: 0, z: 0 };
const PA = { x: 0, z: 0 };
const TC = { x: 0, z: 0 };
const RV: RollerView = { cycle: 0, step: "idle", lane: 0, x: 0, t: 0 };

export function step(run: PaintRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   clearEvents(ev);
   if (run.ended !== null) return ev;
   const total = Math.min(MAX_STEP_MS, Math.max(0, dtMs)) + run.carry;
   const whole = Math.floor(total);
   run.carry = total - whole;
   inputToWorld(input.moveX, input.moveZ, input.yaw, STICK);
   let jump = input.jumpPressed;
   let action = input.actionPressed;
   for (let k = 0; k < whole && run.ended === null; k++) {
      stepMs(run, jump, action, ev);
      jump = false;
      action = false;
   }
   return ev;
}

function secret(run: PaintRun, id: string, ev: StepEvents): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i >= 0 && collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
}

function finish(run: PaintRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

function die(run: PaintRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.deadMs >= 0) return;
   h.deadMs = 0;
   h.ground = NONE;
   h.vx = h.vz = h.vy = 0;
   run.deaths += 1;
   comboBreak(run.combo);
   ev.died = true;
}

/** A stun: knocked back from (fx, fz) unless shielded (or already stunned). */
function hurt(run: PaintRun, ev: StepEvents, fx: number, fz: number): void {
   const h = run.hero;
   if (run.simMs <= h.shieldUntil || run.simMs <= h.stunUntil) return;
   h.stunUntil = run.simMs + STUN_MS;
   const dx = h.x - fx;
   const dz = h.z - fz;
   const l = Math.hypot(dx, dz) || 1;
   h.vx = (dx / l) * 4;
   h.vz = (dz / l) * 4;
   h.vy = 5;
   h.ground = NONE;
   run.hurts += 1;
   comboBreak(run.combo);
   ev.hurt = true;
}

function respawn(run: PaintRun, ev: StepEvents): void {
   const h = run.hero;
   h.deadMs = NONE;
   h.x = h.spawn.x;
   h.y = h.spawn.y;
   h.z = h.spawn.z;
   h.vx = h.vz = h.vy = 0;
   h.ground = support(run);
   h.jumps = 0;
   h.jumpedSinceGround = false;
   ev.respawned = true;
}

/** Paints a tile in the hero's colour (pays the chain once per tile; sets its row when full). */
export function paintTile(run: PaintRun, tile: number, ev: StepEvents): void {
   const board = run.board;
   const colour = HERO_IDS.indexOf(run.heroId);
   const was = board.paint[tile];
   if (was === colour) return;
   board.paint[tile] = colour;
   ev.tile = tile;
   if (was >= 0) return;
   board.painted += 1;
   ev.painted += 1;
   if (!board.paid[tile]) {
      board.paid[tile] = 1;
      ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.tile);
   }
   const row = run.course.tiles[tile].row;
   if (!board.set[row] && run.course.rows[row].every((t) => board.paint[t] >= 0)) {
      board.set[row] = 1;
      board.rowsSet += 1;
      ev.rowSet = row;
      ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.row);
   }
}

/** Wipes a tile back to grey (not on a set row). */
function wipeTile(run: PaintRun, tile: number, ev: StepEvents): void {
   const board = run.board;
   if (board.paint[tile] < 0 || board.set[run.course.tiles[tile].row]) return;
   board.paint[tile] = -1;
   board.painted -= 1;
   run.wipedTotal += 1;
   ev.wiped += 1;
}

function splash(run: PaintRun, tile: number, ev: StepEvents): void {
   const t = run.course.tiles[tile];
   const p = run.course.platforms[t.plat];
   for (const [dx, dz] of SPLASH) {
      const ix = t.ix + dx;
      const iz = t.iz + dz;
      if (ix < 0 || iz < 0 || ix >= p.nx || iz >= p.nz) continue;
      const id = p.cells[iz * p.nx + ix];
      if (id >= 0) paintTile(run, id, ev);
   }
}

/** Can the hero splat the Blob now (open core, within reach)? */
export function canSplat(run: PaintRun): boolean {
   const b = run.boss;
   const spec = run.course.boss;
   if (!b || !spec || b.step !== "vulnerable") return false;
   return Math.hypot(run.hero.x - spec.x, run.hero.z - spec.z) <= spec.r + HERO_R + SPLAT_REACH;
}

function power(run: PaintRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < run.powerReadyAt || ms <= h.stunUntil) return;
   const def = heroById(run.heroId);
   if (def.power === "double") return;
   if (def.power === "dash") {
      const len = Math.hypot(STICK.x, STICK.z);
      h.dashX = len > 0.2 ? STICK.x / len : Math.sin(h.facing);
      h.dashZ = len > 0.2 ? STICK.z / len : Math.cos(h.facing);
      h.dashUntil = ms + POWER_MS.dash;
      h.vy = Math.max(0, h.vy);
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** The solid box under the hero's feet (within 0.06 m), or -1. */
function support(run: PaintRun): number {
   const h = run.hero;
   let best = NONE;
   let bestTop = -Infinity;
   for (const b of run.course.boxes) {
      if (Math.abs(h.y - b.top) > 0.06) continue;
      boxOffset(run, b, PA);
      if (h.x < b.minX + PA.x - HERO_R * 0.4 || h.x > b.maxX + PA.x + HERO_R * 0.4 || h.z < b.minZ + PA.z - HERO_R * 0.4 || h.z > b.maxZ + PA.z + HERO_R * 0.4) continue;
      if (b.top > bestTop) {
         bestTop = b.top;
         best = b.id;
      }
   }
   return best;
}

const phased = (run: PaintRun): boolean => run.heroId === "vexa" && run.simMs <= run.hero.phaseUntil;

function pushOut(run: PaintRun): void {
   const h = run.hero;
   for (const b of run.course.boxes) {
      if (h.y >= b.top - 0.02 || h.y + HERO_H <= b.bottom) continue;
      boxOffset(run, b, PA);
      const minX = b.minX + PA.x - HERO_R;
      const maxX = b.maxX + PA.x + HERO_R;
      const minZ = b.minZ + PA.z - HERO_R;
      const maxZ = b.maxZ + PA.z + HERO_R;
      if (h.x <= minX || h.x >= maxX || h.z <= minZ || h.z >= maxZ) continue;
      if (b.top - h.y < 0.45 && h.vy <= 0) {
         h.y = b.top;
         h.vy = 0;
         continue;
      }
      const px = Math.min(h.x - minX, maxX - h.x);
      const pz = Math.min(h.z - minZ, maxZ - h.z);
      if (px < pz) h.x = h.x - minX < maxX - h.x ? minX : maxX;
      else h.z = h.z - minZ < maxZ - h.z ? minZ : maxZ;
   }
   // the Blob's body (a cylinder)
   const spec = run.course.boss;
   if (spec && run.boss && run.boss.step !== "done" && h.y < spec.y + 3) {
      const dx = h.x - spec.x;
      const dz = h.z - spec.z;
      const d = Math.hypot(dx, dz);
      const r = spec.r + HERO_R;
      if (d < r) {
         const l = d || 1;
         h.x = spec.x + (dx / l) * r;
         h.z = spec.z + ((d ? dz : 1) / l) * r;
      }
   }
   if (phased(run)) return;
   for (const w of run.course.ghostWalls) {
      if (h.y > w.y + 1.2 || h.y + HERO_H < w.y - 1.2) continue;
      const hx = w.normal === "x" ? 0.1 : 1;
      const hz = w.normal === "x" ? 1 : 0.1;
      const dx = h.x - w.x;
      const dz = h.z - w.z;
      const px = hx + HERO_R - Math.abs(dx);
      const pz = hz + HERO_R - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) h.x += dx >= 0 ? px : -px;
      else h.z += dz >= 0 ? pz : -pz;
   }
}

function land(run: PaintRun, id: number, ev: StepEvents): void {
   const h = run.hero;
   const b = run.course.boxes[id];
   h.ground = id;
   h.vy = 0;
   h.y = b.top;
   h.jumps = 0;
   h.jumpedSinceGround = false;
   ev.landed = true;
}

function stepBlots(run: PaintRun, ev: StepEvents): void {
   const c = run.course;
   const h = run.hero;
   const ms = run.simMs;
   for (let i = 0; i < c.blots.length; i++) {
      if (ms <= run.blotFrozen[i]) continue;
      if (run.owner) run.blotAt[i] += c.blots[i].speed / 1000;
      const p = blotPos(run, i);
      const t = fixedTileAt(c, p.x, p.z);
      if (run.owner && t !== run.blotTile[i]) {
         run.blotTile[i] = t;
         if (t >= 0) wipeTile(run, t, ev);
      }
      if (h.deadMs >= 0 || h.y > BLOT_H || Math.hypot(h.x - p.x, h.z - p.z) > BLOT_R + HERO_R) continue;
      if (ms <= h.shieldUntil) {
         run.blotFrozen[i] = ms + FREEZE_MS;
         run.blots += 1;
         ev.frozen = i;
      } else if (!phased(run)) hurt(run, ev, p.x, p.z);
   }
}

function stepRoller(run: PaintRun, ev: StepEvents): void {
   const c = run.course;
   const r = rollerAt(run, RV);
   if (!r) return;
   const h = run.hero;
   const u = run.simMs - r.cycle * ROLLER_CYCLE_MS;
   if (u === ROLLER.idleMs) ev.rollerGlow = true;
   if (u === ROLLER.idleMs + ROLLER.glowMs) ev.rollerGo = true;
   if (r.step !== "roll" || run.hz.rollerStopped === r.cycle) return;
   const [z0, z1] = laneBand(c, r.lane);
   const p = c.platforms[c.roller];
   // the tiles under the drum
   const ix = Math.floor((r.x - p.x0) / TILE);
   if (run.owner && ix >= 0 && ix < p.nx && ix + r.cycle * 1000 !== run.hz.rollerCol) {
      run.hz.rollerCol = ix + r.cycle * 1000;
      const iz0 = Math.round((z0 - p.z0) / TILE);
      for (let iz = iz0; iz < iz0 + 2; iz++) {
         const t = p.cells[iz * p.nx + ix];
         if (t >= 0) wipeTile(run, t, ev);
      }
   }
   if (h.deadMs >= 0 || h.y > 1.6 || h.z < z0 - HERO_R || h.z > z1 + HERO_R || Math.abs(h.x - r.x) > ROLLER.r + HERO_R) return;
   if (run.simMs <= h.shieldUntil) {
      run.hz.rollerStopped = r.cycle;
      ev.rollerStopped = true;
   } else hurt(run, ev, r.x - 1, h.z);
}

/** The slam stuns a hero inside its ring (or its twin's). */
function slamHits(run: PaintRun, spec: { x: number; z: number }, ev: StepEvents): void {
   const h = run.hero;
   const b = run.boss!;
   if (h.deadMs >= 0 || h.y >= 1.6) return;
   const r = SLAM_R[b.phase] ?? SLAM_R[0];
   for (let k = 0; k < (run.ring.twin ? 2 : 1); k++) {
      const cx = k === 0 ? run.ring.x : 2 * spec.x - run.ring.x;
      const cz = k === 0 ? run.ring.z : 2 * spec.z - run.ring.z;
      if (Math.hypot(h.x - cx, h.z - cz) <= r + HERO_R) hurt(run, ev, cx, cz);
   }
}

/** A slam's tell: the ring drops where the hero stands (and, in a twin slam, its mirror across the Blob). */
function beginSlam(run: PaintRun, ev: StepEvents): void {
   const b = run.boss!;
   const atk = BLOB.phases[b.phase].attacks;
   ev.bossTelegraph = true;
   run.ring.x = run.hero.x;
   run.ring.z = run.hero.z;
   run.ring.twin = atk[b.attack % atk.length]?.id === "twin";
}

function stepBossMs(run: PaintRun, ev: StepEvents): void {
   const b = run.boss;
   const spec = run.course.boss;
   if (!b || !spec) return;
   if (!run.owner) {
      // a co-op ally: the owner steps the Blob; its slam still lands on everyone in the ring
      if (b.step === "attack") slamHits(run, spec, ev);
      return;
   }
   const before = b.phase;
   const bev = stepBoss(b, BLOB, 1, run.bossEv);
   if (b.phase !== before) ev.bossPhase = true;
   if (bev.telegraph) beginSlam(run, ev);
   if (bev.attack) {
      ev.bossAttack = true;
      const r = SLAM_R[b.phase] ?? SLAM_R[0];
      const centres = run.ring.twin ? 2 : 1;
      for (let k = 0; k < centres; k++) {
         const cx = k === 0 ? run.ring.x : 2 * spec.x - run.ring.x;
         const cz = k === 0 ? run.ring.z : 2 * spec.z - run.ring.z;
         for (const t of run.course.tiles) {
            tileCentre(run, t.id, TC);
            if (Math.hypot(TC.x - cx, TC.z - cz) <= r) wipeTile(run, t.id, ev);
         }
      }
      slamHits(run, spec, ev);
   }
   if (b.step === "vulnerable" && run.hz.prevBossStep !== "vulnerable") ev.bossOpen = true;
   run.hz.prevBossStep = b.step;
}

function splat(run: PaintRun, ev: StepEvents): void {
   const b = run.boss!;
   const r = hitBoss(b, BLOB, 1, run.bossEv);
   ev.splat = true;
   if (r === "ignored") return;
   ev.bossHit = true;
   ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.boss);
   if (r === "phase") ev.bossPhase = true;
   if (r === "defeated") ev.bossDefeated = true;
   if (b.step === "telegraph") beginSlam(run, ev);
   run.hz.prevBossStep = b.step;
}

/** Is the Blob beaten (or is there none)? */
export function blobDown(run: PaintRun): boolean {
   const b = run.boss;
   return !b || b.step === "defeat" || b.step === "done";
}

function stepMs(run: PaintRun, jumpPressed: boolean, actionPressed: boolean, ev: StepEvents): void {
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   const c = run.course;
   const dt = 0.001;
   comboTick(run.combo, COMBO, ms);
   stepBlots(run, ev);
   stepRoller(run, ev);
   if (h.deadMs >= 0) {
      h.deadMs += 1;
      if (h.deadMs >= DEAD_MS) respawn(run, ev);
      stepBossMs(run, ev);
      endCheck(run, ev);
      return;
   }
   // a raft carries whoever stands on it
   let carryX = 0;
   let carryZ = 0;
   if (h.ground >= 0) {
      const g = c.boxes[h.ground];
      if (g.raft >= 0) {
         run.simMs -= 1;
         const a = raftOff(run, g.raft, { x: 0, z: 0 });
         run.simMs += 1;
         const b = raftOff(run, g.raft, { x: 0, z: 0 });
         carryX = b.x - a.x;
         carryZ = b.z - a.z;
      }
   }
   // Action: splat the open Blob at hand, else the hero power
   if (actionPressed && ms > h.stunUntil) {
      if (canSplat(run)) splat(run, ev);
      else power(run, ev);
   }
   if (jumpPressed) h.jumpBuf = ms + BUFFER_MS;
   const stunned = ms <= h.stunUntil;
   if (h.jumpBuf >= ms && !stunned) {
      const coyote = h.ground < 0 && !h.jumpedSinceGround && h.leftGroundMs >= 0 && ms - h.leftGroundMs <= COYOTE_MS;
      if (h.ground >= 0 || coyote) {
         h.vy = V_JUMP;
         h.ground = NONE;
         h.jumpedSinceGround = true;
         h.jumps = 1;
         h.jumpBuf = NONE;
         ev.jumped = true;
      } else if (h.jumps === 1 && heroById(run.heroId).power === "double") {
         h.vy = V_JUMP2;
         h.jumps = 2;
         h.jumpBuf = NONE;
         ev.doubled = true;
      }
   }
   const dashing = ms <= h.dashUntil;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
      if (h.ground < 0) h.vy = 0;
   } else {
      const wx = stunned ? 0 : STICK.x * V_RUN;
      const wz = stunned ? 0 : STICK.z * V_RUN;
      const acc = (h.ground >= 0 ? ACCEL_GROUND : ACCEL_AIR) * dt;
      const dvx = wx - h.vx;
      const dvz = wz - h.vz;
      const dv = Math.hypot(dvx, dvz);
      if (dv > acc) {
         h.vx += (dvx / dv) * acc;
         h.vz += (dvz / dv) * acc;
      } else {
         h.vx = wx;
         h.vz = wz;
      }
      const sp = Math.hypot(h.vx, h.vz);
      if (sp > V_RUN) {
         h.vx *= V_RUN / sp;
         h.vz *= V_RUN / sp;
      }
      if (h.ground < 0) h.vy -= GRAV * dt;
   }
   if (Math.hypot(h.vx, h.vz) > 0.3) h.facing = Math.atan2(h.vx, h.vz);
   h.x += h.vx * dt + carryX;
   h.z += h.vz * dt + carryZ;
   pushOut(run);
   const prevY = h.y;
   h.y += h.vy * dt;
   if (h.ground < 0 && h.vy <= 0) {
      for (const b of c.boxes) {
         if (prevY < b.top - 0.001 || h.y > b.top) continue;
         boxOffset(run, b, PA);
         if (h.x < b.minX + PA.x - HERO_R * 0.4 || h.x > b.maxX + PA.x + HERO_R * 0.4 || h.z < b.minZ + PA.z - HERO_R * 0.4 || h.z > b.maxZ + PA.z + HERO_R * 0.4) continue;
         land(run, b.id, ev);
         break;
      }
   } else if (h.ground < 0 && h.vy > 0) {
      for (const b of c.boxes) {
         if (prevY + HERO_H > b.bottom + 0.001 || h.y + HERO_H < b.bottom) continue;
         boxOffset(run, b, PA);
         if (h.x < b.minX + PA.x || h.x > b.maxX + PA.x || h.z < b.minZ + PA.z || h.z > b.maxZ + PA.z) continue;
         h.vy = 0;
         h.y = b.bottom - HERO_H;
         break;
      }
   }
   if (h.ground >= 0) {
      const s = support(run);
      if (s >= 0) {
         if (s !== h.ground) land(run, s, ev);
         h.y = c.boxes[s].top;
         const plat = platOfBox(c, s);
         if (plat >= 0) {
            const p = c.platforms[plat];
            // the fixed platform you stand on is where a fall puts you back
            if (p.raft < 0) h.spawn = p.spawn;
            const t = tileOn(run, p, h.x, h.z);
            if (t >= 0) paintTile(run, t, ev);
         }
      } else {
         h.ground = NONE;
         h.leftGroundMs = ms;
         h.vy = Math.min(h.vy, 0);
      }
   }
   if (h.y < VOID_Y) die(run, ev);
   if (h.deadMs >= 0) {
      stepBossMs(run, ev);
      endCheck(run, ev);
      return;
   }
   const my = h.y + 0.75;
   const reach = ms <= h.magnetUntil ? MAGNET_REACH : PICK_R;
   for (let i = 0; i < c.pickups.length; i++) {
      if (run.board.taken[i]) continue;
      const o = c.pickups[i];
      if (Math.hypot(h.x - o.x, my - o.y, h.z - o.z) > reach) continue;
      run.board.taken[i] = 1;
      ev.pickup = i;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.blob);
      splash(run, o.tile, ev);
   }
   if (Math.hypot(h.x - c.cage.x, my - c.cage.y, h.z - c.cage.z) <= PICK_R) secret(run, "ghost", ev);
   if (Math.hypot(h.x - c.high.x, my - c.high.y, h.z - c.high.z) <= PICK_R + 0.3) secret(run, "high", ev);
   stepBossMs(run, ev);
   endCheck(run, ev);
}

function endCheck(run: PaintRun, ev: StepEvents): void {
   if (run.ended !== null) return;
   if (run.board.painted === run.course.tiles.length) secret(run, "mural", ev);
   if (run.board.painted >= run.course.need && blobDown(run)) {
      finish(run, ev);
      return;
   }
   if (run.simMs >= run.course.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

// ---------- reading the run ----------

/** The share painted, in tenths of a percent. */
export function paintedPermille(run: PaintRun): number {
   return Math.floor((run.board.painted * 1000) / run.course.tiles.length);
}

export const STAT = {
   painted: "painted",
   need: "need",
   total: "total",
   rowsSet: "rowsSet",
   timeLeft: "timeLeft",
   blobs: "blobs",
   hero: "hero",
   power: "power",
   roller: "roller",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bonusMs: "bonusMs",
   finishMs: "finishMs",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   hint: "hint",
} as const;

export const HINT = { none: 0, paint: 1, rows: 2, blots: 3, raft: 4, roller: 5, slam: 6, splat: 7, died: 8, blob: 9, last: 10 } as const;

export function hintFor(run: PaintRun): number {
   if (run.ended !== null) return HINT.none;
   const h = run.hero;
   if (h.deadMs >= 0) return HINT.died;
   const b = run.boss;
   if (b && b.step !== "defeat" && b.step !== "done" && b.step !== "intro") {
      if (b.step === "vulnerable") return HINT.splat;
      if (b.step === "telegraph" || b.step === "attack") return HINT.slam;
   }
   if (run.course.roller >= 0) {
      const r = rollerAt(run, RV);
      if (r && (r.step === "glow" || r.step === "roll")) return HINT.roller;
   }
   if (run.board.painted >= run.course.need && !blobDown(run)) return HINT.blob;
   if (run.simMs < 6000) {
      if (run.course.rafts.length) return HINT.raft;
      if (run.course.blots.length) return HINT.blots;
      return run.board.rowsSet === 0 && run.board.painted > 3 ? HINT.rows : HINT.paint;
   }
   if (run.course.need - run.board.painted <= 5 && run.course.need > run.board.painted) return HINT.last;
   return HINT.none;
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.bonusMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export function badgeHits(run: PaintRun): number {
   return run.deaths + run.hurts;
}
