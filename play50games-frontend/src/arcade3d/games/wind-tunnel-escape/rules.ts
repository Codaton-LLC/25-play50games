// Wind Tunnel Escape rules (the design card's REDIRECT): turn fans (a tap = 90°, a held Action
// switches them off / on) and switch vents so the currents chain across gaps, up shafts and out of the
// exit, then ride them (no jumping needed, steering stays inside the current); crosswinds add as
// vectors where currents cross; lift platforms ride their vents; rail fans slide, auto fans turn
// themselves, drones bump; the violet storm front follows (it waits while a fan-setup room is unsolved,
// the card's risk fix) and drains a heart a second inside it; the hero roles; orbs (a time bonus), the
// flow meter, secrets; the level 5 Gale Engine; and the lower bound behind the server limits.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx passes the stick
// plus the orbit camera's yaw (StepInput.yaw) and step() turns it camera-relative with core
// inputToWorld; tests and bot.ts drive it with yaw 0.
//
// Clock: whole STEP_MS (2 ms) substeps, the fraction carried, so every result depends only on rules ms:
// the same at 30, 60 or 144 fps. README "Rules" and "Server limits" explain the design and the proof.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, ESCAPE, GALE_ENGINE, SECRETS } from "./progression";
import { DIR_X, DIR_Z, FAN_FACE, FAN_R, HUB, VENT_R, VENT_TOP, buildCourse, type Box, type Course, type FanDef } from "./tunnel";

export type { Course, FanDef, Box } from "./tunnel";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

export const NONE = -1;
/** the rules' fixed substep (ms) and the most one frame may advance */
export const STEP_MS = 2;
export const MAX_FRAME_MS = 50;
/** the hero's box: half-width and height */
export const HERO_R = 0.35;
export const HERO_H = 1.3;
/** the middle the currents and pickups read (over the feet) */
export const MID = 0.65;
export const V_RUN = 6.5;
export const ACCEL = { ground: 60, air: 24 } as const;
export const G = 30;
export const V_JUMP = 11;
export const V_FALL_MAX = 26;
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
/** a current carries at this speed along its direction; steering adds this much inside it */
export const V_JET = 7;
export const V_STEER = 2.6;
/** overlapping currents add as vectors, capped here (horizontal) and for the up-currents */
export const V_JET_MAX = 9.9;
export const V_UP_MAX = 9;
/** the z guard: no state moves the hero towards -z faster than this (a dash: V_DASH). The proof's one rule. */
export const V_ZMAX = 7.5;
/** fans: the reach to turn one, a tap's turn time (its current is off meanwhile), a hold that switches it */
export const FAN_REACH = 2.8;
export const FAN_REACH_UP = 3.4;
export const FAN_REACH_DOWN = 2.4;
export const TURN_MS = 280;
export const HOLD_MS = 450;
/** currents end this far before a wall, so a rider at the wall drops out */
export const WALL_GAP = 0.6;
/** lift platforms: speed (m/s), thickness */
export const LIFT_V = 3;
export const LIFT_T = 0.6;
/** hearts; a hit's invulnerability; a fall or knock-out costs LOST_MS + SPAWN_MS */
export const HEARTS = 3;
export const INVULN_MS = 1200;
export const LOST_MS = 900;
export const SPAWN_MS = 600;
export const FALL_DEPTH = 7;
/** the storm drains a heart this long after you step in, then every second */
export const STORM_FIRST_MS = 400;
export const STORM_EVERY_MS = 1000;
/** orbs: pickup radius round the hero's middle, the time bonus each */
export const ORB = { pickup: 1.0, bonusMs: 200, centerY: 0.6 } as const;
export const SECRET_R = 1.2;
export const DRONE_R = 0.95;
export const HINT_MS = 20_000;

// ---------- the course ----------

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}

export const COURSE: Course = courseFor(1);

/** Where a rail fan stands at rules ms (dwell at x0, slide, dwell at x1, slide back). */
export function fanX(f: FanDef, ms: number): number {
   const r = f.rail;
   if (!r) return f.x;
   const cycle = 2 * (r.dwellMs + r.moveMs);
   const t = (((ms + r.phaseMs) % cycle) + cycle) % cycle;
   const ease = (k: number) => k * k * (3 - 2 * k);
   if (t < r.dwellMs) return r.x0;
   if (t < r.dwellMs + r.moveMs) return r.x0 + (r.x1 - r.x0) * ease((t - r.dwellMs) / r.moveMs);
   if (t < 2 * r.dwellMs + r.moveMs) return r.x1;
   return r.x1 + (r.x0 - r.x1) * ease((t - 2 * r.dwellMs - r.moveMs) / r.moveMs);
}

/** A rail fan's dwell: at which end (0 / 1, -1 while sliding) and how many ms are left there. */
export function railDwell(f: FanDef, ms: number): { end: number; leftMs: number } {
   const r = f.rail;
   if (!r) return { end: -1, leftMs: 0 };
   const cycle = 2 * (r.dwellMs + r.moveMs);
   const t = (((ms + r.phaseMs) % cycle) + cycle) % cycle;
   if (t < r.dwellMs) return { end: 0, leftMs: r.dwellMs - t };
   if (t >= r.dwellMs + r.moveMs && t < 2 * r.dwellMs + r.moveMs) return { end: 1, leftMs: 2 * r.dwellMs + r.moveMs - t };
   return { end: -1, leftMs: 0 };
}

/** A drone's centre at rules ms. */
export function dronePos(c: Course, i: number, ms: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const d = c.drones[i];
   const a = ((ms + d.phaseMs) / d.periodMs) * Math.PI * 2;
   out.x = d.x + Math.sin(a) * d.ax;
   out.y = d.y + Math.sin(a * 2) * 0.25;
   out.z = d.z;
   return out;
}

/** The ray (axis) from (ox, oy, oz) along (dx, dy, dz) to the first block that stops currents, at most maxLen. */
function rayReach(c: Course, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxLen: number): number {
   let best = maxLen;
   for (const b of c.blocks) {
      // covers sit on their vents; housings never cut a current (a fan's own would)
      if (b.kind === "cover" || b.look === "housing") continue;
      let t0 = 0;
      let t1 = best;
      const slab = (o: number, d: number, lo: number, hi: number): boolean => {
         if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
         let a = (lo - o) / d;
         let z = (hi - o) / d;
         if (a > z) [a, z] = [z, a];
         if (a > t0) t0 = a;
         if (z < t1) t1 = z;
         return t0 <= t1;
      };
      if (!slab(ox, dx, b.x0, b.x1) || !slab(oy, dy, b.y0, b.y1) || !slab(oz, dz, b.z0, b.z1)) continue;
      if (t0 < best) best = t0;
   }
   return best;
}

/** The reach of a fan's current pointing `dir` from x (walls cut it, WALL_GAP short), or a vent's up. */
export function currentReach(c: Course, f: FanDef, dir: number, x = f.x): number {
   if (f.kind === "vent") {
      const len = rayReach(c, x, f.y + VENT_TOP, f.z, 0, 1, 0, f.length);
      return len < f.length ? Math.max(0, len - WALL_GAP) : len;
   }
   const ox = x + DIR_X[dir] * FAN_FACE;
   const oz = f.z + DIR_Z[dir] * FAN_FACE;
   const len = rayReach(c, ox, f.y + HUB, oz, DIR_X[dir], 0, DIR_Z[dir], f.length);
   return len < f.length ? Math.max(0, len - WALL_GAP) : len;
}

/** Each fan's reach per direction (rail fans: per end), cached per course. */
const REACH = new WeakMap<Course, Float64Array[]>();
function reachTable(c: Course): Float64Array[] {
   let t = REACH.get(c);
   if (!t) {
      t = c.fans.map((f) => {
         const a = new Float64Array(8);
         for (let d = 0; d < 4; d++) {
            a[d] = currentReach(c, f, d, f.rail ? f.rail.x0 : f.x);
            a[4 + d] = currentReach(c, f, d, f.rail ? f.rail.x1 : f.x);
         }
         return a;
      });
      REACH.set(c, t);
   }
   return t;
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

/** The least ms to cover `dist` m towards -z at V_ZMAX (a substep may overshoot by one). */
export function zFloorMs(dist: number, v = V_ZMAX): number {
   return Math.max(0, (dist * 1000) / v - STEP_MS);
}

/** The earliest rules ms after it wakes that the Gale Engine can be done (every window hit at once). */
export function bossMinMs(): number {
   const s = createBoss(GALE_ENGINE);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, GALE_ENGINE, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, GALE_ENGINE, 1, ev);
      if (s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** The proof's pieces: z distance before the boss wakes and after its gate, or the whole run. */
export function boundSegments(c: Course): { before: number; after: number; boss: number } {
   const travel = c.startZ - c.goalNearZ;
   if (!c.arena) return { before: travel, after: 0, boss: 0 };
   const gateFront = c.arena.z1 + HERO_R;
   return { before: c.startZ - c.arena.z0, after: gateFront - c.goalNearZ, boss: BOSS_MIN_MS };
}

/** The proven least finish ms: the z floor, and on level 5 the boss's least done time between the pieces. */
export function minFinishMs(c: Course): number {
   const s = boundSegments(c);
   if (!c.arena) return zFloorMs(s.before);
   return zFloorMs(s.before) + s.boss + zFloorMs(s.after);
}

/** What the course can feed the flow meter: every orb, each room's checkpoint and each room's setup once. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: c.rooms.length, base: COMBO_BASE_MS.checkpoint },
         { count: c.rooms.length, base: COMBO_BASE_MS.setup },
      ],
   };
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus. */
export function minDurationMsOf(c: Course): number {
   return minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c));
}

/**
 * Riko's dash: on for at most POWER_MS.dash + STEP_MS at V_DASH where the floor counted V_ZMAX, so it
 * saves at most that times (V_DASH - V_ZMAX) / V_ZMAX ms; a piece that takes T fired at most
 * 1 + floor(T / cooldown) dashes. Each piece's least T, the boss between, less the orbs and the flow.
 */
export function dashFloorMs(c: Course): number {
   const perDash = ((POWER_MS.dash + STEP_MS) * (V_DASH - V_ZMAX)) / V_ZMAX;
   const cd = heroById("riko").cooldownMs;
   const piece = (dist: number) => {
      const F = zFloorMs(dist);
      let T = 0;
      while (T + perDash * (1 + Math.floor(T / cd)) < F) T += 1;
      return T;
   };
   const s = boundSegments(c);
   const T = c.arena ? piece(s.before) + s.boss + piece(s.after) : piece(s.before);
   return T - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms, never above the dash floor. */
export function proposeLimits(c: Course): LevelLimits {
   const lb = minDurationMsOf(c);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   minDurationMs = Math.max(100, Math.min(minDurationMs, Math.floor(dashFloorMs(c) / 100) * 100));
   const timeBaseMs = c.config.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

// ---------- the run ----------

export type HeroState = "play" | "lost" | "spawn";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   state: HeroState;
   timerMs: number;
   grounded: boolean;
   /** standing on this lift (index), NONE otherwise */
   onLift: number;
   coyoteUntil: number;
   bufferUntil: number;
   /** Nami's air jumps used this flight; she hops out of a current's hold until hopUntil */
   airJumps: number;
   hopUntil: number;
   hearts: number;
   invulnUntil: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** facing (unit, xz) */
   faceX: number;
   faceZ: number;
   /** in a current this substep (how many), and whether it was an up-current */
   riding: number;
   ridingUp: boolean;
   /** where a fall / knock-out happened (the respawn never moves ahead of it) */
   lostZ: number;
}

export interface StepInput {
   /** the stick: screen-relative (moveX right, moveZ = the core's moveY, up = -1), turned by `yaw` */
   moveX: number;
   moveZ: number;
   /** the camera's yaw (rad) the stick is relative to: the orbit camera's viewYaw; 0 = world space */
   yaw: number;
   /** a jump press this frame (keyboard and touch alike), latched at the frame's first substep */
   jumpPressed: boolean;
   jumpHeld: boolean;
   /** Action pressed this frame / held (a tap turns a fan, a hold switches it, away from fans: the power) */
   actionPressed: boolean;
   actionHeld: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, actionHeld: false };
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   landSpeed: number;
   /** a fan turned (index, NONE otherwise) and a fan / vent switched */
   turned: number;
   switched: number;
   /** a room's setup came right this step (room index) */
   setup: number;
   checkpoint: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   rideStart: boolean;
   rideEnd: boolean;
   hit: boolean;
   /** the hit was the storm */
   stormHit: boolean;
   lost: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   dashed: boolean;
   coverBroken: number;
   anemo: number;
   stormWoke: boolean;
   comboBonus: number;
   comboLinked: boolean;
   bossWoke: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossDone: boolean;
   /** a side fan sent the blast back / a crate went into the intake (index) */
   returned: number;
   crateIn: number;
}

/** A flying crate of the Gale Engine fight (phase 2). */
export interface Crate {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   /** "none" before phase 2, "live" in play, "in" once in the intake */
   state: "none" | "live" | "in";
}

/**
 * The tunnel's shared world: fans, covers, lifts, orbs, anemometers, the storm, the rooms, the boss.
 * One per run solo; in local multiplayer every run shares one (multiplayer.ts), and only the owner run
 * advances what moves on its own (lifts, crates, the storm, the boss).
 */
export interface World {
   dir: Int8Array;
   on: Uint8Array;
   turnUntil: Float64Array;
   broken: Uint8Array;
   liftY: Float64Array;
   collected: Uint8Array;
   anemoOpen: Uint8Array;
   solved: Uint8Array;
   /** when each room was first entered (-1 = not yet) */
   entered: Float64Array;
   storm: { active: boolean; z: number };
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   spent: Uint8Array;
   crates: Crate[];
   pending: number;
   escapeAt: number;
   /** the owner run's clock (what the shared world has been advanced to) */
   ms: number;
}

export interface WindRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   hero: Hero;
   world: World;
   /** this run advances the shared world (solo: always) */
   owner: boolean;
   /** the lift tops this run last saw (to carry its hero) */
   seenLift: Float64Array;
   /** the fan the current Action press began next to, when it began, and whether its hold already fired */
   pressFan: number;
   pressMs: number;
   pressDone: boolean;
   powerReadyAt: number;
   /** the room whose checkpoint is the respawn spot */
   checkpoint: number;
   room: number;
   respawns: number;
   orbs: number;
   mainOrbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   stormTouched: boolean;
   stormAcc: number;
   /** the last Gale Engine blast that hit this hero (one hit per blast) */
   blastKey: number;
   /** the room whose ghost hint shows (NONE) */
   hint: number;
   bestDist: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      airJumped: false,
      landed: false,
      landSpeed: 0,
      turned: NONE,
      switched: NONE,
      setup: NONE,
      checkpoint: NONE,
      orbCount: 0,
      orbList: new Array<number>(32).fill(0),
      secretCount: 0,
      secretList: [0, 0, 0],
      rideStart: false,
      rideEnd: false,
      hit: false,
      stormHit: false,
      lost: false,
      respawned: false,
      finished: false,
      timeup: false,
      powered: false,
      dashed: false,
      coverBroken: NONE,
      anemo: NONE,
      stormWoke: false,
      comboBonus: 0,
      comboLinked: false,
      bossWoke: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      bossDone: false,
      returned: NONE,
      crateIn: NONE,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = ev.airJumped = ev.landed = false;
   ev.landSpeed = 0;
   ev.turned = ev.switched = ev.setup = ev.checkpoint = NONE;
   ev.orbCount = ev.secretCount = 0;
   ev.rideStart = ev.rideEnd = ev.hit = ev.stormHit = ev.lost = ev.respawned = ev.finished = ev.timeup = false;
   ev.powered = ev.dashed = false;
   ev.coverBroken = ev.anemo = NONE;
   ev.stormWoke = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.bossWoke = ev.bossTelegraph = ev.bossAttack = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.bossDone = false;
   ev.returned = ev.crateIn = NONE;
}

export function createWorld(c: Course): World {
   return {
      dir: Int8Array.from(c.fans.map((f) => f.dir)),
      on: Uint8Array.from(c.fans.map((f) => (f.on ? 1 : 0))),
      turnUntil: new Float64Array(c.fans.length).fill(-1),
      broken: new Uint8Array(c.blocks.length),
      liftY: Float64Array.from(c.lifts.map((l) => l.y0)),
      collected: new Uint8Array(c.orbs.length),
      anemoOpen: new Uint8Array(c.anemos.length),
      solved: new Uint8Array(c.rooms.length),
      entered: new Float64Array(c.rooms.length).fill(-1),
      storm: { active: false, z: 0 },
      boss: c.arena ? createBoss(GALE_ENGINE) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      spent: new Uint8Array(c.fans.length),
      crates: c.crates.map(() => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, state: "none" as const })),
      pending: 0,
      escapeAt: -1,
      ms: 0,
   };
}

function freshHero(x: number, y: number, z: number): Hero {
   return {
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      state: "play",
      timerMs: 0,
      grounded: true,
      onLift: NONE,
      coyoteUntil: 0,
      bufferUntil: -1,
      airJumps: 0,
      hopUntil: -1,
      hearts: HEARTS,
      invulnUntil: -1,
      dashUntil: -1,
      dashX: 0,
      dashZ: -1,
      shieldUntil: -1,
      magnetUntil: -1,
      phaseUntil: -1,
      faceX: 0,
      faceZ: -1,
      riding: 0,
      ridingUp: false,
      lostZ: z,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, world?: World): WindRun {
   const course = courseFor(level);
   const w = world ?? createWorld(course);
   return {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      hero: freshHero(course.start.x, course.start.y, course.start.z),
      world: w,
      owner: !world,
      seenLift: Float64Array.from(w.liftY),
      pressFan: NONE,
      pressMs: 0,
      pressDone: false,
      powerReadyAt: 0,
      checkpoint: 0,
      room: 0,
      respawns: 0,
      orbs: 0,
      mainOrbs: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      stormTouched: false,
      stormAcc: -1,
      blastKey: -1,
      hint: NONE,
      bestDist: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
}

// ---------- queries (the Scene, the bot and the tests read these) ----------

/** The fan's direction at rules ms (auto fans turn themselves every autoMs). */
export function fanDir(run: WindRun, i: number, ms = run.ms): number {
   const f = run.course.fans[i];
   if (f.autoMs) return (f.dir + Math.floor(ms / f.autoMs)) % 4;
   return run.world.dir[i];
}

/** Ms left before an auto fan turns again. */
export function autoLeftMs(f: FanDef, ms: number): number {
   return f.autoMs ? f.autoMs - (ms % f.autoMs) : Infinity;
}

/** The Gale Engine's gate is open (its collapse is done). */
export function gateOpen(run: WindRun): boolean {
   const b = run.world.boss;
   return !b || b.step === "done";
}

/** A fan or vent is blowing right now. */
export function fanLive(run: WindRun, i: number, ms = run.ms): boolean {
   const f = run.course.fans[i];
   const w = run.world;
   if (f.lift !== undefined) return false;
   if (!w.on[i] || w.turnUntil[i] > ms) return false;
   if (f.cover !== undefined && !w.broken[f.cover]) return false;
   if (f.hidden !== undefined && !w.anemoOpen[f.hidden]) return false;
   if (f.boss === "side" && w.spent[i]) return false;
   if ((f.boss === "crateVent" || f.boss === "crateFan") && !(w.boss && w.boss.phase >= 1)) return false;
   return true;
}

/** A fan the hero can work right now (turn / switch). */
export function fanUsable(run: WindRun, i: number): boolean {
   const f = run.course.fans[i];
   const w = run.world;
   if (!f.turnable && !f.toggle) return false;
   if (f.autoMs) return false;
   if (f.cover !== undefined && !w.broken[f.cover]) return false;
   if (f.hidden !== undefined) return false;
   if (f.boss === "side" && w.spent[i]) return false;
   if ((f.boss === "crateVent" || f.boss === "crateFan") && !(w.boss && w.boss.phase >= 1)) return false;
   if (f.boss && w.boss && (w.boss.step === "defeat" || w.boss.step === "done")) return false;
   return true;
}

/** The current's reach right now (rail fans read the end they are at, or the shorter while sliding). */
export function liveReach(run: WindRun, i: number, ms = run.ms): number {
   const t = reachTable(run.course)[i];
   const f = run.course.fans[i];
   const d = f.kind === "vent" ? 0 : fanDir(run, i, ms);
   if (!f.rail) return t[d];
   const k = railDwell(f, ms).end;
   return k === 0 ? t[d] : k === 1 ? t[4 + d] : Math.min(t[d], t[4 + d]);
}

/** The block is solid for the hero now. */
function solidFor(run: WindRun, bi: number, phasing: boolean): boolean {
   const b = run.course.blocks[bi];
   if (b.kind === "solid") return true;
   if (b.kind === "cover") return !run.world.broken[bi];
   if (b.kind === "ghost") return !phasing;
   if (b.kind === "shutter") return run.world.bossAwake && !gateOpen(run);
   return !gateOpen(run);
}

/** The room the z is in (clamped to the course). */
export function roomAt(c: Course, z: number): number {
   const rs = c.rooms;
   for (let i = 0; i < rs.length; i++) if (z > rs[i].z1) return i;
   return rs.length - 1;
}

/** Is this room's fan setup right now? */
export function roomSolved(run: WindRun, r: number): boolean {
   const room = run.course.rooms[r];
   if (run.course.arena && r === roomAt(run.course, run.course.arena.z0)) return gateOpen(run);
   for (const p of room.solution) {
      const live = run.world.on[p.fan] === 1;
      if (p.on !== undefined && live !== p.on) return false;
      if (p.dir !== undefined && fanDir(run, p.fan) !== p.dir) return false;
      if (p.notDir !== undefined && live && fanDir(run, p.fan) === p.notDir) return false;
   }
   return true;
}

// ---------- currents ----------

interface Field {
   hx: number;
   hz: number;
   /** the up-currents' vertical target (sum) and how many */
   up: number;
   vents: number;
   /** horizontal currents, the axis height to hold, the one current's lateral clamp */
   fans: number;
   axisY: number;
   clampUx: number;
   clampUz: number;
   lat: number;
   /** a rail fan's slide speed (x) the rider inherits */
   railVx: number;
}

const FIELD: Field = { hx: 0, hz: 0, up: 0, vents: 0, fans: 0, axisY: 0, clampUx: 0, clampUz: 0, lat: 0, railVx: 0 };

/** The currents at a point (the hero's or a crate's middle), written into FIELD. */
function fieldAt(run: WindRun, px: number, py: number, pz: number, ms: number, out: Field): Field {
   out.hx = out.hz = out.up = out.axisY = out.lat = out.railVx = 0;
   out.vents = out.fans = 0;
   out.clampUx = out.clampUz = 0;
   const fans = run.course.fans;
   for (let i = 0; i < fans.length; i++) {
      const f = fans[i];
      if (!fanLive(run, i, ms)) continue;
      const reach = liveReach(run, i, ms);
      if (f.kind === "vent") {
         const dx = px - f.x;
         const dz = pz - f.z;
         if (dx * dx + dz * dz > VENT_R * VENT_R) continue;
         const base = f.y + VENT_TOP;
         const top = base + reach;
         if (py < base - 0.8 || py > top + 0.4) continue;
         out.up += V_JET * Math.max(-1, Math.min(1, (top - 0.3 - py) / 1.4));
         out.vents += 1;
         continue;
      }
      const d = fanDir(run, i, ms);
      const ux = DIR_X[d];
      const uz = DIR_Z[d];
      const fx = fanX(f, ms);
      const ox = fx + ux * FAN_FACE;
      const oy = f.y + HUB;
      const oz = f.z + uz * FAN_FACE;
      const along = (px - ox) * ux + (pz - oz) * uz;
      if (along < -0.4 || along > reach) continue;
      // lateral: the horizontal perpendicular (-uz, ux)
      const lat = (px - ox) * -uz + (pz - oz) * ux;
      const vert = py - oy;
      if (lat * lat + vert * vert > FAN_R * FAN_R) continue;
      out.hx += ux * V_JET;
      out.hz += uz * V_JET;
      out.axisY += oy;
      out.fans += 1;
      out.clampUx = -uz;
      out.clampUz = ux;
      out.lat = lat;
      if (f.rail) {
         const k = 4;
         out.railVx = (fanX(f, ms + k) - fanX(f, ms - k)) / (2 * k / 1000);
      }
   }
   if (out.fans > 0) out.axisY /= out.fans;
   const h = Math.hypot(out.hx, out.hz);
   if (h > V_JET_MAX) {
      out.hx *= V_JET_MAX / h;
      out.hz *= V_JET_MAX / h;
   }
   if (out.up > V_UP_MAX) out.up = V_UP_MAX;
   return out;
}

/** Is there a current at this point now (Scene: the wind loop; tests)? */
export function currentAt(run: WindRun, px: number, py: number, pz: number): { x: number; y: number; z: number } {
   const f = fieldAt(run, px, py, pz, run.ms, FIELD);
   return { x: f.hx + f.railVx * (f.fans > 0 ? 1 : 0), y: f.vents > 0 ? f.up : 0, z: f.hz };
}

// ---------- collisions ----------

function overlaps(b: Box, x: number, y: number, z: number): boolean {
   return x + HERO_R > b.x0 && x - HERO_R < b.x1 && y + HERO_H > b.y0 && y < b.y1 && z + HERO_R > b.z0 && z - HERO_R < b.z1;
}

const LIFT_BOX: Box = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };

/** The blocks bucketed into 4 m slices along z (built once per course): a collision only reads its slices. */
const SLICE = 4;
interface BlockGrid {
   z0: number;
   slices: number[][];
}
const GRIDS = new WeakMap<Course, BlockGrid>();
function blockGrid(c: Course): BlockGrid {
   let g = GRIDS.get(c);
   if (!g) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const b of c.blocks) {
         lo = Math.min(lo, b.z0);
         hi = Math.max(hi, b.z1);
      }
      const n = Math.max(1, Math.ceil((hi - lo) / SLICE) + 1);
      const slices: number[][] = Array.from({ length: n }, () => []);
      c.blocks.forEach((b, i) => {
         const a = Math.max(0, Math.floor((b.z0 - lo) / SLICE));
         const z = Math.min(n - 1, Math.floor((b.z1 - lo) / SLICE));
         for (let s = a; s <= z; s++) slices[s].push(i);
      });
      g = { z0: lo, slices };
      GRIDS.set(c, g);
   }
   return g;
}

function liftBox(run: WindRun, i: number): Box {
   const l = run.course.lifts[i];
   const top = run.world.liftY[i];
   LIFT_BOX.x0 = l.x - l.hw;
   LIFT_BOX.x1 = l.x + l.hw;
   LIFT_BOX.y0 = top - LIFT_T;
   LIFT_BOX.y1 = top;
   LIFT_BOX.z0 = l.z - l.hd;
   LIFT_BOX.z1 = l.z + l.hd;
   return LIFT_BOX;
}

/** Moves the hero along one axis and pushes it out of whatever it ran into. Returns the box it stopped on (y: landed). */
function moveAxis(run: WindRun, axis: 0 | 1 | 2, delta: number, phasing: boolean): { hit: boolean; lift: number } {
   const h = run.hero;
   if (axis === 0) h.x += delta;
   else if (axis === 1) h.y += delta;
   else h.z += delta;
   let hit = false;
   let lift = NONE;
   const blocks = run.course.blocks;
   const resolve = (b: Box, li: number) => {
      if (!overlaps(b, h.x, h.y, h.z)) return;
      hit = true;
      if (axis === 0) {
         h.x = delta > 0 ? b.x0 - HERO_R - 1e-6 : b.x1 + HERO_R + 1e-6;
         h.vx = 0;
      } else if (axis === 2) {
         h.z = delta > 0 ? b.z0 - HERO_R - 1e-6 : b.z1 + HERO_R + 1e-6;
         h.vz = 0;
      } else if (delta <= 0) {
         h.y = b.y1;
         lift = li;
      } else {
         h.y = b.y0 - HERO_H - 1e-6;
         h.vy = Math.min(0, h.vy);
      }
   };
   const g = blockGrid(run.course);
   const s0 = Math.max(0, Math.floor((h.z - HERO_R - 0.1 - g.z0) / SLICE));
   const s1 = Math.min(g.slices.length - 1, Math.floor((h.z + HERO_R + 0.1 - g.z0) / SLICE));
   for (let s = s0; s <= s1; s++) {
      const list = g.slices[s];
      for (let k = 0; k < list.length; k++) {
         const i = list[k];
         if (solidFor(run, i, phasing)) resolve(blocks[i], NONE);
      }
   }
   void blocks.length;
   for (let i = 0; i < run.course.lifts.length; i++) resolve(liftBox(run, i), i);
   return { hit, lift };
}

/** The hero is inside a ghost block (a phase cannot end there). */
function insideGhost(run: WindRun): boolean {
   const h = run.hero;
   const blocks = run.course.blocks;
   for (let i = 0; i < blocks.length; i++) if (blocks[i].kind === "ghost" && overlaps(blocks[i], h.x, h.y, h.z)) return true;
   return false;
}

// ---------- the step ----------

export function advanceClock(run: WindRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_FRAME_MS);
   const n = Math.floor(run.remainder / STEP_MS);
   run.remainder -= n * STEP_MS;
   return n;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const STICK = { x: 0, z: 0 };
const DRONE = { x: 0, y: 0, z: 0 };

function hurt(run: WindRun, ms: number, kx: number, kz: number, storm = false): void {
   const h = run.hero;
   if (h.state !== "play" || ms < h.invulnUntil) return;
   h.hearts -= 1;
   h.invulnUntil = ms + INVULN_MS;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.hit = true;
   if (storm) run.events.stormHit = true;
   else {
      const k = Math.hypot(kx, kz) || 1;
      h.vx = (kx / k) * 5;
      h.vz = (kz / k) * 5;
      h.vy = 6;
      h.grounded = false;
      h.onLift = NONE;
   }
   if (h.hearts <= 0) lose(run);
}

function lose(run: WindRun): void {
   const h = run.hero;
   if (h.state !== "play") return;
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.lostZ = h.z;
   h.dashUntil = -1;
   run.events.lost = true;
   comboBreak(run.combo);
}

function respawn(run: WindRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   // the latest checkpoint that is not ahead of where the hero went down (a respawn never moves it forward)
   let cp = run.checkpoint;
   while (cp > 0 && c.rooms[cp].checkpoint.z < h.lostZ) cp -= 1;
   const p = c.rooms[cp].checkpoint;
   const startZ = cp === 0 ? c.start.z : p.z;
   h.x = cp === 0 ? c.start.x : p.x;
   h.y = cp === 0 ? c.start.y : p.y;
   h.z = startZ;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.onLift = NONE;
   h.airJumps = 0;
   h.hearts = HEARTS;
   h.invulnUntil = ms + SPAWN_MS + 600;
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.respawns += 1;
   run.stormAcc = -1;
   const w = run.world;
   if (w.storm.active) w.storm.z = Math.max(w.storm.z, h.z + 12);
   run.events.respawned = true;
}

/** The power (Action away from any fan). */
function tryPower(run: WindRun, ms: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   const ev = run.events;
   if (def.power === "doubleJump") {
      if (h.grounded || h.airJumps >= 1) return;
      airJump(run, ms);
      return;
   }
   if (def.power === "dash") {
      let dx = STICK.x;
      let dz = STICK.z;
      let len = Math.hypot(dx, dz);
      if (len < 0.25) {
         dx = h.faceX;
         dz = h.faceZ;
         len = Math.hypot(dx, dz) || 1;
      }
      h.dashX = dx / len;
      h.dashZ = dz / len;
      h.dashUntil = ms + POWER_MS.dash;
      ev.dashed = true;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function airJump(run: WindRun, ms: number): void {
   const h = run.hero;
   h.vy = V_JUMP;
   h.airJumps += 1;
   h.hopUntil = ms + 360;
   h.grounded = false;
   h.onLift = NONE;
   h.bufferUntil = -1;
   run.events.airJumped = true;
   run.events.jumped = true;
   run.events.powered = true;
}

/** The nearest fan the hero can work (within reach), NONE if none. */
export function nearestFan(run: WindRun): number {
   const h = run.hero;
   const fans = run.course.fans;
   let best = NONE;
   let bestD = FAN_REACH * FAN_REACH;
   for (let i = 0; i < fans.length; i++) {
      if (!fanUsable(run, i)) continue;
      const f = fans[i];
      const dy = h.y - f.y;
      if (dy < -FAN_REACH_UP || dy > FAN_REACH_DOWN) continue;
      const dx = h.x - fanX(f, run.ms);
      const dz = h.z - f.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) {
         bestD = d;
         best = i;
      }
   }
   return best;
}

function turnFan(run: WindRun, i: number, ms: number): void {
   const w = run.world;
   w.dir[i] = (w.dir[i] + 1) % 4;
   w.turnUntil[i] = ms + TURN_MS;
   run.events.turned = i;
}

function switchFan(run: WindRun, i: number): void {
   const w = run.world;
   w.on[i] = w.on[i] ? 0 : 1;
   run.events.switched = i;
}

/** Action: a press next to a fan starts a hold (a release before HOLD_MS turns it, the hold switches it); a vent switches at once; else the power. */
function handleAction(run: WindRun, ms: number, input: StepInput, first: boolean): void {
   const h = run.hero;
   if (h.state !== "play") {
      run.pressFan = NONE;
      return;
   }
   if (first && input.actionPressed) {
      const i = nearestFan(run);
      if (i === NONE) {
         run.pressFan = NONE;
         tryPower(run, ms);
      } else {
         const f = run.course.fans[i];
         if (f.kind === "vent") {
            if (f.turnable) switchFan(run, i);
            run.pressFan = NONE;
         } else if (!f.toggle) {
            if (run.world.turnUntil[i] <= ms) turnFan(run, i, ms);
            run.pressFan = NONE;
         } else {
            run.pressFan = i;
            run.pressMs = ms;
            run.pressDone = false;
         }
      }
      return;
   }
   if (run.pressFan === NONE || run.pressDone) {
      if (!input.actionHeld) run.pressFan = NONE;
      return;
   }
   const i = run.pressFan;
   if (input.actionHeld) {
      if (ms - run.pressMs >= HOLD_MS) {
         switchFan(run, i);
         run.pressDone = true;
      }
   } else {
      if (run.course.fans[i].turnable && run.world.turnUntil[i] <= ms) turnFan(run, i, ms);
      run.pressFan = NONE;
   }
}

/** Lifts ride their vents; crates fly; the storm creeps; the boss (the owner run only). */
function stepWorld(run: WindRun, ms: number, dt: number): void {
   const w = run.world;
   const c = run.course;
   w.ms = ms;
   for (let i = 0; i < c.lifts.length; i++) {
      const l = c.lifts[i];
      const up = w.on[l.vent] === 1;
      const target = up ? l.y1 : l.y0;
      const y = w.liftY[i];
      w.liftY[i] = target > y ? Math.min(target, y + LIFT_V * dt) : Math.max(target, y - LIFT_V * dt);
   }
   stepBossWorld(run, ms, dt);
}

const CRATE_FIELD: Field = { hx: 0, hz: 0, up: 0, vents: 0, fans: 0, axisY: 0, clampUx: 0, clampUz: 0, lat: 0, railVx: 0 };

function stepBossWorld(run: WindRun, ms: number, dt: number): void {
   const a = run.course.arena;
   const w = run.world;
   const b = w.boss;
   if (!a || !b) return;
   const ev = run.events;
   if (!w.bossAwake) {
      if (run.hero.z < a.z0 && run.hero.state === "play") {
         w.bossAwake = true;
         ev.bossWoke = true;
      } else return;
   }
   const before = b.step;
   const phase = b.phase;
   stepBoss(b, GALE_ENGINE, dt * 1000, w.bossEv);
   if (w.bossEv.telegraph) ev.bossTelegraph = true;
   if (w.bossEv.attack) ev.bossAttack = true;
   if (b.step === "transition" && before !== "transition" && phase === 0) ev.bossPhase = true;
   // phase 2: the crates drop onto their vents as the transition starts
   if (b.phase >= 1 && w.crates.length > 0 && w.crates[0].state === "none") {
      for (let k = 0; k < w.crates.length; k++) {
         const v = run.course.fans[run.course.crates[k].vent];
         const cr = w.crates[k];
         cr.x = v.x;
         cr.y = v.y + 0.6;
         cr.z = v.z;
         cr.vx = cr.vy = cr.vz = 0;
         cr.state = "live";
      }
   }
   // the crates fly in the currents (the same field as the hero, no steering) and fall onto the floor
   for (let k = 0; k < w.crates.length; k++) {
      const cr = w.crates[k];
      if (cr.state !== "live") continue;
      const f = fieldAt(run, cr.x, cr.y, cr.z, ms, CRATE_FIELD);
      const kH = 1 - Math.exp(-6 * dt);
      if (f.fans > 0 || f.vents > 0) {
         cr.vx += (f.hx - cr.vx) * kH;
         cr.vz += (f.hz - cr.vz) * kH;
         const ty = f.vents > 0 ? f.up : Math.max(-3, Math.min(3, (f.axisY - cr.y) * 4));
         cr.vy += (ty - cr.vy) * (1 - Math.exp(-8 * dt));
      } else {
         cr.vx *= 1 - Math.min(1, 3 * dt);
         cr.vz *= 1 - Math.min(1, 3 * dt);
         cr.vy = Math.max(-V_FALL_MAX, cr.vy - G * dt);
      }
      cr.x = Math.max(-6.4, Math.min(6.4, cr.x + cr.vx * dt));
      cr.y += cr.vy * dt;
      cr.z = Math.min(a.z0, Math.max(a.z1 + 0.2, cr.z + cr.vz * dt));
      if (cr.y < a.floor + 0.6) {
         cr.y = a.floor + 0.6;
         cr.vy = 0;
      }
      const ib = a.intake;
      if (cr.x > ib.x0 && cr.x < ib.x1 && cr.y > ib.y0 && cr.y < ib.y1 && cr.z > ib.z0 && cr.z < ib.z1) {
         cr.state = "in";
         w.pending += 1;
         ev.crateIn = k;
      }
   }
   if (b.step === "vulnerable" && b.hp > 0) {
      if (b.phase === 0) {
         for (const i of a.sideFans) {
            if (w.spent[i] || !fanLive(run, i, ms) || w.dir[i] !== 0) continue;
            const r = hitBoss(b, GALE_ENGINE, 1, w.bossEv);
            if (r !== "ignored") {
               // the blast it sent back jams its blades: spent
               w.spent[i] = 1;
               w.on[i] = 0;
               ev.bossHit = true;
               ev.returned = i;
               if (r === "phase") ev.bossPhase = true;
               if (r === "defeated") ev.bossDefeated = true;
            }
            break;
         }
      } else if (w.pending > 0) {
         const r = hitBoss(b, GALE_ENGINE, 1, w.bossEv);
         if (r !== "ignored") {
            w.pending -= 1;
            ev.bossHit = true;
            if (r === "defeated") ev.bossDefeated = true;
         }
      }
   }
   if (w.bossEv.done && w.escapeAt < 0) {
      w.escapeAt = ms;
      ev.bossDone = true;
      // the escape: the storm surges from behind the arena
      w.storm.active = true;
      w.storm.z = a.z0 + 1 + ESCAPE.startBehind;
   }
}

/** The boss's blast (phase 1) and suction (phase 2) on the hero; the intake bites. */
function bossOnHero(run: WindRun, ms: number, dt: number): void {
   const a = run.course.arena;
   const b = run.world.boss;
   const h = run.hero;
   if (!a || !b || !run.world.bossAwake || h.state !== "play") return;
   const shielded = ms <= h.shieldUntil;
   const ib = a.intake;
   if (b.step !== "done" && b.step !== "defeat" && h.x + HERO_R > ib.x0 && h.x - HERO_R < ib.x1 && h.y < ib.y1 && h.z - HERO_R < ib.z1 && h.z > ib.z0 - 1) {
      if (!shielded) hurt(run, ms, h.x >= 0 ? 0.3 : -0.3, 1);
      h.vz = Math.max(h.vz, 8);
   }
   if (b.step !== "attack" || shielded) return;
   const inArena = h.z < a.z0 + 1 && h.z > a.z1;
   if (!inArena || Math.abs(h.x) > a.lane) return;
   if (b.phase === 0) {
      // the blast down the middle lane throws you back (one hit per blast)
      h.vz += (10 - h.vz) * (1 - Math.exp(-10 * dt));
      if (h.grounded) h.vy = Math.max(h.vy, 2);
      const key = b.hits * 100 + b.attack;
      if (run.blastKey !== key) {
         run.blastKey = key;
         hurt(run, ms, 0, 1);
      }
   } else if (h.z < a.z1 + 12) {
      // the suction pulls you towards the intake
      h.vz += (-6 - h.vz) * (1 - Math.exp(-6 * dt));
   }
}

function substep(run: WindRun, ms: number, input: StepInput, first: boolean): void {
   const h = run.hero;
   const c = run.course;
   const w = run.world;
   const ev = run.events;
   const dt = STEP_MS / 1000;
   if (run.owner) stepWorld(run, ms, dt);
   if (first && input.jumpPressed) h.bufferUntil = ms + BUFFER_MS;
   if (h.state === "lost") {
      h.timerMs -= STEP_MS;
      if (h.timerMs <= 0) respawn(run, ms);
      return;
   }
   if (h.state === "spawn") {
      h.timerMs -= STEP_MS;
      if (h.timerMs <= 0) h.state = "play";
      return;
   }
   handleAction(run, ms, input, first);
   const zPrev = h.z;
   const dashing = ms <= h.dashUntil;
   const phasing = ms <= h.phaseUntil || (h.phaseUntil > 0 && insideGhost(run) && ms <= h.phaseUntil + 1500);
   // lifts carry their riders
   if (h.onLift !== NONE) {
      const dy = w.liftY[h.onLift] - run.seenLift[h.onLift];
      if (dy !== 0) moveAxis(run, 1, dy, phasing);
   }
   run.seenLift.set(w.liftY);
   // jumping (buffered, coyote time), Nami's air jump on a second press
   if (h.bufferUntil >= ms && !dashing) {
      if (h.grounded || ms <= h.coyoteUntil) {
         h.vy = V_JUMP;
         h.grounded = false;
         h.onLift = NONE;
         h.coyoteUntil = 0;
         h.bufferUntil = -1;
         ev.jumped = true;
      } else if (first && input.jumpPressed && run.heroId === "nami" && h.airJumps < 1) {
         airJump(run, ms);
      }
   }
   const f = fieldAt(run, h.x, h.y + MID, h.z, ms, FIELD);
   const hop = ms <= h.hopUntil;
   const riding = f.fans > 0 || f.vents > 0;
   if (riding && h.riding === 0) ev.rideStart = true;
   if (!riding && h.riding > 0) ev.rideEnd = true;
   h.riding = f.fans + f.vents;
   h.ridingUp = f.vents > 0;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
      h.vy = 0;
   } else if (riding) {
      // a current carries: its vector (summed where currents cross) plus a little steering
      let tx = f.hx + f.railVx * (f.fans > 0 ? 1 : 0) + STICK.x * V_STEER;
      let tz = f.hz + STICK.z * V_STEER;
      if (f.fans === 1 && f.vents === 0) {
         // steering stays inside the current (the card: steer within it, you leave at its end)
         const lat = f.lat;
         const out = tx * f.clampUx + tz * f.clampUz;
         if (Math.abs(lat) > FAN_R - 0.15 && out * lat > 0) {
            tx -= out * f.clampUx;
            tz -= out * f.clampUz;
         }
      }
      const kH = 1 - Math.exp(-12 * dt);
      h.vx += (tx - h.vx) * kH;
      h.vz += (tz - h.vz) * kH;
      if (!hop) {
         const ty = f.vents > 0 ? f.up : Math.max(-3, Math.min(3, (f.axisY - (h.y + MID)) * 4));
         h.vy += (ty - h.vy) * (1 - Math.exp(-10 * dt));
         if (ty > 0.2) {
            h.grounded = false;
            h.onLift = NONE;
         }
      } else {
         h.vy = Math.max(-V_FALL_MAX, h.vy - G * dt);
      }
   } else {
      const tx = STICK.x * V_RUN;
      const tz = STICK.z * V_RUN;
      const speed = Math.hypot(h.vx, h.vz);
      if (!h.grounded && speed > V_RUN + 0.1) {
         // carried out of a current: keep the momentum, a little drag, a little control
         const k = 1 - Math.min(1, 1.2 * dt);
         h.vx = h.vx * k + STICK.x * 10 * dt;
         h.vz = h.vz * k + STICK.z * 10 * dt;
      } else {
         const acc = (h.grounded ? ACCEL.ground : ACCEL.air) * dt;
         let dx = tx - h.vx;
         let dz = tz - h.vz;
         const dl = Math.hypot(dx, dz);
         if (dl > acc) {
            dx *= acc / dl;
            dz *= acc / dl;
         }
         h.vx += dx;
         h.vz += dz;
      }
      h.vy = Math.max(-V_FALL_MAX, h.vy - G * dt);
   }
   bossOnHero(run, ms, dt);
   if (Math.hypot(STICK.x, STICK.z) > 0.2) {
      const l = Math.hypot(STICK.x, STICK.z);
      h.faceX = STICK.x / l;
      h.faceZ = STICK.z / l;
   }
   // move: x, z, then y, each pushed out of the blocks (2 ms steps: under 3 cm, nothing tunnels)
   const wasGrounded = h.grounded;
   const fallV = h.vy;
   moveAxis(run, 0, h.vx * dt, phasing);
   moveAxis(run, 2, h.vz * dt, phasing);
   const yres = moveAxis(run, 1, h.vy * dt, phasing);
   if (h.vy <= 0 && yres.hit) {
      h.grounded = true;
      h.vy = 0;
      h.onLift = yres.lift;
      h.airJumps = 0;
      h.coyoteUntil = ms + COYOTE_MS;
      if (!wasGrounded) {
         ev.landed = true;
         ev.landSpeed = -fallV;
      }
   } else if (h.vy <= 0 && h.grounded) {
      // still standing? probe just under the feet
      const probe = moveAxis(run, 1, -0.02, phasing);
      if (!probe.hit) {
         h.grounded = false;
         h.onLift = NONE;
         h.coyoteUntil = ms + COYOTE_MS;
      } else h.onLift = probe.lift;
   } else if (h.vy > 0) {
      h.grounded = false;
   }
   if (h.grounded) h.coyoteUntil = ms + COYOTE_MS;
   // the z guard (the proof's one rule): never further towards -z in a substep than V_ZMAX allows
   const cap = ((dashing ? V_DASH : V_ZMAX) * STEP_MS) / 1000;
   if (h.z < zPrev - cap) h.z = zPrev - cap;
   // Riko's dash breaks a cracked cover it runs into
   if (dashing) {
      for (let i = 0; i < c.blocks.length; i++) {
         const b = c.blocks[i];
         if (b.kind !== "cover" || w.broken[i]) continue;
         if (h.x + HERO_R + 0.5 > b.x0 && h.x - HERO_R - 0.5 < b.x1 && h.y + HERO_H > b.y0 && h.y < b.y1 + 0.2 && h.z + HERO_R + 0.5 > b.z0 && h.z - HERO_R - 0.5 < b.z1) {
            w.broken[i] = 1;
            ev.coverBroken = i;
         }
      }
   }
   hazards(run, ms);
   if (h.state !== "play") return;
   progress(run, ms);
}

function hazards(run: WindRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const w = run.world;
   const immune = ms <= h.shieldUntil || ms <= h.phaseUntil;
   if (!immune) {
      for (const s of c.shocks) {
         if (h.x + HERO_R > s.x0 && h.x - HERO_R < s.x1 && h.y + HERO_H > s.y0 && h.y < s.y1 && h.z + HERO_R > s.z0 && h.z - HERO_R < s.z1) {
            const cx = (s.x0 + s.x1) / 2;
            hurt(run, ms, h.x < cx ? -1 : 1, 0.6);
         }
      }
      for (let i = 0; i < c.drones.length; i++) {
         const d = dronePos(c, i, ms, DRONE);
         const dx = h.x - d.x;
         const dy = h.y + MID - d.y;
         const dz = h.z - d.z;
         if (dx * dx + dy * dy + dz * dz < DRONE_R * DRONE_R) hurt(run, ms, dx, 1);
      }
   }
   // the storm front drains a heart a second inside it (the shield does not hold it back)
   if (w.storm.active && h.z > w.storm.z) {
      run.stormTouched = true;
      if (run.stormAcc < 0) run.stormAcc = STORM_EVERY_MS - STORM_FIRST_MS;
      run.stormAcc += STEP_MS;
      if (run.stormAcc >= STORM_EVERY_MS) {
         run.stormAcc -= STORM_EVERY_MS;
         h.invulnUntil = -1;
         hurt(run, ms, 0, 0, true);
      }
   } else run.stormAcc = -1;
   const room = c.rooms[Math.min(run.room, c.rooms.length - 1)];
   if (h.y < Math.min(room.floor, run.checkpoint >= 0 ? c.rooms[run.checkpoint].floor : room.floor) - FALL_DEPTH) lose(run);
}

function progress(run: WindRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const w = run.world;
   const ev = run.events;
   const r = roomAt(c, h.z);
   run.room = r;
   if (w.entered[r] < 0) w.entered[r] = ms;
   // checkpoints: the first time you stand in a room past its entry
   if (r > run.checkpoint && h.grounded && h.z < c.rooms[r].z0 - 1.2) {
      run.checkpoint = r;
      h.hearts = HEARTS;
      ev.checkpoint = r;
      link(run, ms, COMBO_BASE_MS.checkpoint);
   }
   // the storm wakes in its room and follows; it waits while you are in an unsolved setup room
   const sc = c.config.storm;
   if (!w.storm.active && w.escapeAt < 0 && r >= sc.fromRoom && !(c.arena && r >= roomAt(c, c.arena.z0))) {
      w.storm.active = true;
      w.storm.z = c.rooms[sc.fromRoom].z0 + sc.behind;
      ev.stormWoke = true;
   }
   for (let i = 0; i < c.rooms.length; i++) {
      if (w.solved[i] || w.entered[i] < 0) continue;
      if (roomSolved(run, i)) {
         w.solved[i] = 1;
         if (c.rooms[i].setup) {
            ev.setup = i;
            link(run, ms, COMBO_BASE_MS.setup);
         }
      }
   }
   const here = c.rooms[r];
   const waiting = here.setup && !w.solved[r];
   const inBossFight = !!c.arena && w.escapeAt < 0 && r >= roomAt(c, c.arena.z0);
   if (run.owner && w.storm.active && !waiting && !inBossFight) {
      const speed = w.escapeAt >= 0 ? ESCAPE.surgeSpeed : sc.speed;
      w.storm.z -= (speed * STEP_MS) / 1000;
   }
   run.hint = waiting && !inBossFight && ms - w.entered[r] >= HINT_MS ? r : NONE;
   // anemometers: a fan pointing into one spins it and opens its hidden vent
   for (let i = 0; i < c.anemos.length; i++) {
      if (w.anemoOpen[i]) continue;
      const a = c.anemos[i];
      if (fanLive(run, a.fan, ms) && fanDir(run, a.fan, ms) === a.dir) {
         w.anemoOpen[i] = 1;
         w.on[a.opens] = 1;
         ev.anemo = i;
      }
   }
   // orbs (Zuno's magnet reaches 7 m) and secrets
   const reach = ms <= h.magnetUntil ? MAGNET_REACH : ORB.pickup;
   const mx = h.x;
   const my = h.y + ORB.centerY;
   const mz = h.z;
   for (let i = 0; i < c.orbs.length; i++) {
      if (w.collected[i]) continue;
      const o = c.orbs[i];
      const dx = o.x - mx;
      const dy = o.y - my;
      const dz = o.z - mz;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      w.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      link(run, ms, COMBO_BASE_MS.orb);
   }
   for (let i = 0; i < c.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = c.secrets[i];
      const dx = s.x - mx;
      const dy = s.y - my;
      const dz = s.z - mz;
      if (dx * dx + dy * dy + dz * dz > SECRET_R * SECRET_R) continue;
      if (collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }
   const dist = c.startZ - h.z;
   if (dist > run.bestDist) run.bestDist = dist;
   comboTick(run.combo, COMBO, ms);
   const g = c.goal;
   if (gateOpen(run) && h.x > g.x0 && h.x < g.x1 && h.y > g.y0 && h.y < g.y1 && h.z > g.z0 && h.z <= g.z1) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

function link(run: WindRun, ms: number, base: number): void {
   const bonus = comboHit(run.combo, COMBO, ms, base);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: WindRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended) return ev;
   const n = advanceClock(run, finite(dtMs));
   if (n === 0) {
      // a frame shorter than a substep still latches its presses for the next one
      if (input.jumpPressed) run.hero.bufferUntil = run.ms + BUFFER_MS;
      return ev;
   }
   const world = inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
   const len = Math.hypot(world.x, world.z);
   STICK.x = len > 1 ? world.x / len : world.x;
   STICK.z = len > 1 ? world.z / len : world.z;
   for (let k = 0; k < n && !run.ended; k++) {
      run.ms += STEP_MS;
      substep(run, run.ms, input, k === 0);
      if (run.ms >= run.course.config.durationMs && !run.ended) {
         run.ended = "timeup";
         ev.timeup = true;
      }
   }
   return ev;
}

// ---------- solid boxes (for the orbit camera's collision, menu2/camera) ----------

export interface SolidBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** The solid boxes now (covers broken and an open gate left out; lifts where they are), into `out`. Returns how many. */
export function solidBoxes(run: WindRun, out: SolidBox[]): number {
   let n = 0;
   const put = (b: Box) => {
      const o = out[n] ?? (out[n] = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
      o.minX = b.x0;
      o.maxX = b.x1;
      o.minY = b.y0;
      o.maxY = b.y1;
      o.minZ = b.z0;
      o.maxZ = b.z1;
      n += 1;
   };
   const blocks = run.course.blocks;
   for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "cover" && run.world.broken[i]) continue;
      if (b.kind === "gate" && gateOpen(run)) continue;
      // the arena's shutter is a see-through energy wall: the camera never bumps into it
      if (b.kind === "shutter") continue;
      put(b);
   }
   for (let i = 0; i < run.course.lifts.length; i++) put(liftBox(run, i));
   return n;
}

/** The top of the highest solid under (x, z) at or below the feet (the blob shadow's floor), -Infinity if none. */
export function groundUnder(run: WindRun, x: number, z: number, feet: number): number {
   let best = -Infinity;
   const c = run.course;
   const g = blockGrid(c);
   const s = Math.floor((z - g.z0) / SLICE);
   if (s >= 0 && s < g.slices.length) {
      for (const i of g.slices[s]) {
         const b = c.blocks[i];
         if (b.look === "housing" || !solidFor(run, i, false)) continue;
         if (b.y1 > feet + 0.05 || b.y1 <= best) continue;
         if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) best = b.y1;
      }
   }
   for (let i = 0; i < c.lifts.length; i++) {
      const l = c.lifts[i];
      const top = run.world.liftY[i];
      if (top > feet + 0.05 || top <= best) continue;
      if (Math.abs(x - l.x) <= l.hw && Math.abs(z - l.z) <= l.hd) best = top;
   }
   return best;
}

// ---------- the store hand-off (README "Scoring") ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   distance: "distance",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   hearts: "hearts",
   storm: "storm",
   room: "room",
   rooms: "rooms",
   near: "near",
   hint: "hint",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   escape: "escape",
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

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The card's no-hit bonus for this game: never touch the storm front (hits for the star screen). */
export function badgeHits(run: WindRun): number {
   return run.stormTouched ? 1 : 0;
}

/** Gale Engine is open to a hit right now (the HUD bar pulses, the core glows): a window that can land one. */
export function bossVulnerable(run: WindRun): boolean {
   const b = run.world.boss;
   const a = run.course.arena;
   if (!b || !a || b.step !== "vulnerable" || b.hp <= 0) return false;
   if (b.phase >= 1) return run.world.pending > 0;
   return a.sideFans.some((i) => !run.world.spent[i] && fanLive(run, i) && run.world.dir[i] === 0);
}

export { LEVELS };
