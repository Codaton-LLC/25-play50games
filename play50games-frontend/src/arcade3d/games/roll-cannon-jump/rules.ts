// Roll Cannon Jump rules (the design card's AIM, TIME, FIRE). The hero climbs into circus cannons,
// turns the barrel (yaw +-60 deg round the cannon's base, pitch 20-70 deg), watches the power ring
// pulse 60 -> 100 -> 60 % on a 1.2 s cycle that starts when the hero settles in, and fires itself with
// Jump. A shot is one committed ballistic decision: in flight only a small air nudge (1.5 m/s^2, the
// stick, camera-relative) and the roll-dive (Jump again, held) steer it. A cannon whose mouth comes
// within 1.2 m catches the hero with a 0.4 s hit-stop; trampolines bounce to 1.3x the incoming
// height; balloon bunches pop for one free re-aim in mid-air; a fall into the safety net, a bonk off a
// pole, wall, trapeze or board, or a smoke jet puts the hero back in the last cannon 0.8 s later.
// Level 5 is Ashbag, the Smoke Blimp (menu2/boss). The 2.4 s aim timeout fires on its own (no dead
// time), auto cannons fire after 1.5 s (Jump fires them early).
//
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now; the same at 30, 60 or
// 144 fps (whole-ms clock, fraction carried, stepped 1 ms at a time). No allocation in step().
// The score proof (the least finish over every hero and every shot) is bound.ts; README "Scoring".
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboTick, copyCombo, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, copySecretTracker, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DASH_EXTRA_M, DEFAULT_HERO, MAGNET_REACH, NAMI_VY, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { courseFor } from "./layouts";
import { DEG, forwardX, forwardZ, type CannonDef, type Course, type RingDef, type SpotDef } from "./show";
import { ASHBAG, COMBO, COMBO_BASE_MS, SECRETS } from "./progression";

export { courseFor };
export type { Course };

// ---------- tuning (1 unit = 1 m, the show runs towards -z, up is +y) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
/** gravity (m/s^2): a 45 deg shot carries 7.2 m at 60 % and 24.2 m at 100 % */
export const G = 20;
/** the launch speed at 60 % and 100 % of the power ring */
export const V_MIN = 12;
export const V_MAX = 22;
/** the power ring: 60 -> 100 -> 60 % on a 1.2 s cycle, from the moment the hero settles in */
export const PULSE_MS = 1200;
export const PULSE_MIN = 0.6;
/** the aim: yaw within +-60 deg of the cannon's base, pitch 20-70 deg, turned at these rates (rad/s) */
export const YAW_RANGE = 60 * DEG;
export const PITCH_MIN = 20 * DEG;
export const PITCH_MAX = 70 * DEG;
export const YAW_RATE = 110 * DEG;
export const PITCH_RATE = 75 * DEG;
const AIM_DEAD = 0.15;
/** the aim timeout fires on its own (the card: the pulse forces a decision) and auto cannons fire after this */
export const AIM_TIMEOUT_MS = 2400;
export const AUTO_FIRE_MS = 1500;
/** a cannon mouth within this of the hero's middle catches it, then a 0.4 s hit-stop */
export const CATCH_R = 1.2;
export const CATCH_MS = 400;
/** the cannon just fired from cannot re-catch for this long */
export const REFIRE_IMMUNE_MS = 300;
/** a fall or a bonk: back in the last cannon after this long */
export const LOST_MS = 800;
/** the air nudge (m/s^2), the roll-dive's extra pull (m/s^2) and the fall speed cap (m/s) */
export const NUDGE_A = 1.5;
export const DIVE_G = 30;
export const V_TERM = 26;
/** the hero's ball radius in flight; feet = y - HERO_R on a platform */
export const HERO_R = 0.5;
export const FOOT = 0.15;
/** trampolines bounce to 1.3x the incoming height; they keep a little of the run-in (at most 4 m/s) */
export const TRAMP_K = 1.3;
export const TRAMP_VY_MAX = 16;
export const TRAMP_KEEP = 0.35;
export const TRAMP_H_MAX = 4;
/** a popped balloon bunch: hang this long, then one free re-aim (any yaw) */
export const BALLOON_MS = 350;
/** a paint bomb jams a stage cannon this long (Ashbag P2) */
export const JAM_MS = 3000;
/** on a platform: walking, and a small hop */
export const V_WALK = 4;
export const V_PJUMP = 7;
/** a Jump press counts this long (pressed during the hit-stop, it fires as the aim opens) */
export const PRESS_BUFFER_MS = 130;
/** orbs: pickup reach from the hero's middle and the time each takes off */
export const ORB = { pickup: 0.9, bonusMs: 100 } as const;
export const SECRET_R = 1.0;
/** Ashbag's hit reaches (m) from the hero's middle */
export const POD_R = 1.7;
export const GONDOLA_R = 1.6;
export const VALVE_R = 1.6;
/** the gondola hangs this far under the blimp's centre, the valve sits this far over it */
export const GONDOLA_DY = -2.6;
export const VALVE_DY = 3.0;
/** P2: the blimp's centre over a stage trampoline */
export const P2_HOVER_DY = 7.6;
/** a 100 % shot (the card's 0.3 s slow-mo, the L4 one-shot line) */
export const PERFECT = 0.995;

// ---------- the pulse and the launch ----------

/** The power ring at `t` ms into the aim: 60 % at 0, 100 % at 600 ms, 60 % again at 1200 ms. */
export function pulseAt(t: number): number {
   const u = (Math.max(0, t) % PULSE_MS) / PULSE_MS;
   const tri = u < 0.5 ? 2 * u : 2 - 2 * u;
   return PULSE_MIN + (1 - PULSE_MIN) * tri;
}

/** The first ms into the aim at which the ring reaches `p` (the rising half): (p - 0.6) / 0.4 * 600. */
export function pulseWaitMs(p: number): number {
   return (Math.max(0, Math.min(1, p) - PULSE_MIN) / (1 - PULSE_MIN)) * (PULSE_MS / 2);
}

/** The launch speed for a power 0.6..1 (linear, the card's deterministic arcs). */
export function launchSpeed(power: number): number {
   const p = Math.max(PULSE_MIN, Math.min(1, power));
   return V_MIN + ((V_MAX - V_MIN) * (p - PULSE_MIN)) / (1 - PULSE_MIN);
}

/** The power that gives a launch speed. */
export function powerForSpeed(v: number): number {
   return PULSE_MIN + ((1 - PULSE_MIN) * (v - V_MIN)) / (V_MAX - V_MIN);
}

/** smoothstep on a triangle wave: -travel .. +travel, polynomials only (the same in every engine) */
export function sway(travel: number, periodMs: number, phase: number, ms: number): number {
   if (!(periodMs > 0)) return 0;
   const c = ms / periodMs + phase;
   const t = c - Math.floor(c);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   return travel * (2 * tri * tri * (3 - 2 * tri) - 1);
}

/** A cannon's mouth at rules ms (rails applied). */
export function cannonPos(c: CannonDef, ms: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const r = c.rail;
   if (r) {
      const s = sway(r.travel, r.periodMs, r.phase, ms);
      out.x = c.x + r.ax * s;
      out.y = c.y + r.ay * s;
      out.z = c.z + r.az * s;
   } else {
      out.x = c.x;
      out.y = c.y;
      out.z = c.z;
   }
   return out;
}

/** A wheel cannon's yaw at rules ms (it sweeps on its own); every other cannon keeps its base. */
export function wheelYaw(c: CannonDef, ms: number): number {
   return c.kind === "wheel" ? c.yaw + sway(c.sweep, c.sweepMs, c.sweepPhase, ms) : c.yaw;
}

export function jetLive(j: { periodMs: number; duty: number; phase: number }, ms: number): boolean {
   if (j.duty >= 1) return true;
   const t = ms / j.periodMs + j.phase;
   return t - Math.floor(t) < j.duty;
}

// ---------- the run ----------

export type HeroMode = "aim" | "catch" | "fly" | "walk" | "hover" | "lost" | "done";
export type LostWhy = "net" | "bonk" | "smoke" | null;

export interface Hero {
   /** the ball's middle */
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   mode: HeroMode;
   /** the cannon the hero sits in (aim / catch), else NONE; a balloon re-aim keeps NONE */
   cannon: number;
   /** the balloon being hung from / aimed off, else NONE */
   balloon: number;
   /** the respawn cannon: the last one caught or mounted */
   lastCannon: number;
   /** the platform walked on */
   support: number;
   /** the barrel's aim */
   yaw: number;
   pitch: number;
   /** the ms the current aim opened (the ring's phase, the timeout) */
   aimFrom: number;
   /** catch / hover / lost countdown (ms) */
   timer: number;
   /** the ms this flight began */
   flightFrom: number;
   diving: boolean;
   /** a trampoline bounced this flight (Ashbag's gondola is hit from a bounce) */
   bounced: boolean;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   dashUsed: boolean;
   airJumpUsed: boolean;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   firedFrom: number;
   /** the facing (yaw) for the animation: the barrel in a cannon, the travel in flight */
   facing: number;
   lostWhy: LostWhy;
}

export interface StepInput {
   /**
    * The stick, screen-relative (moveX right, moveZ = the core's moveY, up = -1). In a cannon it turns
    * the barrel (right turns it right, up raises the pitch). In flight and on a platform it is turned
    * into the world by `yaw` (core inputToWorld): the air nudge and the walk. Yaw 0 (bots, tests): up is -z.
    */
   moveX: number;
   moveZ: number;
   /** the orbit camera's drawn yaw (rad); 0 = world space */
   yaw: number;
   /** Jump: fire in a cannon, roll-dive in flight (held), hop on a platform */
   jumpPressed: boolean;
   jumpHeld: boolean;
   /** the hero power (E / Enter / the Power button) */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   fired: boolean;
   pulse: number;
   perfect: boolean;
   autoFire: boolean;
   timeoutFire: boolean;
   /** the cannon that caught the hero this step (NONE otherwise); `mounted` when walked into */
   caught: number;
   mounted: boolean;
   bounced: number;
   balloon: number;
   landed: number;
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
   /** a paint bomb jammed this stage cannon / its shadow appeared on it (telegraph) */
   jam: number;
   bombMark: number;
   crowd: number;
   arena: boolean;
   bossTelegraph: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   /** the smoke pod popped this step (P1), NONE otherwise */
   bossPod: number;
}

function createEvents(): StepEvents {
   return {
      fired: false,
      pulse: 0,
      perfect: false,
      autoFire: false,
      timeoutFire: false,
      caught: NONE,
      mounted: false,
      bounced: NONE,
      balloon: NONE,
      landed: NONE,
      jumped: false,
      dove: false,
      orbCount: 0,
      orbList: new Array<number>(24).fill(0),
      hoop: NONE,
      secretCount: 0,
      secretList: [0, 0, 0],
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
      bombMark: NONE,
      crowd: NONE,
      arena: false,
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
   ev.autoFire = false;
   ev.timeoutFire = false;
   ev.caught = NONE;
   ev.mounted = false;
   ev.bounced = NONE;
   ev.balloon = NONE;
   ev.landed = NONE;
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
   ev.bombMark = NONE;
   ev.crowd = NONE;
   ev.arena = false;
   ev.bossTelegraph = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
   ev.bossPod = NONE;
}

/** The last shot's launch (the card's ghost arc of your last shot). */
export interface GhostShot {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   at: number;
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
   jumpHeld: boolean;
   powerReadyAt: number;
   /** shots fired (the par badge reads this; it never feeds the score) */
   shots: number;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   popped: Uint8Array;
   broken: Uint8Array;
   caught: Uint8Array;
   hooped: Uint8Array;
   crowdLit: Uint8Array;
   jamUntil: Float64Array;
   combo: ComboState;
   secrets: SecretTracker;
   /** falls and bonks */
   hits: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   /** the last shot's launch (at = NONE before the first) */
   ghost: GhostShot;
   /** level 5: Ashbag (null elsewhere) and its events */
   boss: BossState | null;
   bossEv: BossEvents;
   /** the ms the hero reached the stage (Ashbag starts then), NONE before */
   arenaAt: number;
   /** P1 pods popped (rain released) */
   pods: Uint8Array;
   /** the paint bomb's mark: the stage cannon it is falling on (telegraph), NONE */
   bombMark: number;
}

function freshHero(course: Course): Hero {
   const c = course.cannons[0];
   return {
      x: c.x,
      y: c.y,
      z: c.z,
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "aim",
      cannon: 0,
      balloon: NONE,
      lastCannon: 0,
      support: NONE,
      yaw: c.yaw,
      pitch: c.pitch,
      aimFrom: 0,
      timer: 0,
      flightFrom: 0,
      diving: false,
      bounced: false,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      dashUsed: false,
      airJumpUsed: false,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      firedFrom: NONE,
      facing: c.yaw,
      lostWhy: null,
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
      hero: freshHero(course),
      pressMs: NONE,
      actionMs: NONE,
      jumpHeld: false,
      powerReadyAt: 0,
      shots: 0,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      popped: new Uint8Array(course.balloons.length),
      broken: new Uint8Array(course.boards.length),
      caught: new Uint8Array(course.cannons.length),
      hooped: new Uint8Array(course.hoops.length),
      crowdLit: new Uint8Array(course.crowd.length),
      jamUntil: new Float64Array(course.cannons.length),
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
      ghost: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, at: NONE },
      boss: course.arena ? createBoss(ASHBAG) : null,
      bossEv: createBossEvents(),
      arenaAt: NONE,
      pods: new Uint8Array(3),
      bombMark: NONE,
   };
}

/** A copy of a run sharing its course (the bot's look-ahead and the tests); `dst` is reused when given. */
export function copyRun(src: CannonRun, dst: CannonRun | null = null): CannonRun {
   if (!dst || dst.course !== src.course) {
      dst = createRun(src.seed, src.level, src.heroId);
   }
   dst.heroId = src.heroId;
   dst.seed = src.seed;
   dst.simMs = src.simMs;
   dst.remainder = src.remainder;
   dst.stepMs = src.stepMs;
   Object.assign(dst.hero, src.hero);
   dst.pressMs = src.pressMs;
   dst.actionMs = src.actionMs;
   dst.jumpHeld = src.jumpHeld;
   dst.powerReadyAt = src.powerReadyAt;
   dst.shots = src.shots;
   dst.collected.set(src.collected);
   dst.orbs = src.orbs;
   dst.mainOrbs = src.mainOrbs;
   dst.popped.set(src.popped);
   dst.broken.set(src.broken);
   dst.caught.set(src.caught);
   dst.hooped.set(src.hooped);
   dst.crowdLit.set(src.crowdLit);
   dst.jamUntil.set(src.jamUntil);
   copyCombo(src.combo, dst.combo);
   copySecretTracker(src.secrets, dst.secrets);
   dst.hits = src.hits;
   dst.finishMs = src.finishMs;
   dst.ended = src.ended;
   Object.assign(dst.ghost, src.ghost);
   if (src.boss && dst.boss) Object.assign(dst.boss, src.boss);
   dst.arenaAt = src.arenaAt;
   dst.pods.set(src.pods);
   dst.bombMark = src.bombMark;
   return dst;
}

export function advanceClock(run: CannonRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const WORLD = { x: 0, z: 0 };
const POS = { x: 0, y: 0, z: 0 };

/** One frame (dtMs = useRunFrame's dt * 1000). Returns run.events (the same object every step). */
export function step(run: CannonRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (whole <= 0) return ev;
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   run.jumpHeld = !!input.jumpHeld || !!input.jumpPressed;
   // the raw stick turns the barrel; the world stick (camera-relative) nudges and walks
   let sx = finite(input.moveX);
   let sz = finite(input.moveZ);
   const sl = Math.hypot(sx, sz);
   if (sl > 1) {
      sx /= sl;
      sz /= sl;
   }
   inputToWorld(sx, sz, finite(input.yaw), WORLD);
   const wx = WORLD.x;
   const wz = WORLD.z;
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= run.course.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, sx, sz, wx, wz);
      if (run.ended !== null) return ev;
   }
   return ev;
}

function tick(run: CannonRun, sx: number, sz: number, wx: number, wz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   if (run.boss && run.arenaAt !== NONE) bossMs(run);
   if (run.ended !== null) return;
   comboTick(run.combo, COMBO, ms);
   switch (h.mode) {
      case "catch":
         h.timer -= 1;
         if (h.timer <= 0) openAim(run, h.cannon, NONE);
         return;
      case "hover":
         h.timer -= 1;
         if (h.timer <= 0) openAim(run, NONE, h.balloon);
         return;
      case "lost":
         h.timer -= 1;
         if (h.timer <= 0) respawn(run);
         return;
      case "aim":
         aimMs(run, sx, sz);
         return;
      case "walk":
         walkMs(run, wx, wz);
         return;
      case "fly":
         flyMs(run, wx, wz);
         return;
   }
}

function link(run: CannonRun, base: number): void {
   run.events.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
   run.events.comboLinked = true;
}

/** The aim opens (after a catch's hit-stop, a balloon's hang or a respawn): the ring starts at 60 %. */
function openAim(run: CannonRun, cannon: number, balloon: number): void {
   const h = run.hero;
   h.mode = "aim";
   h.cannon = cannon;
   h.balloon = balloon;
   h.aimFrom = run.simMs;
   h.timer = 0;
   h.vx = h.vy = h.vz = 0;
   h.diving = false;
   if (cannon >= 0) {
      const c = run.course.cannons[cannon];
      h.yaw = wheelYaw(c, run.simMs);
      h.pitch = c.pitch;
   } else {
      h.pitch = 45 * DEG;
   }
}

function pressed(run: CannonRun): boolean {
   return run.pressMs !== NONE && run.simMs - run.pressMs <= PRESS_BUFFER_MS && run.pressMs <= run.simMs;
}

function aimMs(run: CannonRun, sx: number, sz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const c = h.cannon >= 0 ? run.course.cannons[h.cannon] : null;
   if (c) {
      cannonPos(c, ms, POS);
      h.x = POS.x;
      h.y = POS.y;
      h.z = POS.z;
      if (ms < run.jamUntil[h.cannon]) {
         // grey paint in the barrel: nothing fires; the ring restarts when it clears
         h.aimFrom = ms;
         run.pressMs = NONE;
         return;
      }
   }
   const kind = c ? c.kind : "aim";
   if (kind === "aim") {
      const ax = Math.abs(sx) > AIM_DEAD ? sx : 0;
      const az = Math.abs(sz) > AIM_DEAD ? sz : 0;
      // right turns the barrel right (seen from behind it); up raises it
      h.yaw -= (ax * YAW_RATE) / 1000;
      h.pitch -= (az * PITCH_RATE) / 1000;
      if (c) {
         const d = Math.atan2(Math.sin(h.yaw - c.yaw), Math.cos(h.yaw - c.yaw));
         if (d > YAW_RANGE) h.yaw = c.yaw + YAW_RANGE;
         else if (d < -YAW_RANGE) h.yaw = c.yaw - YAW_RANGE;
      }
      if (h.pitch < PITCH_MIN) h.pitch = PITCH_MIN;
      if (h.pitch > PITCH_MAX) h.pitch = PITCH_MAX;
   } else if (c) {
      h.yaw = wheelYaw(c, ms);
      h.pitch = c.pitch;
   }
   h.facing = h.yaw;
   const t = ms - h.aimFrom;
   const power = kind === "aim" ? pulseAt(t) : c!.power;
   if (pressed(run)) fire(run, power, false, false);
   else if (kind === "auto" && t >= AUTO_FIRE_MS) fire(run, power, true, false);
   else if (t >= AIM_TIMEOUT_MS) fire(run, power, false, true);
}

/** The launch velocity of a shot (also the Scene's aim preview and the bot's plan). */
export function launchVelocity(yaw: number, pitch: number, power: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const v = launchSpeed(power);
   const cp = Math.cos(pitch);
   out.x = forwardX(yaw) * cp * v;
   out.y = Math.sin(pitch) * v;
   out.z = forwardZ(yaw) * cp * v;
   return out;
}

function fire(run: CannonRun, power: number, auto: boolean, timeout: boolean): void {
   const h = run.hero;
   const ev = run.events;
   launchVelocity(h.yaw, h.pitch, power, POS);
   h.vx = POS.x;
   h.vy = POS.y;
   h.vz = POS.z;
   h.firedFrom = h.cannon;
   h.cannon = NONE;
   h.balloon = NONE;
   startFlight(run);
   run.shots += 1;
   run.pressMs = NONE;
   const g = run.ghost;
   g.x = h.x;
   g.y = h.y;
   g.z = h.z;
   g.vx = h.vx;
   g.vy = h.vy;
   g.vz = h.vz;
   g.at = run.simMs;
   ev.fired = true;
   ev.pulse = power;
   ev.perfect = power >= PERFECT;
   ev.autoFire = auto;
   ev.timeoutFire = timeout;
}

function startFlight(run: CannonRun): void {
   const h = run.hero;
   h.mode = "fly";
   h.flightFrom = run.simMs;
   h.support = NONE;
   h.diving = false;
   h.bounced = false;
   h.dashUsed = false;
   h.dashUntil = NONE;
   h.airJumpUsed = false;
}

function tryPower(run: CannonRun, wx: number, wz: number): void {
   const ms = run.simMs;
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   const ev = run.events;
   if (def.power === "dash") {
      // in flight only, once a flight: +8 m/s along the travel for 500 ms (exactly 4 m extra)
      if (h.mode !== "fly" || h.dashUsed) return;
      let dx = h.vx;
      let dz = h.vz;
      let len = Math.hypot(dx, dz);
      if (len < 0.5) {
         dx = wx;
         dz = wz;
         len = Math.hypot(dx, dz);
      }
      if (len < 0.2) {
         dx = forwardX(h.facing);
         dz = forwardZ(h.facing);
         len = 1;
      }
      h.dashX = dx / len;
      h.dashZ = dz / len;
      h.dashUntil = ms + POWER_MS.dash - 1;
      h.dashUsed = true;
      ev.dashed = true;
   } else if (def.power === "doubleJump") {
      // in flight only, once a flight: a second arc (the horizontal is kept)
      if (h.mode !== "fly" || h.airJumpUsed) return;
      if (h.vy < NAMI_VY) h.vy = NAMI_VY;
      h.airJumpUsed = true;
      h.diving = false;
      ev.airJumped = true;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function flyMs(run: CannonRun, wx: number, wz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const course = run.course;
   if (run.actionMs !== NONE && run.actionMs <= ms) {
      run.actionMs = NONE;
      tryPower(run, wx, wz);
   }
   // the roll-dive: a Jump press after take-off, held (the press that fired never counts)
   if (!run.jumpHeld) h.diving = false;
   else if (!h.diving && run.pressMs > h.flightFrom && run.pressMs <= ms) {
      h.diving = true;
      run.pressMs = NONE;
      ev.dove = true;
   }
   h.vy -= G / 1000;
   if (h.diving) h.vy -= DIVE_G / 1000;
   if (h.vy < -V_TERM) h.vy = -V_TERM;
   // the air nudge, within the speed cap
   h.vx += (wx * NUDGE_A) / 1000;
   h.vz += (wz * NUDGE_A) / 1000;
   const sp = Math.hypot(h.vx, h.vz);
   if (sp > V_MAX) {
      h.vx *= V_MAX / sp;
      h.vz *= V_MAX / sp;
   }
   const dashing = h.dashUntil >= ms;
   const x0 = h.x;
   const y0 = h.y;
   const z0 = h.z;
   h.x += (h.vx + (dashing ? h.dashX * V_DASH : 0)) / 1000;
   h.y += h.vy / 1000;
   h.z += (h.vz + (dashing ? h.dashZ * V_DASH : 0)) / 1000;
   if (sp > 0.3) h.facing = Math.atan2(-h.vx, -h.vz);

   // bonks: walls and trapeze bars, poles (Vexa's phase passes ghost poles), cracked boards (Riko's dash smashes them)
   const phasing = ms <= h.phaseUntil;
   for (let i = 0; i < course.walls.length; i++) {
      const w = course.walls[i];
      if (sphereBox(h.x, h.y, h.z, HERO_R, w.minX, w.maxX, w.minY, w.maxY, w.minZ, w.maxZ)) return lose(run, "bonk");
   }
   for (let i = 0; i < course.poles.length; i++) {
      const p = course.poles[i];
      if (p.ghost && phasing) continue;
      if (h.y < p.y0 - HERO_R || h.y > p.y1 + HERO_R) continue;
      const dx = h.x - p.x;
      const dz = h.z - p.z;
      const rr = p.r + HERO_R;
      if (dx * dx + dz * dz < rr * rr) return lose(run, "bonk");
   }
   for (let i = 0; i < course.boards.length; i++) {
      if (run.broken[i]) continue;
      const b = course.boards[i];
      if (!sphereBox(h.x, h.y, h.z, HERO_R, b.x - b.hx, b.x + b.hx, b.y - b.hy, b.y + b.hy, b.z - b.hz, b.z + b.hz)) continue;
      if (dashing) {
         run.broken[i] = 1;
         ev.boardBroken = i;
         continue;
      }
      return lose(run, "bonk");
   }
   // grey smoke jets knock a flier off its arc (the shield passes)
   if (ms > h.shieldUntil) {
      for (let i = 0; i < course.jets.length; i++) {
         const j = course.jets[i];
         if (h.y < j.y0 || h.y > j.y1 || !jetLive(j, ms)) continue;
         const dx = h.x - j.x;
         const dz = h.z - j.z;
         const rr = j.r + HERO_R * 0.6;
         if (dx * dx + dz * dz < rr * rr) return lose(run, "smoke");
      }
   }

   pickups(run, x0, y0, z0);

   // the finish ring (levels 1-4)
   const f = course.finish;
   if (f && ringCrossed(f, x0, y0, z0, h.x, h.y, h.z)) return win(run);

   if (run.boss && run.arenaAt !== NONE) bossHits(run);
   if (run.ended !== null) return;

   // a cannon mouth within reach catches (a hidden one waits for its board)
   for (let i = 0; i < course.cannons.length; i++) {
      const c = course.cannons[i];
      if (c.board >= 0 && !run.broken[c.board]) continue;
      if (i === h.firedFrom && ms - h.flightFrom < REFIRE_IMMUNE_MS) continue;
      cannonPos(c, ms, POS);
      const dx = h.x - POS.x;
      const dy = h.y - POS.y;
      const dz = h.z - POS.z;
      if (dx * dx + dy * dy + dz * dz <= CATCH_R * CATCH_R) return caught(run, i, false);
   }
   // balloon bunches: pop for one free re-aim
   for (let i = 0; i < course.balloons.length; i++) {
      if (run.popped[i]) continue;
      const b = course.balloons[i];
      const dx = h.x - b.x;
      const dy = h.y - b.y;
      const dz = h.z - b.z;
      const r = b.r + HERO_R;
      if (dx * dx + dy * dy + dz * dz <= r * r) {
         run.popped[i] = 1;
         h.mode = "hover";
         h.balloon = i;
         h.cannon = NONE;
         h.timer = BALLOON_MS;
         h.x = b.x;
         h.y = b.y - b.r * 0.4;
         h.z = b.z;
         h.vx = h.vy = h.vz = 0;
         h.diving = false;
         ev.balloon = i;
         return;
      }
   }
   if (h.vy < 0) {
      // trampolines (landing from above): up to 1.3x the incoming height
      for (let i = 0; i < course.tramps.length; i++) {
         const t = course.tramps[i];
         const top = t.y + HERO_R;
         if (y0 < top || h.y > top) continue;
         const dx = h.x - t.x;
         const dz = h.z - t.z;
         const rr = t.r + FOOT;
         if (dx * dx + dz * dz > rr * rr) continue;
         h.y = top;
         h.vy = Math.min(Math.sqrt(TRAMP_K) * -h.vy, TRAMP_VY_MAX);
         h.vx *= TRAMP_KEEP;
         h.vz *= TRAMP_KEEP;
         const hs = Math.hypot(h.vx, h.vz);
         if (hs > TRAMP_H_MAX) {
            h.vx *= TRAMP_H_MAX / hs;
            h.vz *= TRAMP_H_MAX / hs;
         }
         h.bounced = true;
         h.diving = false;
         h.dashUntil = NONE;
         ev.bounced = i;
         return;
      }
      // platforms (landing from above)
      for (let i = 0; i < course.platforms.length; i++) {
         const p = course.platforms[i];
         const top = p.y + HERO_R;
         if (y0 < top || h.y > top) continue;
         if (!onPlatform(p, h.x, h.z)) continue;
         h.y = top;
         h.mode = "walk";
         h.support = i;
         h.vx = h.vy = h.vz = 0;
         h.diving = false;
         h.dashUntil = NONE;
         ev.landed = i;
         if (course.arena && course.arena.platform === i) enterArena(run);
         return;
      }
   }
   if (h.y < course.killY) lose(run, "net");
}

function walkMs(run: CannonRun, wx: number, wz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const course = run.course;
   const p = course.platforms[h.support];
   if (run.actionMs !== NONE && run.actionMs <= ms) {
      run.actionMs = NONE;
      tryPower(run, wx, wz);
   }
   if (pressed(run)) {
      // a little hop
      run.pressMs = NONE;
      h.vx = wx * V_WALK;
      h.vz = wz * V_WALK;
      h.vy = V_PJUMP;
      h.firedFrom = NONE;
      startFlight(run);
      run.events.jumped = true;
      return;
   }
   h.vx = wx * V_WALK;
   h.vz = wz * V_WALK;
   const x0 = h.x;
   const z0 = h.z;
   h.x += h.vx / 1000;
   h.z += h.vz / 1000;
   if (Math.abs(wx) + Math.abs(wz) > 0.05) h.facing = Math.atan2(-wx, -wz);
   if (!onPlatform(p, h.x, h.z)) {
      // walked off the edge
      h.vy = 0;
      h.firedFrom = NONE;
      startFlight(run);
      return;
   }
   pickups(run, x0, h.y, z0);
   // walking into a cannon climbs in (the same 0.4 s settle as a catch)
   for (let i = 0; i < course.cannons.length; i++) {
      const c = course.cannons[i];
      if (c.board >= 0 && !run.broken[c.board]) continue;
      cannonPos(c, ms, POS);
      const dx = h.x - POS.x;
      const dy = h.y - POS.y;
      const dz = h.z - POS.z;
      if (dx * dx + dy * dy + dz * dz <= CATCH_R * CATCH_R) return caught(run, i, true);
   }
}

function caught(run: CannonRun, i: number, walked: boolean): void {
   const h = run.hero;
   const c = run.course.cannons[i];
   cannonPos(c, run.simMs, POS);
   h.mode = "catch";
   h.cannon = i;
   h.balloon = NONE;
   h.lastCannon = i;
   h.timer = CATCH_MS;
   h.x = POS.x;
   h.y = POS.y;
   h.z = POS.z;
   h.vx = h.vy = h.vz = 0;
   h.diving = false;
   h.dashUntil = NONE;
   h.support = NONE;
   run.events.caught = i;
   run.events.mounted = walked;
   if (!run.caught[i]) {
      run.caught[i] = 1;
      link(run, COMBO_BASE_MS.catch);
   }
   if (c.stage) enterArena(run);
}

function enterArena(run: CannonRun): void {
   if (!run.boss || run.arenaAt !== NONE) return;
   run.arenaAt = run.simMs;
   run.events.arena = true;
}

/** Is (x, z) on the platform's top (its edge plus the foot's reach)? */
export function onPlatform(p: { x: number; z: number; hw: number; hd: number; round: boolean }, x: number, z: number): boolean {
   if (p.round) {
      const dx = x - p.x;
      const dz = z - p.z;
      const r = p.hw + FOOT;
      return dx * dx + dz * dz <= r * r;
   }
   return Math.abs(x - p.x) <= p.hw + FOOT && Math.abs(z - p.z) <= p.hd + FOOT;
}

/** Sphere (x, y, z, r) against a box. */
export function sphereBox(x: number, y: number, z: number, r: number, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): boolean {
   const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
   const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
   const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
   return dx * dx + dy * dy + dz * dz < r * r;
}

/** Did the segment (x0..x1) cross the ring's plane inside its radius? */
export function ringCrossed(f: RingDef, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
   const nx = forwardX(f.yaw);
   const nz = forwardZ(f.yaw);
   const a = (x0 - f.x) * nx + (z0 - f.z) * nz;
   const b = (x1 - f.x) * nx + (z1 - f.z) * nz;
   if ((a > 0 && b > 0) || (a < 0 && b < 0) || a === b) return false;
   const t = a / (a - b);
   const px = x0 + (x1 - x0) * t - f.x;
   const py = y0 + (y1 - y0) * t - f.y;
   const pz = z0 + (z1 - z0) * t - f.z;
   return px * px + py * py + pz * pz <= f.r * f.r;
}

function pickups(run: CannonRun, x0: number, y0: number, z0: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const course = run.course;
   const magnet = ms <= h.magnetUntil;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < course.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = course.orbs[i];
      if (o.hidden && !magnet) continue;
      if (o.pod >= 0 && !run.pods[o.pod]) continue;
      const dx = o.x - h.x;
      const dy = o.y - h.y;
      const dz = o.z - h.z;
      if (dx * dx + dy * dy + dz * dz <= reach * reach) {
         run.collected[i] = 1;
         run.orbs += 1;
         if (o.kind === "main") run.mainOrbs += 1;
         if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
         link(run, COMBO_BASE_MS.orb);
      }
   }
   for (let i = 0; i < course.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = course.secrets[i];
      const dx = s.x - h.x;
      const dy = s.y - h.y;
      const dz = s.z - h.z;
      if (dx * dx + dy * dy + dz * dz <= SECRET_R * SECRET_R && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }
   for (let i = 0; i < course.hoops.length; i++) {
      if (run.hooped[i]) continue;
      if (!ringCrossed(course.hoops[i], x0, y0, z0, h.x, h.y, h.z)) continue;
      run.hooped[i] = 1;
      ev.hoop = i;
      link(run, COMBO_BASE_MS.hoop);
   }
   for (let i = 0; i < course.crowd.length; i++) {
      if (run.crowdLit[i]) continue;
      const c = course.crowd[i];
      if (h.z <= c.z0 && h.z >= c.z1) {
         run.crowdLit[i] = 1;
         ev.crowd = i;
      }
   }
}

function lose(run: CannonRun, why: LostWhy): void {
   const h = run.hero;
   h.mode = "lost";
   h.timer = LOST_MS;
   h.lostWhy = why;
   h.diving = false;
   h.dashUntil = NONE;
   h.support = NONE;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
}

/** Back in the last cannon, aiming (the card: every fall respawns there in 0.8 s); the balloons are back. */
function respawn(run: CannonRun): void {
   const h = run.hero;
   run.popped.fill(0);
   const c = run.course.cannons[h.lastCannon];
   cannonPos(c, run.simMs, POS);
   h.x = POS.x;
   h.y = POS.y;
   h.z = POS.z;
   h.lostWhy = null;
   openAim(run, h.lastCannon, NONE);
   run.events.respawned = true;
}

function win(run: CannonRun): void {
   run.finishMs = run.simMs;
   run.ended = "win";
   run.hero.mode = "done";
   run.events.finished = true;
}

// ---------- Ashbag, the Smoke Blimp (level 5) ----------

/** Which pod is lit in P1: the next one not popped (0, 1, 2). */
export function litPod(run: CannonRun): number {
   for (let k = 0; k < 3; k++) if (!run.pods[k]) return k;
   return 2;
}

/**
 * Where Ashbag hangs while its window is open, and the part that can be hit there (pure: the bot,
 * the Scene and the tests read it). P1: a hover spot round the ring (cycled), the lit pod on the
 * side facing the stage; P2: over a stage trampoline (cycled), the gondola under it; P3: at the
 * tent top, the valve on top. Returns false outside level 5.
 */
export function bossWindowSpot(run: CannonRun, phase: number, attack: number, centre: SpotDef, part: SpotDef): boolean {
   const a = run.course.arena;
   if (!a) return false;
   if (phase <= 0) {
      const s = a.podSpots[attack % a.podSpots.length];
      centre.x = s.x;
      centre.y = s.y;
      centre.z = s.z;
      const dx = a.x - s.x;
      const dz = a.z - s.z;
      const d = Math.hypot(dx, dz) || 1;
      part.x = s.x + (dx / d) * 2.4;
      part.y = s.y - 0.4;
      part.z = s.z + (dz / d) * 2.4;
   } else if (phase === 1) {
      const t = run.course.tramps[a.tramps[attack % a.tramps.length]];
      centre.x = t.x;
      centre.y = t.y + P2_HOVER_DY;
      centre.z = t.z;
      part.x = t.x;
      part.y = centre.y + GONDOLA_DY;
      part.z = t.z;
   } else {
      centre.x = a.topSpot.x;
      centre.y = a.topSpot.y;
      centre.z = a.topSpot.z;
      part.x = centre.x;
      part.y = centre.y + VALVE_DY;
      part.z = centre.z;
   }
   return true;
}

/** True while a hit can land (the window is open). */
export function bossVulnerable(run: CannonRun): boolean {
   return !!run.boss && run.arenaAt !== NONE && run.boss.step === "vulnerable";
}

const CENTRE: SpotDef = { x: 0, y: 0, z: 0 };
const PART: SpotDef = { x: 0, y: 0, z: 0 };

function bossMs(run: CannonRun): void {
   const b = run.boss!;
   const ev = run.events;
   const bev = run.bossEv;
   stepBoss(b, ASHBAG, 1, bev);
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 1) {
         const a = run.course.arena!;
         run.bombMark = a.cannons[b.attack % a.cannons.length];
         ev.bombMark = run.bombMark;
      }
   }
   if (bev.attack && b.phase === 1 && run.bombMark !== NONE) {
      run.jamUntil[run.bombMark] = run.simMs + JAM_MS;
      ev.jam = run.bombMark;
      run.bombMark = NONE;
   }
   if (bev.phaseChanged || b.phase !== 1) run.bombMark = b.phase === 1 ? run.bombMark : NONE;
}

function bossHits(run: CannonRun): void {
   const b = run.boss!;
   const h = run.hero;
   if (b.step !== "vulnerable") return;
   bossWindowSpot(run, b.phase, b.attack, CENTRE, PART);
   const dx = h.x - PART.x;
   const dy = h.y - PART.y;
   const dz = h.z - PART.z;
   const d2 = dx * dx + dy * dy + dz * dz;
   if (b.phase <= 0) {
      if (d2 > POD_R * POD_R) return;
      const k = litPod(run);
      if (applyHit(run)) {
         run.pods[k] = 1;
         run.events.bossPod = k;
      }
   } else if (b.phase === 1) {
      if (d2 > GONDOLA_R * GONDOLA_R || !h.bounced || h.vy <= 0) return;
      if (applyHit(run)) {
         // knocked back down off the gondola
         h.vy = -2;
         h.vx *= 0.5;
         h.vz *= 0.5;
      }
   } else {
      if (d2 > VALVE_R * VALVE_R || !h.diving) return;
      applyHit(run);
   }
}

function applyHit(run: CannonRun): boolean {
   const r = hitBoss(run.boss!, ASHBAG, 1, run.bossEv);
   if (r === "ignored") return false;
   run.events.bossHit = true;
   if (r === "phase") run.events.bossPhase = true;
   link(run, COMBO_BASE_MS.boss);
   if (r === "defeated") {
      run.events.bossDefeated = true;
      win(run);
   }
   return true;
}

// ---------- scoring helpers ----------

/** What the course can feed the flow meter: every orb, the first catch of each cannon, each hoop, each boss hit. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.cannons.length, base: COMBO_BASE_MS.catch },
         { count: course.hoops.length, base: COMBO_BASE_MS.hoop },
         { count: course.arena ? ASHBAG.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/**
 * The server limits per level, pinned (bound.ts proves them: proof.test.ts recomputes every row from
 * its own course with proposeLimits and checks it equals this table). Pinned so the page never runs
 * the Dijkstra proof at load.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 75_000, timeBaseMs: 75_000 },
   2: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 90_000, timeBaseMs: 90_000 },
   3: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 110_000, timeBaseMs: 110_000 },
   4: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 125_000, timeBaseMs: 125_000 },
   5: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 200_000, timeBaseMs: 200_000 },
};

export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];

export const COURSE: Course = courseFor(1);

// ---------- solid boxes (the orbit camera's collision, menu2/camera) ----------

export interface SolidBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** The platforms, walls, unbroken boards, poles and cannon stands at rules ms; returns how many. */
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
   const c = run.course;
   for (const p of c.platforms) put(p.x - p.hw, p.x + p.hw, p.y - 0.6, p.y, p.z - p.hd, p.z + p.hd);
   for (const w of c.walls) put(w.minX, w.maxX, w.minY, w.maxY, w.minZ, w.maxZ);
   for (let i = 0; i < c.boards.length; i++) {
      if (run.broken[i]) continue;
      const b = c.boards[i];
      put(b.x - b.hx, b.x + b.hx, b.y - b.hy, b.y + b.hy, b.z - b.hz, b.z + b.hz);
   }
   for (const p of c.poles) put(p.x - p.r, p.x + p.r, p.y0, p.y1, p.z - p.r, p.z + p.r);
   for (const k of c.cannons) {
      cannonPos(k, ms, POS);
      put(POS.x - 0.6, POS.x + 0.6, POS.y - 1.4, POS.y - 0.7, POS.z - 0.6, POS.z + 0.6);
   }
   return n;
}

// ---------- the store hand-off ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   shots: "shots",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   pulse: "pulse",
   aiming: "aiming",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
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
   par: "par",
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

/** This game's no-hit badge: no fall and no bonk at all (a clean show). */
export function badgeHits(run: CannonRun): number {
   return run.hits;
}

export { DASH_EXTRA_M, V_DASH, NAMI_VY };
