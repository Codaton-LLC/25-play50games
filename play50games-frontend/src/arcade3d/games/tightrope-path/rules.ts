// Tightrope Path rules (the design card's BALANCE): the hero walks a chain of planks, beams and ropes
// over a jungle gorge (course.ts). The stick is camera-relative (StepInput.yaw, the orbit camera's
// yaw): its part along the link walks, its part across it pushes the lean needle back. The needle
// drifts on every balance element, faster on narrower ones, 3x when sprinting (forward held 0.6 s:
// double speed), half when crouched (Action held: no walking). Past +-100 % the hero wobbles; still
// there 0.5 s later, he falls to the last pillar. Jump leaps the short gaps; each landing kicks the
// needle by a fixed +-30 % (seeded per level and link: the same jump always kicks the same way).
// Gusts, swinging sandbags, swaying ropes, rotating beams and Umbra's stomps, cuts and plates push it.
// A time game: the finish time, less 0.2 s a main orb, 0.3 s a high orb, 0.1 s a coin and the flow
// bonus (clean elements chained), is the submitted time.
//
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Whole ms, the fraction
// carried, stepped 1 ms at a time: the same at 30, 60 or 144 fps.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DASH_START, DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { courseFor, isBalance, type Course, type Gust, type Link, type LinkKind } from "./course";
import { COMBO, COMBO_BASE_MS, SECRETS, UMBRA } from "./progression";

export { courseFor, buildCourse } from "./course";
export type { Course, Link } from "./course";

// ---------- tuning (1 unit = 1 m) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
/** walk, sprint (forward held SPRINT_HOLD_MS) and pillar-top speeds (m/s); nothing moves the hero forward faster */
export const V_WALK = 1.6;
export const V_SPRINT = 3.0;
export const V_PILLAR = 3.0;
export const V_MAX = 3.0;
export const SPRINT_HOLD_MS = 600;
export const ACCEL = 10;
/** the jump: up-speed, gravity, the least forward speed of a hop (m/s); Nami's second jump */
export const V_JUMP = 4.4;
export const V_JUMP2 = 5.5;
export const GRAV = 14;
export const V_HOP = 2.4;
/** a high orb needs this height over the walk (a single jump peaks at 0.69 m, a double near 2 m) */
export const HIGH_ORB_Y = 1.4;
/** the needle: drift rates per element (needle per s at the walk), the correction at full stick */
export const DRIFT: Record<LinkKind, number> = { pillar: 0, plank: 0.22, beam: 0.5, rope: 0.7, spin: 0.55, dash: 0.7, ghost: 0.18 };
export const CORRECT = 1.5;
export const STILL_MUL = 0.35;
export const SPRINT_MUL = 3;
export const CROUCH_MUL = 0.5;
export const LEAN_MAX = 1.6;
export const WOBBLE_MS = 500;
export const FALL_MS = 1100;
/** element forces (needle per s) and impulses (needle) */
export const SPIN_FORCE = 0.35;
export const SWAY_FORCE = 0.5;
export const SWAY_MS = 1800;
export const LAND_KICK = 0.3;
export const BAG = { kick: 0.7, reach: 0.55, staggerMs: 350, window: 0.03 } as const;
export const GUST_TELEGRAPH_MS = 1000;
export const GUST_MS = 1500;
/** the time bonuses (ms off the submitted time) */
export const BONUS_MS = { orb: 200, high: 300, coin: 100 } as const;
/** the bird secret: crouch still this long on its rope */
export const BIRD_MS = 5000;
/** Umbra */
export const UMBRA_R = { stomp: 5, shove: 1.8, keep: 2.2, retreat: 3, walk: 0.8 } as const;
export const STOMP_KICK = 0.9;
export const STOMP_RIDE = 0.15;
export const PLATE_KICK = 0.6;
export const STRAND_MUL = 1.6;
export const OUTBALANCE_MS = 10_000;

// ---------- state ----------

export interface Hero {
   link: number;
   s: number;
   /** speed along the link (m/s, + forward) */
   v: number;
   /** the needle: + leans right, +-1 = 100 % */
   lean: number;
   /** height over the walk surface (a jump) and its up-speed */
   y: number;
   vy: number;
   air: boolean;
   airV: number;
   jumps: number;
   crouch: boolean;
   sprint: boolean;
   forwardSince: number;
   wobbleMs: number;
   /** ms since the fall began (-1: not falling) */
   fallMs: number;
   checkpoint: number;
   staggerUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   dashUntil: number;
   dashFrom: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
   actionHeld: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false, actionHeld: false };
}

export interface StepEvents {
   jumped: boolean;
   doubled: boolean;
   landed: boolean;
   kick: number;
   wobble: boolean;
   recovered: boolean;
   fell: boolean;
   respawned: boolean;
   orb: number;
   coin: number;
   powered: boolean;
   bagHit: boolean;
   clean: boolean;
   comboBonus: number;
   checkpoint: boolean;
   secretList: number[];
   secretCount: number;
   finished: boolean;
   timeup: boolean;
   bossWake: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      doubled: false,
      landed: false,
      kick: 0,
      wobble: false,
      recovered: false,
      fell: false,
      respawned: false,
      orb: NONE,
      coin: NONE,
      powered: false,
      bagHit: false,
      clean: false,
      comboBonus: 0,
      checkpoint: false,
      secretList: [],
      secretCount: 0,
      finished: false,
      timeup: false,
      bossWake: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function clearEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.doubled = false;
   ev.landed = false;
   ev.kick = 0;
   ev.wobble = false;
   ev.recovered = false;
   ev.fell = false;
   ev.respawned = false;
   ev.orb = NONE;
   ev.coin = NONE;
   ev.powered = false;
   ev.bagHit = false;
   ev.clean = false;
   ev.comboBonus = 0;
   ev.checkpoint = false;
   ev.secretCount = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.bossWake = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

export interface TightRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   /** the needle's wander phases (from the seed) */
   w1: number;
   w2: number;
   simMs: number;
   carry: number;
   hero: Hero;
   ended: "win" | "timeup" | null;
   finishMs: number;
   /** orbs, high orbs, coins taken (per index) */
   taken: Uint8Array;
   coinTaken: Uint8Array;
   orbs: number;
   highs: number;
   coins: number;
   /** per link: crossed clean and paid into the chain */
   paid: Uint8Array;
   /** no wobble on the current link since it was entered */
   clean: boolean;
   wobbles: number;
   falls: number;
   bagHits: number;
   /** the needle never passed 50 % (Steady Hands) */
   steady: boolean;
   maxLean: number;
   birdMs: number;
   /** the last sandbag crossing that hit, per bag */
   bagLast: Float64Array;
   combo: ComboState;
   secrets: SecretTracker;
   powerReadyAt: number;
   /** elements crossed (the HUD's progress) */
   crossed: number;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   /** Umbra on the joust: the arena link (1..3) and the distance along it */
   umbraArena: number;
   umbraS: number;
   attacks: number;
   /** ms upright on the rotating beam (P3: out-balance him 10 s) */
   steadyMs: number;
   /** an outside push on the needle (needle per s): local co-op's shared rope (multiplayer.ts); solo 0 */
   ext: number;
   events: StepEvents;
}

function freshHero(c: Course): Hero {
   return {
      link: c.start,
      s: 0.5,
      v: 0,
      lean: 0,
      y: 0,
      vy: 0,
      air: false,
      airV: 0,
      jumps: 0,
      crouch: false,
      sprint: false,
      forwardSince: NONE,
      wobbleMs: 0,
      fallMs: NONE,
      checkpoint: c.start,
      staggerUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      dashUntil: NONE,
      dashFrom: 0,
   };
}

function hash(a: number, b: number): number {
   let h = Math.imul(a * 374761393 + b * 668265263, 2246822519) >>> 0;
   h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The landing kick on link `link` of `level` (the card: seeded, the same jump always kicks the same way). */
export function landKick(level: LevelId, link: number): number {
   return hash(level * 31 + 7, link) < 0.5 ? -LAND_KICK : LAND_KICK;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, course: Course = courseFor(level)): TightRun {
   const s = (seed >>> 0) || 1;
   return {
      course,
      level,
      heroId,
      seed: s,
      w1: hash(s, 1) * Math.PI * 2,
      w2: hash(s, 2) * Math.PI * 2,
      simMs: 0,
      carry: 0,
      hero: freshHero(course),
      ended: null,
      finishMs: 0,
      taken: new Uint8Array(course.orbs.length),
      coinTaken: new Uint8Array(course.coins.length),
      orbs: 0,
      highs: 0,
      coins: 0,
      paid: new Uint8Array(course.links.length),
      clean: true,
      wobbles: 0,
      falls: 0,
      bagHits: 0,
      steady: true,
      maxLean: 0,
      birdMs: 0,
      bagLast: new Float64Array(course.sandbags.length).fill(Number.NaN),
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      powerReadyAt: 0,
      crossed: 0,
      boss: course.arenaStart >= 0 ? createBoss(UMBRA) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      umbraArena: 1,
      umbraS: 10,
      attacks: 0,
      steadyMs: 0,
      ext: 0,
      events: createEvents(),
   };
}

// ---------- element helpers (shared with the bot and the scene) ----------

/** A gust's state at ms: 0 calm, 1 telegraph (leaves and mist streaks), 2 pushing. */
export function gustState(g: Gust, ms: number): number {
   const p = (ms + g.offsetMs) % g.periodMs;
   if (p < GUST_TELEGRAPH_MS) return 1;
   if (p < GUST_TELEGRAPH_MS + GUST_MS) return 2;
   return 0;
}

/** A sandbag's swing phase at ms (0..1): its lateral offset is sin(2 pi p); it crosses the walk at p = 0 and 0.5. */
export function bagPhase(b: Course["sandbags"][number], ms: number): number {
   return ((ms + b.offsetMs) % b.periodMs) / b.periodMs;
}

/** The sandbag crossing at ms: its id (alternate ones swing opposite ways) when it is over the walk, else NaN. */
export function bagCrossing(b: Course["sandbags"][number], ms: number): number {
   const half = b.periodMs / 2;
   const t = ms + b.offsetMs;
   const id = Math.round(t / half);
   return Math.abs(t - id * half) < BAG.window * b.periodMs ? id : Number.NaN;
}

/** The needle's slow wander (-1..1-ish), the run's own phases. */
export function wander(run: Pick<TightRun, "w1" | "w2">, ms: number): number {
   return Math.sin(ms * 0.0011 + run.w1) * 0.7 + Math.sin(ms * 0.0029 + run.w2) * 0.45;
}

/** Is the hero on the joust link of `arena` (1 rope, 2 beam, 3 rotating beam)? */
const onArena = (run: TightRun, arena: number): boolean => run.course.links[run.hero.link].arena === arena && !run.hero.air && run.hero.fallMs < 0;

export function bossVulnerable(run: Pick<TightRun, "boss">): boolean {
   return !!run.boss && run.boss.step === "vulnerable";
}

/** Umbra's least defeat time once woken (ms): a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(UMBRA);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(b, UMBRA, 1, ev);
      if (b.step === "vulnerable") hitBoss(b, UMBRA, 1, ev);
      if (b.step === "defeat" || b.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

// ---------- the bound (README "Server limits and why they hold") ----------

/** The least ms to cross link l on foot (or Riko's dash): nothing moves the hero forward faster than V_MAX. */
function linkMinMs(l: Link): number {
   const walk = ((l.len + l.gap) / V_MAX) * 1000;
   return l.kind === "dash" ? Math.min(walk, POWER_MS.dash + (l.gap / V_MAX) * 1000) : walk;
}

/**
 * The least play time (ms) to reach link `target` from the start (0.5 m along the start pillar),
 * over every route (the main walk and Vexa's ghost bridge): a shortest path on the link graph.
 */
export function minReachMs(c: Course, target: number): number {
   const n = c.links.length;
   const best = new Float64Array(n).fill(Infinity);
   const start = c.links[c.start];
   const first = start.next;
   const out = [first, start.alt].filter((i) => i >= 0);
   const startCost = ((start.len + start.gap - 0.5) / V_MAX) * 1000;
   const queue: number[] = [];
   for (const i of out) {
      best[i] = Math.min(best[i], startCost);
      queue.push(i);
   }
   // links form a DAG in walk order: relax until stable (tiny graphs)
   for (let pass = 0; pass < n + 2; pass++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
         if (!Number.isFinite(best[i]) || i === target) continue;
         const l = c.links[i];
         const cost = best[i] + linkMinMs(l);
         for (const j of [l.next, l.alt]) {
            if (j < 0) continue;
            if (cost < best[j]) {
               best[j] = cost;
               changed = true;
            }
         }
      }
      if (!changed) break;
   }
   return target === c.start ? 0 : best[target];
}

/** The least finish (ms): reaching the goal pillar; on level 5 reaching the joust plus Umbra's least defeat. */
export function minFinishMs(c: Course): number {
   if (c.arenaStart >= 0) return minReachMs(c, c.arenaStart) + BOSS_MIN_MS;
   return minReachMs(c, c.goal);
}

/** What the course can feed the flow meter: each balance element once (main and ghost), each Umbra hit. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const sources: { count: number; base: number }[] = [{ count: c.links.filter(isBalance).length, base: COMBO_BASE_MS.element }];
   if (c.arenaStart >= 0) sources.push({ count: UMBRA.maxHp, base: COMBO_BASE_MS.boss });
   return { combo: COMBO, sources };
}

/** The most time any run can take off its finish: every orb, high orb and coin, and the most flow bonus. */
export function maxBonusMs(c: Course): number {
   return c.mainOrbs * BONUS_MS.orb + c.highOrbs * BONUS_MS.high + c.coins.length * BONUS_MS.coin + comboMaxBonus(comboSpecOf(c));
}

/** The time bonus a run has earned so far (ms). */
export function bonusMs(run: Pick<TightRun, "orbs" | "highs" | "coins" | "combo">): number {
   return run.orbs * BONUS_MS.orb + run.highs * BONUS_MS.high + run.coins * BONUS_MS.coin + run.combo.bonusTotal;
}

/** The submitted time: the finish less the bonus. */
export function runTimeMs(finishMs: number, bonus: number): number {
   return Math.max(0, finishMs - bonus);
}

export const submittedMs = (run: TightRun): number => runTimeMs(run.finishMs, bonusMs(run));

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The level's limits row: the least finish less the most bonus, less 6 %, to the 100 ms below. */
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

/** Advances the run by dtMs (capped at MAX_STEP_MS), 1 ms at a time. Returns the run's events object. */
export function step(run: TightRun, dtMs: number, input: StepInput): StepEvents {
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

function secret(run: TightRun, id: string, ev: StepEvents): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i >= 0 && collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
}

function chain(run: TightRun, base: number, ev: StepEvents): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   ev.comboBonus += bonus;
}

function finish(run: TightRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   if (run.steady) secret(run, "steady", ev);
   ev.finished = true;
}

function kick(run: TightRun, amount: number, ev: StepEvents): void {
   const h = run.hero;
   if (run.simMs <= h.shieldUntil) return;
   h.lean = Math.max(-LEAN_MAX, Math.min(LEAN_MAX, h.lean + amount));
   ev.kick += amount;
}

function enter(run: TightRun, link: number, ev: StepEvents): void {
   const h = run.hero;
   const l = run.course.links[link];
   h.link = link;
   run.clean = true;
   run.steadyMs = 0;
   if (l.kind === "pillar") {
      if (h.checkpoint !== link) ev.checkpoint = true;
      h.checkpoint = link;
   }
   if (run.boss && !run.bossAwake && l.arena === 1) {
      run.bossAwake = true;
      ev.bossWake = true;
   }
   if (link === run.course.goal && run.course.arenaStart < 0) finish(run, ev);
}

/** Leaves the current link forward into the next (Vexa phasing takes a pillar's ghost bridge). */
function leaveForward(run: TightRun, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   const l = c.links[h.link];
   if (isBalance(l)) {
      run.crossed += 1;
      if (run.clean && !run.paid[l.id]) {
         run.paid[l.id] = 1;
         ev.clean = true;
         chain(run, COMBO_BASE_MS.element, ev);
      }
   }
   const next = l.alt >= 0 && run.simMs <= h.phaseUntil ? l.alt : l.next;
   h.s -= l.len + l.gap;
   enter(run, next, ev);
}

function startFall(run: TightRun, ev: StepEvents): void {
   const h = run.hero;
   h.fallMs = 0;
   h.v = 0;
   h.air = false;
   h.wobbleMs = 0;
   run.falls += 1;
   run.clean = false;
   comboBreak(run.combo);
   ev.fell = true;
}

function respawn(run: TightRun, ev: StepEvents): void {
   const h = run.hero;
   const cp = run.course.links[h.checkpoint];
   h.fallMs = NONE;
   h.link = cp.id;
   h.s = cp.len / 2;
   h.v = 0;
   h.y = 0;
   h.vy = 0;
   h.lean = 0;
   h.staggerUntil = NONE;
   h.forwardSince = NONE;
   run.clean = true;
   run.steadyMs = 0;
   ev.respawned = true;
}

function power(run: TightRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const l = run.course.links[h.link];
   if (def.power === "double") return;
   if (def.power === "dash") {
      if (l.kind !== "dash" || h.air || h.s > DASH_START || ms <= h.dashUntil) return;
      h.dashUntil = ms + POWER_MS.dash;
      h.dashFrom = h.s;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function bossHit(run: TightRun, ev: StepEvents): boolean {
   const b = run.boss;
   if (!b || b.step !== "vulnerable") return false;
   const r = hitBoss(b, UMBRA, 1, run.bossEv);
   if (r === "ignored") return false;
   ev.bossHit = true;
   chain(run, COMBO_BASE_MS.boss, ev);
   if (r === "phase") ev.bossPhase = true;
   if (r === "defeated") {
      ev.bossDefeated = true;
      finish(run, ev);
   }
   return true;
}

function arenaLink(c: Course, arena: number): Link {
   return c.links[c.arenaStart + (arena - 1) * 2];
}

function stepBossMs(run: TightRun, jumpPressed: boolean, actionPressed: boolean, ev: StepEvents): void {
   const b = run.boss;
   const c = run.course;
   if (!b || !run.bossAwake) return;
   const before = b.phase;
   const bev = stepBoss(b, UMBRA, 1, run.bossEv);
   const h = run.hero;
   const want = b.phase + 1;
   if (want !== run.umbraArena && (b.step === "transition" || b.phase !== before)) {
      // he goes ahead to the next joust link and waits at its far end
      run.umbraArena = Math.min(3, want);
      run.umbraS = arenaLink(c, run.umbraArena).len - 1.5;
   }
   const ul = arenaLink(c, run.umbraArena);
   // he walks towards the hero on his link, keeping his distance
   if (h.link === ul.id && run.umbraS - h.s > UMBRA_R.keep) run.umbraS = Math.max(h.s + UMBRA_R.keep, run.umbraS - UMBRA_R.walk * 0.001);
   if (bev.telegraph) ev.bossTelegraph = true;
   if (bev.attack) {
      ev.bossAttack = true;
      run.attacks += 1;
      const sign = run.attacks % 2 === 0 ? -1 : 1;
      if (b.phase === 0 && onArena(run, 1)) kick(run, (h.crouch ? STOMP_RIDE : STOMP_KICK) * sign, ev);
      if (b.phase === 2 && onArena(run, 3) && !h.crouch) kick(run, PLATE_KICK * sign, ev);
   }
   if (b.step !== "vulnerable") return;
   const near = Math.abs(run.umbraS - h.s);
   if (b.phase === 0 && jumpPressed && onArena(run, 1) && near <= UMBRA_R.stomp) {
      if (bossHit(run, ev)) run.umbraS = Math.min(ul.len - 0.5, run.umbraS + UMBRA_R.retreat);
   } else if (b.phase === 1 && actionPressed && onArena(run, 2) && near <= UMBRA_R.shove) bossHit(run, ev);
   else if (b.phase === 2 && actionPressed && onArena(run, 3) && near <= UMBRA_R.shove && run.steadyMs >= OUTBALANCE_MS) bossHit(run, ev);
}

function stepMs(run: TightRun, input: StepInput, jumpPressed: boolean, actionPressed: boolean, ev: StepEvents): void {
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   const c = run.course;
   const dt = 0.001;
   comboTick(run.combo, COMBO, ms);
   if (h.fallMs >= 0) {
      h.fallMs += 1;
      if (h.fallMs >= FALL_MS) respawn(run, ev);
      stepBossMs(run, false, false, ev);
      endCheck(run, ev);
      return;
   }
   if (actionPressed) power(run, ev);
   let l = c.links[h.link];
   const along = STICK.x * l.dx + STICK.z * l.dz;
   const side = STICK.x * -l.dz + STICK.z * l.dx;
   const dashing = ms <= h.dashUntil;
   h.crouch = input.actionHeld && !h.air && !dashing;
   const wobbling = h.wobbleMs > 0;
   // the boss's stomp-back and shoves read this ms's presses before the jump starts
   stepBossMs(run, jumpPressed, actionPressed, ev);
   if (run.ended !== null) return;

   // the jump (Nami: a second one in the air)
   if (jumpPressed && !dashing) {
      if (!h.air && !h.crouch) {
         h.air = true;
         h.vy = V_JUMP;
         h.airV = Math.max(h.v, V_HOP);
         h.jumps = 1;
         h.wobbleMs = 0;
         ev.jumped = true;
      } else if (h.air && h.jumps === 1 && heroById(run.heroId).power === "double") {
         h.vy = V_JUMP2;
         h.jumps = 2;
         ev.doubled = true;
      }
   }

   // movement
   if (dashing) {
      h.s = h.dashFrom + (l.len - h.dashFrom) * Math.min(1, 1 - (h.dashUntil - ms) / POWER_MS.dash);
      h.v = V_MAX;
      if (ms === h.dashUntil || h.s >= l.len) {
         h.s = l.len + 1e-6;
         h.dashUntil = ms - 1;
         if (l.gap === 0 && l.next >= 0) leaveForward(run, ev);
         else h.s = l.len;
      }
   } else if (h.air) {
      h.s += h.airV * dt;
      h.y += h.vy * dt;
      h.vy -= GRAV * dt;
      if (h.s >= l.len + l.gap && l.next >= 0) {
         leaveForward(run, ev);
         l = c.links[h.link];
      }
      if (h.y <= 0) {
         h.y = 0;
         h.vy = 0;
         h.air = false;
         h.jumps = 0;
         if (h.s > l.len) {
            // landed in the gap: into the mist
            startFall(run, ev);
            endCheck(run, ev);
            return;
         }
         h.v = Math.min(h.v, h.airV);
         ev.landed = true;
         if (isBalance(l)) kick(run, landKick(run.level, l.id), ev);
      }
   } else {
      if (along > 0.6) {
         if (h.forwardSince < 0) h.forwardSince = ms;
      } else h.forwardSince = NONE;
      const balance = isBalance(l);
      h.sprint = balance && h.forwardSince >= 0 && ms - h.forwardSince >= SPRINT_HOLD_MS;
      let target = 0;
      if (!h.crouch && ms > h.staggerUntil && !wobbling) {
         const fwd = balance ? (h.sprint ? V_SPRINT : V_WALK) : V_PILLAR;
         if (along > 0.15) target = fwd;
         else if (along < -0.15) target = -V_WALK;
      }
      const dv = target - h.v;
      const max = ACCEL * dt;
      h.v += dv > max ? max : dv < -max ? -max : dv;
      h.s += h.v * dt;
      if (h.s > l.len) {
         if (l.gap > 0 || l.next < 0) {
            h.s = l.len;
            h.v = 0;
         } else {
            leaveForward(run, ev);
            l = c.links[h.link];
         }
      } else if (h.s < 0) {
         const p = l.prev >= 0 ? c.links[l.prev] : null;
         if (p && p.gap === 0) {
            h.s += p.len;
            h.link = p.id;
            l = p;
            run.clean = false;
         } else {
            h.s = 0;
            h.v = 0;
         }
      }
   }
   if (run.ended !== null) return;

   // the needle
   const k = c.links[h.link];
   if (!isBalance(k)) {
      h.lean -= h.lean * Math.min(1, 3 * dt);
      h.wobbleMs = 0;
   } else if (!h.air && !dashing) {
      const shield = ms <= h.shieldUntil;
      let rate = DRIFT[k.kind];
      const moving = Math.abs(h.v) > 0.1;
      rate *= !moving ? STILL_MUL : h.sprint ? SPRINT_MUL : 1;
      if (h.crouch) rate *= CROUCH_MUL;
      const b = run.boss;
      if (b && b.phase === 1 && run.bossAwake && (k.arena === 1 || k.arena === 2)) rate *= STRAND_MUL;
      let force = run.ext;
      if (k.spin) force += k.spin * SPIN_FORCE;
      if (k.sway) force += k.sway * SWAY_FORCE * Math.sin((2 * Math.PI * ms) / SWAY_MS);
      for (const g of c.gusts) if (g.link === k.id && h.s >= g.s0 && h.s <= g.s1 && gustState(g, ms) === 2) force += g.sign * g.force;
      const drift = shield ? 0 : rate * (0.9 * h.lean + 0.45 * wander(run, ms)) + force;
      h.lean += (drift + CORRECT * Math.max(-1, Math.min(1, side))) * dt;
      h.lean = Math.max(-LEAN_MAX, Math.min(LEAN_MAX, h.lean));
      // sandbags: duck (crouch) or take the swing
      for (let i = 0; i < c.sandbags.length; i++) {
         const bag = c.sandbags[i];
         if (bag.link !== k.id || Math.abs(h.s - bag.s) > BAG.reach || h.crouch) continue;
         const id = bagCrossing(bag, ms);
         if (Number.isNaN(id) || run.bagLast[i] === id) continue;
         run.bagLast[i] = id;
         run.bagHits += 1;
         h.v = 0;
         h.staggerUntil = ms + BAG.staggerMs;
         kick(run, (id % 2 === 0 ? 1 : -1) * BAG.kick, ev);
         ev.bagHit = true;
      }
      const a = Math.abs(h.lean);
      if (a > run.maxLean) run.maxLean = a;
      if (a > 0.5) run.steady = false;
      if (a >= 1) {
         if (h.wobbleMs === 0) {
            run.wobbles += 1;
            run.clean = false;
            run.steadyMs = 0;
            comboBreak(run.combo);
            ev.wobble = true;
         }
         h.wobbleMs += 1;
         if (h.wobbleMs >= WOBBLE_MS) {
            startFall(run, ev);
            endCheck(run, ev);
            return;
         }
      } else if (h.wobbleMs > 0) {
         h.wobbleMs = 0;
         ev.recovered = true;
      }
      if (k.arena === 3 && h.wobbleMs === 0) run.steadyMs += 1;
   }

   // orbs, coins, the shard, the bird
   for (const o of c.orbs) {
      if (run.taken[o.id] || o.link !== h.link || Math.abs(h.s - o.s) > 0.55) continue;
      if (o.high ? h.y < HIGH_ORB_Y : h.y > 1.3) continue;
      run.taken[o.id] = 1;
      if (o.high) run.highs += 1;
      else run.orbs += 1;
      ev.orb = o.id;
   }
   if (ms <= h.magnetUntil) {
      for (const coin of c.coins) {
         if (run.coinTaken[coin.id] || coin.link !== h.link || Math.abs(h.s - coin.s) > MAGNET_REACH) continue;
         run.coinTaken[coin.id] = 1;
         run.coins += 1;
         ev.coin = coin.id;
         break;
      }
   }
   if (c.shard && h.link === c.shard.link && h.s >= c.shard.s - 0.6) secret(run, "ghost", ev);
   if (h.link === c.birdLink && h.crouch && Math.abs(h.v) < 0.05 && !h.air) {
      run.birdMs += 1;
      if (run.birdMs >= BIRD_MS) secret(run, "bird", ev);
   } else run.birdMs = 0;
   endCheck(run, ev);
}

function endCheck(run: TightRun, ev: StepEvents): void {
   if (run.ended === null && run.simMs >= run.course.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

// ---------- reading the run ----------

/** The hero's world point on the path (no lean), for the scene, the camera and the multiplayer. */
export function heroPoint(run: TightRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   const l = run.course.links[h.link];
   const k = l.len > 0 ? Math.max(0, Math.min(1, h.s / l.len)) : 0;
   out.x = l.ax + l.dx * h.s;
   out.z = l.az + l.dz * h.s;
   const surf = h.s > l.len ? l.by : l.ay + (l.by - l.ay) * k - l.sag * 4 * k * (1 - k);
   out.y = surf + h.y;
   if (h.fallMs >= 0) {
      const t = h.fallMs / 1000;
      out.y -= 0.5 * 18 * t * t;
   }
   return out;
}

/** Umbra's world point (level 5). */
export function umbraPoint(run: TightRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const c = run.course;
   if (c.arenaStart < 0) return out;
   const l = arenaLink(c, run.umbraArena);
   const k = Math.max(0, Math.min(1, run.umbraS / l.len));
   out.x = l.ax + l.dx * run.umbraS;
   out.z = l.az + l.dz * run.umbraS;
   out.y = l.ay + (l.by - l.ay) * k - l.sag * 4 * k * (1 - k);
   return out;
}

export { arenaLink };

export const STAT = {
   lean: "lean",
   wobble: "wobble",
   sprint: "sprint",
   crouch: "crouch",
   orbs: "orbs",
   highs: "highs",
   coins: "coins",
   crossed: "crossed",
   hero: "hero",
   power: "power",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bonusMs: "bonusMs",
   finishMs: "finishMs",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   steadyMs: "steadyMs",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   hint: "hint",
} as const;

/** The one teaching line the HUD shows. */
export const HINT = { none: 0, walk: 1, lean: 2, gap: 3, gust: 4, bag: 5, dash: 6, ghost: 7, stomp: 8, shove: 9, balance: 10, wobble: 11, spin: 12 } as const;

export function hintFor(run: TightRun): number {
   if (run.ended !== null) return HINT.none;
   const h = run.hero;
   const c = run.course;
   const l = c.links[h.link];
   if (h.wobbleMs > 0) return HINT.wobble;
   const b = run.boss;
   if (b && run.bossAwake && b.step !== "defeat" && b.step !== "done" && b.step !== "intro") return b.phase === 0 ? HINT.stomp : b.phase === 1 ? HINT.shove : HINT.balance;
   if (l.kind === "pillar") {
      if (run.crossed === 0) return HINT.walk;
      if (l.alt >= 0 && run.heroId === "vexa") return HINT.ghost;
      const n = l.next >= 0 ? c.links[l.next] : null;
      if (n?.kind === "dash" && run.heroId === "riko") return HINT.dash;
      return HINT.none;
   }
   if (l.gap > 0 && h.s > l.len - 1.2) return HINT.gap;
   if (c.sandbags.some((s) => s.link === l.id && Math.abs(s.s - h.s) < 2)) return HINT.bag;
   if (c.gusts.some((g) => g.link === l.id && gustState(g, run.simMs) !== 0 && h.s < g.s1)) return HINT.gust;
   if (l.spin && run.crossed < 4) return HINT.spin;
   if (run.crossed < 2 && Math.abs(h.lean) > 0.35) return HINT.lean;
   return HINT.none;
}

/** A time game: a win submits the finish less the bonus (published as STAT.bonusMs before the end). */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.bonusMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The "never wobbled" badge (the card): the star screen's hits are the wobbles plus the falls. */
export function badgeHits(run: TightRun): number {
   return run.wobbles + run.falls;
}
