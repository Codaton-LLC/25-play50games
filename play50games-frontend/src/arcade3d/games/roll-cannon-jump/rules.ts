// Roll Cannon Jump rules (the design card's AIM, TIME, FIRE): a grey, colour-drained big top crossed
// by climbing into circus cannons, aiming (yaw ±60 deg, pitch 20-70 deg), and firing yourself
// cannon-to-cannon. The power ring pulses 60 -> 100 % on a 1.2 s cycle and Jump fires, so launch
// speed is a pure function of the pulse at the fire ms (deterministic arcs, the card's risk fix). In
// flight only a small air nudge (1.5 m/s^2) and a steeper roll-dive steer the arc; a cannon within
// 1.2 m auto-catches with a 0.4 s hit-stop; trampolines bounce to 1.3x the incoming height; balloon
// bunches pop for one free re-aim; a 2.4 s aim timeout auto-fires (no dead time); every fall
// respawns the hero in the last cannon after 0.8 s. Level 5 is Ashbag, the Smoke Blimp.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now; the same at 30, 60 or
// 144 fps (whole-ms clock, fraction carried, stepped 1 ms at a time). No allocation after createRun().
// README "Rules" and "Server limits" (M3) explain the design and the proof; rules.test.ts checks them.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { NAMI_JUMP_PITCH, NAMI_JUMP_V, V_DASH, MAGNET_REACH, POWER_MS, DEFAULT_HERO, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import {
   cannonX,
   cannonYaw,
   cannonZ,
   courseFor,
   jetLive,
   type Course,
} from "./course";
import { ASHBAG, COMBO, COMBO_BASE_MS, SECRETS } from "./progression";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** gravity (m/s^2) and the terminal fall speed (m/s): nothing ever falls faster than the launch bound */
export const G = 12;
export const V_TERM = 22;
/** the launch speed curve: a pure function of the pulse (the card's deterministic arcs) */
export const V_MIN = 9;
export const V_MAX = 22;
/** the power ring: 60 -> 100 % on a 1.2 s cycle */
export const PULSE_MS = 1200;
export const PULSE_MIN = 0.6;
/** the stick's aim: yaw within +-60 deg of the cannon's forward, pitch 20-70 deg */
export const YAW_MAX = Math.PI / 3;
export const PITCH_MIN = Math.PI / 9;
export const PITCH_MAX = (70 * Math.PI) / 180;
export const PITCH_MID = (45 * Math.PI) / 180;
/** the aim timeout: auto-fire at the current pulse (the card's dead-time fix) */
export const AIM_TIMEOUT_MS = 2400;
/** a cannon within this of the hero auto-catches it, then a 0.4 s hit-stop */
export const CATCH_R = 1.2;
export const CATCH_MS = 400;
/** the same cannon cannot re-catch the hero for this long after a fire (leaving the barrel) */
export const REFIRE_IMMUNE_MS = 300;
/** every fall: back in the last cannon after this long */
export const RESPAWN_MS = 800;
/** the small air nudge (m/s^2) and the roll-dive's extra downward accel (m/s^2) */
export const NUDGE_A = 1.5;
export const DIVE_G = 30;
const DIVE_STICK = 0.5;
/** trampolines bounce to this much of the incoming height (the card: 1.3x); the pad also caps the
 * horizontal carry at this speed, so a bounce is a pop up, not a skip forward (design note: the card
 * fixes only the 1.3x vertical; the horizontal cap keeps every bounce landable) */
export const TRAMP_K = 1.3;
export const TRAMP_VMAX = 6;
/** a popped balloon bunch: hover this long, then one free re-aim (a fresh aim, mid-air) */
export const BALLOON_MS = 350;
/** auto cannons fire alone after this long in the barrel, at the cannon's calibrated pulse */
export const AUTO_FIRE_MS = 1500;
/** a paint bomb jams a cannon this long (Ashbag P2) */
export const JAM_MS = 3000;
/** on foot: platform walking and the platform jump */
export const V_WALK = 4;
export const V_JUMP = 6;
export const FOOT = 0.15;
/** orbs: pickup radius round the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 1.0, bonusMs: 400, centerY: 0.6 } as const;
const AIM_DEAD = 0.12;

export const DASH_DIST = (V_DASH * POWER_MS.dash) / 1000;
/** the least ms the dash phase can last: its 4 m at the dash top speed */
export const DASH_MIN_MS = (DASH_DIST * 1000) / (V_MAX + V_DASH);

// ---------- the pulse, the launch curve, arcs ----------

/** The power ring's pulse at rules ms: 60 % at the cycle's ends, 100 % at its middle. */
export function pulseAt(ms: number): number {
   const t = (ms % PULSE_MS) / PULSE_MS;
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   return PULSE_MIN + (1 - PULSE_MIN) * tri;
}

/** The launch speed for a pulse: linear from V_MIN (60 %) to V_MAX (100 %). Pure and deterministic. */
export function launchSpeed(pulse: number): number {
   return V_MIN + (V_MAX - V_MIN) * ((pulse - PULSE_MIN) / (1 - PULSE_MIN));
}

/** The pulse that gives a launch speed (inverse of launchSpeed), for the bot's fire timing. */
export function pulseForSpeed(v: number): number {
   return PULSE_MIN + ((1 - PULSE_MIN) * (v - V_MIN)) / (V_MAX - V_MIN);
}

/** One point of a ballistic arc (the preview, the ghost, the bot's look-ahead). */
export function arcPoint(x0: number, y0: number, z0: number, yaw: number, pitch: number, v: number, t: number): { x: number; y: number; z: number } {
   const cp = Math.cos(pitch);
   return {
      x: x0 + Math.sin(yaw) * cp * v * t,
      y: y0 + Math.sin(pitch) * v * t - (G / 2) * t * t,
      z: z0 - Math.cos(yaw) * cp * v * t,
   };
}

// ---------- the lower bound (README "Server limits and why they hold", M3) ----------

/**
 * The least ms a leg's vertical change can take: up at vy <= V_MAX.sin(70 deg), down at vy <= V_TERM.
 * Any sequence of arcs, bounces and relaunches is bounded by these (a relaunch never raises the caps).
 */
export function verticalMinMs(dH: number): number {
   if (dH >= 0) {
      const vy = V_MAX * Math.sin(PITCH_MAX);
      const disc = vy * vy - 2 * G * dH;
      return disc < 0 ? Infinity : ((vy - Math.sqrt(disc)) / G) * 1000;
   }
   return (-dH * 1000) / V_TERM;
}

/** The least ms a fly leg can take at the horizontal caps: d m at V_MAX, less Riko's one 4 m dash. */
export function flyLegMinMs(d: number, dH: number, dash: boolean): number {
   const horiz = dash ? DASH_MIN_MS + ((Math.max(0, d - DASH_DIST) * 1000) / V_MAX) : (d * 1000) / V_MAX;
   return Math.max(horiz, verticalMinMs(dH));
}

/** The least ms one leg list takes. */
function legsMinMs(legs: LegDef[], dash: boolean): number {
   let ms = 0;
   for (const leg of legs) {
      if (leg.mode === "walk") ms += (leg.d * 1000) / V_WALK;
      else ms += flyLegMinMs(leg.d, leg.dH, dash) + (leg.catchEnd ? CATCH_MS : 0);
   }
   return ms;
}

/** The least ms the course's mandatory stretches take: the shorter of the main plan and L4's shortcut. */
export function progressFloorMs(course: Course, dash = false): number {
   const main = legsMinMs(course.legs, dash);
   if (course.altLegs) return Math.min(main, legsMinMs(course.altLegs, dash));
   return main;
}

/** The earliest rules ms Ashbag can be down: every vulnerable window hit at once (menu2/boss). */
export function bossMinMs(): number {
   const s = createBoss(ASHBAG);
   const ev = createBossEvents();
   for (let ms = 1; ms < 900_000; ms++) {
      stepBoss(s, ASHBAG, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, ASHBAG, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** The proven least finish ms: the leg floor, and on level 5 Ashbag's least defeat time too. */
export function minFinishMs(course: Course): number {
   const legs = progressFloorMs(course);
   return course.boss ? Math.max(legs, BOSS_MIN_MS) : legs;
}

/** What the course can feed the flow meter: every orb, the first catch of each cannon, each hoop, boss hits. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length + course.rainOrbs.length, base: COMBO_BASE_MS.orb },
         { count: course.cannons.length, base: COMBO_BASE_MS.catch },
         { count: course.hoops.length, base: COMBO_BASE_MS.hoop },
         { count: course.boss ? ASHBAG.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus. */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - (course.orbs.length + course.rainOrbs.length) * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

/** Riko's floor: each fly leg keeps its vertical bound, but up to 4 m a flight rides the dash's
 * +8 m/s (the only thing that can beat the horizontal cap). Nothing else in the game can. */
export function dashFloorMs(course: Course): number {
   const plain = minDurationMsOf(course);
   const ms = progressFloorMs(course, true);
   return Math.min(plain, ms - (course.orbs.length + course.rainOrbs.length) * ORB.bonusMs - comboMaxBonus(comboSpecOf(course)));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms (94-100 % of it), never above the dash floor. */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb / 100) * 100;
   minDurationMs = Math.min(minDurationMs, Math.floor(dashFloorMs(course) / 100) * 100);
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}

// ---------- the run ----------

export type HeroMode = "aim" | "fly" | "catch" | "fall" | "done";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   mode: HeroMode;
   /** the cannon the hero is in, or the last one it fired from (the fall respawn anchor) */
   cannon: number;
   aimYaw: number;
   aimPitch: number;
   /** the ms the current aim began (the 2.4 s timeout) */
   aimFrom: number;
   /** aiming from a popped balloon: anchored mid-air, no cannon */
   balloonAim: boolean;
   /** catch / fall / balloon hover countdown */
   timerMs: number;
   grounded: boolean;
   support: number;
   diving: boolean;
   /** Riko's dash: on through this ms, its unit direction and speed, used this flight */
   dashUntil: number;
   dashX: number;
   dashZ: number;
   dashV: number;
   dashUsed: boolean;
   /** Nami: the air jump is up */
   airJump: boolean;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** the cannon last fired from + when (re-catch immunity) */
   firedFrom: number;
   firedAt: number;
   /** no dive and no nudge until this ms (the fire frame's aim stick must not spoil the launch) */
   launchGraceUntil: number;
}

export interface StepInput {
   /**
    * The stick: screen-relative (moveX right, moveZ = the core's moveY, up = -1), turned into the
    * world by `yaw` (core inputToWorld). With yaw 0 (bots, tests) it is the world direction itself,
    * so up is -z. In a cannon the stick aims: moveX = yaw, moveZ = pitch (up = lob). In flight it
    * is the air nudge; down (moveZ > 0.5 with yaw 0) is the roll-dive. On a platform it walks.
    */
   moveX: number;
   moveZ: number;
   /** the camera's yaw (rad); 0 = world space (bots, tests) */
   yaw: number;
   /** Jump: fire in a cannon, jump on a platform */
   jumpPressed: boolean;
   jumpHeld: boolean;
   /** the hero power (E / Enter / the Power button), one press */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   fired: boolean;
   /** the pulse at the fire (the juice's 0.3 s slow-mo hooks a 100 % shot) */
   pulse: number;
   perfect: boolean;
   aimTimeout: boolean;
   autoFire: boolean;
   caught: boolean;
   mounted: boolean;
   bounced: number;
   balloon: number;
   landed: boolean;
   landedOn: number;
   jumped: boolean;
   dove: boolean;
   orbCount: number;
   orbList: number[];
   hoop: number;
   secretCount: number;
   secretList: number[];
   comboBonus: number;
   comboLinked: boolean;
   lost: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   dashed: boolean;
   airJumped: boolean;
   boardBroken: number;
   jam: number;
   crowd: number;
   bossTelegraph: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   /** the pod whose rain was released (L5 P1), NONE otherwise */
   bossPod: number;
}

export interface GhostShot {
   x: number;
   y: number;
   z: number;
   yaw: number;
   pitch: number;
   v: number;
   from: number;
}

export interface CannonRun {
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
   /** shots fired (the par-shots badge reads this; it never feeds the score) */
   shots: number;
   collected: Uint8Array;
   rainActive: Uint8Array;
   orbs: number;
   mainOrbs: number;
   popped: Uint8Array;
   broken: Uint8Array;
   caught: Uint8Array;
   hooped: Uint8Array;
   crowdPassed: Uint8Array;
   jamUntil: Float64Array;
   combo: ComboState;
   secrets: SecretTracker;
   /** falls taken */
   hits: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   /** the last shot's arc (the card's ghost) */
   ghost: GhostShot | null;
   /** level 5: Ashbag (null elsewhere), its events */
   boss: BossState | null;
   bossEv: BossEvents;
   /** the boss's world pose this ms (bot, Scene) */
   blimp: { x: number; y: number; z: number; angle: number };
}

function createEvents(): StepEvents {
   return {
      fired: false,
      pulse: 0,
      perfect: false,
      aimTimeout: false,
      autoFire: false,
      caught: false,
      mounted: false,
      bounced: NONE,
      balloon: NONE,
      landed: false,
      landedOn: NONE,
      jumped: false,
      dove: false,
      orbCount: 0,
      orbList: new Array<number>(32).fill(0),
      hoop: NONE,
      secretCount: 0,
      secretList: [0, 0],
      comboBonus: 0,
      comboLinked: false,
      lost: false,
      respawned: false,
      finished: false,
      timeup: false,
      powered: false,
      dashed: false,
      airJumped: false,
      boardBroken: NONE,
      jam: NONE,
      crowd: NONE,
      bossTelegraph: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      bossPod: NONE,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.fired = false;
   ev.pulse = 0;
   ev.perfect = false;
   ev.aimTimeout = false;
   ev.autoFire = false;
   ev.caught = false;
   ev.mounted = false;
   ev.bounced = NONE;
   ev.balloon = NONE;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.jumped = false;
   ev.dove = false;
   ev.orbCount = 0;
   ev.hoop = NONE;
   ev.secretCount = 0;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.powered = false;
   ev.dashed = false;
   ev.airJumped = false;
   ev.boardBroken = NONE;
   ev.jam = NONE;
   ev.crowd = NONE;
   ev.bossTelegraph = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
   ev.bossPod = NONE;
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

function freshHero(cannon: number, course: Course): Hero {
   const c = course.cannons[cannon];
   return {
      x: c.x,
      y: c.y,
      z: c.z,
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "aim",
      cannon,
      aimYaw: c.yaw,
      aimPitch: c.pitch,
      aimFrom: 0,
      balloonAim: false,
      timerMs: 0,
      grounded: false,
      support: NONE,
      diving: false,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      dashV: 0,
      dashUsed: false,
      airJump: true,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      firedFrom: NONE,
      firedAt: NONE,
      launchGraceUntil: 0,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CannonRun {
   const course = courseFor(level);
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(0, course),
      pressMs: NONE,
      actionMs: NONE,
      powerReadyAt: 0,
      shots: 0,
      collected: new Uint8Array(course.orbs.length),
      rainActive: new Uint8Array(course.rainOrbs.length),
      orbs: 0,
      mainOrbs: 0,
      popped: new Uint8Array(course.balloons.length),
      broken: new Uint8Array(course.boards.length),
      caught: new Uint8Array(course.cannons.length),
      hooped: new Uint8Array(course.hoops.length),
      crowdPassed: new Uint8Array(course.crowd.length),
      jamUntil: new Float64Array(course.cannons.length),
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
      ghost: null,
      boss: course.boss ? createBoss(ASHBAG) : null,
      bossEv: createBossEvents(),
      blimp: { x: 0, y: 0, z: 0, angle: 0 },
   };
}

export function advanceClock(run: CannonRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const STICK = { x: 0, z: 0 };

/** One frame (dtMs = useRunFrame's dt * 1000). Returns run.events (the same object every step). */
export function step(run: CannonRun, dtMs: number, input: StepInput): StepEvents {
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

function tick(run: CannonRun, mx: number, mz: number): void {
   const h = run.hero;
   if (run.boss) bossMs(run);
   if (run.ended !== null) return;
   if (h.mode === "catch" || h.mode === "fall") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      if (h.timerMs > 0) return;
      if (h.mode === "catch") enterAim(run, h.cannon, false);
      else respawn(run);
      return;
   }
   if (h.mode === "aim") aimMs(run, mx, mz);
   else flyMs(run, mx, mz);
}

function link(run: CannonRun, ms: number, base: number): void {
   run.events.comboBonus += comboHit(run.combo, COMBO, ms, base);
   run.events.comboLinked = true;
}

function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

function enterAim(run: CannonRun, cannon: number, balloon: boolean): void {
   const h = run.hero;
   h.mode = "aim";
   h.cannon = cannon;
   h.balloonAim = balloon;
   h.aimFrom = run.simMs;
   h.grounded = false;
   h.support = NONE;
   h.diving = false;
   h.vx = 0;
   h.vy = 0;
   h.vz = 0;
   if (balloon) {
      h.aimYaw = 0;
      h.aimPitch = PITCH_MID;
   } else {
      const c = run.course.cannons[cannon];
      h.aimYaw = cannonYaw(c, run.simMs);
      h.aimPitch = c.pitch;
   }
}

function fire(run: CannonRun, pulse: number, auto: boolean, timeout: boolean): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const v = launchSpeed(pulse);
   const cp = Math.cos(h.aimPitch);
   if (!h.balloonAim) {
      h.firedFrom = h.cannon;
      h.firedAt = ms;
   }
   h.vx = Math.sin(h.aimYaw) * cp * v;
   h.vy = Math.sin(h.aimPitch) * v;
   h.vz = -Math.cos(h.aimYaw) * cp * v;
   h.mode = "fly";
   h.balloonAim = false;
   h.grounded = false;
   h.support = NONE;
   h.diving = false;
   h.dashUsed = false;
   h.airJump = true;
   h.timerMs = 0;
   run.shots += 1;
   h.launchGraceUntil = ms + 80;
   run.ghost = { x: h.x, y: h.y, z: h.z, yaw: h.aimYaw, pitch: h.aimPitch, v, from: ms };
   run.pressMs = NONE;
   ev.fired = true;
   ev.pulse = pulse;
   ev.perfect = pulse >= 0.999;
   ev.aimTimeout = timeout;
   ev.autoFire = auto;
}

function aimMs(run: CannonRun, mx: number, mz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const course = run.course;
   const cannon = h.balloonAim ? null : course.cannons[h.cannon];

   if (h.timerMs > 0) {
      // the popped-balloon hover: held in place, then the free re-aim opens
      h.timerMs -= 1;
      if (h.timerMs > 0) return;
   }

   if (cannon) {
      // ride the rail / the wheel
      h.x = cannonX(cannon, ms);
      h.y = cannon.y;
      h.z = cannonZ(cannon, ms);
   }
   const jammed = cannon !== null && ms < run.jamUntil[h.cannon];
   if (jammed) {
      // the paint jam: nothing fires; the timeout restarts when the jam lifts
      h.aimFrom = ms;
      run.pressMs = NONE;
      return;
   }

   // the stick aims (a dead stick keeps the cannon's forward and a mid pitch)
   const sx = Math.abs(mx) > AIM_DEAD ? mx : 0;
   const sz = Math.abs(mz) > AIM_DEAD ? mz : 0;
   const baseYaw = cannon ? cannonYaw(cannon, ms) : 0;
   h.aimYaw = baseYaw + sx * YAW_MAX;
   h.aimPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, PITCH_MID - sz * (25 * Math.PI) / 180));

   if (cannon && cannon.kind === "auto" && ms - h.aimFrom >= AUTO_FIRE_MS) {
      fire(run, cannon.autoPower, true, false);
      return;
   }
   if (ms - h.aimFrom >= AIM_TIMEOUT_MS) {
      fire(run, pulseAt(ms), false, true);
      return;
   }
   if (run.pressMs !== NONE) {
      run.pressMs = NONE;
      fire(run, pulseAt(ms), false, false);
   }
}

function flyMs(run: CannonRun, mx: number, mz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const course = run.course;
   comboTick(run.combo, COMBO, ms);

   if (h.grounded) {
      groundMs(run, mx, mz);
      return;
   }

   // the hero power (in flight only)
   if (run.actionMs !== NONE && run.actionMs <= ms) {
      run.actionMs = NONE;
      tryPower(run, mx, mz);
   }

   // the roll-dive: down on the stick, a steeper descent (corrects a long shot); the launch grace
   // keeps the fire frame's aim stick from spoiling the shot's first ms
   h.diving = mz > DIVE_STICK && ms > h.launchGraceUntil;
   if (h.diving && !ev.dove) ev.dove = true;

   // gravity, the dive's extra pull, the terminal bound
   h.vy -= G / 1000;
   if (h.diving) h.vy -= DIVE_G / 1000;
   if (h.vy < -V_TERM) h.vy = -V_TERM;
   if (h.vy > V_TERM) h.vy = V_TERM;

   // the air nudge (redirects within the speed caps)
   if (ms > h.launchGraceUntil) {
      h.vx += (mx * NUDGE_A) / 1000;
      h.vz += (mz * NUDGE_A) / 1000;
   }

   const dashing = h.dashUntil >= ms;
   if (dashing) {
      const sp = Math.min(V_MAX + V_DASH, h.dashV);
      h.vx = h.dashX * sp;
      h.vz = h.dashZ * sp;
   } else if (h.dashUntil === ms - 1) {
      h.dashUntil = NONE;
   }
   // the horizontal caps: V_MAX in flight, V_MAX + V_DASH through the dash — the proof's one rule
   {
      const cap = dashing ? V_MAX + V_DASH : V_MAX;
      const sp = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
      if (sp > cap) {
         const k = cap / sp;
         h.vx *= k;
         h.vz *= k;
      }
   }

   const x0 = h.x;
   const y0 = h.y;
   const z0 = h.z;
   h.x += h.vx / 1000;
   h.y += h.vy / 1000;
   h.z += h.vz / 1000;

   // poles (ghost tent poles stop the shot; Vexa's phase slips through)
   const phasing = ms <= h.phaseUntil;
   if (!phasing) {
      for (let i = 0; i < course.poles.length; i++) {
         const p = course.poles[i];
         if (h.y < p.y0 || h.y > p.y1) continue;
         const dx = h.x - p.x;
         const dz = h.z - p.z;
         const rr = p.r + HERO.radius;
         const d2 = dx * dx + dz * dz;
         if (d2 < rr * rr && d2 > 1e-9) {
            const d = Math.sqrt(d2);
            h.x = p.x + (dx / d) * rr;
            h.z = p.z + (dz / d) * rr;
         }
      }
   }

   // walls and cracked boards (boards break under Riko's dash)
   sideCollisions(run, dashing);

   // landings: platforms and trampolines (descending only)
   if (h.y < y0) {
      for (let i = 0; i < course.platforms.length; i++) {
         const p = course.platforms[i];
         if (y0 < p.y || h.y > p.y) continue;
         if (Math.abs(h.x - p.x) > p.hw + FOOT || Math.abs(h.z - p.z) > p.hd + FOOT) continue;
         h.y = p.y;
         h.grounded = true;
         h.support = i;
         h.vx = 0;
         h.vy = 0;
         h.vz = 0;
         h.diving = false;
         ev.landed = true;
         ev.landedOn = i;
         break;
      }
      if (!h.grounded) {
         for (let i = 0; i < course.tramps.length; i++) {
            const t = course.tramps[i];
            if (y0 < t.y || h.y > t.y) continue;
            const dx = h.x - t.x;
            const dz = h.z - t.z;
            if (dx * dx + dz * dz > (t.r + FOOT) * (t.r + FOOT)) continue;
            h.y = t.y;
            h.vy = Math.min(TRAMP_K * -h.vy, V_TERM);
            const sp = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
            if (sp > TRAMP_VMAX) {
               const k = TRAMP_VMAX / sp;
               h.vx *= k;
               h.vz *= k;
            }
            ev.bounced = i;
            break;
         }
      }
   }
   if (h.grounded) return;

   // auto-catch: a cannon within 1.2 m (hidden cannons wait for their board to break)
   for (let i = 0; i < course.cannons.length; i++) {
      const c = course.cannons[i];
      if (c.hidden) {
         const board = course.boards.findIndex((b) => boardGuards(b, c));
         if (board >= 0 && !run.broken[board]) continue;
      }
      if (i === h.firedFrom && ms - h.firedAt < REFIRE_IMMUNE_MS) continue;
      const dx = h.x - cannonX(c, ms);
      const dy = h.y - c.y;
      const dz = h.z - cannonZ(c, ms);
      if (dx * dx + dy * dy + dz * dz <= CATCH_R * CATCH_R) {
         h.cannon = i;
         h.mode = "catch";
         h.timerMs = CATCH_MS;
         h.x = cannonX(c, ms);
         h.y = c.y;
         h.z = cannonZ(c, ms);
         h.vx = 0;
         h.vy = 0;
         h.vz = 0;
         h.diving = false;
         ev.caught = true;
         if (!run.caught[i]) {
            run.caught[i] = 1;
            link(run, ms, COMBO_BASE_MS.catch);
         }
         return;
      }
   }

   // balloon bunches: pop for one free re-aim
   for (let i = 0; i < course.balloons.length; i++) {
      if (run.popped[i]) continue;
      const b = course.balloons[i];
      const dx = h.x - b.x;
      const dy = h.y - b.y;
      const dz = h.z - b.z;
      const r = b.r + HERO.radius;
      if (dx * dx + dy * dy + dz * dz <= r * r) {
         run.popped[i] = 1;
         h.mode = "aim";
         h.balloonAim = true;
         h.timerMs = BALLOON_MS;
         h.aimFrom = ms;
         h.vx = 0;
         h.vy = 0;
         h.vz = 0;
         ev.balloon = i;
         return;
      }
   }

   // grey smoke jets knock a flying hero off its arc (the shield passes)
   if (!hazardImmune(h, ms)) {
      for (let i = 0; i < course.jets.length; i++) {
         const j = course.jets[i];
         if (!jetLive(j, ms)) continue;
         const px = h.x - j.x;
         const py = h.y - j.y;
         const pz = h.z - j.z;
         const along = px * j.dx + py * j.dy + pz * j.dz;
         if (along < 0 || along > j.len) continue;
         const cx = px - j.dx * along;
         const cy = py - j.dy * along;
         const cz = pz - j.dz * along;
         const rr = j.r + HERO.radius;
         if (cx * cx + cy * cy + cz * cz <= rr * rr) {
            lose(run);
            return;
         }
      }
   }

   pickups(run, x0, z0);

   // the finish ring (levels 1-4): through the plane inside the ring
   const f = course.finish;
   if (f && (z0 - f.z) * (h.z - f.z) <= 0 && z0 !== h.z) {
      const dx = h.x - f.x;
      const dy = h.y + ORB.centerY - f.y;
      if (dx * dx + dy * dy <= f.r * f.r) {
         win(run);
         return;
      }
   }

   // the crowd silhouettes turn red as the hero passes
   for (let i = 0; i < course.crowd.length; i++) {
      if (run.crowdPassed[i]) continue;
      const c = course.crowd[i];
      if (h.z < c.z0 && h.z > c.z1) {
         run.crowdPassed[i] = 1;
         ev.crowd = i;
      }
   }

   if (h.y < course.killY) lose(run);
}

function boardGuards(b: { x: number; z: number }, c: { x: number; z: number }): boolean {
   return Math.hypot(b.x - c.x, b.z - c.z) < 4;
}

function tryPower(run: CannonRun, mx: number, mz: number): void {
   if (run.simMs < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   const ev = run.events;
   if (def.power === "dash") {
      if (h.dashUsed) return;
      let dx = h.vx;
      let dz = h.vz;
      let len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.5 && (mx !== 0 || mz !== 0)) {
         dx = mx;
         dz = mz;
         len = Math.sqrt(dx * dx + dz * dz);
      }
      if (len < 0.25) {
         dx = 0;
         dz = -1;
         len = 1;
      }
      h.dashX = dx / len;
      h.dashZ = dz / len;
      h.dashV = Math.min(V_MAX, len) + V_DASH;
      h.dashUntil = run.simMs + POWER_MS.dash;
      h.dashUsed = true;
      run.powerReadyAt = run.simMs + def.cooldownMs;
      ev.powered = true;
      ev.dashed = true;
      return;
   }
   if (def.power === "doubleJump") {
      if (!h.airJump) return;
      const pitch = NAMI_JUMP_PITCH * (Math.PI / 180);
      const cp = Math.cos(pitch);
      let dx = h.vx;
      let dz = h.vz;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.25) {
         dx = 0;
         dz = -1;
      } else {
         dx /= len;
         dz /= len;
      }
      h.vx = dx * NAMI_JUMP_V * cp;
      h.vz = dz * NAMI_JUMP_V * cp;
      h.vy = NAMI_JUMP_V * Math.sin(pitch);
      h.airJump = false;
      run.powerReadyAt = run.simMs + def.cooldownMs;
      ev.powered = true;
      ev.airJumped = true;
      return;
   }
   if (def.power === "shield") h.shieldUntil = run.simMs + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = run.simMs + POWER_MS.magnet;
   else h.phaseUntil = run.simMs + POWER_MS.phase;
   run.powerReadyAt = run.simMs + def.cooldownMs;
   ev.powered = true;
}

function groundMs(run: CannonRun, mx: number, mz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const course = run.course;
   const p = course.platforms[h.support];
   // walked off the edge?
   if (!p || Math.abs(h.x - p.x) > p.hw + FOOT || Math.abs(h.z - p.z) > p.hd + FOOT) {
      h.grounded = false;
      h.support = NONE;
      h.vy = 0;
      return;
   }
   // the platform jump
   if (run.pressMs !== NONE) {
      run.pressMs = NONE;
      h.grounded = false;
      h.support = NONE;
      h.vy = V_JUMP;
      const len = Math.hypot(mx, mz);
      h.vx = len > 0.25 ? (mx / len) * 1.5 : 0;
      h.vz = len > 0.25 ? (mz / len) * 1.5 : 0;
      ev.jumped = true;
      return;
   }
   // walk toward the stick
   h.vx = mx * V_WALK;
   h.vz = mz * V_WALK;
   h.x += h.vx / 1000;
   h.z += h.vz / 1000;
   h.y = p.y;
   pickups(run, h.x, h.z);
   // walking into a cannon mounts it (no hit-stop)
   for (let i = 0; i < course.cannons.length; i++) {
      const c = course.cannons[i];
      if (c.hidden) {
         const board = course.boards.findIndex((b) => boardGuards(b, c));
         if (board >= 0 && !run.broken[board]) continue;
      }
      const dx = h.x - cannonX(c, ms);
      const dy = h.y - c.y;
      const dz = h.z - cannonZ(c, ms);
      if (dx * dx + dy * dy + dz * dz <= CATCH_R * CATCH_R) {
         ev.mounted = true;
         if (!run.caught[i]) {
            run.caught[i] = 1;
            link(run, ms, COMBO_BASE_MS.catch);
         }
         enterAim(run, i, false);
         return;
      }
   }
}

// collision scratch (module-level: step() never yields)
const SCRATCH_P: Vec3Like = { x: 0, y: 0, z: 0 };
const SCRATCH_BOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

function pushBox(run: CannonRun, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): boolean {
   const h = run.hero;
   SCRATCH_BOX.min.x = minX;
   SCRATCH_BOX.max.x = maxX;
   SCRATCH_BOX.min.y = minY;
   SCRATCH_BOX.max.y = maxY;
   SCRATCH_BOX.min.z = minZ;
   SCRATCH_BOX.max.z = maxZ;
   SCRATCH_P.x = h.x;
   SCRATCH_P.y = h.y + ORB.centerY;
   SCRATCH_P.z = h.z;
   resolveSphereAabb(SCRATCH_P, HERO.radius, SCRATCH_BOX, SCRATCH_P);
   const moved = SCRATCH_P.x !== h.x || SCRATCH_P.z !== h.z || SCRATCH_P.y !== h.y + ORB.centerY;
   h.x = SCRATCH_P.x;
   h.y = SCRATCH_P.y - ORB.centerY;
   h.z = SCRATCH_P.z;
   return moved;
}

function sideCollisions(run: CannonRun, dashing: boolean): void {
   const h = run.hero;
   const course = run.course;
   for (let i = 0; i < course.walls.length; i++) {
      const w = course.walls[i];
      pushBox(run, w.x0, w.x1, w.y0, w.y1, Math.min(w.z0, w.z1), Math.max(w.z0, w.z1));
   }
   for (let i = 0; i < course.boards.length; i++) {
      if (run.broken[i]) continue;
      const b = course.boards[i];
      if (dashing && Math.abs(h.y + ORB.centerY - b.y) < b.hh + 0.8 && Math.abs(h.x - b.x) < b.hw + 1.2 && Math.abs(h.z - b.z) < 1.6) {
         // Riko's dash smashes the cracked board: the hidden cannon line opens
         run.broken[i] = 1;
         run.events.boardBroken = i;
         continue;
      }
      const s = Math.sin(b.yaw);
      const c = Math.cos(b.yaw);
      // the board's thin box, axis-aligned for the shallow-yaw courses we build
      const ex = Math.abs(c) * b.hw + Math.abs(s) * 0.25;
      const ez = Math.abs(s) * b.hw + Math.abs(c) * 0.25;
      pushBox(run, b.x - ex, b.x + ex, b.y - b.hh, b.y + b.hh, b.z - ez, b.z + ez);
   }
}

function pickups(run: CannonRun, x0: number, z0: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const course = run.course;
   const my = h.y + ORB.centerY;
   const magnet = h.magnetUntil >= ms;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < course.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = course.orbs[i];
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
   for (let i = 0; i < course.rainOrbs.length; i++) {
      if (!run.rainActive[i]) continue;
      const o = course.rainOrbs[i];
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach) {
         run.rainActive[i] = 0;
         run.collected[i] = 1;
         run.orbs += 1;
         run.mainOrbs += 1;
         if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
         link(run, ms, COMBO_BASE_MS.orb);
      }
   }
   for (let i = 0; i < course.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = course.secrets[i];
      const ox = s.x - h.x;
      const oy = s.y - my;
      const oz = s.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }
   for (let i = 0; i < course.hoops.length; i++) {
      const hp = course.hoops[i];
      if ((z0 - hp.z) * (h.z - hp.z) > 0 || z0 === h.z) continue;
      const dx = h.x - hp.x;
      const dy = my - hp.y;
      if (dx * dx + dy * dy > hp.r * hp.r) continue;
      ev.hoop = i;
      if (!run.hooped[i]) {
         run.hooped[i] = 1;
         link(run, ms, COMBO_BASE_MS.hoop);
      }
   }
}

function lose(run: CannonRun): void {
   const h = run.hero;
   h.mode = "fall";
   h.timerMs = RESPAWN_MS;
   h.vx = 0;
   h.vy = 0;
   h.vz = 0;
   h.grounded = false;
   h.support = NONE;
   h.dashUntil = NONE;
   h.diving = false;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
}

/** Back in the last cannon, aiming, RESPAWN_MS after the fall (the card's 0.8 s). */
function respawn(run: CannonRun): void {
   enterAim(run, run.hero.cannon, false);
   run.events.respawned = true;
}

function win(run: CannonRun): void {
   run.finishMs = run.simMs;
   run.ended = "win";
   run.hero.mode = "done";
   run.events.finished = true;
}

// ---------- Ashbag, the Smoke Blimp (level 5) ----------

/** The blimp's centre at rules ms (it circles the arena; for P3 it rises to the top and hovers). */
export function blimpCenter(course: Course, ms: number, phase: number): { x: number; y: number; z: number; angle: number } {
   const b = course.boss!;
   if (phase >= 2) return { x: b.cx, y: b.yPhase3, z: b.cz, angle: 0 };
   const angle = (2 * Math.PI * (ms % b.periodMs)) / b.periodMs;
   return { x: b.cx + b.radius * Math.cos(angle), y: b.yPhase2, z: b.cz + b.radius * Math.sin(angle), angle };
}

/** Pod k's world position at rules ms (the pods ride the blimp, rotating with it). */
export function podPos(course: Course, ms: number, k: number, phase: number): { x: number; y: number; z: number } {
   const b = course.boss!;
   const c = blimpCenter(course, ms, phase);
   const a = c.angle;
   const p = b.pods[k];
   const ca = Math.cos(a);
   const sa = Math.sin(a);
   return { x: c.x + p.x * ca - p.z * sa, y: c.y + p.y, z: c.z + p.x * sa + p.z * ca };
}

function bossMs(run: CannonRun): void {
   const b = run.boss!;
   const ev = run.events;
   const bev = run.bossEv;
   const h = run.hero;
   const ms = run.simMs;
   stepBoss(b, ASHBAG, 1, bev);
   if (bev.telegraph) ev.bossTelegraph = true;
   const center = blimpCenter(run.course, ms, b.phase);
   run.blimp.x = center.x;
   run.blimp.y = center.y;
   run.blimp.z = center.z;
   run.blimp.angle = center.angle;
   if (h.mode !== "fly") return;

   if (b.phase === 0) {
      // P1: the vulnerable pod of this circuit (one per 6 s)
      if (b.step === "vulnerable") {
         const k = b.attack % 3;
         const p = podPos(run.course, ms, k, 0);
         const dx = h.x - p.x;
         const dy = h.y - p.y;
         const dz = h.z - p.z;
         if (dx * dx + dy * dy + dz * dz <= run.course.boss!.podR * run.course.boss!.podR) {
            applyHit(run);
            if (run.events.bossHit) {
               ev.bossPod = k;
               // each popped pod rains orbs
               for (let i = 0; i < run.course.rainOrbs.length; i++) {
                  if (run.course.rainOrbs[i].pod === k && !run.rainActive[i] && !run.collected[i]) run.rainActive[i] = 1;
               }
            }
         }
      }
      return;
   }
   if (b.phase === 1) {
      // P2: paint bombs jam the arena cannons; the gondola opens in the windows
      if (b.step === "attack" && bev.attack) {
         const ci = run.course.boss!.bombCannons[b.attack % run.course.boss!.bombCannons.length];
         run.jamUntil[ci] = ms + JAM_MS;
         ev.jam = ci;
      }
      const g = run.course.boss!.gondola;
      const dxg = h.x - (center.x + g.x);
      const dyg = h.y - (center.y + g.y);
      const dzg = h.z - (center.z + g.z);
      if (b.step === "vulnerable" && dxg * dxg + dyg * dyg + dzg * dzg <= run.course.boss!.gondolaR * run.course.boss!.gondolaR) {
         applyHit(run);
      }
      return;
   }
   // P3: roll-dive into the valve while it is open
   if (b.step === "vulnerable" && h.diving) {
      const v = run.course.boss!.valve;
      const dx = h.x - (center.x + v.x);
      const dy = h.y - (center.y + v.y);
      const dz = h.z - (center.z + v.z);
      if (dx * dx + dy * dy + dz * dz <= run.course.boss!.valveR * run.course.boss!.valveR) {
         applyHit(run);
      }
   }
}

function applyHit(run: CannonRun): void {
   const r = hitBoss(run.boss!, ASHBAG, 1, run.bossEv);
   if (r === "ignored") return;
   run.events.bossHit = true;
   if (r === "phase") run.events.bossPhase = true;
   link(run, run.simMs, COMBO_BASE_MS.boss);
   if (r === "defeated") {
      run.events.bossDefeated = true;
      win(run);
   }
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

/** Every platform, wall, board and pole as it rests: a static list (allocates; call once per course). */
export function courseBoxes(course: Course): SolidBox[] {
   const out: SolidBox[] = [];
   for (const p of course.platforms) out.push({ minX: p.x - p.hw, maxX: p.x + p.hw, minY: p.y - 1, maxY: p.y, minZ: p.z - p.hd, maxZ: p.z + p.hd });
   for (const w of course.walls) out.push({ minX: w.x0, maxX: w.x1, minY: w.y0, maxY: w.y1, minZ: Math.min(w.z0, w.z1), maxZ: Math.max(w.z0, w.z1) });
   for (const b of course.boards) out.push({ minX: b.x - b.hw, maxX: b.x + b.hw, minY: b.y - b.hh, maxY: b.y + b.hh, minZ: b.z - 0.25, maxZ: b.z + 0.25 });
   for (const p of course.poles) out.push({ minX: p.x - p.r, maxX: p.x + p.r, minY: p.y0, maxY: p.y1, minZ: p.z - p.r, maxZ: p.z + p.r });
   return out;
}

/** The solid boxes at rules ms: rail-riding cannons included, smashed boards left out. */
export function solidBoxes(run: CannonRun, ms: number, out: SolidBox[]): number {
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
   for (const p of run.course.platforms) put(p.x - p.hw, p.x + p.hw, p.y - 1, p.y, p.z - p.hd, p.z + p.hd);
   for (const w of run.course.walls) put(w.x0, w.x1, w.y0, w.y1, Math.min(w.z0, w.z1), Math.max(w.z0, w.z1));
   for (let i = 0; i < run.course.boards.length; i++) {
      if (run.broken[i]) continue;
      const b = run.course.boards[i];
      put(b.x - b.hw, b.x + b.hw, b.y - b.hh, b.y + b.hh, b.z - 0.25, b.z + 0.25);
   }
   for (const p of run.course.poles) put(p.x - p.r, p.x + p.r, p.y0, p.y1, p.z - p.r, p.z + p.r);
   for (const c of run.course.cannons) put(cannonX(c, ms) - 0.8, cannonX(c, ms) + 0.8, c.y - 1.2, c.y + 0.4, cannonZ(c, ms) - 0.8, cannonZ(c, ms) + 0.8);
   return n;
}

// ---------- the store hand-off (README "Scoring", M3) ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   shots: "shots",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
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

/** This game's no-hit badge: no fall at all (the card's clean show). */
export function badgeHits(run: CannonRun): number {
   return run.hits === 0 ? 0 : 1;
}
