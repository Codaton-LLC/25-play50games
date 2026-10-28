// Cloud Hopper rules (the design card's GLIDE): a horizontal run along -z over clouds that sink
// under you and burst, feathers that fill a glide meter, gliding (hold Jump in the air), wind bands,
// wind and lift rings, centre landings (the streak), the hero roles, hazards (thunderheads, rim
// strikes, Gloom Nimbus's hail and its chase), checkpoints on solid anchor clouds, orbs (a time
// bonus), the flow meter, secrets, the level 5 boss and the lower bound behind the server limits.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx passes the stick
// plus the orbit camera's yaw (StepInput.yaw) and step() turns it camera-relative with core
// inputToWorld, so the yaw is part of the input every step reads; tests and bot.ts drive it (yaw 0).
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time, so every arc, glide and sink depends
// only on rules ms: the same at 30, 60 or 144 fps. No allocation after createRun().
// README "Rules" and "Server limits" explain the design and the proof; rules.test.ts checks them.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DASH_GLIDE_MS, DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS, type CloudLevel } from "./levels";
import { buildDraft, type BandDef, type CloudDef, type FeatherDef, type OrbDef, type RingDef, type RodDef, type StrikeDef, type ThunderDef, type WallDef } from "./sea";
import { COMBO, COMBO_BASE_MS, GLOOM_NIMBUS, SECRETS, STREAK_BADGE } from "./progression";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** top speed on foot and in a plain jump (m/s), and gliding (the card: 7 m/s forward, 1.2 m/s fall) */
export const V_RUN = 6.5;
export const V_GLIDE = 7;
export const GLIDE_FALL = 1.2;
export const ACCEL = { ground: 50, air: 32 } as const;
export const G = 30;
export const V_JUMP = 13;
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
export const FOOT = 0.15;
/** a fall this far below the last cloud stood on is lost */
export const FALL_DEPTH = 8;
export const LOST_MS = 900;
export const SPAWN_MS = 600;
/** cloud colliders are this deep under their crown */
export const THICKNESS = 1.2;
/** orbs: pickup radius round the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 1.0, bonusMs: 400, centerY: 0.6 } as const;
/** the glide meter: each feather adds 1.5 s, at most 4.5 s; a feather comes back 4 s after it is taken */
export const GLIDE_MAX_MS = 4500;
export const FEATHER = { pickup: 1.0, glideMs: 1500, respawnMs: 4000 } as const;
/** a respawn never leaves the meter under this (a glide gap after a checkpoint is never a soft-lock) */
export const RESPAWN_GLIDE_MS = 1500;
/** a centre landing: within this of the cloud's middle */
export const CENTRE_R = 0.8;
/** wind is felt in full while gliding, this much in a plain jump; never on the ground or in a dash */
export const WIND_JUMP = 0.4;
/** a pulse cloud just landed on stays solid this long */
export const PULSE_GRIP_MS = 700;
/** Gloom Nimbus's chase (level 5, phase 1): its speed, where it starts behind you, how close catches you */
export const CHASE = { speed: 5.2, start: 26, catch: 1.4, pushBack: 2, afterRespawn: 22 } as const;
/** the eye / core ring of phases 2-3: placed this far ahead, kept at least `lead` ahead until it opens */
export const EYE = { ahead: 14, lead: 4, radius: 1.9, up: 1.4 } as const;
/** the hail of phase 2: falls where you stood when it was telegraphed */
export const HAIL_R = 2.2;
/** a lightning rod charges you when you pass its plane within these (m) */
export const ROD = { halfX: 4, halfY: 4 } as const;

export const H_JUMP = (V_JUMP * V_JUMP) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;

// ---------- the course ----------

export interface Cloud extends CloudDef {
   bottom: number;
}

export type Orb = OrbDef;
export type { BandDef, FeatherDef, RingDef, RodDef, StrikeDef, ThunderDef, WallDef };

export interface Course {
   level: LevelId;
   clouds: Cloud[];
   route: number[];
   /** cloud indices of the checkpoints in order (the start, then every anchor on the route) */
   checkpoints: number[];
   goal: number;
   orbs: Orb[];
   /** the main orbs (the all-orbs star) */
   mainOrbs: number;
   feathers: FeatherDef[];
   rings: RingDef[];
   walls: WallDef[];
   thunder: ThunderDef[];
   strikes: StrikeDef[];
   bands: BandDef[];
   rods: RodDef[];
   /** the level's secrets (progression.ts SECRETS order): where each floats; no score */
   secrets: Vec3Like[];
   durationMs: number;
   sinkMps: number;
   burstMs: number;
   reformMs: number;
   boss: boolean;
   /** where the hero starts (z) and the goal's near edge for standing (z), the bound's ends */
   startZ: number;
   goalNearZ: number;
}

export function buildCourse(level: CloudLevel = LEVELS[1], script?: string): Course {
   const d = buildDraft(level, script);
   const clouds: Cloud[] = d.clouds.map((c) => ({ ...c, bottom: c.top - THICKNESS }));
   const checkpoints = d.route.filter((i) => clouds[i].kind === "start" || clouds[i].kind === "anchor");
   const goal = d.route[d.route.length - 1];
   const g = clouds[goal];
   const secrets = SECRETS[level.id].map((s) => {
      const p = d.secrets[s.id];
      if (!p) throw new Error(`cloud-hopper L${level.id}: secret ${s.id} is not placed`);
      return { x: p.x, y: p.y, z: p.z };
   });
   return {
      level: level.id,
      clouds,
      route: d.route,
      checkpoints,
      goal,
      orbs: d.orbs,
      mainOrbs: d.orbs.filter((o) => o.kind === "main").length,
      feathers: d.feathers,
      rings: d.rings,
      walls: d.walls,
      thunder: d.thunder,
      strikes: d.strikes,
      bands: d.bands,
      rods: d.rods,
      secrets,
      durationMs: level.durationMs,
      sinkMps: level.sinkMps,
      burstMs: level.burstMs,
      reformMs: level.reformMs,
      boss: level.boss,
      startZ: clouds[0].cz + 1.5,
      goalNearZ: g.cz + g.hd + FOOT,
   };
}

/** smoothstep(triangle) mover offset, polynomials only (the same in every engine) */
function sway(travel: number, periodMs: number, phase: number, ms: number): number {
   const cycles = ms / periodMs + phase;
   const t = cycles - Math.floor(cycles);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   const s = tri * tri * (3 - 2 * tri);
   return travel * (2 * s - 1);
}

export function cloudX(c: CloudDef, ms: number): number {
   return c.drift ? c.cx + sway(c.drift.travel, c.drift.periodMs, c.drift.phase, ms) : c.cx;
}

/** The top speed of a drifting cloud (m/s, along x only: drift never carries anyone forward). */
export function driftTopSpeed(c: CloudDef): number {
   return c.drift ? (c.drift.travel * 6000) / c.drift.periodMs : 0;
}

export function pulseOn(c: CloudDef, ms: number): boolean {
   if (!c.pulse) return true;
   const t = ms / c.pulse.periodMs + c.pulse.phase;
   return t - Math.floor(t) < c.pulse.on;
}

export function strikeLive(st: StrikeDef, ms: number): boolean {
   const t = ms / st.periodMs + st.phase;
   return t - Math.floor(t) < st.duty;
}

/** The wind band at z (index into course.bands), NONE outside every band. */
export function bandAt(course: Course, z: number): number {
   const b = course.bands;
   for (let i = 0; i < b.length; i++) if (z <= b[i].z0 && z > b[i].z1) return i;
   return NONE;
}

/**
 * The fastest any hero can move towards -z at z (m/s): on foot V_RUN, gliding V_GLIDE plus a tail
 * wind, a plain jump V_RUN plus WIND_JUMP of it; a head wind takes the same off. A dash is
 * V_DASH (the dash floor). The rules cap every ms's -z step at this (playMs step 9), so the proof holds.
 */
export function vmaxZ(course: Course, z: number): number {
   const i = bandAt(course, z);
   const tail = i === NONE ? 0 : -course.bands[i].wz;
   return Math.max(V_RUN, V_GLIDE + tail, V_RUN + WIND_JUMP * tail);
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

/** The z breakpoints between startZ and goalNearZ, with the speed on each piece. */
export function boundPieces(course: Course): { from: number; to: number; v: number }[] {
   const a = course.startZ;
   const b = course.goalNearZ;
   const cuts = [a, b];
   for (const band of course.bands) for (const z of [band.z0, band.z1]) if (z < a && z > b) cuts.push(z);
   cuts.sort((p, q) => q - p);
   const out: { from: number; to: number; v: number }[] = [];
   for (let i = 0; i + 1 < cuts.length; i++) {
      const from = cuts[i];
      const to = cuts[i + 1];
      if (from - to < 1e-9) continue;
      out.push({ from, to, v: vmaxZ(course, (from + to) / 2) });
   }
   return out;
}

/**
 * The least ms to stand on the goal by the z guard alone: every ms moves at most vmaxZ(z)/1000 m
 * towards -z, so a piece of length l at speed v takes at least l·1000/v ms, less the few ms a step
 * started in the piece before can overshoot into it (4 per piece). `vCap` replaces the speed (the dash floor).
 */
export function progressFloorMs(course: Course, vScale = 1): number {
   let ms = 0;
   for (const p of boundPieces(course)) ms += ((p.from - p.to) * 1000) / (p.v * vScale) - 4;
   return Math.max(0, ms);
}

/** The earliest rules ms Gloom Nimbus can be down: every vulnerable window hit at once (menu2/boss). */
export function bossMinMs(): number {
   const s = createBoss(GLOOM_NIMBUS);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, GLOOM_NIMBUS, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, GLOOM_NIMBUS, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/**
 * Gloom Nimbus can be hit right now (its eye glints turn gold, the HUD bar pulses): its vulnerable
 * window, and only when that window can land a hit. In the chase (phase 0) the eyes stay violet unless
 * the hero carries a lightning-rod charge to spend in it; later phases need the eye ring open ahead.
 * The step alone is not enough: the chase cycles telegraph -> attack -> vulnerable even with no charge.
 */
export function bossVulnerable(run: Pick<CloudRun, "boss" | "charges" | "eye">): boolean {
   const b = run.boss;
   if (!b || b.step !== "vulnerable" || b.hp <= 0) return false;
   return b.phase === 0 ? run.charges > 0 : run.eye.live;
}

const BOSS_MIN_MS = bossMinMs();

/** The proven least finish ms: the z floor, and on level 5 the boss's least defeat time too. */
export function minFinishMs(course: Course): number {
   const z = progressFloorMs(course);
   return course.boss ? Math.max(z, BOSS_MIN_MS) : z;
}

/** What the course can feed the flow meter: every orb, the first landing on each cloud but the start, the first pass of each ring. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.clouds.length - 1, base: COMBO_BASE_MS.cloud },
         { count: course.rings.length, base: COMBO_BASE_MS.ring },
      ],
   };
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus. */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/**
 * Riko's air dash: it is on for at most POWER_MS.dash + 1 ms at V_DASH (wind does not add), where the
 * floor counted at least V_RUN, so it saves at most (POWER_MS.dash + 1)(V_DASH − V_RUN)/V_RUN ms; a run
 * that finishes at T fired at most 1 + floor(T / cooldown) dashes. The least such T (never under the
 * boss floor), less every orb's bonus and the most flow bonus.
 */
export function dashFloorMs(course: Course): number {
   const F = progressFloorMs(course);
   const perDash = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
   const cooldown = heroById("riko").cooldownMs;
   let T = 0;
   while (T + perDash * (1 + Math.floor(T / cooldown)) < F) T += 1;
   if (course.boss) T = Math.max(T, BOSS_MIN_MS);
   return T - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms (94-100 % of it), never above the dash floor. */
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

export interface Hero extends Vec3Like {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   state: HeroState;
   grounded: boolean;
   support: number;
   arcStart: number;
   arcY0: number;
   arcV: number;
   coyoteFrom: number;
   /** drift carry (m per ms, x only) */
   carryX: number;
   lastTop: number;
   timerMs: number;
   /** gliding this ms; the meter (ms of glide left) */
   gliding: boolean;
   glideMs: number;
   /** Riko's dash: on through this ms; its unit direction; used this flight */
   dashUntil: number;
   dashX: number;
   dashZ: number;
   dashUsed: boolean;
   /** Nami: the air jump is up; it was refreshed by a glide this flight */
   airJump: boolean;
   glideRefresh: boolean;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** a pulse cloud just landed on stays solid through this ms */
   gripUntil: number;
}

export interface StepInput {
   /**
    * The stick: screen-relative (moveX right, moveZ = the core's moveY, up = -1), turned into the world
    * by `yaw` (the camera's yaw, core inputToWorld). With yaw 0 (bots, tests) it is the world
    * direction itself, so up is -z (the bot passes world directions with yaw 0).
    */
   moveX: number;
   moveZ: number;
   /** the camera's yaw (rad) the stick is relative to: the orbit camera's viewYaw (menu2/camera); 0 = world space (bots, tests) */
   yaw: number;
   /** a jump press this frame (keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   /** Jump held: glide in the air (the same button and the same timing on touch and keyboard) */
   jumpHeld: boolean;
   /** the hero power (E / Enter / the Power button), one press */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   /** Nami's air jump (the somersault) */
   airJumped: boolean;
   glideStarted: boolean;
   landed: boolean;
   landedOn: number;
   /** the landing was on the cloud's bright centre (a streak point) */
   centre: boolean;
   checkpoint: number;
   orbCount: number;
   orbList: number[];
   featherCount: number;
   featherList: number[];
   /** a ring flown through this step, NONE otherwise */
   ring: number;
   lost: boolean;
   /** the loss was a hit (a thunderhead, a strike, hail, the boss) rather than a fall */
   struck: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   dashed: boolean;
   /** a storm-cloud wall broken by the dash (index), NONE otherwise */
   wallBroken: number;
   /** a cloud burst into vapour this step (index), NONE otherwise */
   burst: number;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   /** a rod charged a shock (level 5) */
   charged: boolean;
   bossTelegraph: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

export interface CloudRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   pressMs: number;
   actionMs: number;
   powerReadyAt: number;
   checkpoint: number;
   respawns: number;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   /** the ms each feather was taken (-1 = there) */
   featherAt: Float64Array;
   /** the ms each sinking cloud was first landed on in its cycle (-1 = at rest) */
   landAt: Float64Array;
   /** 1 = this ring was flown through before (a first pass is a flow link) */
   ringPassed: Uint8Array;
   /** 1 = this storm wall is broken */
   broken: Uint8Array;
   /** 1 = landed on this cloud before */
   visited: Uint8Array;
   combo: ComboState;
   secrets: SecretTracker;
   /** falls and hits taken */
   hits: number;
   /** centre landings in a row, the best run of them (STREAK_BADGE = the no-hit badge) */
   streak: number;
   bestStreak: number;
   /** the furthest forward stood (m along -z, the HUD's distance) */
   bestDist: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   /** level 5: Gloom Nimbus (null elsewhere), its events, the shocks charged, its chase line and its ring */
   boss: BossState | null;
   bossEv: BossEvents;
   charges: number;
   chaseZ: number;
   eye: { x: number; y: number; z: number; live: boolean };
   hail: { x: number; z: number; live: boolean };
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      airJumped: false,
      glideStarted: false,
      landed: false,
      landedOn: NONE,
      centre: false,
      checkpoint: NONE,
      orbCount: 0,
      orbList: new Array<number>(32).fill(0),
      featherCount: 0,
      featherList: new Array<number>(8).fill(0),
      ring: NONE,
      lost: false,
      struck: false,
      respawned: false,
      finished: false,
      timeup: false,
      powered: false,
      dashed: false,
      wallBroken: NONE,
      burst: NONE,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      charged: false,
      bossTelegraph: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.airJumped = false;
   ev.glideStarted = false;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.centre = false;
   ev.checkpoint = NONE;
   ev.orbCount = 0;
   ev.featherCount = 0;
   ev.ring = NONE;
   ev.lost = false;
   ev.struck = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.powered = false;
   ev.dashed = false;
   ev.wallBroken = NONE;
   ev.burst = NONE;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.charged = false;
   ev.bossTelegraph = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

export const COURSE: Course = courseFor(1);

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

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
      lastTop: y,
      timerMs: 0,
      gliding: false,
      glideMs: 0,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      dashUsed: false,
      airJump: true,
      glideRefresh: false,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      gripUntil: 0,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CloudRun {
   const course = courseFor(level);
   const start = course.clouds[course.checkpoints[0]];
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(start.cx, start.top, course.startZ, course.checkpoints[0]),
      pressMs: NONE,
      actionMs: NONE,
      powerReadyAt: 0,
      checkpoint: 0,
      respawns: 0,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      featherAt: new Float64Array(course.feathers.length).fill(-1),
      landAt: new Float64Array(course.clouds.length).fill(-1),
      ringPassed: new Uint8Array(course.rings.length),
      broken: new Uint8Array(course.walls.length),
      visited: new Uint8Array(course.clouds.length),
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      streak: 0,
      bestStreak: 0,
      bestDist: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
      boss: course.boss ? createBoss(GLOOM_NIMBUS) : null,
      bossEv: createBossEvents(),
      charges: 0,
      chaseZ: course.startZ + CHASE.start,
      eye: { x: 0, y: 0, z: 0, live: false },
      hail: { x: 0, z: 0, live: false },
   };
}

/** A cloud's crown at rules ms, NaN while it is gone (burst, re-forming, or a pulse cloud off the beat). */
export function cloudTop(run: CloudRun, i: number, ms: number): number {
   const c = run.course.clouds[i];
   if (c.pulse && !pulseOn(c, ms) && !(run.hero.support === i && ms <= run.hero.gripUntil)) return Number.NaN;
   if (!c.sinks) return c.top;
   const la = run.landAt[i];
   if (la < 0) return c.top;
   const dt = ms - la;
   if (dt < 0) return c.top;
   const course = run.course;
   if (dt < course.burstMs) return c.top - (course.sinkMps * dt) / 1000;
   if (dt < course.burstMs + course.reformMs) return Number.NaN;
   return c.top;
}

export function arcY(h: Hero, ms: number): number {
   const t = (ms - h.arcStart) / 1000;
   return h.arcY0 + h.arcV * t - (G / 2) * t * t;
}

/** The hero's vertical speed now (m/s): 0 grounded, the glide's fall, the arc's speed. */
export function heroVy(h: Hero, ms: number): number {
   if (h.grounded) return 0;
   if (h.gliding) return -GLIDE_FALL;
   if (h.dashUntil >= ms) return 0;
   return h.arcV - (G * (ms - h.arcStart)) / 1000;
}

function startArc(h: Hero, ms: number, y0: number, v: number): void {
   h.arcStart = ms;
   h.arcY0 = y0;
   h.arcV = v;
   h.y = y0;
   h.grounded = false;
   h.support = NONE;
   h.gliding = false;
}

function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

function tryPower(run: CloudRun, ms: number, mx: number, mz: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   const ev = run.events;
   if (def.power === "dash") {
      // an air dash: in the air, once a flight, paid with a second of glide
      if (h.grounded || h.dashUsed || h.glideMs < DASH_GLIDE_MS) return;
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
      h.dashUsed = true;
      h.glideMs -= DASH_GLIDE_MS;
      h.gliding = false;
      h.arcY0 = h.y;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      ev.dashed = true;
      return;
   }
   if (def.power === "doubleJump") {
      if (h.grounded || !h.airJump) return;
      startArc(h, ms, h.y, V_JUMP);
      h.airJump = false;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      ev.airJumped = true;
      ev.jumped = true;
      return;
   }
   if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

export function advanceClock(run: CloudRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const STICK = { x: 0, z: 0 };

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: CloudRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   let mx = finite(input.moveX);
   let mz = finite(input.moveZ);
   const yaw = finite(input.yaw);
   if (yaw !== 0) {
      inputToWorld(mx, mz, yaw, STICK);
      mx = STICK.x;
      mz = STICK.z;
   }
   const len = Math.sqrt(mx * mx + mz * mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }
   const held = input.jumpHeld === true;
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= run.course.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, mx, mz, held);
      if (run.ended !== null) return ev;
   }
   return ev;
}

function tick(run: CloudRun, mx: number, mz: number, held: boolean): void {
   const h = run.hero;
   if (run.boss) bossMs(run);
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
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
   playMs(run, mx, mz, held);
}

// collision scratch (module-level: step() never yields)
const SCRATCH_P: Vec3Like = { x: 0, y: 0, z: 0 };
const SCRATCH_BOX: AABB = { min: { x: 0, y: -1000, z: 0 }, max: { x: 0, y: 1000, z: 0 } };

function onCloud(c: CloudDef, x: number, z: number, ms: number): boolean {
   return Math.abs(x - cloudX(c, ms)) <= c.hw + FOOT && Math.abs(z - c.cz) <= c.hd + FOOT;
}

function sideCollisions(run: CloudRun, h: Hero, ms: number): void {
   const feet = h.y;
   const head = h.y + HERO.height;
   const clouds = run.course.clouds;
   for (let i = 0; i < clouds.length; i++) {
      if (i === h.support) continue;
      const t = cloudTop(run, i, ms);
      if (!(feet < t - 1e-9 && head > t - THICKNESS)) continue;
      const c = clouds[i];
      const x = cloudX(c, ms);
      SCRATCH_BOX.min.x = x - c.hw;
      SCRATCH_BOX.max.x = x + c.hw;
      SCRATCH_BOX.min.z = c.cz - c.hd;
      SCRATCH_BOX.max.z = c.cz + c.hd;
      SCRATCH_P.x = h.x;
      SCRATCH_P.y = 0;
      SCRATCH_P.z = h.z;
      resolveSphereAabb(SCRATCH_P, HERO.radius, SCRATCH_BOX, SCRATCH_P);
      h.x = SCRATCH_P.x;
      h.z = SCRATCH_P.z;
   }
   const walls = run.course.walls;
   const dashing = h.dashUntil >= ms;
   const phasing = ms <= h.phaseUntil;
   for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (run.broken[i]) continue;
      if (!(feet < w.y1 && head > w.y0)) continue;
      if (w.kind === "ghost") {
         if (phasing) continue;
         // a one-way veil: it stops you only from the main route's side
         const mid = (w.x0 + w.x1) / 2;
         if ((h.x - mid) * w.side < 0) continue;
      }
      SCRATCH_BOX.min.x = w.x0;
      SCRATCH_BOX.max.x = w.x1;
      SCRATCH_BOX.min.z = w.z1 < w.z0 ? w.z1 : w.z0;
      SCRATCH_BOX.max.z = w.z1 < w.z0 ? w.z0 : w.z1;
      SCRATCH_P.x = h.x;
      SCRATCH_P.y = 0;
      SCRATCH_P.z = h.z;
      resolveSphereAabb(SCRATCH_P, HERO.radius, SCRATCH_BOX, SCRATCH_P);
      if (SCRATCH_P.x === h.x && SCRATCH_P.z === h.z) continue;
      if (w.kind === "storm" && dashing) {
         // the air dash crashes through the storm-cloud wall
         run.broken[i] = 1;
         run.events.wallBroken = i;
         continue;
      }
      h.x = SCRATCH_P.x;
      h.z = SCRATCH_P.z;
   }
}

function landingCloud(run: CloudRun, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   let best = NONE;
   let bestTop = -Infinity;
   const clouds = run.course.clouds;
   for (let i = 0; i < clouds.length; i++) {
      const t = cloudTop(run, i, ms);
      if (!(yOld >= t && t > yNew)) continue;
      if (t <= bestTop) continue;
      if (onCloud(clouds[i], x, z, ms)) {
         best = i;
         bestTop = t;
      }
   }
   return best;
}

function headCloud(run: CloudRun, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   const clouds = run.course.clouds;
   for (let i = 0; i < clouds.length; i++) {
      const t = cloudTop(run, i, ms);
      const bottom = t - THICKNESS;
      if (!(yOld + HERO.height <= bottom && bottom < yNew + HERO.height)) continue;
      const c = clouds[i];
      if (Math.abs(x - cloudX(c, ms)) < c.hw && Math.abs(z - c.cz) < c.hd) return i;
   }
   return NONE;
}

/** The cloud under the grounded hero now (its own, or a touching one at the same height), NONE if none. */
function cloudUnder(run: CloudRun, h: Hero, ms: number): number {
   const clouds = run.course.clouds;
   if (h.support !== NONE) {
      const t = cloudTop(run, h.support, ms);
      if (t === t && onCloud(clouds[h.support], h.x, h.z, ms)) return h.support;
   }
   for (let i = 0; i < clouds.length; i++) {
      const t = cloudTop(run, i, ms);
      if (Math.abs(t - h.y) < 0.03 && onCloud(clouds[i], h.x, h.z, ms)) return i;
   }
   return NONE;
}

function link(run: CloudRun, ms: number, base: number): void {
   run.events.comboBonus += comboHit(run.combo, COMBO, ms, base);
   run.events.comboLinked = true;
}

function playMs(run: CloudRun, mx: number, mz: number, held: boolean): void {
   const course = run.course;
   const h = run.hero;
   const ev = run.events;
   const ms = run.simMs;
   const x0 = h.x;
   const z0 = h.z;
   comboTick(run.combo, COMBO, ms);

   // 1. drift carry (x only)
   let cx = h.carryX;
   if (h.grounded) {
      const c = course.clouds[h.support];
      cx = cloudX(c, ms) - cloudX(c, ms - 1);
      h.carryX = cx;
   }

   // 2. jump: a buffered press, grounded or within coyote time
   if (run.pressMs !== NONE) {
      if (ms - run.pressMs > BUFFER_MS) run.pressMs = NONE;
      else if (h.grounded || (h.coyoteFrom !== NONE && ms - h.coyoteFrom <= COYOTE_MS)) {
         const y0 = h.grounded ? h.y : arcY(h, ms);
         startArc(h, ms, y0, V_JUMP);
         h.coyoteFrom = NONE;
         run.pressMs = NONE;
         ev.jumped = true;
      }
   }

   // 3. the hero power
   if (run.actionMs === ms) {
      run.actionMs = NONE;
      if (!(heroById(run.heroId).power === "doubleJump" && ev.jumped)) tryPower(run, ms, mx, mz);
   }

   const dashing = h.dashUntil >= ms;
   if (!dashing && h.dashUntil === ms - 1) {
      // the dash ends: fall from where it ended
      startArc(h, ms, h.y, 0);
      h.dashUntil = NONE;
   }

   // 4. the glide: hold Jump past the apex with glide in the meter; the meter drains 1 ms a ms
   if (!h.grounded && !dashing) {
      if (!h.gliding && held && h.glideMs > 0 && heroVy(h, ms) <= 0) {
         h.gliding = true;
         ev.glideStarted = true;
         // Nami: a glide refreshes her air jump once a flight
         if (!h.glideRefresh) {
            h.glideRefresh = true;
            h.airJump = true;
         }
      } else if (h.gliding && (!held || h.glideMs <= 0)) {
         startArc(h, ms, h.y, -GLIDE_FALL);
      }
   }
   const gliding = h.gliding;

   // 5. horizontal velocity: eased to the stick at the state's cap, or the dash
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else {
      const cap = gliding ? V_GLIDE : V_RUN;
      const rate = (h.grounded ? ACCEL.ground : ACCEL.air) / 1000;
      let dvx = cap * mx - h.vx;
      let dvz = cap * mz - h.vz;
      const dv = Math.sqrt(dvx * dvx + dvz * dvz);
      if (dv > rate) {
         dvx *= rate / dv;
         dvz *= rate / dv;
      }
      h.vx += dvx;
      h.vz += dvz;
      const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
      if (speed > cap) {
         h.vx *= cap / speed;
         h.vz *= cap / speed;
      }
   }
   h.x += h.vx / 1000 + cx;
   h.z += h.vz / 1000;
   // wind: felt in the air (in full while gliding), never on a cloud or in a dash
   if (!h.grounded && !dashing) {
      const b = bandAt(course, h.z);
      if (b !== NONE) {
         const k = gliding ? 1 : WIND_JUMP;
         h.x += (course.bands[b].wx * k) / 1000;
         h.z += (course.bands[b].wz * k) / 1000;
      }
   }

   // 6. vertical: walk-off / sinking under the feet, the arc or the glide (head bump, landing)
   if (h.grounded) {
      const s = cloudUnder(run, h, ms);
      if (s === NONE) {
         startArc(h, ms, h.y, 0);
         h.coyoteFrom = ms;
      } else {
         h.support = s;
         h.y = cloudTop(run, s, ms);
      }
   } else {
      const yOld = h.y;
      let yNew: number;
      if (dashing) yNew = yOld;
      else if (gliding) {
         yNew = yOld - GLIDE_FALL / 1000;
         h.glideMs -= 1;
      } else yNew = arcY(h, ms);
      if (yNew > yOld) {
         const hit = headCloud(run, h.x, h.z, yOld, yNew, ms);
         if (hit !== NONE) {
            yNew = Math.min(yOld, cloudTop(run, hit, ms) - THICKNESS - HERO.height - 1e-6);
            startArc(h, ms, yNew, 0);
            h.coyoteFrom = NONE;
         }
      }
      h.y = yNew;
      if (h.gliding) {
         h.arcY0 = yNew;
         h.arcStart = ms;
      }
      if (yNew < yOld) {
         const s = landingCloud(run, h.x, h.z, yOld, yNew, ms);
         if (s !== NONE) land(run, s, ms);
      }
   }

   // 7. side collisions (clouds, storm walls, ghost walls)
   sideCollisions(run, h, ms);

   // 8. the speed guards: the stick step (push-outs included) never beats its cap, and the -z step
   // never beats vmaxZ at the ms's start (the proof's one rule; a dash: V_DASH)
   const cap = (dashing ? V_DASH : gliding ? V_GLIDE : V_RUN) / 1000;
   {
      const dx = h.x - x0 - cx;
      const dz = h.z - z0;
      const moved = Math.sqrt(dx * dx + dz * dz);
      const windAllow = !h.grounded && !dashing ? windSpeed(course, z0) / 1000 : 0;
      const limit = cap + windAllow;
      if (moved > limit) {
         const k = limit / moved;
         h.x = x0 + cx + dx * k;
         h.z = z0 + dz * k;
      }
   }
   const zCap = (dashing ? V_DASH : vmaxZ(course, z0)) / 1000;
   if (z0 - h.z > zCap) h.z = z0 - zCap;

   const dist = course.startZ - h.z;
   if (h.grounded && dist > run.bestDist) run.bestDist = dist;

   // 9. pickups: orbs, feathers, secrets (the magnet's reach), rings, rods
   const my = h.y + ORB.centerY;
   const magnet = h.magnetUntil >= ms;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   const orbs = course.orbs;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      if (o.hidden && !magnet) continue;
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach) {
         run.collected[i] = 1;
         run.orbs += 1;
         if (o.kind === "main") run.mainOrbs += 1;
         if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
         link(run, ms, COMBO_BASE_MS.orb);
      }
   }
   const fr = magnet ? MAGNET_REACH : FEATHER.pickup;
   const feathers = course.feathers;
   for (let i = 0; i < feathers.length; i++) {
      const at = run.featherAt[i];
      if (at >= 0 && ms - at < FEATHER.respawnMs) continue;
      const f = feathers[i];
      const fx = f.x - h.x;
      const fy = f.y - my;
      const fz = f.z - h.z;
      if (fx * fx + fy * fy + fz * fz <= fr * fr) {
         run.featherAt[i] = ms;
         h.glideMs = Math.min(GLIDE_MAX_MS, h.glideMs + FEATHER.glideMs);
         if (ev.featherCount < ev.featherList.length) ev.featherList[ev.featherCount++] = i;
      }
   }
   const secrets = course.secrets;
   for (let i = 0; i < secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const o = secrets[i];
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }
   const rings = course.rings;
   for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if ((z0 - r.z) * (h.z - r.z) > 0 || z0 === h.z) continue;
      const rx = h.x - r.x;
      const ry = my - r.y;
      if (rx * rx + ry * ry > r.radius * r.radius) continue;
      ev.ring = i;
      if (!run.ringPassed[i]) {
         run.ringPassed[i] = 1;
         link(run, ms, COMBO_BASE_MS.ring);
      }
      if (r.kind === "wind") h.glideMs = Math.min(GLIDE_MAX_MS, h.glideMs + r.glideMs);
      else {
         // a lift ring: thrown straight up (no forward push) with the meter topped up
         h.glideMs = Math.min(GLIDE_MAX_MS, Math.max(h.glideMs, r.glideMs));
         if (!h.grounded) startArc(h, ms, h.y, r.liftV);
         h.dashUntil = NONE;
      }
   }
   if (run.boss && run.boss.phase === 0) {
      const rods = course.rods;
      for (let i = 0; i < rods.length; i++) {
         const r = rods[i];
         if ((z0 - r.z) * (h.z - r.z) > 0 || z0 === h.z) continue;
         if (Math.abs(h.x - r.x) > ROD.halfX || Math.abs(my - r.y) > ROD.halfY) continue;
         const need = 3 - run.boss.hits;
         if (run.charges < need) {
            run.charges += 1;
            ev.charged = true;
         }
      }
   }
   if (run.boss) bossContact(run, ms, z0);
   if (h.state !== "play") return;

   // 10. hazards: thunderheads (shield and phase pass), the fall line
   if (!hazardImmune(h, ms)) {
      const th = course.thunder;
      for (let i = 0; i < th.length; i++) {
         const t = th[i];
         const dx = h.x - t.x;
         const dy = my - t.y;
         const dz = h.z - t.z;
         const r = t.r + HERO.radius;
         if (dx * dx + dy * dy + dz * dz <= r * r) {
            lose(run, true);
            return;
         }
      }
   }
   if (!h.grounded && h.y < h.lastTop - FALL_DEPTH) {
      lose(run, false);
      return;
   }
   if (!h.grounded) return;

   // 11. rim strikes (level 4) on the cloud stood on
   if (!hazardImmune(h, ms)) {
      const st = course.strikes;
      for (let i = 0; i < st.length; i++) {
         const s = st[i];
         if (s.cloud !== h.support || !strikeLive(s, ms)) continue;
         const c = course.clouds[s.cloud];
         const dx = h.x - (cloudX(c, ms) + s.ox);
         const dz = h.z - (c.cz + s.oz);
         if (dx * dx + dz * dz <= s.radius * s.radius) {
            lose(run, true);
            return;
         }
      }
   }

   // 12. checkpoints (forward only) and the bridge's bell
   for (let k = run.checkpoint + 1; k < course.checkpoints.length; k++) {
      if (course.checkpoints[k] === h.support) {
         run.checkpoint = k;
         ev.checkpoint = k;
         break;
      }
   }
   if (h.support === course.goal && (!run.boss || run.boss.step === "defeat" || run.boss.step === "done")) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

/** The wind's speed at z (m/s, its length): the speed guard's allowance on top of the stick. */
function windSpeed(course: Course, z: number): number {
   const b = bandAt(course, z);
   if (b === NONE) return 0;
   const w = course.bands[b];
   return Math.sqrt(w.wx * w.wx + w.wz * w.wz);
}

function land(run: CloudRun, s: number, ms: number): void {
   const course = run.course;
   const h = run.hero;
   const ev = run.events;
   const c = course.clouds[s];
   const top = cloudTop(run, s, ms);
   h.y = top;
   h.grounded = true;
   h.support = s;
   h.coyoteFrom = NONE;
   h.lastTop = c.top;
   h.gliding = false;
   h.airJump = true;
   h.glideRefresh = false;
   h.dashUsed = false;
   h.dashUntil = NONE;
   h.gripUntil = c.pulse ? ms + PULSE_GRIP_MS : 0;
   if (c.sinks) {
      const la = run.landAt[s];
      if (la < 0 || ms - la >= course.burstMs + course.reformMs) run.landAt[s] = ms;
   }
   ev.landed = true;
   ev.landedOn = s;
   if (!run.visited[s]) {
      run.visited[s] = 1;
      if (s !== course.checkpoints[0]) link(run, ms, COMBO_BASE_MS.cloud);
      // the streak: a first landing on the bright centre adds a point, off-centre breaks it
      const dx = h.x - cloudX(c, ms);
      const dz = h.z - c.cz;
      if (dx * dx + dz * dz <= CENTRE_R * CENTRE_R) {
         run.streak += 1;
         if (run.streak > run.bestStreak) run.bestStreak = run.streak;
         ev.centre = true;
         if (run.boss && run.boss.phase === 0) run.chaseZ += CHASE.pushBack;
      } else run.streak = 0;
   }
}

/** Level 5: Gloom Nimbus's machine, one ms (before the hero's ms). */
function bossMs(run: CloudRun): void {
   const b = run.boss!;
   const ev = run.events;
   const bev = run.bossEv;
   const h = run.hero;
   const ms = run.simMs;
   stepBoss(b, GLOOM_NIMBUS, 1, bev);
   if (bev.telegraph) ev.bossTelegraph = true;
   if (b.phase === 0) {
      // the chase: it rolls after you along the route (it waits while you are out of play)
      if (h.state === "play" && b.step !== "intro") run.chaseZ -= CHASE.speed / 1000;
      if (b.step === "vulnerable" && run.charges > 0) {
         run.charges -= 1;
         applyHit(run);
      }
      return;
   }
   if (bev.telegraph) {
      // an eye (phase 2) or the core (phase 3) opens ahead of you; hail falls where you stand now
      const goal = run.course.clouds[run.course.goal];
      run.eye.x = h.x;
      run.eye.y = h.y + EYE.up;
      run.eye.z = Math.max(h.z - EYE.ahead, goal.cz - goal.hd + 1);
      run.eye.live = true;
      if (b.phase === 1) {
         run.hail.x = h.x;
         run.hail.z = h.z;
         run.hail.live = true;
      }
   }
   if (run.eye.live && (b.step === "telegraph" || b.step === "attack")) {
      // it keeps ahead of you until it opens
      if (run.eye.z > h.z - EYE.lead) {
         const goal = run.course.clouds[run.course.goal];
         run.eye.z = Math.max(h.z - EYE.lead, goal.cz - goal.hd + 1);
      }
   }
   if (b.step !== "attack") run.hail.live = run.hail.live && b.step === "telegraph";
   if (b.step === "defeat" || b.step === "done") {
      run.eye.live = false;
      run.hail.live = false;
   }
}

function applyHit(run: CloudRun): void {
   const r = hitBoss(run.boss!, GLOOM_NIMBUS, 1, run.bossEv);
   if (r === "ignored") return;
   run.events.bossHit = true;
   if (r === "phase") run.events.bossPhase = true;
   if (r === "defeated") run.events.bossDefeated = true;
   run.eye.live = false;
}

/** Level 5: what the hero touches of the boss this ms (its chase, the hail, the eye ring). */
function bossContact(run: CloudRun, ms: number, z0: number): void {
   const b = run.boss!;
   const h = run.hero;
   if (h.state !== "play") return;
   if (b.phase === 0 && b.step !== "intro" && run.chaseZ - h.z < CHASE.catch && !hazardImmune(h, ms)) {
      lose(run, true);
      return;
   }
   if (b.phase === 1 && b.step === "attack" && run.hail.live && !hazardImmune(h, ms)) {
      const dx = h.x - run.hail.x;
      const dz = h.z - run.hail.z;
      if (dx * dx + dz * dz <= HAIL_R * HAIL_R) {
         lose(run, true);
         return;
      }
   }
   if (b.phase >= 1 && b.step === "vulnerable" && run.eye.live) {
      const e = run.eye;
      if ((z0 - e.z) * (h.z - e.z) <= 0 && z0 !== h.z) {
         const dx = h.x - e.x;
         const dy = h.y + ORB.centerY - e.y;
         if (dx * dx + dy * dy <= EYE.radius * EYE.radius) applyHit(run);
      }
   }
}

function lose(run: CloudRun, struck: boolean): void {
   const h = run.hero;
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.vx = 0;
   h.vz = 0;
   h.carryX = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   h.gliding = false;
   if (h.grounded) {
      h.grounded = false;
      h.arcStart = run.simMs;
      h.arcY0 = h.y;
      h.arcV = 4;
   }
   h.support = NONE;
   run.hits += 1;
   run.streak = 0;
   comboBreak(run.combo);
   run.events.lost = true;
   run.events.struck = struck;
}

/** Back on the active checkpoint, at rest, frozen for SPAWN_MS; the clouds re-form and the feathers come back. */
function respawn(run: CloudRun): void {
   const h = run.hero;
   const index = run.course.checkpoints[run.checkpoint];
   const s = run.course.clouds[index];
   h.x = s.cx;
   h.y = s.top;
   h.z = run.checkpoint === 0 ? run.course.startZ : s.cz;
   h.vx = 0;
   h.vz = 0;
   h.grounded = true;
   h.support = index;
   h.arcStart = run.simMs;
   h.arcY0 = s.top;
   h.arcV = 0;
   h.coyoteFrom = NONE;
   h.carryX = 0;
   h.lastTop = s.top;
   h.dashUntil = NONE;
   h.dashUsed = false;
   h.gliding = false;
   h.airJump = true;
   h.glideRefresh = false;
   h.gripUntil = 0;
   h.glideMs = Math.max(h.glideMs, RESPAWN_GLIDE_MS);
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.landAt.fill(-1);
   run.featherAt.fill(-1);
   run.chaseZ = Math.max(run.chaseZ, h.z + CHASE.afterRespawn);
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- solid boxes (for a camera-collision pass, menu2/camera) ----------

export interface SolidBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** Every cloud as it rests and every wall: a static list (allocates; call once per course). */
export function courseBoxes(course: Course): SolidBox[] {
   const out: SolidBox[] = course.clouds.map((c) => {
      const t = c.drift ? c.drift.travel : 0;
      return { minX: c.cx - c.hw - t, maxX: c.cx + c.hw + t, minY: c.bottom, maxY: c.top, minZ: c.cz - c.hd, maxZ: c.cz + c.hd };
   });
   for (const w of course.walls) out.push({ minX: w.x0, maxX: w.x1, minY: w.y0, maxY: w.y1, minZ: Math.min(w.z0, w.z1), maxZ: Math.max(w.z0, w.z1) });
   return out;
}

/**
 * The solid boxes at rules ms `ms` (clouds where they are now, gone ones left out; walls not broken),
 * written into `out` (grown as needed, never shrunk). Returns how many are valid.
 */
export function solidBoxes(run: CloudRun, ms: number, out: SolidBox[]): number {
   let n = 0;
   const put = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) => {
      const b = out[n] ?? (out[n] = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
      b.minX = minX;
      b.maxX = maxX;
      b.minY = minY;
      b.maxY = maxY;
      b.minZ = minZ;
      b.maxZ = maxZ;
      n += 1;
   };
   const clouds = run.course.clouds;
   for (let i = 0; i < clouds.length; i++) {
      const t = cloudTop(run, i, ms);
      if (t !== t) continue;
      const c = clouds[i];
      const x = cloudX(c, ms);
      put(x - c.hw, x + c.hw, t - THICKNESS, t, c.cz - c.hd, c.cz + c.hd);
   }
   const walls = run.course.walls;
   for (let i = 0; i < walls.length; i++) {
      if (run.broken[i]) continue;
      const w = walls[i];
      put(w.x0, w.x1, w.y0, w.y1, Math.min(w.z0, w.z1), Math.max(w.z0, w.z1));
   }
   return n;
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
   /** glide meter, tenths of a second */
   glide: "glide",
   streak: "streak",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   charges: "charges",
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

/** The streak badge counts as the no-hit badge of this game (the card): hits for the star screen. */
export function badgeHits(run: CloudRun): number {
   return run.bestStreak >= STREAK_BADGE ? 0 : 1;
}
