// Dragon Cave Rush rules (the design card's CHASE CART): a mine cart on rails at the level's track speed,
// leaning into curves (the right lean +15 % speed; a wrong lean on a sharp curve tips the cart onto two
// wheels, a second derails it), hopping gaps and rocks, ducking beams and breath, swapping lanes at forks
// round falling crystals and lavafalls, the hero roles (Riko's boost through cracked barricades, Nami's
// double hop to the scaffold, Kiro's shield, Zuno's wall-trail magnet, Vexa's ghost rails), Cindermaw's
// distance meter (0 = caught), orbs (a time bonus), the flow meter, secrets, the level 5 boss on the loop,
// and the lower bound behind the server limits.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Clock: whole STEP_MS (2 ms)
// substeps, the fraction carried. README "Rules" and "Server limits" explain the design and the proof.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { CINDERMAW, COMBO, COMBO_BASE_MS, DISTANCE_BADGE, SECRETS } from "./progression";
import { LANE_W, SCAFFOLD_Y, buildCourse, segmentAt, type Course } from "./track";

export type { Course } from "./track";

// ---------- tuning ----------

export const NONE = -1;
export const STEP_MS = 2;
export const MAX_FRAME_MS = 50;
/** the right lean on a curve speeds the cart up this much (the card's +15 %) */
export const LEAN_BONUS = 1.15;
/** a lean counts once the stick is this far towards the curve's inside */
export const LEAN_MIN = 0.45;
/** a sharp curve: leaning right for at least this share of it is a perfect lean; under the low share it tips the cart */
export const LEAN_GOOD = 0.55;
export const LEAN_BAD = 0.3;
/** the hop: up at this speed, gravity G (0.57 s in the air, 1.2 m up) */
export const V_HOP = 8.5;
export const G = 30;
export const BUFFER_MS = 120;
/** lane swaps move the cart sideways this fast (m/s) */
export const V_SWAP = 11;
/** obstacle heights: a rock is cleared over this, a beam only ducked and under this */
export const ROCK_H = 0.6;
export const BEAM_H = 0.3;
/** a hit: the cart slows to this share for SLOW_MS; invulnerable INVULN_MS; the meter loses HIT_METER */
export const SLOW = 0.55;
export const SLOW_MS = 800;
export const INVULN_MS = 1000;
export const HIT_METER = 25;
/** a fall or being caught: LOST_MS down, SPAWN_MS back at the last lantern */
export const LOST_MS = 900;
export const SPAWN_MS = 700;
/** the distance meter: its start when the dragon wakes, its creep (per s), the gains */
export const METER = { start: 70, creep: 0.5, lean: 6, clear: 3, barricade: 20, respawn: 50 } as const;
/** a breath: the telegraph (orange glow, roar) and the fire */
export const BREATH = { telegraphMs: 1000, fireMs: 600 } as const;
/** orbs and secrets: pickup radius round the cart's middle (0.9 m over the rail), the time bonus each */
export const ORB = { pickup: 1.25, bonusMs: 250, centerY: 0.9 } as const;
export const SECRET_R = 1.4;
/** Riko's boost reaches a barricade from this far before it */
export const BOOST_REACH = 16;
/** Nami's second hop near a scaffold ramp lifts her onto it */
export const RAMP_REACH = { before: 10, after: 6 } as const;

// ---------- the course ----------

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}

/** The fastest the cart moves along s on this segment: the track speed, the lean bonus on a curve. */
export function vmaxAt(c: Course, s: number): number {
   const g = segmentAt(c, s);
   return c.config.speed * (g.turn !== 0 ? LEAN_BONUS : 1);
}

/** The least ms from s = a to s = b (a < b) by the track's own speed bound, piece by piece. */
export function travelFloorMs(c: Course, a: number, b: number): number {
   let ms = 0;
   for (const g of c.segments) {
      const lo = Math.max(a, g.s0);
      const hi = Math.min(b, g.s0 + g.len);
      if (hi <= lo) continue;
      // a substep that starts in the piece before may run into this one at that piece's speed: one substep slack each
      ms += ((hi - lo) * 1000) / (c.config.speed * (g.turn !== 0 ? LEAN_BONUS : 1)) - STEP_MS;
   }
   if (b > c.length) ms += ((b - Math.max(a, c.length)) * 1000) / c.config.speed;
   return Math.max(0, ms);
}

/** The earliest rules ms after she wakes that Cindermaw can be done (every window hit the ms it opens). */
export function bossMinMs(): number {
   const s = createBoss(CINDERMAW);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, CINDERMAW, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, CINDERMAW, 1, ev);
      if (s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** The proven least finish ms: the rails at their speed bound; on level 5 the loop until Cindermaw is done. */
export function minFinishMs(c: Course): number {
   if (!c.loop) return travelFloorMs(c, 0, c.finishS);
   const lap = travelFloorMs(c, c.loop.s0, c.loop.s1);
   return travelFloorMs(c, 0, c.loop.s0) + Math.max(lap, BOSS_MIN_MS) + travelFloorMs(c, c.loop.s1, c.finishS);
}

/** What the course can feed the flow meter: every orb, each curve (the loop's once), each obstacle. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const curves = c.segments.filter((g) => g.turn !== 0).length;
   const clears = c.hazards.filter((h) => h.kind === "gap" || h.kind === "rock" || h.kind === "beam").length;
   return {
      combo: COMBO,
      sources: [
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: curves, base: COMBO_BASE_MS.lean },
         { count: clears, base: COMBO_BASE_MS.clear },
      ],
   };
}

export function minDurationMsOf(c: Course): number {
   return minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms. */
export function proposeLimits(c: Course): LevelLimits {
   const lb = minDurationMsOf(c);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
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

export type CartState = "ride" | "lost" | "spawn";

export interface Cart {
   s: number;
   /** the lane it rides and its sideways position (lateral offset, m) */
   lane: number;
   d: number;
   /** height over its lane's rail, vertical speed */
   h: number;
   vy: number;
   state: CartState;
   timerMs: number;
   ducking: boolean;
   /** the lean this substep (-1 left .. 1 right, along the cart) */
   lean: number;
   /** the speed this substep (m/s) */
   v: number;
   airHops: number;
   bufferUntil: number;
   slowUntil: number;
   invulnUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   boostUntil: number;
   /** tipped onto two wheels by a wrong lean (a second derails) */
   tilted: boolean;
   tiltUntil: number;
}

export interface StepInput {
   /** the stick, screen-relative (moveZ = the core's moveY, up = -1), turned by `yaw` for the lean */
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   /** a lane swap press (keys / swipes): left or right on the screen */
   swapLeft: boolean;
   swapRight: boolean;
   /** duck (stick / S / Down held) */
   duck: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, swapLeft: false, swapRight: false, duck: false, actionPressed: false };
}

export interface StepEvents {
   hopped: boolean;
   airHopped: boolean;
   landed: boolean;
   swapped: boolean;
   perfectLean: boolean;
   tilted: boolean;
   cleared: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   hit: boolean;
   absorbed: boolean;
   lost: boolean;
   caught: boolean;
   respawned: boolean;
   checkpoint: number;
   barricade: number;
   scaffold: boolean;
   powered: boolean;
   woke: boolean;
   breathWarn: boolean;
   breathFire: boolean;
   comboBonus: number;
   comboLinked: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossCharge: number;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossDone: boolean;
   finished: boolean;
   timeup: boolean;
}

/** A breath in flight: fires at the lane the cart was on when it was triggered. */
export interface Breath {
   fireAt: number;
   lane: number;
   hit: boolean;
}

export interface CaveRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   cart: Cart;
   collected: Uint8Array;
   broken: Uint8Array;
   orbs: number;
   mainOrbs: number;
   /** each obstacle and curve linked once */
   cleared: Uint8Array;
   leaned: Uint8Array;
   /** the curve in progress: ms in it, ms leaning right */
   curveIndex: number;
   curveMs: number;
   curveGood: number;
   awake: boolean;
   meter: number;
   meterLow: number;
   breaths: Breath[];
   nextBreath: number;
   checkpoint: number;
   respawns: number;
   powerReadyAt: number;
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   lap: number;
   boss: BossState | null;
   bossEv: BossEvents;
   /** a crystal / ore / lock hit charged for her next open window (at most one) */
   pending: number;
   /** each boss event used this lap */
   eventLap: Int32Array;
   /** level 5 phase 2: fireballs down the main track until this ms */
   fireballsUntil: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   return {
      hopped: false,
      airHopped: false,
      landed: false,
      swapped: false,
      perfectLean: false,
      tilted: false,
      cleared: NONE,
      orbCount: 0,
      orbList: new Array<number>(16).fill(0),
      secretCount: 0,
      secretList: [0, 0, 0],
      hit: false,
      absorbed: false,
      lost: false,
      caught: false,
      respawned: false,
      checkpoint: NONE,
      barricade: NONE,
      scaffold: false,
      powered: false,
      woke: false,
      breathWarn: false,
      breathFire: false,
      comboBonus: 0,
      comboLinked: false,
      bossTelegraph: false,
      bossAttack: false,
      bossCharge: NONE,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      bossDone: false,
      finished: false,
      timeup: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.hopped = ev.airHopped = ev.landed = ev.swapped = ev.perfectLean = ev.tilted = false;
   ev.cleared = ev.checkpoint = ev.barricade = ev.bossCharge = NONE;
   ev.orbCount = ev.secretCount = 0;
   ev.hit = ev.absorbed = ev.lost = ev.caught = ev.respawned = ev.scaffold = ev.powered = ev.woke = false;
   ev.breathWarn = ev.breathFire = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.bossTelegraph = ev.bossAttack = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.bossDone = false;
   ev.finished = ev.timeup = false;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CaveRun {
   const course = courseFor(level);
   return {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      cart: {
         s: 0,
         lane: 0,
         d: 0,
         h: 0,
         vy: 0,
         state: "ride",
         timerMs: 0,
         ducking: false,
         lean: 0,
         v: course.config.speed,
         airHops: 0,
         bufferUntil: -1,
         slowUntil: -1,
         invulnUntil: -1,
         shieldUntil: -1,
         magnetUntil: -1,
         phaseUntil: -1,
         boostUntil: -1,
         tilted: false,
         tiltUntil: -1,
      },
      collected: new Uint8Array(course.orbs.length),
      broken: new Uint8Array(course.barricades.length),
      orbs: 0,
      mainOrbs: 0,
      cleared: new Uint8Array(course.hazards.length),
      leaned: new Uint8Array(course.segments.length),
      curveIndex: NONE,
      curveMs: 0,
      curveGood: 0,
      awake: course.wake <= 0,
      meter: METER.start,
      meterLow: METER.start,
      breaths: [],
      nextBreath: 0,
      checkpoint: 0,
      respawns: 0,
      powerReadyAt: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      lap: 0,
      boss: course.loop ? createBoss(CINDERMAW) : null,
      bossEv: createBossEvents(),
      pending: 0,
      eventLap: new Int32Array(course.bossEvents.length).fill(-1),
      fireballsUntil: -1,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
}

// ---------- queries ----------

/** Does lane i exist at s (and is it ridable now: a ghost rail only while phasing, a shortcut once broken)? */
export function laneOpen(run: CaveRun, i: number, s: number): boolean {
   const l = run.course.lanes[i];
   if (s < l.s0 || s > l.s1) return false;
   return true;
}

/** The lane on the given side (-1 left, 1 right) of the current one at s, at the same height, or NONE. */
export function laneBeside(run: CaveRun, from: number, side: number, s: number): number {
   const c = run.course;
   const l = c.lanes[from];
   const want = l.d + side * LANE_W;
   for (let i = 0; i < c.lanes.length; i++) {
      const o = c.lanes[i];
      if (i === from || o.y !== l.y || Math.abs(o.d - want) > 0.1) continue;
      if (s >= o.s0 && s <= o.s1) return i;
   }
   return NONE;
}

/** Is the lavafall on now? */
export function lavaOn(h: { periodMs: number; onMs: number; phaseMs: number }, ms: number): boolean {
   if (h.periodMs <= 0) return true;
   return (ms + h.phaseMs) % h.periodMs < h.onMs;
}

/** Is Cindermaw open to a charged hit right now (the HUD bar pulses)? */
export function bossVulnerable(run: CaveRun): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0 && run.pending > 0;
}

export function bossDone(run: CaveRun): boolean {
   return !run.boss || run.boss.step === "done";
}

/** The dragon's distance behind the cart (m), from the meter. */
export function dragonGap(run: CaveRun): number {
   return 5 + run.meter * 0.32;
}

// ---------- the step ----------

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const STICK = { x: 0, z: 0 };

function advanceClock(run: CaveRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_FRAME_MS);
   const n = Math.floor(run.remainder / STEP_MS);
   run.remainder -= n * STEP_MS;
   return n;
}

function link(run: CaveRun, ms: number, base: number): void {
   const bonus = comboHit(run.combo, COMBO, ms, base);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

function meterAdd(run: CaveRun, v: number): void {
   if (!run.awake) return;
   run.meter = Math.max(0, Math.min(100, run.meter + v));
   if (run.meter < run.meterLow) run.meterLow = run.meter;
}

/** A hit: the shield absorbs it; else the meter drops, the cart slows. */
function hit(run: CaveRun, ms: number): void {
   const c = run.cart;
   if (c.state !== "ride" || ms < c.invulnUntil) return;
   if (ms <= c.shieldUntil) {
      c.shieldUntil = -1;
      c.invulnUntil = ms + 500;
      run.events.absorbed = true;
      return;
   }
   c.invulnUntil = ms + INVULN_MS;
   c.slowUntil = ms + SLOW_MS;
   c.tilted = false;
   run.hits += 1;
   meterAdd(run, -HIT_METER);
   comboBreak(run.combo);
   run.events.hit = true;
}

function lose(run: CaveRun, caught = false): void {
   const c = run.cart;
   if (c.state !== "ride") return;
   c.state = "lost";
   c.timerMs = LOST_MS;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
   if (caught) run.events.caught = true;
}

function respawn(run: CaveRun, ms: number): void {
   const c = run.cart;
   const co = run.course;
   // the latest lantern at or behind the cart (in the loop: its own lantern)
   let s = 0;
   for (const l of co.lanterns) if (l <= c.s) s = l;
   if (co.loop && c.s >= co.loop.s0 && c.s <= co.loop.s1) s = Math.max(s, co.loop.s0 + 2);
   c.s = s;
   c.lane = 0;
   c.d = 0;
   c.h = 0;
   c.vy = 0;
   c.state = "spawn";
   c.timerMs = SPAWN_MS;
   c.tilted = false;
   c.invulnUntil = ms + SPAWN_MS + 800;
   run.curveIndex = NONE;
   run.breaths.length = 0;
   while (run.nextBreath > 0 && co.breaths[run.nextBreath - 1].s > s) run.nextBreath -= 1;
   if (run.awake) {
      run.meter = Math.max(run.meter, METER.respawn);
   }
   run.respawns += 1;
   run.events.respawned = true;
}

function tryPower(run: CaveRun, ms: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const c = run.cart;
   if (def.power === "doubleJump") {
      airHop(run, ms);
      return;
   }
   if (def.power === "boost") {
      c.boostUntil = ms + POWER_MS.boost;
      // smash the cracked barricade ahead: onto the shortcut
      for (let i = 0; i < run.course.barricades.length; i++) {
         const b = run.course.barricades[i];
         if (run.broken[i] || c.s < b.s - BOOST_REACH || c.s > b.s + 2) continue;
         run.broken[i] = 1;
         c.lane = b.lane;
         meterAdd(run, METER.barricade);
         run.events.barricade = i;
         break;
      }
   } else if (def.power === "shield") c.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") c.magnetUntil = ms + POWER_MS.magnet;
   else c.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   run.events.powered = true;
}

/** Nami's second hop: higher, and next to a scaffold ramp it lifts the cart onto the upper track. */
function airHop(run: CaveRun, ms: number): void {
   const c = run.cart;
   if (c.h <= 0.01 || c.airHops >= 1 || c.state !== "ride") return;
   c.airHops += 1;
   c.vy = V_HOP;
   run.events.airHopped = true;
   run.events.powered = true;
   const co = run.course;
   if (co.lanes[c.lane].kind !== "scaffold") {
      for (const r of co.ramps) {
         if (c.s < r.s - RAMP_REACH.before || c.s > r.s + RAMP_REACH.after) continue;
         c.lane = r.lane;
         c.d = co.lanes[r.lane].d;
         c.h -= SCAFFOLD_Y;
         c.vy = V_HOP * 1.15;
         run.events.scaffold = true;
         break;
      }
   }
   void ms;
}

function stepBossWorld(run: CaveRun, ms: number, dt: number): void {
   const b = run.boss;
   const co = run.course;
   if (!b || !co.loop || !run.awake || run.cart.s < co.loop.s0 - 1) return;
   const before = b.phase;
   stepBoss(b, CINDERMAW, dt, run.bossEv);
   const ev = run.events;
   if (run.bossEv.telegraph) ev.bossTelegraph = true;
   if (run.bossEv.attack) {
      ev.bossAttack = true;
      if (b.phase === 1) run.fireballsUntil = ms + CINDERMAW.phases[1].attacks[0].attackMs + BREATH.fireMs;
      else run.breaths.push({ fireAt: ms + 200, lane: run.cart.lane, hit: false });
   }
   if (run.bossEv.telegraph && b.phase !== 1) ev.breathWarn = true;
   if (b.step === "vulnerable" && run.pending > 0 && b.hp > 0) {
      const r = hitBoss(b, CINDERMAW, 1, run.bossEv);
      if (r !== "ignored") {
         run.pending = 0;
         ev.bossHit = true;
         if (r === "phase") ev.bossPhase = true;
         if (r === "defeated") ev.bossDefeated = true;
      }
   }
   if (b.phase !== before) ev.bossPhase = true;
   if (run.bossEv.done) ev.bossDone = true;
}

function substep(run: CaveRun, ms: number, input: StepInput, first: boolean): void {
   const c = run.cart;
   const co = run.course;
   const ev = run.events;
   const dt = STEP_MS / 1000;
   stepBossWorld(run, ms, STEP_MS);
   if (first && input.jumpPressed) c.bufferUntil = ms + BUFFER_MS;
   if (c.state === "lost") {
      c.timerMs -= STEP_MS;
      if (c.timerMs <= 0) respawn(run, ms);
      return;
   }
   if (c.state === "spawn") {
      c.timerMs -= STEP_MS;
      if (c.timerMs <= 0) c.state = "ride";
      return;
   }
   // the lean: the camera-relative stick along the cart's right
   const centre = co.samples;
   const si = Math.min(centre.length / 4 - 1, Math.max(0, Math.round(c.s / 0.5)));
   const heading = centre[si * 4 + 3];
   const rx = Math.cos(heading);
   const rz = -Math.sin(heading);
   c.lean = Math.max(-1, Math.min(1, STICK.x * rx + STICK.z * rz));
   c.ducking = input.duck && c.h < 0.4;
   if (first && input.actionPressed) tryPower(run, ms);
   // lane swaps (a press towards a side; turned onto the cart's own left / right by the camera)
   if (first && (input.swapLeft || input.swapRight)) {
      const sx = input.swapLeft ? -1 : 1;
      const w = inputToWorld(sx, 0, finite(input.yaw), { x: 0, z: 0 });
      const side = w.x * rx + w.z * rz >= 0 ? 1 : -1;
      const to = laneBeside(run, c.lane, side, c.s);
      const kind = to === NONE ? null : co.lanes[to].kind;
      // a shortcut lane is closed until Riko's boost breaks its barricade
      const closed = kind === "shortcut" && !run.broken[co.barricades.findIndex((b) => b.lane === to)];
      if (to !== NONE && !closed) {
         c.lane = to;
         ev.swapped = true;
      }
   }
   // the lane ended: back to the main line (the scaffold drops you down onto it)
   const lane = co.lanes[c.lane];
   if (c.s > lane.s1) {
      if (lane.kind === "scaffold") c.h += SCAFFOLD_Y;
      c.lane = 0;
   }
   const want = co.lanes[c.lane].d;
   if (c.d !== want) c.d = c.d < want ? Math.min(want, c.d + V_SWAP * dt) : Math.max(want, c.d - V_SWAP * dt);
   // hop (buffered), Nami's second hop
   if (c.bufferUntil >= ms) {
      if (c.h <= 0.01) {
         c.vy = V_HOP;
         c.h = 0.001;
         c.airHops = 0;
         c.bufferUntil = -1;
         ev.hopped = true;
      } else if (first && input.jumpPressed && run.heroId === "nami") {
         c.bufferUntil = -1;
         airHop(run, ms);
      }
   }
   if (c.h > 0 || c.vy > 0) {
      c.vy -= G * dt;
      c.h += c.vy * dt;
      if (c.h <= 0) {
         c.h = 0;
         c.vy = 0;
         c.airHops = 0;
         ev.landed = true;
      }
   }
   // speed: the track speed, the right lean on a curve, slowed after a hit
   const segIndex = co.segments.indexOf(segmentAt(co, c.s));
   const seg = co.segments[segIndex];
   const inside = seg.turn > 0 ? -1 : 1;
   const leaningRight = seg.turn !== 0 && c.lean * inside >= LEAN_MIN;
   let v = co.config.speed * (leaningRight ? LEAN_BONUS : 1);
   if (ms < c.slowUntil) v *= SLOW;
   c.v = v;
   const s0 = c.s;
   c.s += v * dt;
   // the curve in progress: judged as it ends
   if (seg.turn !== 0) {
      if (run.curveIndex !== segIndex) {
         run.curveIndex = segIndex;
         run.curveMs = 0;
         run.curveGood = 0;
      }
      run.curveMs += STEP_MS;
      if (leaningRight) run.curveGood += STEP_MS;
      // a sharp curve half done with no lean: the warning tilt (sparks)
      if (seg.sharp && !c.tilted && c.s > seg.s0 + seg.len * 0.5 && run.curveGood < run.curveMs * LEAN_BAD && ms > c.tiltUntil) {
         c.tilted = true;
         c.tiltUntil = ms + 1500;
         ev.tilted = true;
      }
   }
   if (run.curveIndex >= 0 && run.curveIndex !== segIndex) {
      const done = co.segments[run.curveIndex];
      const share = run.curveMs > 0 ? run.curveGood / run.curveMs : 0;
      const isLoop = !!co.loop && done.s0 === co.loop.s0;
      if (share >= LEAN_GOOD) {
         ev.perfectLean = true;
         c.tilted = false;
         meterAdd(run, METER.lean);
         if (!run.leaned[run.curveIndex] && !isLoop) {
            run.leaned[run.curveIndex] = 1;
            link(run, ms, COMBO_BASE_MS.lean);
         }
      } else if (done.sharp && share < LEAN_BAD && c.tilted && ms > c.tiltUntil - 1400) {
         // the second wrong lean in a row: derailed
         lose(run);
      }
      run.curveIndex = NONE;
   }
   if (c.state !== "ride") return;
   hazards(run, ms, s0, c.s);
   if (c.state !== "ride") return;
   // the loop round Cindermaw: another lap until she is free
   if (co.loop && c.s >= co.loop.s1 && !bossDone(run)) {
      c.s -= co.loop.s1 - co.loop.s0;
      run.lap += 1;
   }
   progress(run, ms, s0);
}

/** Did the cart pass x this substep (from a to b)? */
const passed = (a: number, b: number, x: number) => a < x && b >= x;

function hazards(run: CaveRun, ms: number, a: number, b: number): void {
   const c = run.cart;
   const co = run.course;
   const lane = co.lanes[c.lane];
   const onLane = (i: number) => c.lane === i && Math.abs(c.d - co.lanes[i].d) < 1.2;
   // a ghost rail is solid only while Vexa phases
   if (lane.kind === "ghost" && ms > c.phaseUntil && Math.abs(c.d - lane.d) < 1.2 && c.h <= 0.01) {
      lose(run);
      return;
   }
   for (let i = 0; i < co.hazards.length; i++) {
      const hz = co.hazards[i];
      if (hz.kind === "gap") {
         if (onLane(hz.lane) && c.h <= 0.01 && b > hz.s && a < hz.s + hz.len) {
            lose(run);
            return;
         }
         if (onLane(hz.lane) && passed(a, b, hz.s + hz.len) && !run.cleared[i]) clear(run, ms, i);
      } else if (hz.kind === "rock") {
         if (!passed(a, b, hz.s) || !onLane(hz.lane)) continue;
         if (c.h < ROCK_H) hit(run, ms);
         else if (!run.cleared[i]) clear(run, ms, i);
      } else if (hz.kind === "beam") {
         if (!passed(a, b, hz.s) || c.lane === NONE) continue;
         if (co.lanes[c.lane].y > 0) continue;
         if (!c.ducking || c.h > BEAM_H) hit(run, ms);
         else if (!run.cleared[i]) clear(run, ms, i);
      } else if (hz.kind === "crystal") {
         if (passed(a, b, hz.s) && onLane(hz.lane)) hit(run, ms);
      } else if (hz.kind === "lavafall") {
         if (onLane(hz.lane) && b > hz.s && a < hz.s + hz.len && lavaOn(hz, ms)) hit(run, ms);
      }
   }
   // the breaths: triggered as the cart passes, fired a second later at the lane it was on
   if (run.awake) {
      while (run.nextBreath < co.breaths.length && co.breaths[run.nextBreath].s <= b) {
         if (co.breaths[run.nextBreath].s > a - 50) {
            run.breaths.push({ fireAt: ms + BREATH.telegraphMs, lane: c.lane, hit: false });
            run.events.breathWarn = true;
         }
         run.nextBreath += 1;
      }
   }
   for (let k = run.breaths.length - 1; k >= 0; k--) {
      const br = run.breaths[k];
      if (ms >= br.fireAt && ms < br.fireAt + BREATH.fireMs) {
         if (ms - br.fireAt < STEP_MS) run.events.breathFire = true;
         if (!br.hit && c.lane === br.lane && !c.ducking) {
            br.hit = true;
            hit(run, ms);
         }
      } else if (ms >= br.fireAt + BREATH.fireMs) run.breaths.splice(k, 1);
   }
   // level 5 phase 2: fireballs down the main track; the side track carries the ramps
   if (ms < run.fireballsUntil && c.lane === 0 && Math.abs(c.d) < 1.2) hit(run, ms);
   // a shortcut lane before its barricade is broken: a crash
   if (lane.kind === "shortcut") {
      const bi = co.barricades.findIndex((x) => x.lane === c.lane);
      if (bi >= 0 && !run.broken[bi] && passed(a, b, co.barricades[bi].s)) hit(run, ms);
   }
}

function clear(run: CaveRun, ms: number, i: number): void {
   run.cleared[i] = 1;
   run.events.cleared = i;
   meterAdd(run, METER.clear);
   link(run, ms, COMBO_BASE_MS.clear);
}

function progress(run: CaveRun, ms: number, a: number): void {
   const c = run.cart;
   const co = run.course;
   const ev = run.events;
   const b = c.s;
   if (!run.awake && b >= co.wake) {
      run.awake = true;
      run.meter = METER.start;
      run.meterLow = METER.start;
      ev.woke = true;
   }
   if (run.awake && !run.ended) {
      run.meter = Math.max(0, run.meter - (METER.creep * STEP_MS) / 1000);
      if (run.meter < run.meterLow) run.meterLow = run.meter;
      if (run.meter <= 0) {
         lose(run, true);
         return;
      }
   }
   for (let i = 0; i < co.lanterns.length; i++) {
      if (i > run.checkpoint && co.lanterns[i] <= b) {
         run.checkpoint = i;
         ev.checkpoint = i;
      }
   }
   // orbs and secrets: in (s, sideways, height) round the cart's middle
   const lane = co.lanes[c.lane];
   const myY = lane.y + c.h + ORB.centerY;
   const reach = ms <= c.magnetUntil ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < co.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = co.orbs[i];
      const ds = o.s - b;
      if (ds > reach || ds < -reach) continue;
      const ol = co.lanes[o.lane];
      const dd = ol.d + o.dx - c.d;
      const dy = ol.y + o.h - myY;
      if (ds * ds + dd * dd + dy * dy > reach * reach) continue;
      // the scaffold's orbs are up there: only from the scaffold (or Zuno's magnet)
      if (ol.kind === "scaffold" && lane.kind !== "scaffold" && reach === ORB.pickup) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      link(run, ms, COMBO_BASE_MS.orb);
   }
   for (let i = 0; i < co.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const sp = co.secrets[i];
      if (sp.lane !== c.lane) continue;
      const ds = sp.s - b;
      const dy = co.lanes[sp.lane].y + sp.h - myY;
      if (ds * ds + dy * dy > SECRET_R * SECRET_R) continue;
      if (collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }
   // level 5: the loop's track events charge a hit for her next open window
   if (run.boss && co.loop && run.boss.hp > 0) {
      for (let i = 0; i < co.bossEvents.length; i++) {
         const e = co.bossEvents[i];
         if (e.phase !== run.boss.phase || run.eventLap[i] === run.lap || !passed(a, b, e.s)) continue;
         const ok = e.kind === "ramp" ? c.lane === e.lane : c.h > 0.4 && c.lane === e.lane;
         if (!ok) continue;
         run.eventLap[i] = run.lap;
         if (run.pending === 0) {
            run.pending = 1;
            ev.bossCharge = i;
         }
      }
   }
   comboTick(run.combo, COMBO, ms);
   if (b >= co.finishS && bossDone(run)) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: CaveRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended) return ev;
   const n = advanceClock(run, finite(dtMs));
   if (n === 0) {
      if (input.jumpPressed) run.cart.bufferUntil = run.ms + BUFFER_MS;
      return ev;
   }
   const w = inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
   const len = Math.hypot(w.x, w.z);
   STICK.x = len > 1 ? w.x / len : w.x;
   STICK.z = len > 1 ? w.z / len : w.z;
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

// ---------- the store hand-off ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   meter: "meter",
   awake: "awake",
   progress: "progress",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   breath: "breath",
   tilt: "tilt",
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
} as const;

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The card's bonus badge: the meter never under DISTANCE_BADGE once the dragon woke (hits for the star screen). */
export function badgeHits(run: CaveRun): number {
   return run.meterLow >= DISTANCE_BADGE ? 0 : 1;
}

export { LEVELS } from "./levels";
