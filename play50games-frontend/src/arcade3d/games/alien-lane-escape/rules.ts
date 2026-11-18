// Alien Lane Escape's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the
// same run, at any frame rate (the simulation advances in fixed STEP_MS steps).
//
// The signature mechanic (card "Break line of sight"): the hero runs on its own at the level's speed on
// three lanes (a lane change takes 0.18 s). A mothership hangs behind; as you pass a scan's trigger its
// violet line sweeps forward along the track and reaches you at the scan's meeting point (the line closes
// in as you run, so a stumble never moves where it meets you). Be in the shadow of the cover there (the
// 3 m strip behind a crystal, a rock, a drifting pod or a fresh meteor crater, in its lane; under a low
// cover you must slide) and you pass UNSEEN (a flow link). Seen, the tractor beam takes you: 1.2 s held
// in the air, a hit, the chain broken. Rocks want a jump, low arches a slide; meeting one wrong is a
// stumble (half speed 0.8 s, a hit). Goo slows you to 0.6. Level 4's glow plants, brushed, wash the
// shadows near them out for 3 s. Level 5: the Mothership; its abduction beams, its underside and the last
// meteor are the hits, and the launch road repeats until it is down.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { LANE_W, MESA_Y, SCAN_LEAD, STRIP, TELEGRAPH_MS, courseFor, laneX, type Course } from "./course";
import { DASH_X, DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, MOTHERSHIP, SECRETS } from "./progression";

export type { Course } from "./course";
export { courseFor } from "./course";

// ---------- tuning ----------

export const STEP_MS = 4;
export const MAX_FRAME_MS = 50;
/** a lane change (ms): the card's 0.18 s */
export const LANE_MS = 180;
/** a jump: apex 1.35 m, 0.6 s (Nyla's second jump in the air reaches the mesa) */
export const V_HOP = 9;
export const G = 30;
/** a jump clears a rock while this high */
export const CLEAR_H = 0.8;
/** a stumble: half speed for 0.8 s */
export const SLOW = 0.5;
export const SLOW_MS = 800;
export const INVULN_MS = 600;
/** goo slows you to this (Kiro's shield carries him through) */
export const GOO_SLOW = 0.6;
/** two catches this close together count as a hit */
export const CATCH_PAIR_MS = 6000;
/** the tractor beam holds you this long */
export const HELD_MS = 1200;
/** a pod drifts into its lane over this long once its scan starts */
export const POD_MS = 1200;
/** a meteor lands this long after its trigger */
export const METEOR_MS = 1000;
/** a brushed plant glows this long, washing out the shadows of covers this near it */
export const PLANT_MS = 3000;
export const PLANT_R = 10;
/** Vexa phased hides inside any crystal this near */
export const PHASE_R = 4;
/** level 5: an abduction beam locks onto your lane this far before it lands */
export const LURE_LOCK = 8;
/** jumping into the Mothership's underside: this high */
export const UNDERSIDE_H = 1.0;
export const ORB = { pickup: 1.1, bonusMs: 100 } as const;
export const SECRET_R = 1.4;
/** something is in your lane while you are within this of the lane's centre */
export const LANE_HALF = 1.0;
/** a buffered jump press waits this long for the ground */
export const BUFFER_MS = 120;

// ---------- the run ----------

export interface Runner {
   s: number;
   /** the lane it is on (or heading to: 0 1 2, the cave 3) and its sideways position (m) */
   lane: number;
   x: number;
   fromX: number;
   swapAt: number;
   h: number;
   vy: number;
   onMesa: boolean;
   airHops: number;
   sliding: boolean;
   slowUntil: number;
   invulnUntil: number;
   heldUntil: number;
   bufferUntil: number;
}

export interface StepInput {
   /** a lane change press (keys / swipes / a stick flick) */
   left: boolean;
   right: boolean;
   /** the slide (Down / S / the stick pulled down, held) */
   slide: boolean;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { left: false, right: false, slide: false, jumpPressed: false, actionPressed: false };
}

export interface StepEvents {
   swapped: boolean;
   blocked: boolean;
   hopped: boolean;
   airHopped: boolean;
   landed: boolean;
   mesaOn: boolean;
   slid: boolean;
   /** obstacle index jumped / slid right, -1 none */
   cleared: number;
   /** obstacle index stumbled into, -1 none */
   miss: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   /** a scan's line starts (index), its telegraph starts (index) */
   scanStart: number;
   scanWarn: number;
   /** the line passed you hidden / it caught you (scan index) */
   unseen: number;
   caught: number;
   released: boolean;
   meteorLand: number;
   plantLit: number;
   caveOpen: boolean;
   gooIn: boolean;
   powered: boolean;
   comboBonus: number;
   comboLinked: boolean;
   bossWoke: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   /** a boss event index that charged a hit, a lure that locked onto your lane */
   bossCharge: number;
   lureLock: number;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossDone: boolean;
   finished: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      swapped: false, blocked: false, hopped: false, airHopped: false, landed: false, mesaOn: false, slid: false,
      cleared: -1, miss: -1, orbCount: 0, orbList: new Array<number>(8).fill(0), secretCount: 0, secretList: [0, 0, 0],
      scanStart: -1, scanWarn: -1, unseen: -1, caught: -1, released: false, meteorLand: -1, plantLit: -1, caveOpen: false,
      gooIn: false, powered: false, comboBonus: 0, comboLinked: false, bossWoke: false, bossTelegraph: false, bossAttack: false,
      bossCharge: -1, lureLock: -1, bossHit: false, bossPhase: false, bossDefeated: false, bossDone: false, finished: false, timeup: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.swapped = e.blocked = e.hopped = e.airHopped = e.landed = e.mesaOn = e.slid = false;
   e.cleared = e.miss = e.scanStart = e.scanWarn = e.unseen = e.caught = e.meteorLand = e.plantLit = e.bossCharge = e.lureLock = -1;
   e.orbCount = e.secretCount = 0;
   e.released = e.caveOpen = e.gooIn = e.powered = false;
   e.comboBonus = 0;
   e.comboLinked = false;
   e.bossWoke = e.bossTelegraph = e.bossAttack = e.bossHit = e.bossPhase = e.bossDefeated = e.bossDone = false;
   e.finished = e.timeup = false;
}

export interface AlienRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   runner: Runner;
   /** per scan: the lap it ran on (-1 never), when it started (ms), resolved this lap */
   scanLap: Int32Array;
   scanAt: Float64Array;
   scanDone: Uint8Array;
   /** the scan sweeping now (-1 none) */
   active: number;
   /** per obstacle: met on this lap */
   metLap: Int32Array;
   /** per boss event: met on this lap; per lure: locked on this lap */
   eventLap: Int32Array;
   lureLap: Int32Array;
   meteorAt: Float64Array;
   plantUntil: Float64Array;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   caveOpen: Uint8Array;
   catches: number;
   lastCatchMs: number;
   unseen: number;
   misses: number;
   hits: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   inGoo: boolean;
   lap: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   pending: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): AlienRun {
   const course = courseFor(level);
   return {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      runner: { s: 0, lane: 1, x: 0, fromX: 0, swapAt: -1, h: 0, vy: 0, onMesa: false, airHops: 0, sliding: false, slowUntil: -1, invulnUntil: -1, heldUntil: -1, bufferUntil: -1 },
      scanLap: new Int32Array(course.scans.length).fill(-1),
      scanAt: new Float64Array(course.scans.length).fill(-1),
      scanDone: new Uint8Array(course.scans.length),
      active: -1,
      metLap: new Int32Array(course.obstacles.length).fill(-1),
      eventLap: new Int32Array(course.bossEvents.length).fill(-1),
      lureLap: new Int32Array(course.bossEvents.length).fill(-1),
      meteorAt: new Float64Array(course.meteors.length).fill(-1),
      plantUntil: new Float64Array(course.plants.length).fill(-1),
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      caveOpen: new Uint8Array(course.caves.length),
      catches: 0,
      lastCatchMs: -1,
      unseen: 0,
      misses: 0,
      hits: 0,
      powerReadyAt: 0,
      dashUntil: -1,
      shieldUntil: -1,
      magnetUntil: -1,
      phaseUntil: -1,
      inGoo: false,
      lap: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      boss: course.loop ? createBoss(MOTHERSHIP) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      pending: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
}

// ---------- queries ----------

export function bossDone(run: AlienRun): boolean {
   return !run.boss || run.boss.step === "done";
}

/** Is a phase-tagged item there now (level 5: only in its boss phase, while it fights)? */
export function inPhase(run: AlienRun, phase: number): boolean {
   if (phase < 0) return true;
   const b = run.boss;
   return !!b && run.bossAwake && !bossDone(run) && b.phase === phase;
}

/** The lane under a sideways position. */
export function laneAt(x: number): number {
   return Math.round(x / LANE_W) + 1;
}

/** The cave open to enter at s (its index), else -1. */
export function caveAt(run: AlienRun, s: number): number {
   const cv = run.course.caves;
   for (let i = 0; i < cv.length; i++) if (s >= cv[i].s0 - 8 && s <= cv[i].s1) return i;
   return -1;
}

/** Where the runner is drawn: its s plus every launch-road lap (the world never jumps back). */
export function visualS(run: AlienRun, s = run.runner.s): number {
   const l = run.course.loop;
   return l ? s + run.lap * (l.s1 - l.s0) : s;
}

/** Where an item at course s is drawn this lap. */
export function itemVisualS(run: AlienRun, s: number): number {
   const l = run.course.loop;
   if (!l || s < l.s0) return s;
   return s + run.lap * (l.s1 - l.s0);
}

export function dashing(run: AlienRun, ms = run.ms): boolean {
   return ms < run.dashUntil;
}

/** The run speed now (m/s): the level's; x1.6 dashing; halved after a stumble; 0.6 in goo; 0 held. */
export function speedNow(run: AlienRun, ms = run.ms): number {
   const r = run.runner;
   if (ms < r.heldUntil) return 0;
   let v = run.course.config.speed;
   if (ms < run.dashUntil) v *= DASH_X;
   if (ms < r.slowUntil) v *= SLOW;
   if (run.inGoo) v *= GOO_SLOW;
   return v;
}

/** A pod's sideways position (m): it drifts from its first lane into its own once its scan starts. */
export function coverX(run: AlienRun, i: number, ms = run.ms): number {
   const c = run.course.covers[i];
   if (c.kind !== "pod" || c.from === c.lane) return laneX(c.lane);
   const at = run.scanLap[c.scan] === run.lap ? run.scanAt[c.scan] : -1;
   const k = at < 0 ? 0 : Math.min(1, (ms - at) / POD_MS);
   const e = k * k * (3 - 2 * k);
   return laneX(c.from) + (laneX(c.lane) - laneX(c.from)) * e;
}

/** Is cover i there (in its phase; a crater only once its meteor has landed)? */
export function coverUp(run: AlienRun, i: number, ms = run.ms): boolean {
   const c = run.course.covers[i];
   if (!inPhase(run, c.phase)) return false;
   if (c.kind === "crater") return c.meteor >= 0 && run.meteorAt[c.meteor] >= 0 && run.meteorAt[c.meteor] <= ms;
   return true;
}

/** Is cover i's shadow washed out by a glowing plant (level 4)? */
export function coverWashed(run: AlienRun, i: number, ms = run.ms): boolean {
   const c = run.course.covers[i];
   const pl = run.course.plants;
   for (let k = 0; k < pl.length; k++) if (run.plantUntil[k] > ms && Math.abs(pl[k].s - c.s) < PLANT_R) return true;
   return false;
}

/** Why the line would miss you now: "mesa" | "dash" | "shield" | "phase" | "cave" | "shadow", else null. */
export function hiddenBy(run: AlienRun, ms = run.ms): string | null {
   const r = run.runner;
   if (r.onMesa) return "mesa";
   if (ms < run.dashUntil) return "dash";
   if (ms < run.shieldUntil) return "shield";
   if (r.lane === 3 && Math.abs(r.x - laneX(3)) < LANE_HALF) return "cave";
   const co = run.course;
   const phased = ms < run.phaseUntil;
   for (let i = 0; i < co.covers.length; i++) {
      const c = co.covers[i];
      if (c.s > r.s + PHASE_R + 1) break;
      if (c.s < r.s - STRIP.to - PHASE_R) continue;
      if (!coverUp(run, i, ms)) continue;
      if (phased && c.kind === "crystal" && Math.abs(c.s - r.s) < PHASE_R) return "phase";
      if (r.s < c.s + STRIP.from || r.s > c.s + STRIP.to) continue;
      if (Math.abs(r.x - coverX(run, i, ms)) >= LANE_HALF) continue;
      if (c.low && !r.sliding) continue;
      if (r.h > 1.6) continue;
      if (coverWashed(run, i, ms)) continue;
      return "shadow";
   }
   return null;
}

/** The sweeping line's position (m along the track) for the active scan, else NaN. */
export function scanLineS(run: AlienRun): number {
   const i = run.active;
   if (i < 0) return NaN;
   const sc = run.course.scans[i];
   const r = run.runner;
   if (sc.kind === "lateral") return sc.meet;
   const run0 = sc.meet - sc.trigger;
   const k = Math.min(1, Math.max(0, (r.s - sc.trigger) / run0));
   return sc.trigger - SCAN_LEAD + (sc.meet - sc.trigger + SCAN_LEAD) * k;
}

/** The active scan's time until it reaches you (ms, at the level's speed), else Infinity. */
export function scanEtaMs(run: AlienRun): number {
   const i = run.active;
   if (i < 0) return Infinity;
   return Math.max(0, ((run.course.scans[i].meet - run.runner.s) / run.course.config.speed) * 1000);
}

// ---------- the step ----------

function stumble(run: AlienRun, ms: number, index: number): void {
   const r = run.runner;
   run.misses += 1;
   run.hits += 1;
   run.events.miss = index;
   r.slowUntil = ms + SLOW_MS;
   r.invulnUntil = ms + INVULN_MS;
   comboBreak(run.combo);
}

function caught(run: AlienRun, ms: number, index: number): void {
   const r = run.runner;
   // two catches within 6 s count as a hit (the card); every catch breaks the Ghost Run
   if (run.lastCatchMs >= 0 && ms - run.lastCatchMs < CATCH_PAIR_MS) run.hits += 1;
   run.lastCatchMs = ms;
   run.catches += 1;
   run.events.caught = index;
   r.heldUntil = ms + HELD_MS;
   r.invulnUntil = ms + HELD_MS + INVULN_MS;
   r.vy = 0;
   r.sliding = false;
   comboBreak(run.combo);
   // level 3: the beam inside the abduction zone lifts you to the shard's floating rock
   const ab = run.course.abduction;
   if (ab && r.s >= ab.s0 && r.s <= ab.s1) {
      const k = SECRETS[run.level].findIndex((sp) => sp.id === "abducted");
      if (k >= 0 && collectSecret(run.secrets, k) && run.events.secretCount < 3) run.events.secretList[run.events.secretCount++] = k;
   }
}

function tryPower(run: AlienRun, ms: number): void {
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") return;
   if (ms < run.powerReadyAt) return;
   if (def.power === "dash") run.dashUntil = ms + POWER_MS.dash;
   else if (def.power === "shield") run.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") run.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   run.events.powered = true;
}

function startSwap(run: AlienRun, to: number, ms: number): void {
   const r = run.runner;
   r.fromX = r.x;
   r.lane = to;
   r.swapAt = ms;
   run.events.swapped = true;
}

function passed(a: number, b: number, s: number): boolean {
   return a < s && s <= b;
}

function onMesaSpan(run: AlienRun, s: number): boolean {
   for (const m of run.course.mesas) if (s >= m.s0 && s <= m.s1) return true;
   return false;
}

function airJump(run: AlienRun): boolean {
   const r = run.runner;
   if (run.heroId !== "nami" || r.h <= 0.05 || r.onMesa || r.airHops >= 1) return false;
   r.vy = V_HOP;
   r.airHops += 1;
   run.events.airHopped = true;
   return true;
}

function substep(run: AlienRun, ms: number, input: StepInput, first: boolean, dtMs: number): void {
   const r = run.runner;
   const co = run.course;
   const ev = run.events;
   const dt = dtMs / 1000;
   comboTick(run.combo, COMBO, ms);
   const held = ms < r.heldUntil;
   if (!held && r.heldUntil >= 0 && ms - dtMs < r.heldUntil) ev.released = true;

   if (first && input.actionPressed && !held && !airJump(run)) tryPower(run, ms);
   // lane changes (one per press; the cave lane only where it runs, past its ghost wall)
   if (first && (input.left || input.right) && !held) {
      const to = r.lane + (input.left ? -1 : 1);
      if (to >= 0 && to <= 2) startSwap(run, to, ms);
      else if (to === 3 && caveAt(run, r.s) >= 0) startSwap(run, to, ms);
      else ev.blocked = true;
   }
   if (r.lane === 3 && caveAt(run, r.s) < 0) startSwap(run, 2, ms);
   const tx = laneX(r.lane);
   if (r.swapAt >= 0) {
      const k = Math.min(1, (ms - r.swapAt) / LANE_MS);
      r.x = r.fromX + (tx - r.fromX) * k;
      if (k >= 1) r.swapAt = -1;
   } else r.x = tx;
   const inLane = (l: number) => Math.abs(r.x - laneX(l)) < LANE_HALF;

   // the jump: buffered; Nyla's second jump in the air
   if (first && input.jumpPressed && !held) {
      if (r.h <= 0.001 || r.onMesa) r.bufferUntil = ms + BUFFER_MS;
      else airJump(run);
   }
   if (!held && r.bufferUntil >= ms && (r.h <= 0.001 || r.onMesa)) {
      r.vy = V_HOP;
      r.onMesa = false;
      r.bufferUntil = -1;
      r.airHops = 0;
      ev.hopped = true;
   }
   // the slide (held, on the ground)
   const wasSliding = r.sliding;
   r.sliding = input.slide && !held && r.h <= 0.001 && !r.onMesa;
   if (r.sliding && !wasSliding) ev.slid = true;

   // goo (level speed x0.6 unless Kiro's shield is up)
   let goo = false;
   if (r.h <= 0.001 && !r.onMesa) for (const g of co.goo) if (r.s >= g.s0 && r.s <= g.s1 && inLane(g.lane)) goo = true;
   goo = goo && ms >= run.shieldUntil;
   if (goo && !run.inGoo) ev.gooIn = true;
   run.inGoo = goo;

   // forward
   const a = r.s;
   r.s += speedNow(run, ms) * dt;
   const b = r.s;

   // up and down (the mesa holds Nyla up while it runs); the beam holds you in the air
   if (held) {
      r.h = Math.min(1.8, r.h + 3 * dt);
      r.vy = 0;
   } else {
      if (r.onMesa && (!onMesaSpan(run, b) || !inLane(1))) {
         r.onMesa = false;
         r.vy = 0;
      }
      if (!r.onMesa && (r.h > 0 || r.vy > 0)) {
         const prev = r.h;
         r.vy -= G * dt;
         r.h += r.vy * dt;
         if (r.vy <= 0 && inLane(1) && onMesaSpan(run, b) && prev >= MESA_Y - 0.05 && r.h <= MESA_Y) {
            r.h = MESA_Y;
            r.vy = 0;
            r.onMesa = true;
            r.airHops = 0;
            ev.mesaOn = true;
         } else if (r.h <= 0) {
            r.h = 0;
            r.vy = 0;
            r.airHops = 0;
            ev.landed = true;
         }
      }
   }

   // obstacles: met as you pass them in their lane (rocks and blobs: be in the air; arches: slide)
   for (let i = 0; i < co.obstacles.length; i++) {
      const o = co.obstacles[i];
      if (o.s > b + 1) break;
      if (!passed(a, b, o.s) || !inPhase(run, o.phase) || run.metLap[i] === run.lap) continue;
      if (!inLane(o.lane) || r.onMesa) continue;
      run.metLap[i] = run.lap;
      const ok = o.kind === "arch" ? r.sliding : r.h > CLEAR_H;
      if (ok) ev.cleared = i;
      else if (ms >= r.invulnUntil && !held) stumble(run, ms, i);
   }

   // the scans: started as you pass the trigger; resolved as the line reaches you
   for (let i = 0; i < co.scans.length; i++) {
      const sc = co.scans[i];
      if (sc.trigger > b + 1) break;
      if (!inPhase(run, sc.phase)) continue;
      if (run.scanLap[i] !== run.lap && passed(a, b, sc.trigger)) {
         run.scanLap[i] = run.lap;
         run.scanAt[i] = ms;
         run.scanDone[i] = 0;
         run.active = i;
         ev.scanStart = i;
      }
      if (run.scanLap[i] !== run.lap || run.scanDone[i]) continue;
      const warnS = sc.meet - (co.config.speed * TELEGRAPH_MS) / 1000;
      if (passed(a, b, warnS)) ev.scanWarn = i;
      if (b >= sc.meet) {
         run.scanDone[i] = 1;
         if (run.active === i) run.active = -1;
         if (held || ms < r.invulnUntil) continue;
         if (hiddenBy(run, ms) !== null) {
            run.unseen += 1;
            ev.unseen = i;
            ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.unseen);
            ev.comboLinked = true;
         } else caught(run, ms, i);
      }
   }

   // meteors (level 3): they land 1 s after their trigger
   for (let i = 0; i < co.meteors.length; i++) {
      const m = co.meteors[i];
      if (run.meteorAt[i] < 0 && passed(a, b, m.trigger)) run.meteorAt[i] = ms + METEOR_MS;
      if (run.meteorAt[i] >= 0 && run.meteorAt[i] > ms - dtMs && run.meteorAt[i] <= ms) ev.meteorLand = i;
   }
   // glow plants (level 4): brushed, they light up
   for (let i = 0; i < co.plants.length; i++) {
      const p = co.plants[i];
      if (!passed(a, b, p.s) || !inLane(p.lane) || r.h > 1.2) continue;
      run.plantUntil[i] = ms + PLANT_MS;
      ev.plantLit = i;
   }

   // orbs (Zuno's magnet pulls them in, the goo's buried ones only to it)
   const magnet = ms < run.magnetUntil;
   for (let i = 0; i < co.orbs.length; i++) {
      const o = co.orbs[i];
      if (o.s > b + MAGNET_REACH) break;
      if (run.collected[i] || o.s < a - MAGNET_REACH) continue;
      if (o.magnet && !magnet) continue;
      const dx = laneX(o.lane) - r.x;
      const ds = o.s - b;
      const dy = o.h - (r.h + 0.8);
      const reach = magnet ? MAGNET_REACH : ORB.pickup;
      if (dx * dx + ds * ds + (magnet ? 0 : dy * dy) > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
      ev.comboLinked = true;
   }

   // the cave's ghost-crystal wall: only Vexa's phase walks through
   for (let i = 0; i < co.caves.length; i++) {
      const cv = co.caves[i];
      if (run.caveOpen[i] || !passed(a, b, cv.s0) || r.lane !== 3) continue;
      if (ms < run.phaseUntil) {
         run.caveOpen[i] = 1;
         ev.caveOpen = true;
      } else {
         startSwap(run, 2, ms);
         ev.blocked = true;
      }
   }

   // secrets: the cave shard, the mesa sticker (the abducted shard comes from the beam)
   for (let i = 0; i < co.secrets.length; i++) {
      const sp = co.secrets[i];
      if (run.secrets.found[i] || sp.id === "abducted") continue;
      if (Math.abs(sp.s - b) < SECRET_R && inLane(sp.lane) && Math.abs(sp.h - (r.h + 0.8)) < 1.2 && collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }

   bossWorld(run, ms, a, b, held);

   // level 5's launch road repeats until the Mothership is down
   const loop = co.loop;
   if (loop && run.boss && !bossDone(run) && r.s >= loop.s1) {
      r.s -= loop.s1 - loop.s0;
      run.lap += 1;
   }
   if (r.s >= co.finishS && bossDone(run) && run.ended === null) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

function bossWorld(run: AlienRun, ms: number, a: number, b: number, held: boolean): void {
   const co = run.course;
   const boss = run.boss;
   if (!boss || !co.loop) return;
   const ev = run.events;
   const r = run.runner;
   if (!run.bossAwake) {
      if (r.s < co.loop.s0) return;
      run.bossAwake = true;
      ev.bossWoke = true;
   }
   const inLane = (l: number) => Math.abs(r.x - laneX(l)) < LANE_HALF;
   // the track's hits: a lure (in its lane as it locks, out of it as it lands), the underside, the crash
   for (let i = 0; i < co.bossEvents.length; i++) {
      const e = co.bossEvents[i];
      if (!inPhase(run, e.phase) || run.eventLap[i] === run.lap) continue;
      if (e.kind === "lure" && passed(a, b, e.s - LURE_LOCK) && inLane(e.lane)) {
         run.lureLap[i] = run.lap;
         ev.lureLock = i;
      }
      if (!passed(a, b, e.s)) continue;
      run.eventLap[i] = run.lap;
      let charged = false;
      if (e.kind === "lure") {
         if (run.lureLap[i] === run.lap) {
            if (inLane(e.lane) && !held && ms >= r.invulnUntil && hiddenBy(run, ms) === null) caught(run, ms, -2);
            else if (!inLane(e.lane)) charged = true;
         }
      } else if (e.kind === "underside") charged = inLane(e.lane) && r.h > UNDERSIDE_H;
      else charged = r.h > CLEAR_H;
      if (charged && boss.hp > 0 && run.pending === 0) {
         run.pending = 1;
         ev.bossCharge = i;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.unseen);
         ev.comboLinked = true;
      }
   }
   const before = boss.phase;
   stepBoss(boss, MOTHERSHIP, STEP_MS, run.bossEv);
   if (run.bossEv.telegraph) ev.bossTelegraph = true;
   if (run.bossEv.attack) ev.bossAttack = true;
   if (boss.step === "vulnerable" && run.pending > 0 && boss.hp > 0) {
      const res = hitBoss(boss, MOTHERSHIP, 1, run.bossEv);
      if (res !== "ignored") {
         run.pending = 0;
         ev.bossHit = true;
         if (res === "phase") ev.bossPhase = true;
         if (res === "defeated") ev.bossDefeated = true;
      }
   }
   if (boss.phase !== before) {
      ev.bossPhase = true;
      run.pending = 0;
   }
   if (run.bossEv.done) ev.bossDone = true;
}

/** One frame (dtMs = useRunFrame's dt x 1000). Returns run.events (the same object every step). */
export function step(run: AlienRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null) return ev;
   const dt = Math.min(MAX_FRAME_MS, Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0);
   run.remainder += dt;
   let first = true;
   while (run.remainder >= STEP_MS && run.ended === null) {
      run.remainder -= STEP_MS;
      run.ms += STEP_MS;
      substep(run, run.ms, input, first, STEP_MS);
      first = false;
      if (run.ms >= run.course.config.durationMs && run.ended === null) {
         run.ended = "timeup";
         ev.timeup = true;
      }
   }
   // a press in a frame shorter than one step: the jump waits in the buffer
   if (first && input.jumpPressed) run.runner.bufferUntil = run.ms + BUFFER_MS;
   return ev;
}

// ---------- the store hand-off ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   progress: "progress",
   catches: "catches",
   unseen: "unseen",
   misses: "misses",
   finishMs: "finishMs",
   hits: "hits",
   hero: "hero",
   power: "power",
   scanEta: "scanEta",
   hidden: "hidden",
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

// ---------- the proof ----------

/** The most orbs one hero can take: the track's, the goo's and the open ground's, plus its own route. */
export function maxOrbs(c: Course): number {
   const open = c.orbs.filter((o) => o.bonus === null || o.bonus === "kiro" || o.bonus === "open").length;
   const own = Math.max(...(["nami", "zuno", "vexa"] as const).map((h) => c.orbs.filter((o) => o.bonus === h).length));
   return open + own;
}

/** King of the laps: how many launch-road laps the fight can take at most (its least time, plus one). */
function lapsOf(c: Course): number {
   if (!c.loop) return 0;
   return Math.ceil(bossMinMs() / (((c.loop.s1 - c.loop.s0) / (c.config.speed * DASH_X)) * 1000)) + 2;
}

/** What the course can feed the flow meter: every orb one hero can take, every scan passed unseen. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const once = c.scans.filter((s) => s.phase < 0).length;
   const laps = lapsOf(c);
   const road = (c.scans.filter((s) => s.phase >= 0).length + c.bossEvents.length) * laps;
   return { combo: COMBO, sources: [{ count: maxOrbs(c), base: COMBO_BASE_MS.orb }, { count: once + road, base: COMBO_BASE_MS.unseen }] };
}

/** The Mothership's least defeat time (ms) once woken: a hit in the first ms of every open window. */
export function bossMinMs(): number {
   const b = createBoss(MOTHERSHIP);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000 && b.step !== "done"; guard++) {
      stepBoss(b, MOTHERSHIP, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, MOTHERSHIP, 1, ev);
   }
   return ms;
}

/**
 * The least time (ms) to run d metres: never faster than the level's speed, except Riko's dash (x1.6 for
 * 0.75 s, at most once every 5 s from the first frame).
 */
export function leastRunMs(d: number, v: number): number {
   const extra = (DASH_X - 1) * (POWER_MS.dash / 1000);
   const per = heroById("riko").cooldownMs / 1000;
   // d <= v t + extra v (t / per + 1)  =>  t >= (d / v - extra) / (1 + extra / per)
   return Math.max(0, ((d / v - extra) / (1 + extra / per)) * 1000);
}

/**
 * The least finish (ms): the course's length at the fastest pace; level 5 adds the Mothership: once it
 * wakes at the launch road's start, the hero cannot leave it before its least defeat time (or one lap).
 */
export function minFinishMs(c: Course): number {
   const v = c.config.speed;
   if (!c.loop) return leastRunMs(c.finishS, v) - STEP_MS;
   const lap = leastRunMs(c.loop.s1 - c.loop.s0, v);
   return leastRunMs(c.loop.s0, v) + Math.max(lap, bossMinMs()) + leastRunMs(c.finishS - c.loop.s1, v) - STEP_MS;
}

export function minDurationMsOf(c: Course): number {
   return Math.max(0, minFinishMs(c) - maxOrbs(c) * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The level's limits row: the bound less 5 %, to the 100 ms below. */
export function proposeLimits(c: Course): LevelLimits {
   const minDurationMs = Math.max(0, Math.floor((minDurationMsOf(c) * 0.95) / 100) * 100);
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

/** The no-hit badge (the card's "Ghost Run"): never caught, never stumbled. */
export function badgeHits(run: AlienRun): number {
   return run.misses + run.catches;
}

export { LEVELS } from "./levels";
