// Candy World Runner's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the
// same run, at any frame rate (the simulation advances in fixed STEP_MS steps).
//
// The signature mechanic (card "Sugar Size"): the hero runs on its own at the level's speed on three
// lanes (a lane change takes 0.18 s; on frosted ice 0.45 s). It has three sizes: Small, Normal, Big.
// Every 3 candy coins eaten grow it a size; holding Down sugar-burn rolls it down a size every 0.6 s.
// An obstacle needs one size: Big smashes jelly cubes, chocolate walls and frozen blocks, Small slips
// under cookie, candy-cane and frozen arches. Met at any other size it is a SIZE MISS: you stumble
// through it at half speed for 0.8 s. Level 2: chocolate bridges crack under Big (a miss), donuts bounce
// a Small hero high. Level 3: frosted ice. Level 4: gummy monsters bite you down a size (a jump onto a
// head grows you a size). Level 5: King Bonbon; his drum, throne and crown are Big beats that charge
// his hits, and the palace section repeats until he is free.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { BIG, COINS_PER_SIZE, LANE_W, RAIL_Y, SMALL, courseFor, isBossTarget, laneX, needOf, type Course, type Size } from "./course";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, GIANT_MS, KING_BONBON, SECRETS } from "./progression";

export type { Course } from "./course";
export { courseFor } from "./course";

// ---------- tuning ----------

export const STEP_MS = 4;
export const MAX_FRAME_MS = 50;
/** a lane change (s): the card's 0.18 s; on frosted ice it drifts 0.45 s */
export const LANE_MS = 180;
export const ICE_LANE_MS = 450;
/** the sugar-burn roll: one size down per 0.6 s held */
export const BURN_MS = 600;
/** a hop: apex 1.35 m, 0.6 s (Nami's second hop in the air reaches the rail) */
export const V_HOP = 9;
export const G = 30;
/** a donut bounces a Small hero this high */
export const V_DONUT = 13;
/** a size miss: half speed for 0.8 s */
export const SLOW = 0.5;
export const SLOW_MS = 800;
export const INVULN_MS = 600;
/** the scale per size (the card: 0.7 / 1.0 / 1.4) */
export const SIZE_SCALE = [0.7, 1, 1.4] as const;
export const ORB = { pickup: 1.1, bonusMs: 100 } as const;
export const COIN_R = 1.0;
export const SECRET_R = 1.4;
/** an obstacle (or a coin) is in your lane while you are within this of the lane's centre */
export const LANE_HALF = 1.0;
/** a buffered jump press waits this long for the ground */
export const BUFFER_MS = 120;

// ---------- the run ----------

export interface Runner {
   s: number;
   /** the lane it is on (or heading to) and its sideways position (m) */
   lane: number;
   x: number;
   /** the lane change in progress: from x, started at ms (-1 none) */
   fromX: number;
   swapAt: number;
   swapMs: number;
   /** height over the road (or the rail), vertical speed */
   h: number;
   vy: number;
   onRail: boolean;
   airHops: number;
   size: Size;
   /** coins eaten towards the next size */
   eaten: number;
   /** the sugar-burn roll held (ms) */
   burnMs: number;
   rolling: boolean;
   /** the size a moment ago (the grow / shrink animation) and when it changed */
   sizeAt: number;
   slowUntil: number;
   invulnUntil: number;
   bufferUntil: number;
}

export interface StepInput {
   /** a lane change press (keys / swipes / a stick flick): left or right */
   left: boolean;
   right: boolean;
   /** the sugar-burn roll (Down / S / the stick pulled down, held) */
   roll: boolean;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { left: false, right: false, roll: false, jumpPressed: false, actionPressed: false };
}

export interface StepEvents {
   swapped: boolean;
   blocked: boolean;
   hopped: boolean;
   airHopped: boolean;
   landed: boolean;
   railOn: boolean;
   grew: boolean;
   shrank: boolean;
   /** obstacle index met right (smashed / slipped under), -1 none */
   cleared: number;
   /** obstacle index met at the wrong size, -1 none */
   miss: number;
   coinCount: number;
   coinList: number[];
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   cracked: number;
   bounced: boolean;
   bitten: boolean;
   stomped: boolean;
   popped: boolean;
   absorbed: boolean;
   gateBroken: number;
   powered: boolean;
   comboBonus: number;
   comboLinked: boolean;
   bossWoke: boolean;
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

function createEvents(): StepEvents {
   return {
      swapped: false, blocked: false, hopped: false, airHopped: false, landed: false, railOn: false, grew: false, shrank: false,
      cleared: -1, miss: -1, coinCount: 0, coinList: new Array<number>(8).fill(0), orbCount: 0, orbList: new Array<number>(8).fill(0),
      secretCount: 0, secretList: [0, 0, 0], cracked: -1, bounced: false, bitten: false, stomped: false, popped: false, absorbed: false,
      gateBroken: -1, powered: false, comboBonus: 0, comboLinked: false, bossWoke: false, bossTelegraph: false, bossAttack: false,
      bossCharge: -1, bossHit: false, bossPhase: false, bossDefeated: false, bossDone: false, finished: false, timeup: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.swapped = e.blocked = e.hopped = e.airHopped = e.landed = e.railOn = e.grew = e.shrank = false;
   e.cleared = e.miss = e.cracked = e.gateBroken = e.bossCharge = -1;
   e.coinCount = e.orbCount = e.secretCount = 0;
   e.bounced = e.bitten = e.stomped = e.popped = e.absorbed = e.powered = false;
   e.comboBonus = 0;
   e.comboLinked = false;
   e.bossWoke = e.bossTelegraph = e.bossAttack = e.bossHit = e.bossPhase = e.bossDefeated = e.bossDone = false;
   e.finished = e.timeup = false;
}

export interface CandyRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   runner: Runner;
   /** per obstacle: met this lap (the palace's repeat: the lap number it was met on, else -1) */
   metLap: Int32Array;
   coinLap: Int32Array;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   /** side-lane gates broken / opened */
   gateOpen: Uint8Array;
   /** per bridge: cracked */
   bridgeCracked: Uint8Array;
   /** per gummy: eaten (stomped or it bit) */
   gummyDone: Uint8Array;
   /** per field: crossed (it knocks you once) */
   fieldDone: Uint8Array;
   misses: number;
   hits: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetOn: boolean;
   phaseUntil: number;
   /** Big since (ms; -1 not Big); a bridge broken ends the sugar giant */
   bigSince: number;
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

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CandyRun {
   const course = courseFor(level);
   return {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      runner: { s: 0, lane: 1, x: 0, fromX: 0, swapAt: -1, swapMs: LANE_MS, h: 0, vy: 0, onRail: false, airHops: 0, size: SMALL, eaten: 0, burnMs: 0, rolling: false, sizeAt: -9999, slowUntil: -1, invulnUntil: -1, bufferUntil: -1 },
      metLap: new Int32Array(course.obstacles.length).fill(-1),
      coinLap: new Int32Array(course.coins.length).fill(-1),
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      gateOpen: new Uint8Array(course.sideLanes.length),
      bridgeCracked: new Uint8Array(course.bridges.length),
      gummyDone: new Uint8Array(course.gummies.length),
      fieldDone: new Uint8Array(course.fields.length),
      misses: 0,
      hits: 0,
      powerReadyAt: 0,
      dashUntil: -1,
      shieldUntil: -1,
      magnetOn: false,
      phaseUntil: -1,
      bigSince: -1,
      lap: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      boss: course.loop ? createBoss(KING_BONBON) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      pending: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
}

// ---------- queries ----------

export function bossDone(run: CandyRun): boolean {
   return !run.boss || run.boss.step === "done";
}

export function bossVulnerable(run: CandyRun): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

/** Is a phase-tagged item there now (level 5: only in its boss phase, while he fights)? */
export function inPhase(run: CandyRun, phase: number): boolean {
   if (phase < 0) return true;
   const b = run.boss;
   return !!b && !bossDone(run) && b.phase === phase;
}

/** The lane under a sideways position. */
export function laneAt(x: number): number {
   return Math.round(x / LANE_W) + 1;
}

/** Is a side lane open to enter at s (its span, and its gate broken / phased)? */
export function sideLaneAt(run: CandyRun, lane: number, s: number): number {
   const sl = run.course.sideLanes;
   for (let i = 0; i < sl.length; i++) if (sl[i].lane === lane && s >= sl[i].s0 - 8 && s <= sl[i].s1) return i;
   return -1;
}

/**
 * Where the runner is drawn (m down the road): its s plus every palace lap it has run, so the world
 * never jumps back when level 5's palace repeats (the palace is drawn again one lap on each lap).
 */
export function visualS(run: CandyRun, s = run.runner.s): number {
   const l = run.course.loop;
   return l ? s + run.lap * (l.s1 - l.s0) : s;
}

/** Where an item at course s is drawn this lap (items past the palace move on with the laps). */
export function itemVisualS(run: CandyRun, s: number): number {
   const l = run.course.loop;
   if (!l || s < l.s0) return s;
   return s + run.lap * (l.s1 - l.s0);
}

/** The run speed now (m/s): the level's, halved for 0.8 s after a size miss. */
export function speedNow(run: CandyRun, ms = run.ms): number {
   return run.course.config.speed * (ms < run.runner.slowUntil ? SLOW : 1);
}

function onIce(run: CandyRun, s: number): boolean {
   for (const i of run.course.ice) if (s >= i.s0 && s <= i.s1) return true;
   return false;
}

function onRailSpan(run: CandyRun, s: number): boolean {
   for (const r of run.course.rails) if (s >= r.s0 && s <= r.s1) return true;
   return false;
}

// ---------- the step ----------

function setSize(run: CandyRun, size: Size, ms: number): void {
   const r = run.runner;
   if (size === r.size) return;
   const ev = run.events;
   if (size > r.size) ev.grew = true;
   else ev.shrank = true;
   r.size = size;
   r.sizeAt = ms;
   r.eaten = 0;
   if (size === BIG) run.bigSince = ms;
   else run.bigSince = -1;
}

function sizeMiss(run: CandyRun, ms: number, index: number): void {
   const r = run.runner;
   run.misses += 1;
   run.hits += 1;
   run.events.miss = index;
   r.slowUntil = ms + SLOW_MS;
   r.invulnUntil = ms + INVULN_MS;
   comboBreak(run.combo);
}

function knockDown(run: CandyRun, ms: number): void {
   const r = run.runner;
   run.hits += 1;
   r.invulnUntil = ms + INVULN_MS;
   comboBreak(run.combo);
   if (r.size > SMALL) setSize(run, (r.size - 1) as Size, ms);
}

function tryPower(run: CandyRun, ms: number): void {
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") return;
   if (ms < run.powerReadyAt) return;
   if (def.power === "dash") run.dashUntil = ms + POWER_MS.dash;
   else if (def.power === "shield") run.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") run.magnetOn = !run.magnetOn;
   else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   run.events.powered = true;
}

function startSwap(run: CandyRun, to: number, ms: number): void {
   const r = run.runner;
   r.fromX = r.x;
   r.lane = to;
   r.swapAt = ms;
   r.swapMs = onIce(run, r.s) ? ICE_LANE_MS : LANE_MS;
   run.events.swapped = true;
}

function passed(a: number, b: number, s: number): boolean {
   return a < s && s <= b;
}

function substep(run: CandyRun, ms: number, input: StepInput, first: boolean, dtMs: number): void {
   const r = run.runner;
   const co = run.course;
   const ev = run.events;
   const dt = dtMs / 1000;
   comboTick(run.combo, COMBO, ms);

   if (first && input.actionPressed) {
      if (run.heroId === "nami" && r.h > 0.05 && !r.onRail && r.airHops < 1) {
         r.vy = V_HOP;
         r.airHops += 1;
         ev.airHopped = true;
      } else tryPower(run, ms);
   }
   // lane changes (one per press; side lanes only where they run, past their gate)
   if (first && (input.left || input.right) && !r.onRail) {
      const to = r.lane + (input.left ? -1 : 1);
      if (to >= 0 && to <= 2) startSwap(run, to, ms);
      else if (to === -1 || to === 3) {
         if (sideLaneAt(run, to, r.s) >= 0) startSwap(run, to, ms);
         else ev.blocked = true;
      }
   }
   // a side lane ends: back onto the road
   if (r.lane === -1 || r.lane === 3) {
      const i = sideLaneAt(run, r.lane, r.s);
      if (i < 0) startSwap(run, r.lane === -1 ? 0 : 2, ms);
   }
   const tx = laneX(r.lane);
   if (r.swapAt >= 0) {
      const k = Math.min(1, (ms - r.swapAt) / r.swapMs);
      r.x = r.fromX + (tx - r.fromX) * k;
      if (k >= 1) r.swapAt = -1;
   } else r.x = tx;

   // the jump: buffered; Nami's second hop (Jump in the air)
   if (first && input.jumpPressed) {
      if (r.h <= 0.001 || r.onRail) r.bufferUntil = ms + BUFFER_MS;
      else if (run.heroId === "nami" && r.airHops < 1) {
         r.vy = V_HOP;
         r.airHops += 1;
         ev.airHopped = true;
      }
   }
   if (r.bufferUntil >= ms && (r.h <= 0.001 || r.onRail)) {
      r.vy = V_HOP;
      r.onRail = false;
      r.bufferUntil = -1;
      r.airHops = 0;
      ev.hopped = true;
   }

   // the sugar-burn roll (held: one size down per 0.6 s, on the ground)
   r.rolling = input.roll && r.h <= 0.001 && !r.onRail;
   if (r.rolling && r.size > SMALL) {
      r.burnMs += dtMs;
      if (r.burnMs >= BURN_MS) {
         r.burnMs = 0;
         setSize(run, (r.size - 1) as Size, ms);
      }
   } else r.burnMs = 0;

   // forward
   const a = r.s;
   r.s += speedNow(run, ms) * dt;
   const b = r.s;

   // up and down (the rail holds Nami up while it runs)
   if (r.onRail && !onRailSpan(run, b)) r.onRail = false;
   if (!r.onRail && (r.h > 0 || r.vy > 0)) {
      const prev = r.h;
      r.vy -= G * dt;
      r.h += r.vy * dt;
      if (r.vy <= 0 && r.lane === 1 && laneAt(r.x) === 1 && onRailSpan(run, b) && prev >= RAIL_Y - 0.05 && r.h <= RAIL_Y) {
         r.h = RAIL_Y;
         r.vy = 0;
         r.onRail = true;
         r.airHops = 0;
         ev.railOn = true;
      } else if (r.h <= 0) {
         r.h = 0;
         r.vy = 0;
         r.airHops = 0;
         ev.landed = true;
      }
   }
   const ground = r.h <= 0.001;
   const lane = laneAt(r.x);
   const inLane = (l: number) => Math.abs(r.x - laneX(l)) < LANE_HALF;

   // obstacles: met as you pass them in their lane
   for (let i = 0; i < co.obstacles.length; i++) {
      const o = co.obstacles[i];
      if (o.s > b + 1 || !passed(a, b, o.s)) continue;
      if (!inPhase(run, o.phase) || run.metLap[i] === run.lap) continue;
      if (!inLane(o.lane) || r.onRail) continue;
      run.metLap[i] = run.lap;
      const need = needOf(o.kind);
      if (r.size === need) {
         ev.cleared = i;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.size);
         ev.comboLinked = true;
         if (isBossTarget(o.kind) && run.boss && run.bossAwake && run.boss.hp > 0 && run.pending === 0) {
            run.pending = 1;
            ev.bossCharge = i;
         }
      } else if (ms >= r.invulnUntil) sizeMiss(run, ms, i);
   }

   // candy coins (eaten as you pass in their lane, or pulled by Zuno's magnet): 3 grow you a size
   for (let i = 0; i < co.coins.length; i++) {
      const c = co.coins[i];
      if (c.s > b + MAGNET_REACH || c.s < a - MAGNET_REACH) continue;
      if (run.coinLap[i] === run.lap || !inPhase(run, c.phase)) continue;
      const dx = laneX(c.lane) - r.x;
      const ds = c.s - b;
      const near = run.magnetOn ? dx * dx + ds * ds <= MAGNET_REACH * MAGNET_REACH : Math.abs(dx) < LANE_HALF && Math.abs(ds) < COIN_R && r.h < 1.6;
      if (!near) continue;
      run.coinLap[i] = run.lap;
      if (ev.coinCount < ev.coinList.length) ev.coinList[ev.coinCount++] = i;
      if (r.size < BIG) {
         r.eaten += 1;
         if (r.eaten >= COINS_PER_SIZE) setSize(run, (r.size + 1) as Size, ms);
      }
   }

   // orbs
   for (let i = 0; i < co.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = co.orbs[i];
      if (o.s > b + MAGNET_REACH || o.s < a - MAGNET_REACH) continue;
      const dx = laneX(o.lane) - r.x;
      const ds = o.s - b;
      const dy = o.h - (r.h + 0.8);
      const reach = run.magnetOn ? MAGNET_REACH : ORB.pickup;
      if (o.magnet && !run.magnetOn) continue;
      if (dx * dx + ds * ds + (run.magnetOn ? 0 : dy * dy) > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
      ev.comboLinked = true;
   }

   // the side-lane gates: Riko's gingerbread wall breaks to a Big dash; Vexa's ghost wall to her phase
   for (let i = 0; i < co.sideLanes.length; i++) {
      const sl = co.sideLanes[i];
      if (run.gateOpen[i] || !passed(a, b, sl.s0) || !inLane(sl.lane)) continue;
      const opens = sl.gate === "cracked" ? ms <= run.dashUntil && r.size === BIG : ms <= run.phaseUntil;
      if (opens) {
         run.gateOpen[i] = 1;
         ev.gateBroken = i;
      } else {
         // bounced back onto the road (no hit)
         startSwap(run, sl.lane === -1 ? 0 : 2, ms);
         ev.blocked = true;
      }
   }

   // level 2: chocolate bridges crack under Big (a size miss); donuts bounce a Small hero high
   for (let i = 0; i < co.bridges.length; i++) {
      const br = co.bridges[i];
      if (run.bridgeCracked[i] || b < br.s0 || a > br.s1 || !inLane(br.lane) || !ground) continue;
      if (r.size === BIG) {
         run.bridgeCracked[i] = 1;
         ev.cracked = i;
         run.bigSince = -1;
         if (ms >= r.invulnUntil) sizeMiss(run, ms, -1);
      }
   }
   for (const d of co.donuts) {
      if (!passed(a, b, d.s) || !inLane(d.lane) || !ground) continue;
      if (r.size === SMALL) {
         r.vy = V_DONUT;
         r.h = 0.01;
         ev.bounced = true;
      }
   }
   // level 4: gummies bite (down a size); a jump onto a head grows you a size
   for (let i = 0; i < co.gummies.length; i++) {
      const g = co.gummies[i];
      if (run.gummyDone[i] || !passed(a, b, g.s) || !inLane(g.lane)) continue;
      run.gummyDone[i] = 1;
      if (r.h > 0.7 && r.vy <= 0) {
         ev.stomped = true;
         r.vy = V_HOP * 0.8;
         if (r.size < BIG) setSize(run, (r.size + 1) as Size, ms);
      } else if (r.h <= 0.7 && ms >= r.invulnUntil) {
         ev.bitten = true;
         knockDown(run, ms);
      }
   }
   // popping-candy fields: knocked down a size unless Kiro's shield is up
   for (let i = 0; i < co.fields.length; i++) {
      const f = co.fields[i];
      if (run.fieldDone[i] || b < f.s0 || a > f.s1 || !inLane(f.lane) || !ground) continue;
      run.fieldDone[i] = 1;
      if (ms <= run.shieldUntil) ev.absorbed = true;
      else if (ms >= r.invulnUntil) {
         ev.popped = true;
         knockDown(run, ms);
      }
   }

   // secrets: the fourth-lane shard; the sugar giant (level 2); the secret exit (level 3: Small through its arch)
   for (let i = 0; i < co.secrets.length; i++) {
      const sp = co.secrets[i];
      if (run.secrets.found[i]) continue;
      const id = SECRETS[run.level][i]?.id;
      let got = false;
      if (id === "giant") got = r.size === BIG && run.bigSince >= 0 && ms - run.bigSince >= GIANT_MS;
      else if (id === "exit") got = passed(a, b, sp.s) && inLane(sp.lane) && r.size === SMALL;
      else got = Math.abs(sp.s - b) < SECRET_R && inLane(sp.lane);
      if (got && collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }

   bossWorld(run, dtMs);

   // level 5's palace repeats until the king is free
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
   void lane;
}

function bossWorld(run: CandyRun, dtMs: number): void {
   const co = run.course;
   const b = run.boss;
   if (!b || !co.loop) return;
   const ev = run.events;
   if (!run.bossAwake) {
      if (run.runner.s < co.loop.s0) return;
      run.bossAwake = true;
      ev.bossWoke = true;
   }
   const before = b.phase;
   stepBoss(b, KING_BONBON, dtMs, run.bossEv);
   if (run.bossEv.telegraph) ev.bossTelegraph = true;
   if (run.bossEv.attack) ev.bossAttack = true;
   if (b.step === "vulnerable" && run.pending > 0 && b.hp > 0) {
      const r = hitBoss(b, KING_BONBON, 1, run.bossEv);
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

/** One frame (dtMs = useRunFrame's dt x 1000). Returns run.events (the same object every step). */
export function step(run: CandyRun, dtMs: number, input: StepInput): StepEvents {
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
   size: "size",
   eaten: "eaten",
   burn: "burn",
   progress: "progress",
   misses: "misses",
   finishMs: "finishMs",
   hits: "hits",
   hero: "hero",
   power: "power",
   sign: "sign",
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

/** The most orbs one hero can take: the road's and the donuts', plus its own hero route. */
export function maxOrbs(c: Course): number {
   const open = c.orbs.filter((o) => o.bonus === null || o.bonus === "donut" || o.bonus === "kiro").length;
   const own = Math.max(...(["riko", "nami", "zuno", "vexa"] as const).map((h) => c.orbs.filter((o) => o.bonus === h).length));
   return open + own;
}

/** What the course can feed the flow meter: every orb one hero can take, and every obstacle met right once. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const once = c.obstacles.filter((o) => o.phase < 0).length;
   // the palace's beats count once per lap: a lap is at least its length at the run speed
   const laps = c.loop ? Math.ceil(bossMinMs() / (((c.loop.s1 - c.loop.s0) / c.config.speed) * 1000)) + 1 : 0;
   const palace = c.obstacles.filter((o) => o.phase >= 0).length * laps;
   return { combo: COMBO, sources: [{ count: maxOrbs(c), base: COMBO_BASE_MS.orb }, { count: once + palace, base: COMBO_BASE_MS.size }] };
}

/** King Bonbon's least defeat time (ms) once woken: a hit in the first ms of every open window. */
export function bossMinMs(): number {
   const b = createBoss(KING_BONBON);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000 && b.step !== "done"; guard++) {
      stepBoss(b, KING_BONBON, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, KING_BONBON, 1, ev);
   }
   return ms;
}

/**
 * The least finish (ms): the hero never runs faster than the level's speed (a miss only slows it), so
 * the road's length at that speed is a floor (one substep of slack); level 5 adds the king: once he
 * wakes at the palace's start, the hero cannot leave it before his least defeat time (or one lap).
 */
export function minFinishMs(c: Course): number {
   const v = c.config.speed;
   if (!c.loop) return (c.finishS / v) * 1000 - STEP_MS;
   const lap = ((c.loop.s1 - c.loop.s0) / v) * 1000;
   return (c.loop.s0 / v) * 1000 + Math.max(lap, bossMinMs()) + ((c.finishS - c.loop.s1) / v) * 1000 - STEP_MS;
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

/** The level's limits row: the bound less 4.5 %, to the 100 ms below. */
export function proposeLimits(c: Course): LevelLimits {
   const minDurationMs = Math.max(0, Math.floor((minDurationMsOf(c) * 0.955) / 100) * 100);
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

/** The no-hit badge: misses, bites and popped fields. */
export function badgeHits(run: CandyRun): number {
   return run.hits;
}

export { LEVELS } from "./levels";

