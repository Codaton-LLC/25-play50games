// Flooded Ruins Escape rules: the roofs as data, the integer-ms clock and its cap, kinematic movement
// with closed-form jumps, moving roofs as functions of rules time, vanishing roofs, icy roofs,
// checkpoints, falls and respawns (dead time = the time penalty), coins (a time bonus), the finish,
// and the lower bound behind the server limits. Pure and deterministic: no three.js, React, DOM,
// Math.random or Date.now. Scene.tsx maps the stick with inputToWorld(moveX, moveY, 0) and calls
// step() once per useRunFrame; rules.test.ts and bot.ts drive it directly.
//
// Clock: whole ms, the fraction carried to the next step (as obstacle-race), stepped 1 ms at a time,
// so a jump arc depends only on the ms since take-off and is the same at 30, 60 or 144 fps.
// No allocation after createRun(): the hero and the events object are rewritten in place.
// README.md "Rules" and "Server limits" explain the design and the proof; rules.test.ts checks them.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { heroById, type HeroId } from "./heroes";
import { MAGNET_REACH, POWER_MS, V_DASH } from "./powers";
import { LEVELS, type RoofLevel } from "./levels";
import { buildRoofs, type RoofStrike } from "./roofs";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

/** "Nothing": no support, no coyote, no buffered press. */
export const NONE = -1;
/** the most rules ms one frame may advance (the core caps dt at 1/20 s anyway) */
export const MAX_STEP_MS = 50;
/** the hero's collision: a vertical cylinder, feet at y */
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** top speed from the stick (m/s), and its acceleration (m/s²) on the ground and in the air */
export const V_RUN = 6.5;
export const ACCEL = { ground: 50, air: 32, ice: 36 } as const;
/** gravity (m/s²), jump and bounce-pad launch speeds (m/s) */
export const G = 30;
export const V_JUMP = 14;
export const V_BOUNCE = 22;
/** a jump still works this long after walking off an edge, and a press is kept this long */
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
/** the feet may stand this far past a platform's edge (landing and walking) */
export const FOOT = 0.15;
/** a fall this far below the last platform stood on is lost */
export const FALL_DEPTH = 7;
/** after a fall: frozen this long out of view, then this long on the checkpoint (the time penalty) */
export const LOST_MS = 900;
export const SPAWN_MS = 600;
/**
 * After you land on a blinking roof it stays solid this long, so a jump off is possible
 * before the gap in its cycle. Checkpoints and the goal never blink.
 */
export const GRIP_MS = 1600;
/** bounce pad: a square of this half size around its platform's centre */
export const PAD_HALF = 0.8;
/** platform colliders are this deep under their top (the visuals' rock hangs lower, no collision) */
export const THICKNESS = 1.4;
/** orbs: pickup radius around the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 0.95, bonusMs: 400, centerY: 0.6 } as const;

/** apex heights and times of the two launches (m, ms) */
export const H_JUMP = (V_JUMP * V_JUMP) / (2 * G);
export const H_BOUNCE = (V_BOUNCE * V_BOUNCE) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;
export const BOUNCE_APEX_MS = (1000 * V_BOUNCE) / G;

// ---------- the course ----------

export type SupportKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

/** A moving platform: offset along `axis` = travel · (2 · smoothstep(triangle(ms / period + phase)) - 1). */
export interface Mover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** A platform: its top is a rectangle (centre ± half sizes at rest), THICKNESS deep. */
export interface Support {
   kind: SupportKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   bottom: number;
   mover: Mover | null;
   /** a bounce pad in the middle of the top (unused on these roofs; the field stays for the launch) */
   pad: boolean;
   /** blinks out for `gone` of each cycle; null = always solid */
   vanish: { periodMs: number; gone: number; phase: number } | null;
   /** low ground traction (ACCEL.ice) */
   slippery: boolean;
}

export interface Orb extends Vec3Like {
   x: number;
   y: number;
   z: number;
}

export interface Course {
   supports: Support[];
   /** support indices of the checkpoints in order; [0] is the start */
   checkpoints: number[];
   goal: number;
   orbs: Orb[];
   /** the run clock's cap (ms): "timeup" (unranked) */
   durationMs: number;
   /** the fastest any platform moves (m/s): the carry bound of the proof */
   maxCarry: number;
   /** sideways gusts while airborne (Flood Rise, Final Escape) */
   wind: boolean;
   /** antenna arcs on roof rims; the centre of each roof is outside the strike */
   strikes: RoofStrike[];
}

export type { RoofStrike };

/** Top speed of a mover (m/s): smoothstep's slope peaks at 1.5. */
export function moverTopSpeed(m: Mover): number {
   return (m.travel * 2 * 1.5 * 2 * 1000) / m.periodMs;
}

/** The mover's offset (m) at rules ms `ms`. Polynomials only (no trigonometry): the same in every engine. */
export function moverOffset(m: Mover, ms: number): number {
   const cycles = ms / m.periodMs + m.phase;
   const t = cycles - Math.floor(cycles);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   const s = tri * tri * (3 - 2 * tri);
   return m.travel * (2 * s - 1);
}

export function supportX(s: Support, ms: number): number {
   return s.mover && s.mover.axis === "x" ? s.cx + moverOffset(s.mover, ms) : s.cx;
}

export function supportZ(s: Support, ms: number): number {
   return s.mover && s.mover.axis === "z" ? s.cz + moverOffset(s.mover, ms) : s.cz;
}

/** True while a blinking roof is absent. A roof with no vanish cycle is always there. */
export function roofGone(s: Support, ms: number): boolean {
   const v = s.vanish;
   if (!v) return false;
   const t = ms / v.periodMs + v.phase;
   const frac = t - Math.floor(t);
   return frac < v.gone;
}

function finishCourse(supports: Support[], level: RoofLevel, orbs: Orb[], strikes: RoofStrike[], wind: boolean): Course {
   const checkpoints = [0];
   supports.forEach((s, i) => {
      if (s.kind === "checkpoint") checkpoints.push(i);
   });
   const goal = supports.findIndex((s) => s.kind === "goal");
   let maxCarry = 0;
   for (const s of supports) if (s.mover) maxCarry = Math.max(maxCarry, moverTopSpeed(s.mover));
   return { supports, checkpoints, goal, orbs, durationMs: level.durationMs, maxCarry, strikes, wind };
}

/** Every level, including Drain Entry: buildRoofs. The course does not depend on the run seed. */
export function buildCourse(level: RoofLevel = LEVELS[1]): Course {
   const draft = buildRoofs(level);
   const supports: Support[] = draft.supports.map((s) => ({
      kind: s.kind,
      cx: s.cx,
      cz: s.cz,
      hw: s.hw,
      hd: s.hd,
      top: s.top,
      bottom: s.top - THICKNESS,
      mover: s.mover ? { ...s.mover } : null,
      pad: s.pad,
      vanish: s.vanish ? { ...s.vanish } : null,
      slippery: s.slippery,
   }));
   return finishCourse(supports, level, draft.orbs, draft.strikes, draft.wind);
}

/** A strike is live this ms (the same fraction on every device). */
export function strikeLive(st: RoofStrike, ms: number): boolean {
   const t = ms / st.periodMs + st.phase;
   const frac = t - Math.floor(t);
   return frac < st.duty;
}

/**
 * Sideways gust (m/s²) at rules ms. Peaks at WIND_PEAK, flips each period, polynomials only.
 * Applied in the air and then clamped to V_RUN, so a gust never outruns the proof's speed bound.
 */
export const WIND_PEAK = 3.5;
export const WIND_PERIOD_MS = 2800;

export function windAccelX(ms: number): number {
   const cyc = ms / WIND_PERIOD_MS;
   const t = cyc - Math.floor(cyc);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   const s = tri * tri * (3 - 2 * tri);
   const sign = Math.floor(cyc) % 2 === 0 ? 1 : -1;
   return sign * WIND_PEAK * (2 * s - 1);
}

export const COURSE: Course = buildCourse(LEVELS[1]);

/** Is (x, z) over the support's top at `ms` (its rectangle grown by FOOT)? */
export function onSupport(s: Support, x: number, z: number, ms: number): boolean {
   return Math.abs(x - supportX(s, ms)) <= s.hw + FOOT && Math.abs(z - supportZ(s, ms)) <= s.hd + FOOT;
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

/** The rectangle the feet can stand in on `s` over the whole run (a mover's sweep included), grown by FOOT. */
function standRect(s: Support): { minX: number; maxX: number; minZ: number; maxZ: number } {
   const tx = s.mover?.axis === "x" ? s.mover.travel : 0;
   const tz = s.mover?.axis === "z" ? s.mover.travel : 0;
   return {
      minX: s.cx - s.hw - FOOT - tx,
      maxX: s.cx + s.hw + FOOT + tx,
      minZ: s.cz - s.hd - FOOT - tz,
      maxZ: s.cz + s.hd + FOOT + tz,
   };
}

/** The shortest distance between two supports' stand rectangles (0 when they touch or overlap). */
export function standGap(a: Support, b: Support): number {
   const ra = standRect(a);
   const rb = standRect(b);
   const dx = Math.max(0, ra.minX - rb.maxX, rb.minX - ra.maxX);
   const dz = Math.max(0, ra.minZ - rb.maxZ, rb.minZ - ra.maxZ);
   return Math.sqrt(dx * dx + dz * dz);
}

/** The fastest a flight launched at `v` lands `dy` (> 0) above its launch: up through the apex and down to dy (s). */
export function riseLandS(v: number, dy: number): number {
   const h = (v * v) / (2 * G);
   if (dy >= h) return Infinity;
   return v / G + Math.sqrt((2 * (h - dy)) / G);
}

/**
 * The least time (ms) from one support to another: max(the vertical bound, the horizontal bound).
 * Infinity when no launch reaches. Ground time is taken as 0.
 */
export function edgeMinMs(course: Course, from: number, to: number, vRun = V_RUN): number {
   const a = course.supports[from];
   const b = course.supports[to];
   const vh = vRun + course.maxCarry;
   const flat = (1000 * standGap(a, b)) / vh;
   const dy = b.top - a.top;
   if (dy <= 0) return flat;
   let vertical = riseLandS(V_JUMP, dy);
   if (a.pad) vertical = Math.min(vertical, riseLandS(V_BOUNCE, dy));
   if (!Number.isFinite(vertical)) return Infinity;
   return Math.max(flat, 1000 * vertical);
}

/** Dijkstra over the supports with edgeMinMs: the least ms to stand on each one (Infinity = never). `vRun` is the horizontal cap (V_DASH to ask what a dash could save). */
export function minArrivalMs(course: Course, vRun = V_RUN): number[] {
   const n = course.supports.length;
   const best = new Array<number>(n).fill(Infinity);
   const done = new Array<boolean>(n).fill(false);
   best[course.checkpoints[0]] = 0;
   for (let round = 0; round < n; round++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || best[i] < best[u])) u = i;
      if (u < 0 || !Number.isFinite(best[u])) break;
      done[u] = true;
      for (let v = 0; v < n; v++) {
         if (done[v] || v === u) continue;
         const t = best[u] + edgeMinMs(course, u, v, vRun);
         if (t < best[v]) best[v] = t;
      }
   }
   return best;
}

/** The proven least finish ms of a course (README proof step 4). */
export function minFinishMs(course: Course, vRun = V_RUN): number {
   return minArrivalMs(course, vRun)[course.goal];
}

/** The least submitted duration: the least finish minus every orb's bonus (README proof step 5). */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs;
}

/**
 * Rising water. It starts under the drain floor and climbs the shaft. Standing in it ends the run
 * (unranked). It never makes a finish faster, so the least-time bound above still holds. Shield and
 * phase do not hold it back: the flood is the level.
 */
export const WATER_Y0 = -3.4;
export const WATER_MPS: Record<LevelId, number> = { 1: 0.16, 2: 0.18, 3: 0.2, 4: 0.22, 5: 0.24 };

/** The water surface (m) at rules time `ms`. */
export function waterY(level: LevelId, ms: number): number {
   return WATER_Y0 + WATER_MPS[level] * (Math.max(0, ms) / 1000);
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
 * About 8 % under the bound, rounded down to 100 ms, and never under 90 % of it.
 * A dash can shave about 260 ms; on a short roof climb that is more than 4.5 % of the bound,
 * so the margin has to cover that dash (rules.test.ts).
 */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.92) / 100) * 100;
   if (minDurationMs < lb * 0.9) minDurationMs = Math.ceil((lb * 0.9) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}

// ---------- the run ----------

export type HeroState = "play" | "lost" | "spawn";

export interface Hero extends Vec3Like {
   /** feet centre: x right, y up (feet), z forward = -z */
   x: number;
   y: number;
   z: number;
   /** the stick's velocity (m/s), eased towards V_RUN · stick */
   vx: number;
   vz: number;
   state: HeroState;
   grounded: boolean;
   /** the support stood on (index into course.supports), NONE in the air */
   support: number;
   /** the current arc in the air: y = arcY0 + arcV · t - G t² / 2, t = (ms - arcStart) / 1000 */
   arcStart: number;
   arcY0: number;
   arcV: number;
   /** the ms of the walk-off (coyote time runs from it), NONE otherwise */
   coyoteFrom: number;
   /** carry (m per ms) this ms on a mover; in the air the take-off's carry */
   carryX: number;
   carryZ: number;
   /** the top of the last support stood on (the fall line is FALL_DEPTH under it) */
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
   /** a blinking roof just landed on stays solid through this rules ms */
   gripUntil: number;
}

/** One frame of input. Scene fills one object per run and passes it every step. */
export interface StepInput {
   /** the stick in world space: inputToWorld(moveX, moveY, 0), so up is -z. Length <= 1 (longer is normalised). */
   moveX: number;
   moveZ: number;
   /** a jump press this frame (the core's jumpPressed: keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   /**
    * The hero power (keyboard E/Enter and the touch Power button both set the core's actionPressed).
    * One press, latched at the frame's first ms. No separate touch timing.
    */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, jumpPressed: false, actionPressed: false };
}

/** What happened in one step. The same object every step, reset at its start. */
export interface StepEvents {
   jumped: boolean;
   bounced: boolean;
   landed: boolean;
   /** the support of the latest landing in this step, NONE without one (a pad launches at once, so the hero may already be in the air) */
   landedOn: number;
   /** a checkpoint (1..) activated in this step, NONE otherwise */
   checkpoint: number;
   /** orbs collected in this step: their indices in orbList[0..orbCount) */
   orbCount: number;
   orbList: number[];
   lost: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   /** feet went under the rising water: the run ends unranked */
   flooded: boolean;
   /** a hero power actually fired this step (a press on cooldown does not) */
   powered: boolean;
}

export interface RoofRun {
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
   /** the ms a power press is applied, NONE if this frame had none. Cooldown is powerReadyAt. */
   actionMs: number;
   /** the power can fire again at this rules ms (0 = ready at the start) */
   powerReadyAt: number;
   /** the active checkpoint: 0 (the start) and up; respawns go to its support */
   checkpoint: number;
   respawns: number;
   /** 1 = collected, per course.orbs */
   collected: Uint8Array;
   orbs: number;
   finishMs: number;
   /** the highest top stood on (HUD "height") */
   bestTop: number;
   ended: "win" | "timeup" | "flood" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   const orbList = new Array<number>(32);
   for (let i = 0; i < orbList.length; i++) orbList[i] = 0;
   return { jumped: false, bounced: false, landed: false, landedOn: NONE, checkpoint: NONE, orbCount: 0, orbList, lost: false, respawned: false, finished: false, timeup: false, flooded: false, powered: false };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.bounced = false;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.checkpoint = NONE;
   ev.orbCount = 0;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.flooded = false;
   ev.powered = false;
}

const COURSES: Partial<Record<LevelId, Course>> = { 1: COURSE };

/** The level's course (built once per level). */
export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
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
      state: "play",
      grounded: true,
      support,
      arcStart: 0,
      arcY0: y,
      arcV: 0,
      coyoteFrom: NONE,
      carryX: 0,
      carryZ: 0,
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
      gripUntil: 0,
   };
}

/**
 * A new run on the start platform: at rest, grounded (the countdown is the start freeze).
 * Allocates everything the run will ever use. `heroId` defaults to Riko; the Scene passes the
 * overlay's pick (pickedHero). The power is ready at the start and its cooldown resets each run.
 */
export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = "riko"): RoofRun {
   const course = courseFor(level);
   const start = course.supports[course.checkpoints[0]];
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(start.cx, start.top, start.cz + 1.5, course.checkpoints[0]),
      pressMs: NONE,
      actionMs: NONE,
      powerReadyAt: 0,
      checkpoint: 0,
      respawns: 0,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      finishMs: 0,
      bestTop: start.top,
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
   h.grounded = false;
   h.support = NONE;
   if (v >= V_BOUNCE - 1e-6) h.apexCap = y0 + H_BOUNCE;
   else if (v > 0) h.apexCap = y0 + (v * v) / (2 * G);
   else h.apexCap = keep;
}

/** Shield or phase is up: gusts and lightning do not touch the hero. */
function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

/**
 * Nami's second jump. The new apex is capped at the flight's existing apexCap, so it cannot
 * reach a platform a single jump (or the bounce that started the flight) could not already reach.
 */
function tryDoubleJump(run: RoofRun, ms: number): boolean {
   const h = run.hero;
   if (h.grounded || !h.airJump) return false;
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

/** Fire the run's hero power if it is off cooldown. A press that cannot fire (Nami on the ground) does not start the cooldown. */
function tryPower(run: RoofRun, ms: number, mx: number, mz: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
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
      run.events.powered = true;
      return;
   }
   if (def.power === "doubleJump") {
      if (!tryDoubleJump(run, ms)) return;
      run.powerReadyAt = ms + def.cooldownMs;
      run.events.powered = true;
      run.events.jumped = true;
      return;
   }
   if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   run.events.powered = true;
}

function lightningHit(run: RoofRun, ms: number): boolean {
   const strikes = run.course.strikes;
   if (strikes.length === 0) return false;
   const h = run.hero;
   if (!h.grounded || h.support === NONE || hazardImmune(h, ms)) return false;
   const s = run.course.supports[h.support];
   for (let i = 0; i < strikes.length; i++) {
      const st = strikes[i];
      if (st.support !== h.support || !strikeLive(st, ms)) continue;
      const dx = h.x - (supportX(s, ms) + st.ox);
      const dz = h.z - (supportZ(s, ms) + st.oz);
      if (dx * dx + dz * dz <= st.radius * st.radius) return true;
   }
   return false;
}

/** The whole ms to simulate for a frame of `dtMs` (clamped to MAX_STEP_MS), the fraction carried. */
export function advanceClock(run: RoofRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * One frame: `dtMs` is useRunFrame's dt · 1000. Each whole ms: simMs += 1; the ms that reaches the
 * cap ends with "timeup"; else the hero's state acts. A finish or a time-up ends the step, and every
 * later step does nothing. Returns run.events (the same object every step). Allocates nothing.
 */
export function step(run: RoofRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   let mx = finite(input.moveX);
   let mz = finite(input.moveZ);
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

function tick(run: RoofRun, mx: number, mz: number): void {
   const h = run.hero;
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      // keep falling out of view (looks only: nothing collides)
      h.y = arcY(h, run.simMs);
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

function supportBox(s: Support, ms: number): AABB {
   const x = supportX(s, ms);
   const z = supportZ(s, ms);
   SCRATCH_BOX.min.x = x - s.hw;
   SCRATCH_BOX.max.x = x + s.hw;
   SCRATCH_BOX.min.z = z - s.hd;
   SCRATCH_BOX.max.z = z + s.hd;
   return SCRATCH_BOX;
}

function sideCollisions(course: Course, h: Hero, ms: number): void {
   const feet = h.y;
   const head = h.y + HERO.height;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      const gripped = i === h.support && ms <= h.gripUntil;
      if (!gripped && roofGone(s, ms)) continue;
      if (!(feet < s.top - 1e-9 && head > s.bottom)) continue;
      SCRATCH_P.x = h.x;
      SCRATCH_P.y = 0;
      SCRATCH_P.z = h.z;
      resolveSphereAabb(SCRATCH_P, HERO.radius, supportBox(s, ms), SCRATCH_P);
      h.x = SCRATCH_P.x;
      h.z = SCRATCH_P.z;
   }
}

/** Is the hero's centre inside a support's box at a height that collides (the progress guard's fallback)? */
function insideSolid(course: Course, x: number, z: number, feet: number, ms: number): boolean {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      if (!(feet < s.top - 1e-9 && feet + HERO.height > s.bottom)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return true;
   }
   return false;
}

/** The highest support whose top the feet crossed downwards this ms with the centre over it. */
function landingSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   let best = NONE;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      if (!(yOld >= s.top && s.top > yNew)) continue;
      if (best !== NONE && supports[best].top >= s.top) continue;
      if (onSupport(s, x, z, ms)) best = i;
   }
   return best;
}

/** A rising head that crosses a support's underside (centre under its box) stops rising. */
function headSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      if (!(yOld + HERO.height <= s.bottom && s.bottom < yNew + HERO.height)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return i;
   }
   return NONE;
}

function supportUnder(course: Course, h: Hero, ms: number): number {
   if (h.support !== NONE) {
      const current = course.supports[h.support];
      const gripped = ms <= h.gripUntil;
      if ((gripped || !roofGone(current, ms)) && onSupport(current, h.x, h.z, ms)) return h.support;
   }
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      if (Math.abs(s.top - h.y) < 1e-9 && onSupport(s, h.x, h.z, ms)) return i;
   }
   return NONE;
}

function playMs(run: RoofRun, mx: number, mz: number): void {
   const course = run.course;
   const h = run.hero;
   const ev = run.events;
   const ms = run.simMs;
   const x0 = h.x;
   const z0 = h.z;

   // 1. carry: the mover's own step this ms when grounded on one; in the air the take-off's
   let cx = h.carryX;
   let cz = h.carryZ;
   if (h.grounded) {
      const s = course.supports[h.support];
      cx = supportX(s, ms) - supportX(s, ms - 1);
      cz = supportZ(s, ms) - supportZ(s, ms - 1);
      h.carryX = cx;
      h.carryZ = cz;
   }

   // 2. jump: a buffered press, grounded or within coyote time
   if (run.pressMs !== NONE) {
      if (ms - run.pressMs > BUFFER_MS) {
         run.pressMs = NONE;
      } else if (h.grounded || (h.coyoteFrom !== NONE && ms - h.coyoteFrom <= COYOTE_MS)) {
         const y0 = h.grounded ? h.y : arcY(h, ms);
         startArc(h, ms, y0, V_JUMP);
         h.coyoteFrom = NONE;
         run.pressMs = NONE;
         ev.jumped = true;
      }
   }

   // 2b. hero power: the same action press on keyboard and touch, applied on one ms. A double jump
   // on the same ms as a ground jump would only replace that jump, so it waits for a later press.
   if (run.actionMs === ms) {
      run.actionMs = NONE;
      if (!(heroById(run.heroId).power === "doubleJump" && ev.jumped)) tryPower(run, ms, mx, mz);
   }

   // 3. ease the stick velocity towards V_RUN · stick, or snap to the dash. Wind is sideways, in the
   // air only, and the cap below keeps the step inside the proof (a dash uses V_DASH for that ms).
   const dashing = h.dashUntil >= ms;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else {
      const icy = h.grounded && h.support !== NONE && course.supports[h.support].slippery;
      const rate = ((h.grounded ? (icy ? ACCEL.ice : ACCEL.ground) : ACCEL.air) / 1000);
      let dvx = V_RUN * mx - h.vx;
      let dvz = V_RUN * mz - h.vz;
      const dv = Math.sqrt(dvx * dvx + dvz * dvz);
      if (dv > rate) {
         dvx *= rate / dv;
         dvz *= rate / dv;
      }
      h.vx += dvx;
      h.vz += dvz;
      if (!h.grounded && course.wind && !hazardImmune(h, ms)) h.vx += windAccelX(ms) / 1000;
   }
   const speedCap = dashing ? V_DASH : V_RUN;
   const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
   if (speed > speedCap) {
      h.vx *= speedCap / speed;
      h.vz *= speedCap / speed;
   }

   // 4. move by the stick velocity plus the carry
   h.x += h.vx / 1000 + cx;
   h.z += h.vz / 1000 + cz;

   // 5. vertical: walk-off, the arc (head bump, landing)
   if (h.grounded) {
      const s = supportUnder(course, h, ms);
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
         const hit = headSupport(course, h.x, h.z, yOld, yNew, ms);
         if (hit !== NONE) {
            // bump: start falling from just under the support
            yNew = Math.min(yOld, course.supports[hit].bottom - HERO.height - 1e-6);
            startArc(h, ms, yNew, 0);
            h.coyoteFrom = NONE;
         }
      }
      h.y = yNew;
      if (yNew < yOld) {
         const s = landingSupport(course, h.x, h.z, yOld, yNew, ms);
         if (s !== NONE) {
            const top = course.supports[s].top;
            h.y = top;
            h.grounded = true;
            h.support = s;
            h.coyoteFrom = NONE;
            h.lastTop = top;
            h.airJump = true;
            h.apexCap = top + H_JUMP;
            h.gripUntil = course.supports[s].vanish ? ms + GRIP_MS : 0;
            if (top > run.bestTop) run.bestTop = top;
            ev.landed = true;
            ev.landedOn = s;
         }
      }
   }

   // 6. side collisions
   sideCollisions(course, h, ms);

   // 7. progress guard: the non-carry step (stick + push-outs + wind) is at most the speed cap
   const maxMove = (h.dashUntil >= ms ? V_DASH : V_RUN) / 1000;
   const dx = h.x - x0 - cx;
   const dz = h.z - z0 - cz;
   const moved = Math.sqrt(dx * dx + dz * dz);
   if (moved > maxMove) {
      const k = maxMove / moved;
      h.x = x0 + cx + dx * k;
      h.z = z0 + cz + dz * k;
      if (insideSolid(course, h.x, h.z, h.y, ms)) {
         h.x = x0 + cx;
         h.z = z0 + cz;
      }
   }

   // 8. orbs
   const orbs = course.orbs;
   const my = h.y + ORB.centerY;
   const reach = h.magnetUntil >= ms ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach) {
         run.collected[i] = 1;
         run.orbs += 1;
         if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      }
   }

   // 9. the flood, then the fall line. Water ends the run; a dry fall still respawns.
   if (h.y <= waterY(run.level, ms)) {
      run.ended = "flood";
      ev.flooded = true;
      return;
   }
   if (!h.grounded && h.y < h.lastTop - FALL_DEPTH) {
      lose(run);
      return;
   }
   if (!h.grounded) return;

   // 10. lightning on the rim (shield and phase ignore it)
   if (lightningHit(run, ms)) {
      lose(run);
      return;
   }

   // 11. a bounce pad under the feet launches at once (walking onto it too)
   const s = course.supports[h.support];
   if (s.pad && Math.abs(h.x - s.cx) <= PAD_HALF && Math.abs(h.z - s.cz) <= PAD_HALF) {
      startArc(h, ms, h.y, V_BOUNCE);
      h.coyoteFrom = NONE;
      h.carryX = 0;
      h.carryZ = 0;
      run.pressMs = NONE;
      ev.bounced = true;
      return;
   }

   // 12. checkpoints, forward only
   for (let k = run.checkpoint + 1; k < course.checkpoints.length; k++) {
      if (course.checkpoints[k] === h.support) {
         run.checkpoint = k;
         ev.checkpoint = k;
         break;
      }
   }

   // 13. the goal
   if (h.support === course.goal) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function lose(run: RoofRun): void {
   const h = run.hero;
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.vx = 0;
   h.vz = 0;
   h.carryX = 0;
   h.carryZ = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   run.events.lost = true;
}

/** Back on the active checkpoint's centre, at rest, frozen for SPAWN_MS. */
function respawn(run: RoofRun): void {
   const h = run.hero;
   const index = run.course.checkpoints[run.checkpoint];
   const s = run.course.supports[index];
   h.x = s.cx;
   h.y = s.top;
   h.z = s.cz + (run.checkpoint === 0 ? 1.5 : 0);
   h.vx = 0;
   h.vz = 0;
   h.grounded = true;
   h.support = index;
   h.arcStart = run.simMs;
   h.arcY0 = s.top;
   h.arcV = 0;
   h.coyoteFrom = NONE;
   h.carryX = 0;
   h.carryZ = 0;
   h.lastTop = s.top;
   h.dashUntil = NONE;
   h.airJump = true;
   h.apexCap = s.top + H_JUMP;
   h.gripUntil = 0;
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- the store hand-off (README "Scoring") ----------

/** HUD and hand-off stats. */
export const STAT = { orbs: "orbs", height: "height", checkpoint: "checkpoint", finishMs: "finishMs", falls: "falls", hero: "hero", power: "power" } as const;

/** The run time a player sees and submits: play ms minus the orb bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs);
}

/**
 * GameDefinition.finalScore: a win submits the finish ms minus the orb bonus (the Scene publishes
 * finishMs and orbs with setStat before end("win")); any other end keeps elapsedMs (unranked anyway).
 */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
