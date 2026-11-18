// Ring Jump Challenge rules (the design card's DIVE AND THREAD): leap off a stone column and steer a
// free-fall down a sea canyon through rings. The stick steers on the plane (9 m/s spread, 4.5 m/s in a
// dive); holding Dive (Jump) tucks into a ball and falls at 40 m/s, releasing spreads to 18 m/s. Each
// ring threaded scores and adds +2 m/s; the inner 30 % (a centre thread) doubles it; a ring passed
// close by without threading it is a miss that breaks the flow (the Perfect Streak badge is a level
// with no miss). Updraft geysers slow the fall, speed rings add +6 m/s, blade gates and storm shear
// knock you about, the hero powers open the gated routes, and the run ends on the target pad, the
// marked pool or (level 5) Cyclone Ray's tail pad. A splash anywhere else drops you again from 70 m.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. The Scene passes the stick
// plus the orbit camera's yaw (StepInput.yaw) and step() turns it camera-relative with core
// inputToWorld; tests and bot.ts drive it with yaw 0.
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time, so every fall, thread and hit depends
// only on rules ms: the same at 30, 60 or 144 fps. No allocation after createRun().
// README "Rules" and "Server limits" explain the design and the proof; rules.test.ts checks them.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld, rngNext } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, G_FLIP, MAGNET_REACH, POWER_MS, V_DASH, V_FLIP, heroById, type HeroId } from "./heroes";
import { LEVELS, type RingLevel } from "./levels";
import { buildCanyon, shaftRadius, type Course, type RingDef } from "./canyon";
import { BOSS_DAMAGE, COMBO, COMBO_BASE, CYCLONE_RAY, SECRETS } from "./progression";

export type { Course, RingDef } from "./canyon";

// ---------- tuning (1 unit = 1 m, up is +y, the sea at y = 0) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
/** the hero's body as a sphere round its centre (the drawn hero's middle) */
export const HERO_R = 0.45;
/** fall speeds (m/s): spread and dive (the card) */
export const V_SPREAD = 18;
export const V_DIVE = 40;
/** steering on the plane (m/s): spread, dive (the card's 9 m/s; a ball steers worse) */
export const STEER_SPREAD = 9;
export const STEER_DIVE = 4.5;
export const STEER_ACCEL = 28;
/** towards a faster fall (m/s²), and the drag back to a slower one */
export const G_FALL = 32;
export const DRAG = 30;
/** a threaded ring adds this to the fall (m/s), a speed ring this; the extra caps at BOOST_CAP and wears off */
export const BOOST_RING = 2;
export const BOOST_SPEED = 6;
export const BOOST_CAP = 10;
export const BOOST_DECAY = 3;
/** THE proof's one rule: no ms ever falls faster than this (m/s) */
export const VMAX = V_DIVE + BOOST_CAP;
/** an updraft holds the fall to this (m/s) spread / diving, braking at UPDRAFT_DECEL */
export const UPDRAFT_FALL = { spread: 6, dive: 10 } as const;
export const UPDRAFT_DECEL = 45;
/** the leap off the column: up, towards the shaft, the stick locked a moment, and it goes by itself after autoMs */
export const LEAP = { vy: 6, speed: 7, lockMs: 450, autoMs: 2600 } as const;
/** the walls start this far under the column's top (the rim) */
export const RIM_DROP = 2;
/** a centre thread: the inner 30 % of the opening (the card) */
export const CENTRE_FRAC = 0.3;
/** a ring passed within this of its rim (m) without threading it is a miss */
export const MISS_LANE = 5;
/** the closing trio shrinks shut over this long (ms) */
export const CLOSE_ANIM_MS = 500;
export const ORB_PICKUP = 1.6;
export const SECRET_PICKUP = 1.6;
/** a splash: this long in the sea, then a drop from this high above the pad */
export const SPLASH_MS = 1200;
export const RESPAWN_HEIGHT = 70;
export const RESPAWN_OFFSET = 7;
/** blade gates: the spiked ball's radius, the knock and the grace after a hit */
export const BLADE_BALL = 1.3;
export const KNOCK = { speed: 10, ms: 350 } as const;
export const INVULN_MS = 700;
/** storm shear: the outward push (m/s) */
export const STORM_PUSH = 14;
/** wall corrections move the hero at most this far per ms (m): a pocket's foot slides you back in */
export const WALL_SLIDE = 0.03;

/** Points (README "Scoring"). */
export const PTS = { ring: 100, centre: 200, orb: 50, bossHit: 300, defeat: 1500, pad: 500, bull: 1000, pool: 300 } as const;
/** The speed bonus: points per second landed under the par time. */
export const TIME_PTS = 20;

// ---------- Cyclone Ray (level 5) ----------

/** the wake rings: the slots, the drop interval, their radius, their life */
export const WAKE = { slots: 10, everyMs: 850, r: 2.4, lifeMs: 6000, chain: 5 } as const;
/** where the Ray swims (m under the eye's centre) and how far it circles */
export const RAY = {
   spiral: { below: 22, radius: 9, omega: 0.75 },
   spiralOpen: { below: 16.5, radius: 5, omega: 0.25 },
   storm: { below: 16, radius: 14, omega: 0.55 },
   stormOpen: { below: 16.5, radius: 2 },
   fin: { r: 2.6, dy: 1.8 },
   body: { r: 3.4, dy: 2.2 },
} as const;
/** the lightning lanes: three lines through the axis, this half-width (m) */
export const LANE_HALF = 1.6;
/** the tail pad circles the sea's centre */
export const TAIL = { radius: 4, omega: 0.25, y: 3 } as const;

// ---------- the course ----------

export interface CourseIndex {
   /** ring indices sorted by y, high to low */
   ringsByY: number[];
   ringY: number[];
   orbsByY: number[];
   orbY: number[];
}

export interface RingCourse extends Course {
   index: CourseIndex;
}

function indexCourse(c: Course): RingCourse {
   const ringsByY = c.rings.map((_, i) => i).sort((a, b) => c.rings[b].y - c.rings[a].y);
   const orbsByY = c.orbs.map((_, i) => i).sort((a, b) => c.orbs[b].y - c.orbs[a].y);
   return { ...c, index: { ringsByY, ringY: ringsByY.map((i) => c.rings[i].y), orbsByY, orbY: orbsByY.map((i) => c.orbs[i].y) } };
}

export function buildCourse(level: RingLevel = LEVELS[1]): RingCourse {
   return indexCourse(buildCanyon(level));
}

const COURSES: Partial<Record<LevelId, RingCourse>> = {};

export function courseFor(level: LevelId): RingCourse {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** The first index in `ys` (sorted high to low) whose value is <= y. */
function firstAtOrBelow(ys: readonly number[], y: number): number {
   let lo = 0;
   let hi = ys.length;
   while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ys[mid] > y) lo = mid + 1;
      else hi = mid;
   }
   return lo;
}

/** Where ring `r` is at rules time `ms` (its centre on the plane), written into `out`. */
export function ringPos(r: RingDef, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   const m = r.motion;
   if (!m) {
      out.x = r.x;
      out.z = r.z;
      return out;
   }
   const a = (m.omega * ms) / 1000 + m.phase;
   if (m.kind === "orbit") {
      out.x = r.x + Math.cos(a) * m.amp;
      out.z = r.z + Math.sin(a) * m.amp;
   } else {
      const s = Math.sin(a) * m.amp;
      out.x = r.x + m.ax * s;
      out.z = r.z + m.az * s;
   }
   return out;
}

/** The ring's open radius now (level 1's trio shrinks shut once its clock runs out). */
export function ringOpen(run: Pick<RingRun, "trioMs">, r: RingDef, ms: number): number {
   if (!(r.closeMs === r.closeMs) || run.trioMs < 0) return r.r;
   const k = 1 - (ms - run.trioMs - r.closeMs) / CLOSE_ANIM_MS;
   return r.r * Math.max(0, Math.min(1, k));
}

// ---------- the run ----------

export type HeroMode = "perch" | "fall" | "splash" | "landed";
export type Landing = "pad" | "bull" | "pool" | null;

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   mode: HeroMode;
   /** ms in the current mode */
   modeMs: number;
   diving: boolean;
   /** the extra fall speed from rings (m/s) */
   boost: number;
   inUpdraft: boolean;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   flipUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   invulnUntil: number;
   knockUntil: number;
   /** the wall pocket the hero is in (-1: the main shaft) */
   pocket: number;
   /** the storm pocket the hero was last blown out of (-1: none) */
   storm: number;
   /** the leap's start (ms) */
   leapAt: number;
}

export interface WakeRing {
   alive: boolean;
   x: number;
   y: number;
   z: number;
   bornMs: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the orbit camera's drawn yaw (menu2/camera): the stick turns with it. Bots and tests: 0 */
   yaw: number;
   /** Jump pressed this frame (the leap) */
   jumpPressed: boolean;
   /** Jump held: Dive */
   jumpHeld: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   leaped: boolean;
   /** rings threaded this step (course indices) and whether each was a centre thread */
   ringList: number[];
   ringCentre: boolean[];
   ringCount: number;
   missCount: number;
   orbList: number[];
   orbCount: number;
   secretList: number[];
   secretCount: number;
   /** a seal broken this step (pocket index), or -1 */
   sealBroken: number;
   powered: boolean;
   bladeHit: boolean;
   laneHit: boolean;
   stormPushed: boolean;
   splashed: boolean;
   respawned: boolean;
   /** the landing this step */
   landed: Landing;
   finished: boolean;
   timeup: boolean;
   comboLinked: boolean;
   comboBonus: number;
   speedBoost: boolean;
   wakeThreaded: boolean;
   wakeMissed: boolean;
   charged: boolean;
   arenaEntered: boolean;
   bossTelegraph: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

function createEvents(): StepEvents {
   return {
      leaped: false,
      ringList: [],
      ringCentre: [],
      ringCount: 0,
      missCount: 0,
      orbList: [],
      orbCount: 0,
      secretList: [],
      secretCount: 0,
      sealBroken: NONE,
      powered: false,
      bladeHit: false,
      laneHit: false,
      stormPushed: false,
      splashed: false,
      respawned: false,
      landed: null,
      finished: false,
      timeup: false,
      comboLinked: false,
      comboBonus: 0,
      speedBoost: false,
      wakeThreaded: false,
      wakeMissed: false,
      charged: false,
      arenaEntered: false,
      bossTelegraph: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function clearEvents(ev: StepEvents): void {
   ev.leaped = false;
   ev.ringCount = 0;
   ev.missCount = 0;
   ev.orbCount = 0;
   ev.secretCount = 0;
   ev.sealBroken = NONE;
   ev.powered = false;
   ev.bladeHit = false;
   ev.laneHit = false;
   ev.stormPushed = false;
   ev.splashed = false;
   ev.respawned = false;
   ev.landed = null;
   ev.finished = false;
   ev.timeup = false;
   ev.comboLinked = false;
   ev.comboBonus = 0;
   ev.speedBoost = false;
   ev.wakeThreaded = false;
   ev.wakeMissed = false;
   ev.charged = false;
   ev.arenaEntered = false;
   ev.bossTelegraph = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

export interface RingRun {
   course: RingCourse;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   /** rng state for the lightning lanes (rngNext) */
   rng: { s: number };
   simMs: number;
   carry: number;
   hero: Hero;
   ended: "win" | "timeup" | null;
   finishMs: number;
   score: number;
   /** per course ring: threaded (shared between versus runs: the first to thread takes it) */
   threaded: Uint8Array;
   missed: Uint8Array;
   /** per orb: taken (shared in multiplayer) */
   taken: Uint8Array;
   /** per pocket: the seal is broken (shared in multiplayer) */
   broken: Uint8Array;
   rings: number;
   centres: number;
   misses: number;
   orbs: number;
   mainOrbs: number;
   /** rings threaded in a row (a miss resets it) and the best of the run */
   streak: number;
   bestStreak: number;
   /** blade, lane and splash hits */
   hits: number;
   splashes: number;
   /** level 1's closing trio clock (ms the hero passed course.trioY), -1 before */
   trioMs: number;
   combo: ComboState;
   secrets: SecretTracker;
   powerReadyAt: number;
   landing: Landing;
   timeBonus: number;
   /** the score parts (HUD and README): rings, orbs, flow, boss, landing, time */
   parts: { rings: number; orbs: number; flow: number; boss: number; landing: number; time: number };
   // level 5
   boss: BossState | null;
   bossEv: BossEvents;
   arenaMs: number;
   wake: WakeRing[];
   wakeNext: number;
   wakeDropAt: number;
   /** wake rings threaded in a row; `charged` once it reaches WAKE.chain */
   wakeChain: number;
   charged: boolean;
   lanes: number[];
   events: StepEvents;
}

function freshHero(c: Course): Hero {
   return {
      x: c.startX,
      y: c.top,
      z: c.startZ,
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "perch",
      modeMs: 0,
      diving: false,
      boost: 0,
      inUpdraft: false,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      flipUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      invulnUntil: NONE,
      knockUntil: NONE,
      pocket: NONE,
      storm: NONE,
      leapAt: NONE,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): RingRun {
   const course = courseFor(level);
   const wake: WakeRing[] = [];
   for (let i = 0; i < WAKE.slots; i++) wake.push({ alive: false, x: 0, y: 0, z: 0, bornMs: 0 });
   return {
      course,
      level,
      heroId,
      seed,
      rng: { s: (seed >>> 0) || 1 },
      simMs: 0,
      carry: 0,
      hero: freshHero(course),
      ended: null,
      finishMs: 0,
      score: 0,
      threaded: new Uint8Array(course.rings.length),
      missed: new Uint8Array(course.rings.length),
      taken: new Uint8Array(course.orbs.length),
      broken: new Uint8Array(course.pockets.length),
      rings: 0,
      centres: 0,
      misses: 0,
      orbs: 0,
      mainOrbs: 0,
      streak: 0,
      bestStreak: 0,
      hits: 0,
      splashes: 0,
      trioMs: NONE,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      powerReadyAt: 0,
      landing: null,
      timeBonus: 0,
      parts: { rings: 0, orbs: 0, flow: 0, boss: 0, landing: 0, time: 0 },
      boss: null,
      bossEv: createBossEvents(),
      arenaMs: NONE,
      wake,
      wakeNext: 0,
      wakeDropAt: 0,
      wakeChain: 0,
      charged: false,
      lanes: [0, 0, 0],
      events: createEvents(),
   };
}

// ---------- the eye and the Ray (level 5; pure, the Scene draws from them too) ----------

/** The storm eye's centre y at `ms` (NaN before the hero reaches it). */
export function eyeY(run: Pick<RingRun, "course" | "arenaMs">, ms: number): number {
   const a = run.course.arena;
   if (!a || run.arenaMs < 0) return Number.NaN;
   return Math.max(a.stop, a.top + a.floor - (a.speed * (ms - run.arenaMs)) / 1000);
}

/** Is the eye still holding the hero up (phases 1 and 2, the transition into 3 not yet)? */
export function eyeHolds(run: Pick<RingRun, "boss" | "arenaMs">): boolean {
   const b = run.boss;
   return run.arenaMs >= 0 && !!b && b.phase < 2 && b.step !== "defeat" && b.step !== "done";
}

export interface RayPose {
   x: number;
   y: number;
   z: number;
   /** heading on the plane (rad, the direction it swims) */
   heading: number;
   /** 0 (flat) .. 1 (banked belly-up, open) */
   bank: number;
   /** the fin's (phase 1) or the body's (phase 2) hit point */
   hx: number;
   hy: number;
   hz: number;
   /** above the sea and in the fight (false before the eye, after the defeat) */
   visible: boolean;
}

export function createRayPose(): RayPose {
   return { x: 0, y: 0, z: 0, heading: 0, bank: 0, hx: 0, hy: 0, hz: 0, visible: false };
}

/** Where Cyclone Ray is at rules time `ms` (a pure function of the boss and the eye). */
export function rayPose(run: Pick<RingRun, "course" | "arenaMs" | "boss">, ms: number, out: RayPose): RayPose {
   const b = run.boss;
   out.visible = false;
   if (!b || run.arenaMs < 0) return out;
   const eye = eyeY(run, ms);
   const t = (ms - run.arenaMs) / 1000;
   out.bank = 0;
   if (b.phase === 0 || b.step === "intro") {
      const open = b.step === "vulnerable" && b.phase === 0;
      const s = open ? RAY.spiralOpen : RAY.spiral;
      const a = t * s.omega;
      let y = eye - s.below;
      if (b.step === "intro") y -= 40 * (1 - Math.min(1, b.stepMs / 2500)) ** 2;
      out.x = Math.cos(a) * s.radius;
      out.z = Math.sin(a) * s.radius;
      out.y = y;
      out.heading = a + Math.PI / 2;
      out.hx = out.x;
      out.hy = y + 1.2;
      out.hz = out.z;
      out.visible = true;
      return out;
   }
   if (b.phase === 1) {
      const open = b.step === "vulnerable";
      const a = t * RAY.storm.omega;
      const k = open ? Math.min(1, b.stepMs / 500) : b.step === "telegraph" && b.attack > 0 ? Math.max(0, 1 - b.stepMs / 500) : 0;
      const rad = RAY.storm.radius + (RAY.stormOpen.radius - RAY.storm.radius) * k;
      out.x = Math.cos(a) * rad;
      out.z = Math.sin(a) * rad;
      out.y = eye - (RAY.storm.below + (RAY.stormOpen.below - RAY.storm.below) * k);
      out.heading = a + Math.PI / 2;
      out.bank = k;
      out.hx = out.x;
      out.hy = out.y;
      out.hz = out.z;
      out.visible = b.step !== "transition" || b.stepMs < 1200;
      return out;
   }
   // phase 3: it dives to the sea and surfaces with its tail pad up
   const a = t * TAIL.omega;
   out.x = Math.cos(a) * TAIL.radius;
   out.z = Math.sin(a) * TAIL.radius;
   out.heading = a + Math.PI / 2;
   let up = 0;
   if (b.step === "attack") up = Math.min(1, b.stepMs / 800);
   else if (b.step === "vulnerable" || b.step === "defeat" || b.step === "done") up = 1;
   out.y = TAIL.y - 6 * (1 - up);
   out.hx = out.x;
   out.hy = out.y;
   out.hz = out.z;
   out.visible = up > 0;
   return out;
}

const RAY_SCRATCH = createRayPose();

// ---------- the lower bound (README "Server limits and why they hold") ----------

/** The earliest rules ms Cyclone Ray can be down after the hero enters the eye: every window hit at once. */
export function bossMinMs(): number {
   const s = createBoss(CYCLONE_RAY);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, CYCLONE_RAY, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, CYCLONE_RAY, BOSS_DAMAGE[s.phase] ?? 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/** How many hits defeat the Ray (each phase's damage), the most hits a run can score. */
export function bossHitsToDefeat(): number {
   let hp = CYCLONE_RAY.maxHp;
   let hits = 0;
   const phaseOf = (h: number) => {
      const f = h / CYCLONE_RAY.maxHp;
      for (let i = 0; i < CYCLONE_RAY.phases.length; i++) if (f > CYCLONE_RAY.phases[i].endsAt) return i;
      return CYCLONE_RAY.phases.length - 1;
   };
   while (hp > 0 && hits < 100) {
      hp = Math.max(0, hp - (BOSS_DAMAGE[phaseOf(hp)] ?? 1));
      hits++;
   }
   return hits;
}

const BOSS_MIN_MS = bossMinMs();

/**
 * The least finish ms. Every ms falls at most VMAX/1000 m (the vy clamp; the leap, a flip, an updraft,
 * the eye and a splash only slow it), so the pad (the highest landing) is reached no sooner than the
 * drop over VMAX, less 2 ms of slack. Level 5 lands only on the tail pad, which means the Ray is down:
 * the eye at least (top - eye top) / VMAX in, then the boss's least defeat time.
 */
export function minFinishMs(course: Course): number {
   const fall = Math.floor(((course.top - course.pad.y) * 1000) / VMAX) - 2;
   if (!course.arena) return Math.max(0, fall);
   const toEye = Math.floor(((course.top - course.arena.top) * 1000) / VMAX) - 2;
   return Math.max(fall, toEye + BOSS_MIN_MS);
}

/** What the course can feed the flow meter: each course ring once, each orb once (wake rings never). */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.rings.length, base: COMBO_BASE.ring },
         { count: course.orbs.length, base: COMBO_BASE.orb },
      ],
   };
}

/** The speed bonus of a landing at finishMs. */
export function timeBonusFor(course: Course, finishMs: number): number {
   return Math.floor((Math.max(0, course.parMs - finishMs) * TIME_PTS) / 1000);
}

/**
 * The most points any run of the course can make: every ring as a centre thread, every orb (all the
 * heroes' gated ones too), the most flow bonus (menu2/combo comboMaxBonus), the best landing, the
 * speed bonus at the least finish, and on level 5 every boss hit and the defeat.
 */
export function maxScoreOf(course: Course): number {
   const rings = course.rings.length * PTS.centre;
   const orbs = course.orbs.length * PTS.orb;
   const flow = comboMaxBonus(comboSpecOf(course));
   const landing = Math.max(PTS.bull, PTS.pad, PTS.pool);
   const time = timeBonusFor(course, minFinishMs(course));
   const boss = course.boss ? bossHitsToDefeat() * PTS.bossHit + PTS.defeat : 0;
   return rings + orbs + flow + landing + time + boss;
}

export interface LevelLimits {
   kind: "points";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   base: number;
   maxPointsPerSec: number;
}

/**
 * The limits of a level: maxScore is the bound above; minDurationMs the least finish less about
 * 4.5 %, rounded down to 100 ms (94-100 % of it); maxDurationMs the run clock's cap plus 1 s (the
 * shell's clock may count the rest of the frame the cap falls in); base 0 and the rate
 * ceil(maxScore / minDuration): every run is at most maxScore and lasts at least minDuration, so
 * score * 1000 <= rate * duration always holds.
 */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minFinishMs(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const maxScore = maxScoreOf(course);
   return { kind: "points", maxScore, minDurationMs, maxDurationMs: course.durationMs + 1000, base: 0, maxPointsPerSec: Math.ceil((maxScore * 1000) / minDurationMs) };
}

export const COURSE: RingCourse = courseFor(1);

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

// ---------- the step ----------

const STICK = { x: 0, z: 0 };
const POS = { x: 0, z: 0 };

/** Advances the run by dtMs (capped at MAX_STEP_MS), 1 ms at a time. Returns the run's events object. */
export function step(run: RingRun, dtMs: number, input: StepInput): StepEvents {
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
      stepMs(run, input, jump, action, ev);
      jump = false;
      action = false;
   }
   return ev;
}

function stickLen(): number {
   return Math.hypot(STICK.x, STICK.z);
}

function stepMs(run: RingRun, input: StepInput, jumpPressed: boolean, actionPressed: boolean, ev: StepEvents): void {
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   const c = run.course;
   h.modeMs += 1;
   comboTick(run.combo, COMBO, ms);

   if (h.mode === "perch") {
      if (jumpPressed || stickLen() > 0.35 || ms >= LEAP.autoMs) leap(run, ev);
   } else if (h.mode === "splash") {
      if (h.modeMs >= SPLASH_MS) respawn(run, ms, ev);
   } else if (h.mode === "fall") {
      fall(run, ms, input, actionPressed, ev);
   }

   if (run.boss) stepTheBoss(run, ms, ev);

   if (run.ended === null && ms >= c.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

function leap(run: RingRun, ev: StepEvents): void {
   const h = run.hero;
   const d = Math.hypot(h.x, h.z) || 1;
   h.vx = (-h.x / d) * LEAP.speed;
   h.vz = (-h.z / d) * LEAP.speed;
   h.vy = LEAP.vy;
   h.mode = "fall";
   h.modeMs = 0;
   h.leapAt = run.simMs;
   ev.leaped = true;
}

function respawn(run: RingRun, ms: number, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   let px = c.pad.x;
   let pz = c.pad.z;
   if (c.boss) {
      rayPose(run, ms, RAY_SCRATCH);
      px = RAY_SCRATCH.x;
      pz = RAY_SCRATCH.z;
   }
   // beside the pad, never over it: a splash always needs steering back
   h.x = px + RESPAWN_OFFSET;
   h.z = pz;
   h.y = c.pad.y + RESPAWN_HEIGHT;
   h.vx = h.vz = 0;
   h.vy = -6;
   h.boost = 0;
   h.mode = "fall";
   h.modeMs = 0;
   h.pocket = NONE;
   h.invulnUntil = ms + INVULN_MS;
   ev.respawned = true;
}

function firePower(run: RingRun, ms: number, ev: StepEvents): void {
   const h = run.hero;
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
   switch (def.power) {
      case "dash": {
         let dx = STICK.x;
         let dz = STICK.z;
         let l = Math.hypot(dx, dz);
         if (l < 0.2) {
            dx = h.vx;
            dz = h.vz;
            l = Math.hypot(dx, dz);
         }
         if (l < 0.5) {
            dx = -h.x;
            dz = -h.z;
            l = Math.hypot(dx, dz) || 1;
         }
         h.dashX = dx / l;
         h.dashZ = dz / l;
         h.dashUntil = ms + POWER_MS.dash;
         break;
      }
      case "flip":
         h.flipUntil = ms + POWER_MS.flip;
         h.vy = V_FLIP;
         break;
      case "shield":
         h.shieldUntil = ms + POWER_MS.shield;
         break;
      case "magnet":
         h.magnetUntil = ms + POWER_MS.magnet;
         break;
      case "phase":
         h.phaseUntil = ms + POWER_MS.phase;
         break;
   }
}

/** The unit direction from (fx, fz) to the hero on the plane (towards the axis when they coincide). */
function awayFrom(h: Hero, fx: number, fz: number, out: { x: number; z: number }): { x: number; z: number } {
   let dx = h.x - fx;
   let dz = h.z - fz;
   let l = Math.hypot(dx, dz);
   if (l < 1e-6) {
      dx = -h.x;
      dz = -h.z;
      l = Math.hypot(dx, dz);
      if (l < 1e-6) {
         dx = 1;
         dz = 0;
         l = 1;
      }
   }
   out.x = dx / l;
   out.z = dz / l;
   return out;
}

const AWAY = { x: 0, z: 0 };

/** A hit: pushed along (nx, nz) (a unit direction on the plane), the flow breaks, a short grace. */
function knock(run: RingRun, ms: number, nx: number, nz: number): void {
   const h = run.hero;
   h.vx = nx * KNOCK.speed;
   h.vz = nz * KNOCK.speed;
   h.knockUntil = ms + KNOCK.ms;
   h.invulnUntil = ms + INVULN_MS;
   h.dashUntil = NONE;
   run.hits += 1;
   comboBreak(run.combo);
   run.streak = 0;
}

function fall(run: RingRun, ms: number, input: StepInput, actionPressed: boolean, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   const dt = 0.001;
   if (actionPressed) firePower(run, ms, ev);
   const flipping = ms < h.flipUntil;
   const dashing = ms < h.dashUntil;
   h.diving = input.jumpHeld && !flipping;

   // the fall speed
   if (flipping) {
      h.vy -= G_FLIP * dt;
   } else {
      const target = h.inUpdraft ? (h.diving ? UPDRAFT_FALL.dive : UPDRAFT_FALL.spread) : (h.diving ? V_DIVE : V_SPREAD) + h.boost;
      const want = -target;
      if (h.vy > want) h.vy = Math.max(want, h.vy - G_FALL * dt);
      else h.vy = Math.min(want, h.vy + (h.inUpdraft ? UPDRAFT_DECEL : DRAG) * dt);
   }
   if (h.vy < -VMAX) h.vy = -VMAX;
   h.boost = Math.max(0, h.boost - BOOST_DECAY * dt);

   // steering on the plane
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else if (ms < h.knockUntil || ms - h.leapAt < LEAP.lockMs) {
      // the knock or the leap carries the hero
   } else {
      const steer = h.diving ? STEER_DIVE : STEER_SPREAD;
      let tx = STICK.x * steer;
      let tz = STICK.z * steer;
      const tl = Math.hypot(tx, tz);
      if (tl > steer) {
         tx = (tx / tl) * steer;
         tz = (tz / tl) * steer;
      }
      const dx = tx - h.vx;
      const dz = tz - h.vz;
      const dl = Math.hypot(dx, dz);
      const a = STEER_ACCEL * dt;
      if (dl <= a) {
         h.vx = tx;
         h.vz = tz;
      } else {
         h.vx += (dx / dl) * a;
         h.vz += (dz / dl) * a;
      }
   }

   const prevY = h.y;
   h.x += h.vx * dt;
   h.z += h.vz * dt;
   h.y += h.vy * dt;

   // the storm eye holds the hero up (level 5, phases 1 and 2)
   if (c.arena) {
      if (run.arenaMs < 0 && h.y <= c.arena.top) enterArena(run, ms, ev);
      if (eyeHolds(run)) {
         const floor = eyeY(run, ms) - c.arena.floor - (h.diving ? c.arena.diveFloor : 0);
         if (h.y < floor) {
            h.y = Math.min(prevY, floor);
            if (h.vy < -c.arena.speed) h.vy = -c.arena.speed;
         }
      }
   }

   walls(run, ms, dashing, ev);
   hazards(run, ms, ev);
   if (run.trioMs < 0 && h.y < c.trioY) run.trioMs = ms;
   threadRings(run, ms, prevY, ev);
   if (run.boss) wakeRings(run, ms, prevY, ev);
   pickups(run, ms, ev);
   land(run, ms, prevY, ev);
}

/** The shaft wall, the pockets behind it (open, sealed, ghost) and the ledges. */
function walls(run: RingRun, ms: number, dashing: boolean, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   if (h.y > c.top - RIM_DROP) return;
   const R = shaftRadius(c, h.y);
   const d = Math.hypot(h.x, h.z);
   const phasing = ms < h.phaseUntil;
   let inPocket = NONE;
   for (let i = 0; i < c.pockets.length; i++) {
      const p = c.pockets[i];
      if (h.y < p.y0 || h.y > p.y1) continue;
      const dp = Math.hypot(h.x - p.x, h.z - p.z);
      if (dp > p.pr - HERO_R + 0.35) continue;
      let open = p.kind === "open" || run.broken[i] === 1 || (p.kind === "ghost" && (phasing || h.pocket === i));
      if (!open && p.kind === "seal" && dashing) {
         run.broken[i] = 1;
         ev.sealBroken = i;
         open = true;
      }
      if (open && dp <= p.pr - HERO_R) inPocket = i;
   }
   if (inPocket >= 0) {
      h.pocket = inPocket;
   } else if (d <= R - HERO_R) {
      h.pocket = NONE;
   } else {
      // outside: back towards the shaft (a pocket's foot slides the hero back in, never a jump)
      const excess = d - (R - HERO_R);
      const move = excess <= 0.5 ? excess : WALL_SLIDE;
      const k = (d - move) / d;
      h.x *= k;
      h.z *= k;
      // no velocity into the wall
      const nx = h.x / (Math.hypot(h.x, h.z) || 1);
      const nz = h.z / (Math.hypot(h.x, h.z) || 1);
      const out = h.vx * nx + h.vz * nz;
      if (out > 0 && ms >= h.dashUntil) {
         h.vx -= out * nx;
         h.vz -= out * nz;
      }
      h.pocket = NONE;
   }
   // ledges: pushed inward off the shelf
   for (let i = 0; i < c.ledges.length; i++) {
      const l = c.ledges[i];
      if (h.y < l.y0 - HERO_R || h.y > l.y1 + HERO_R) continue;
      const ca = Math.cos((l.a * Math.PI) / 180);
      const sa = Math.sin((l.a * Math.PI) / 180);
      const u = h.x * ca + h.z * sa;
      const v = -h.x * sa + h.z * ca;
      if (u > l.inner - HERO_R && Math.abs(v) < l.half + HERO_R) {
         const nu = l.inner - HERO_R;
         h.x = nu * ca - v * sa;
         h.z = nu * sa + v * ca;
         const vu = h.vx * ca + h.vz * sa;
         if (vu > 0) {
            h.vx -= vu * ca;
            h.vz -= vu * sa;
         }
      }
   }
}

/** Updrafts (for the next ms), storm shear, blade gates and Cyclone Ray's lightning. */
function hazards(run: RingRun, ms: number, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   h.inUpdraft = false;
   for (let i = 0; i < c.updrafts.length; i++) {
      const u = c.updrafts[i];
      if (h.y >= u.y0 && h.y <= u.y1 && Math.hypot(h.x - u.x, h.z - u.z) <= u.r) {
         h.inUpdraft = true;
         break;
      }
   }
   const shielded = ms < h.shieldUntil;
   const phasing = ms < h.phaseUntil;
   let storm = NONE;
   for (let i = 0; i < c.storms.length; i++) {
      const s = c.storms[i];
      if (h.y < s.y0 || h.y > s.y1) continue;
      const dx = h.x - s.x;
      const dz = h.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d >= s.r) continue;
      storm = i;
      if (shielded) continue;
      const n = d > 1e-6 ? d : 1;
      h.vx = (d > 1e-6 ? dx / n : 1) * STORM_PUSH;
      h.vz = (d > 1e-6 ? dz / n : 0) * STORM_PUSH;
      h.knockUntil = ms + 120;
      if (h.storm !== i) ev.stormPushed = true;
   }
   h.storm = storm;
   if (shielded || phasing || ms < h.invulnUntil) return;
   for (let i = 0; i < c.blades.length; i++) {
      const b = c.blades[i];
      if (Math.abs(h.y - b.y) > BLADE_BALL + HERO_R) continue;
      const a = (b.omega * ms) / 1000 + b.phase;
      for (let k = 0; k < 2; k++) {
         const bx = b.x + Math.cos(a + k * Math.PI) * b.arm;
         const bz = b.z + Math.sin(a + k * Math.PI) * b.arm;
         const dx = h.x - bx;
         const dy = h.y - b.y;
         const dz = h.z - bz;
         if (dx * dx + dy * dy + dz * dz < (BLADE_BALL + HERO_R) ** 2) {
            awayFrom(h, bx, bz, AWAY);
            knock(run, ms, AWAY.x, AWAY.z);
            ev.bladeHit = true;
            return;
         }
      }
   }
   const boss = run.boss;
   if (boss && boss.phase === 1 && boss.step === "attack") {
      for (let k = 0; k < 3; k++) {
         const th = run.lanes[k];
         const dist = Math.abs(-Math.sin(th) * h.x + Math.cos(th) * h.z);
         if (dist < LANE_HALF + HERO_R) {
            const side = -Math.sin(th) * h.x + Math.cos(th) * h.z >= 0 ? 1 : -1;
            knock(run, ms, -Math.sin(th) * side, Math.cos(th) * side);
            ev.laneHit = true;
            return;
         }
      }
   }
}

function addPoints(run: RingRun, pts: number, part: keyof RingRun["parts"]): void {
   run.score += pts;
   run.parts[part] += pts;
}

function link(run: RingRun, ms: number, base: number, ev: StepEvents): void {
   const bonus = comboHit(run.combo, COMBO, ms, base);
   ev.comboLinked = true;
   if (bonus > 0) {
      addPoints(run, bonus, "flow");
      ev.comboBonus += bonus;
   }
}

function threadRings(run: RingRun, ms: number, prevY: number, ev: StepEvents): void {
   const h = run.hero;
   if (!(h.y < prevY)) return;
   const c = run.course;
   const ix = c.index;
   for (let k = firstAtOrBelow(ix.ringY, prevY); k < ix.ringY.length && ix.ringY[k] >= h.y; k++) {
      const i = ix.ringsByY[k];
      if (ix.ringY[k] >= prevY) continue;
      if (run.threaded[i] === 1) continue;
      const r = c.rings[i];
      ringPos(r, ms, POS);
      const d = Math.hypot(h.x - POS.x, h.z - POS.z);
      const open = ringOpen(run, r, ms);
      if (open > 0.2 && d <= open - 0.1) {
         run.threaded[i] = 1;
         const centre = d <= CENTRE_FRAC * open;
         addPoints(run, centre ? PTS.centre : PTS.ring, "rings");
         run.rings += 1;
         if (centre) run.centres += 1;
         if (run.missed[i] === 1) {
            // Nami's rescue: a missed ring threaded after all is no longer a miss
            run.missed[i] = 0;
            run.misses -= 1;
         }
         run.streak += 1;
         if (run.streak > run.bestStreak) run.bestStreak = run.streak;
         h.boost = Math.min(BOOST_CAP, h.boost + (r.kind === "speed" ? BOOST_SPEED : BOOST_RING));
         if (r.kind === "speed") ev.speedBoost = true;
         link(run, ms, COMBO_BASE.ring, ev);
         if (ev.ringCount < 8) {
            ev.ringList[ev.ringCount] = i;
            ev.ringCentre[ev.ringCount] = centre;
            ev.ringCount += 1;
         }
         if (r.kind === "gold") {
            for (let s = 0; s < c.secrets.length; s++) {
               const spot = c.secrets[s];
               if (spot.kind === "ring" && spot.ring === i && collectSecret(run.secrets, s)) pushSecret(ev, s);
            }
         }
      } else if (r.main && run.missed[i] === 0 && d < r.r + MISS_LANE) {
         run.missed[i] = 1;
         run.misses += 1;
         run.streak = 0;
         comboBreak(run.combo);
         ev.missCount += 1;
      }
   }
}

function pushSecret(ev: StepEvents, s: number): void {
   if (ev.secretCount < 4) ev.secretList[ev.secretCount++] = s;
}

function pickups(run: RingRun, ms: number, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   const magnet = ms < h.magnetUntil;
   const reach = magnet ? MAGNET_REACH : ORB_PICKUP;
   const ix = c.index;
   for (let k = firstAtOrBelow(ix.orbY, h.y + reach); k < ix.orbY.length && ix.orbY[k] >= h.y - reach; k++) {
      const i = ix.orbsByY[k];
      if (run.taken[i] === 1) continue;
      const o = c.orbs[i];
      if (o.gate === "zuno" && !magnet) continue;
      const dx = h.x - o.x;
      const dy = h.y - o.y;
      const dz = h.z - o.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.taken[i] = 1;
      run.orbs += 1;
      if (o.gate === "none") run.mainOrbs += 1;
      addPoints(run, PTS.orb, "orbs");
      link(run, ms, COMBO_BASE.orb, ev);
      if (ev.orbCount < 8) ev.orbList[ev.orbCount++] = i;
   }
   for (let s = 0; s < c.secrets.length; s++) {
      const spot = c.secrets[s];
      if (spot.kind !== "pickup" || run.secrets.found[s]) continue;
      const dx = h.x - spot.x;
      const dy = h.y - spot.y;
      const dz = h.z - spot.z;
      if (dx * dx + dy * dy + dz * dz <= SECRET_PICKUP * SECRET_PICKUP && collectSecret(run.secrets, s)) pushSecret(ev, s);
   }
}

/** The pad, the pool, the tail pad (level 5) or a splash. */
function land(run: RingRun, ms: number, prevY: number, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   const pad = c.pad;
   if (c.boss) {
      const b = run.boss;
      if (b && b.phase === 2 && b.step === "vulnerable" && prevY > TAIL.y && h.y <= TAIL.y) {
         rayPose(run, ms, RAY_SCRATCH);
         const d = Math.hypot(h.x - RAY_SCRATCH.x, h.z - RAY_SCRATCH.z);
         if (d <= pad.r) {
            if (hitBoss(b, CYCLONE_RAY, BOSS_DAMAGE[2], run.bossEv) !== "ignored") {
               addPoints(run, PTS.bossHit, "boss");
               ev.bossHit = true;
               if (b.hp === 0) {
                  addPoints(run, PTS.defeat, "boss");
                  ev.bossDefeated = true;
               }
            }
            finish(run, ms, h.y, d <= pad.bull ? "bull" : "pad", ev);
            return;
         }
      }
   } else if (prevY > pad.y && h.y <= pad.y) {
      const d = Math.hypot(h.x - pad.x, h.z - pad.z);
      if (d <= pad.r) {
         finish(run, ms, pad.y, d <= pad.bull ? "bull" : "pad", ev);
         return;
      }
   }
   if (prevY > 0 && h.y <= 0) {
      const pool = c.pool;
      if (pool && Math.hypot(h.x - pool.x, h.z - pool.z) <= pool.r) {
         finish(run, ms, 0, "pool", ev);
         return;
      }
      // a splash in the open sea: back up for another drop
      h.y = 0;
      h.vx = h.vz = h.vy = 0;
      h.mode = "splash";
      h.modeMs = 0;
      h.boost = 0;
      run.hits += 1;
      run.splashes += 1;
      run.streak = 0;
      comboBreak(run.combo);
      ev.splashed = true;
   }
}

function finish(run: RingRun, ms: number, y: number, landing: Exclude<Landing, null>, ev: StepEvents): void {
   const h = run.hero;
   h.y = y;
   h.vx = h.vz = h.vy = 0;
   h.mode = "landed";
   h.modeMs = 0;
   run.landing = landing;
   addPoints(run, landing === "bull" ? PTS.bull : landing === "pad" ? PTS.pad : PTS.pool, "landing");
   if (landing === "bull") {
      for (let s = 0; s < run.course.secrets.length; s++) if (run.course.secrets[s].kind === "landing" && collectSecret(run.secrets, s)) pushSecret(ev, s);
   }
   run.finishMs = ms;
   run.timeBonus = timeBonusFor(run.course, ms);
   addPoints(run, run.timeBonus, "time");
   run.ended = "win";
   ev.landed = landing;
   ev.finished = true;
}

// ---------- level 5: the eye, the wake rings, the lanes, the hits ----------

function enterArena(run: RingRun, ms: number, ev: StepEvents): void {
   run.arenaMs = ms;
   run.boss = createBoss(CYCLONE_RAY);
   run.wakeDropAt = ms + CYCLONE_RAY.introMs;
   ev.arenaEntered = true;
}

function stepTheBoss(run: RingRun, ms: number, ev: StepEvents): void {
   const b = run.boss!;
   const bev = stepBoss(b, CYCLONE_RAY, 1, run.bossEv);
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 1) {
         const th = (rngNext(run.rng) * Math.PI) / 3;
         for (let k = 0; k < 3; k++) run.lanes[k] = th + (k * Math.PI) / 3;
      }
   }
   if (bev.phaseChanged) ev.bossPhase = true;
   const h = run.hero;
   if (h.mode !== "fall") return;
   rayPose(run, ms, RAY_SCRATCH);
   // phase 1: the Ray drops wind rings while it attacks
   if (b.phase === 0 && b.step === "attack" && ms >= run.wakeDropAt) {
      const w = run.wake[run.wakeNext];
      run.wakeNext = (run.wakeNext + 1) % WAKE.slots;
      w.alive = true;
      w.x = RAY_SCRATCH.x;
      w.y = RAY_SCRATCH.y + 1;
      w.z = RAY_SCRATCH.z;
      w.bornMs = ms;
      run.wakeDropAt = ms + WAKE.everyMs;
   }
   if (b.step !== "vulnerable") return;
   if (b.phase === 0 && run.charged) {
      const dx = h.x - RAY_SCRATCH.hx;
      const dz = h.z - RAY_SCRATCH.hz;
      if (Math.abs(h.y - RAY_SCRATCH.hy) <= RAY.fin.dy + HERO_R && dx * dx + dz * dz <= RAY.fin.r * RAY.fin.r) bossHitNow(run, 0, ev);
   } else if (b.phase === 1) {
      const dx = h.x - RAY_SCRATCH.hx;
      const dz = h.z - RAY_SCRATCH.hz;
      if (Math.abs(h.y - RAY_SCRATCH.hy) <= RAY.body.dy + HERO_R && dx * dx + dz * dz <= RAY.body.r * RAY.body.r) bossHitNow(run, 1, ev);
   }
}

function bossHitNow(run: RingRun, phase: 0 | 1, ev: StepEvents): void {
   const b = run.boss!;
   const res = hitBoss(b, CYCLONE_RAY, BOSS_DAMAGE[phase], run.bossEv);
   if (res === "ignored") return;
   addPoints(run, PTS.bossHit, "boss");
   ev.bossHit = true;
   if (res === "phase") ev.bossPhase = true;
   if (phase === 0) {
      run.charged = false;
      run.wakeChain = 0;
      for (const w of run.wake) w.alive = false;
   }
   // bounce off it
   run.hero.vy = 8;
   run.hero.invulnUntil = run.simMs + INVULN_MS;
}

function wakeRings(run: RingRun, ms: number, prevY: number, ev: StepEvents): void {
   const h = run.hero;
   for (let i = 0; i < run.wake.length; i++) {
      const w = run.wake[i];
      if (!w.alive) continue;
      if (ms - w.bornMs > WAKE.lifeMs) {
         w.alive = false;
         continue;
      }
      if (!(prevY > w.y && h.y <= w.y)) continue;
      w.alive = false;
      const d = Math.hypot(h.x - w.x, h.z - w.z);
      if (d <= WAKE.r - 0.1) {
         run.wakeChain += 1;
         ev.wakeThreaded = true;
         if (run.wakeChain >= WAKE.chain && !run.charged) {
            run.charged = true;
            ev.charged = true;
         }
      } else if (d < WAKE.r + MISS_LANE && !run.charged) {
         run.wakeChain = 0;
         ev.wakeMissed = true;
      }
   }
}

// ---------- reads for the HUD, the camera and the store ----------

/** The hero's fall speed (m/s, positive down). */
export function fallSpeed(run: RingRun): number {
   return Math.max(0, -run.hero.vy);
}

/** The next course ring under the hero not yet threaded on the main line (or -1): the outline and the drop line. */
export function nextRing(run: RingRun): number {
   const h = run.hero;
   const c = run.course;
   const ix = c.index;
   for (let k = firstAtOrBelow(ix.ringY, h.y - 0.01); k < ix.ringY.length; k++) {
      const i = ix.ringsByY[k];
      if (run.threaded[i] === 1) continue;
      const r = c.rings[i];
      if (!r.main && r.kind !== "gold") continue;
      if (h.y - r.y > 90) return NONE;
      ringPos(r, run.simMs, POS);
      if (Math.hypot(h.x - POS.x, h.z - POS.z) > 26) continue;
      return i;
   }
   return NONE;
}

/** Where the hero would cross height y at the current velocity (the drop line's mark), written into out. */
export function predictCross(run: RingRun, y: number, out: { x: number; z: number }): { x: number; z: number } {
   const h = run.hero;
   const vy = Math.min(-1, h.vy);
   const t = Math.max(0, (h.y - y) / -vy);
   out.x = h.x + h.vx * Math.min(t, 1.5);
   out.z = h.z + h.vz * Math.min(t, 1.5);
   return out;
}

export const STAT = {
   rings: "rings",
   centres: "centres",
   misses: "misses",
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   depth: "depth",
   speed: "speed",
   hero: "hero",
   power: "power",
   streak: "streak",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   finishMs: "finishMs",
   landing: "landing",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   wakeChain: "wakeChain",
   charged: "charged",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   hint: "hint",
} as const;

/** The one teaching line the HUD shows (teach by playing: a word at the moment it matters, no text walls). */
export const HINT = { none: 0, leap: 1, dive: 2, wake: 3, fin: 4, lanes: 5, belly: 6, tail: 7 } as const;

export function hintFor(run: RingRun): number {
   const h = run.hero;
   if (run.ended !== null) return HINT.none;
   if (h.mode === "perch") return HINT.leap;
   const b = run.boss;
   if (b && b.step !== "defeat" && b.step !== "done") {
      if (b.phase === 0) return run.charged ? HINT.fin : HINT.wake;
      if (b.phase === 1) return b.step === "vulnerable" ? HINT.belly : HINT.lanes;
      if (b.phase === 2) return HINT.tail;
   }
   if (run.trioMs >= 0 && !h.diving) {
      const c = run.course;
      for (let i = 0; i < c.rings.length; i++) {
         const r = c.rings[i];
         if (r.closeMs === r.closeMs && run.threaded[i] === 0 && h.y > r.y && run.simMs - run.trioMs < r.closeMs) return HINT.dive;
      }
   }
   return HINT.none;
}

/** A points game: the store's score (the rules' run.score, published every frame) and the run time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The Perfect Streak badge (the card's no-hit bonus): no ring missed in the whole level. Hits for the star screen. */
export function badgeHits(run: RingRun): number {
   return run.misses;
}
