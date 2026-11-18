// Laser Maze Run's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the
// same run, at any frame rate (the simulation advances in fixed STEP_MS steps).
//
// The signature mechanic (card GAME 38, "navigate through a laser maze using timing, jumps and phase
// windows"): the hero walks freely (5.5 m/s) down a corridor of laser rooms. A laser touched is a hit:
// back to the room's checkpoint pad, 0.7 s frozen. Low beams are jumped; full walls are timed (pulses),
// found through (gaps), switched off (gates: E on a switch pad) or, for Nyla, cleared with a second jump;
// low beams sliding along a room are jumped as they pass; barriers slide across and block; live floor
// tiles burn. Phasing Vexa passes through every beam; Kiro's shield soaks touches for 1.2 s. Level 5's
// Vault Core sweeps its arena and is overloaded from its pylons while it is open.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, stepProgress, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { inputToWorld } from "@/arcade3d/core/math";
import { HALF, LOW, courseFor, type Course } from "./course";
import { DASH_X, DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, SECRETS, VAULT_CORE } from "./progression";

export type { Course } from "./course";
export { courseFor } from "./course";

// ---------- tuning ----------

export const STEP_MS = 4;
export const MAX_FRAME_MS = 50;
/** the walk (m/s); Riko's dash x1.6 */
export const SPEED = 5.5;
/** a jump: apex 1.125 m, 0.6 s (Nyla's second jump reaches 2.25 m: over a full wall) */
export const V_HOP = 7.5;
export const G = 25;
/** the hero's body: a capsule this wide (radius) and this tall */
export const BODY_R = 0.35;
export const BODY_H = 1.5;
/** a hit: back to the checkpoint, frozen this long, then blinking this long */
export const HELD_MS = 700;
export const INVULN_MS = 1500;
/** a switch is in reach this close */
export const SWITCH_R = 1.3;
export const ORB = { pickup: 1.0, bonusMs: 100 } as const;
export const SECRET_R = 1.2;
/** a buffered jump press waits this long for the ground */
export const BUFFER_MS = 120;

// ---------- the run ----------

export interface Runner {
   x: number;
   s: number;
   h: number;
   vy: number;
   airHops: number;
   /** the last move (a unit-ish vector, x and forward s), for the facing; the velocity now (m/s) */
   faceX: number;
   faceS: number;
   vx: number;
   vs: number;
   heldUntil: number;
   invulnUntil: number;
   bufferUntil: number;
}

export interface StepInput {
   /** the stick / keys (core useInput: moveX right = 1, moveY up = -1), turned by the camera's yaw */
   moveX: number;
   moveY: number;
   /** the orbit camera's drawn yaw (0: behind the hero, looking down the corridor) */
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveY: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface StepEvents {
   hopped: boolean;
   airHopped: boolean;
   landed: boolean;
   /** a laser index that hit you (-1 none; -2 a live floor, -3 a barrier, -4 the core's sweep) */
   hit: number;
   /** a touch the shield soaked */
   soaked: boolean;
   respawned: boolean;
   /** a switch pressed (index), a decoy pressed */
   pressed: number;
   decoy: boolean;
   /** a zone crossed (index) and whether it was clean */
   zone: number;
   clean: boolean;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   powered: boolean;
   comboBonus: number;
   comboLinked: boolean;
   bossWoke: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossDone: boolean;
   finished: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      hopped: false, airHopped: false, landed: false, hit: -1, soaked: false, respawned: false, pressed: -1, decoy: false, zone: -1, clean: false,
      orbCount: 0, orbList: new Array<number>(8).fill(0), secretCount: 0, secretList: [0, 0, 0], powered: false, comboBonus: 0, comboLinked: false,
      bossWoke: false, bossTelegraph: false, bossAttack: false, bossHit: false, bossPhase: false, bossDefeated: false, bossDone: false, finished: false, timeup: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.hopped = e.airHopped = e.landed = e.soaked = e.respawned = e.decoy = e.clean = false;
   e.hit = e.pressed = e.zone = -1;
   e.orbCount = e.secretCount = 0;
   e.powered = false;
   e.comboBonus = 0;
   e.comboLinked = false;
   e.bossWoke = e.bossTelegraph = e.bossAttack = e.bossHit = e.bossPhase = e.bossDefeated = e.bossDone = false;
   e.finished = e.timeup = false;
}

export interface LaserRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   runner: Runner;
   /** per laser: a gate is off until (ms); a gate (or a sleeping sweep) turned on by a switch, until (ms; Infinity for good) */
   offUntil: Float64Array;
   onUntil: Float64Array;
   /** the room you are in, its checkpoint, whether you crossed it without a hit */
   zone: number;
   cp: number;
   clean: boolean;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   hits: number;
   zonesClean: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): LaserRun {
   const course = courseFor(level);
   return {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      runner: { x: 0, s: 0, h: 0, vy: 0, airHops: 0, faceX: 0, faceS: 1, vx: 0, vs: 0, heldUntil: -1, invulnUntil: -1, bufferUntil: -1 },
      offUntil: new Float64Array(course.lasers.length).fill(-1),
      onUntil: new Float64Array(course.lasers.length).fill(-1),
      zone: 0,
      cp: course.zones[0].cp,
      clean: true,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      hits: 0,
      zonesClean: 0,
      powerReadyAt: 0,
      dashUntil: -1,
      shieldUntil: -1,
      magnetUntil: -1,
      phaseUntil: -1,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      boss: course.arena ? createBoss(VAULT_CORE) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
}

// ---------- queries ----------

export function bossDone(run: LaserRun): boolean {
   return !run.boss || run.boss.step === "done";
}

export function bossOpen(run: LaserRun): boolean {
   const b = run.boss;
   return !!b && run.bossAwake && b.step === "vulnerable" && b.hp > 0;
}

/** Where a laser runs now (a sweep slides; the rest stay at their s). */
export function laserS(run: LaserRun, i: number, ms = run.ms): number {
   const l = run.course.lasers[i];
   if (l.kind !== "sweep") return l.s;
   const len = l.s1 - l.s;
   const d = ((l.speed * ms) / 1000) % (2 * len);
   return l.s + (d < len ? d : 2 * len - d);
}

/** Is laser i live now? */
export function laserOn(run: LaserRun, i: number, ms = run.ms): boolean {
   const l = run.course.lasers[i];
   if (l.kind === "pulse") return (ms + l.offset) % l.period < l.onMs;
   if (l.kind === "sweep") return l.startsOn || run.onUntil[i] > ms;
   if (l.kind === "gate") {
      const a = run.course.arena;
      if (a && a.exit === i) return !bossDone(run);
      if (run.offUntil[i] > ms) return false;
      return l.startsOn || run.onUntil[i] > ms;
   }
   return true;
}

/** A pulse's time until it changes (ms) and whether it is on. */
export function pulseLeft(run: LaserRun, i: number, ms = run.ms): number {
   const l = run.course.lasers[i];
   const t = (ms + l.offset) % l.period;
   return t < l.onMs ? l.onMs - t : l.period - t;
}

/** The core's sweep across the arena (its s), while it attacks; NaN otherwise. */
export function coreSweepS(run: LaserRun): number {
   const b = run.boss;
   const a = run.course.arena;
   if (!b || !a || !run.bossAwake || b.step !== "attack") return NaN;
   const k = stepProgress(b, VAULT_CORE);
   const from = a.coreS - 2;
   const to = a.s0 + 4;
   return from + (to - from) * k;
}

/** The barrier's centre x now. */
export function barrierX(run: LaserRun, i: number, ms = run.ms): number {
   const b = run.course.barriers[i];
   return b.amp * Math.sin((2 * Math.PI * ms) / b.period + b.offset);
}

/** The switch in reach (nearest within SWITCH_R), else -1. */
export function switchNear(run: LaserRun, x = run.runner.x, s = run.runner.s): number {
   let best = -1;
   let bd = SWITCH_R * SWITCH_R;
   const sw = run.course.switches;
   for (let i = 0; i < sw.length; i++) {
      const dx = sw[i].x - x;
      const ds = sw[i].s - s;
      const d = dx * dx + ds * ds;
      if (d < bd) {
         bd = d;
         best = i;
      }
   }
   return best;
}

export function dashing(run: LaserRun, ms = run.ms): boolean {
   return ms < run.dashUntil;
}

function heightOverlap(h: number, y0: number, y1: number): boolean {
   return h < y1 && h + BODY_H > y0;
}

/** Does live laser i touch the hero at (x, s, h)? */
export function laserTouches(run: LaserRun, i: number, x: number, s: number, h: number, ms = run.ms): boolean {
   if (!laserOn(run, i, ms)) return false;
   const l = run.course.lasers[i];
   if (!heightOverlap(h, l.y0, l.y1)) return false;
   if (l.along) return Math.abs(x - l.x0) < BODY_R && s > l.s - BODY_R && s < l.s1 + BODY_R;
   const ls = laserS(run, i, ms);
   return Math.abs(s - ls) < BODY_R && x > l.x0 - BODY_R && x < l.x1 + BODY_R;
}

// ---------- the step ----------

const WORLD = { x: 0, z: 0 };

function respawn(run: LaserRun, ms: number, cause: number): void {
   const r = run.runner;
   run.hits += 1;
   run.clean = false;
   run.events.hit = cause;
   run.events.respawned = true;
   r.x = 0;
   r.s = run.cp;
   r.h = 0;
   r.vy = 0;
   r.heldUntil = ms + HELD_MS;
   r.invulnUntil = ms + INVULN_MS;
   comboBreak(run.combo);
}

/** A touch: soaked by the shield (not a cage), passed by a phase (not a floor), else a hit. */
function touched(run: LaserRun, ms: number, cause: number, cage: boolean, floor: boolean): boolean {
   if (!floor && ms < run.phaseUntil) return false;
   if (!cage && ms < run.shieldUntil) {
      run.events.soaked = true;
      return false;
   }
   if (ms < run.runner.invulnUntil) return false;
   respawn(run, ms, cause);
   return true;
}

function tryPower(run: LaserRun, ms: number): void {
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

function press(run: LaserRun, ms: number, i: number): void {
   const sw = run.course.switches[i];
   const ev = run.events;
   ev.pressed = i;
   const a = run.course.arena;
   if (a && a.pylons.includes(i)) {
      const b = run.boss;
      if (b && bossOpen(run)) {
         const res = hitBoss(b, VAULT_CORE, 1, run.bossEv);
         if (res !== "ignored") {
            ev.bossHit = true;
            if (res === "phase") ev.bossPhase = true;
            if (res === "defeated") ev.bossDefeated = true;
            ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.zone);
            ev.comboLinked = true;
         }
      }
      return;
   }
   for (const g of sw.off) run.offUntil[g] = ms + sw.ms;
   for (const g of sw.on) run.onUntil[g] = run.course.lasers[g].kind === "sweep" ? ms + sw.ms : Infinity;
   if (sw.decoy) ev.decoy = true;
}

function substep(run: LaserRun, ms: number, input: StepInput, first: boolean, dtMs: number): void {
   const r = run.runner;
   const co = run.course;
   const ev = run.events;
   const dt = dtMs / 1000;
   comboTick(run.combo, COMBO, ms);
   const held = ms < r.heldUntil;

   // Action: a switch in reach, else the power; Nyla's second jump is Jump (or Action) in the air
   if (first && input.actionPressed && !held) {
      const sw = switchNear(run);
      if (sw >= 0) press(run, ms, sw);
      else if (run.heroId === "nami" && r.h > 0.05 && r.airHops < 1) airJump(run);
      else tryPower(run, ms);
   }
   if (first && input.jumpPressed && !held) {
      if (r.h <= 0.001) r.bufferUntil = ms + BUFFER_MS;
      else if (run.heroId === "nami" && r.airHops < 1) airJump(run);
   }
   if (!held && r.bufferUntil >= ms && r.h <= 0.001) {
      r.vy = V_HOP;
      r.bufferUntil = -1;
      r.airHops = 0;
      ev.hopped = true;
   }

   // the walk
   const a = r.s;
   const ax = r.x;
   r.vx = r.vs = 0;
   if (!held) {
      inputToWorld(Number.isFinite(input.moveX) ? input.moveX : 0, Number.isFinite(input.moveY) ? input.moveY : 0, Number.isFinite(input.yaw) ? input.yaw : 0, WORLD);
      let mx = WORLD.x;
      let mz = -WORLD.z;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
         mx /= len;
         mz /= len;
      }
      const v = SPEED * (ms < run.dashUntil ? DASH_X : 1);
      r.vx = mx * v;
      r.vs = mz * v;
      r.x += mx * v * dt;
      r.s += mz * v * dt;
      if (len > 0.1) {
         r.faceX = mx;
         r.faceS = mz;
      }
      r.x = Math.max(-HALF + BODY_R, Math.min(HALF - BODY_R, r.x));
      r.s = Math.max(0, r.s);
   }
   // up and down
   if (r.h > 0 || r.vy > 0) {
      r.vy -= G * dt;
      r.h += r.vy * dt;
      if (r.h <= 0) {
         r.h = 0;
         r.vy = 0;
         r.airHops = 0;
         ev.landed = true;
      }
   }

   // barriers: solid (blocked back; pushed aside; crushed against the wall is a hit)
   for (let i = 0; i < co.barriers.length; i++) {
      const b = co.barriers[i];
      if (Math.abs(r.s - b.s) > 0.3 + BODY_R) continue;
      const c = barrierX(run, i, ms);
      const hw = b.width / 2 + BODY_R;
      if (Math.abs(r.x - c) >= hw || r.h > 1.2) continue;
      if (Math.abs(a - b.s) >= 0.3 + BODY_R || Math.abs(ax - c) >= hw) {
         r.s = a;
         r.x = ax;
      }
      if (Math.abs(r.s - b.s) < 0.3 + BODY_R && Math.abs(r.x - c) < hw) {
         const nx = r.x < c ? c - hw : c + hw;
         if (nx < -HALF + BODY_R || nx > HALF - BODY_R) {
            if (!held && ms >= r.invulnUntil) respawn(run, ms, -3);
         } else r.x = nx;
      }
   }

   // lasers
   if (!held) {
      for (let i = 0; i < co.lasers.length; i++) {
         const l = co.lasers[i];
         if (!l.along && Math.abs(laserS(run, i, ms) - r.s) > 1) continue;
         if (laserTouches(run, i, r.x, r.s, r.h, ms)) {
            if (touched(run, ms, i, l.kind === "cage", false)) break;
         }
      }
   }
   // live floor tiles
   if (!held && r.h <= 0.02 && ms >= r.heldUntil) {
      for (const f of co.floors) {
         if (r.x > f.x0 && r.x < f.x1 && r.s > f.s0 && r.s < f.s1) {
            touched(run, ms, -2, false, true);
            break;
         }
      }
   }

   // the rooms: a zone crossed (clean: a flow link), the next checkpoint
   const zones = co.zones;
   while (run.zone < zones.length - 1 && r.s >= zones[run.zone + 1].s0) {
      ev.zone = run.zone;
      ev.clean = run.clean;
      if (run.clean) {
         run.zonesClean += 1;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.zone);
         ev.comboLinked = true;
      }
      run.zone += 1;
      run.cp = zones[run.zone].cp;
      run.clean = true;
   }

   // orbs (Zuno's magnet pulls the caged and the walkway orbs in, never the high ones)
   const magnet = ms < run.magnetUntil;
   for (let i = 0; i < co.orbs.length; i++) {
      const o = co.orbs[i];
      if (o.s > r.s + MAGNET_REACH) break;
      if (run.collected[i] || o.s < r.s - MAGNET_REACH) continue;
      const dx = o.x - r.x;
      const ds = o.s - r.s;
      const dy = o.h - (r.h + 0.8);
      const pulled = magnet && (o.magnet || o.bonus === null) && dx * dx + ds * ds <= MAGNET_REACH * MAGNET_REACH;
      if (!pulled) {
         if (o.magnet && ms >= run.phaseUntil) continue;
         if (dx * dx + ds * ds + dy * dy > ORB.pickup * ORB.pickup) continue;
      }
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
      ev.comboLinked = true;
   }
   // secrets
   for (let i = 0; i < co.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const sp = co.secrets[i];
      const dx = sp.x - r.x;
      const ds = sp.s - r.s;
      const dy = sp.h - (r.h + 0.8);
      if (dx * dx + ds * ds + dy * dy < SECRET_R * SECRET_R && collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }

   bossWorld(run, ms, held);

   if (r.s >= co.finishS && bossDone(run) && run.ended === null) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

function airJump(run: LaserRun): void {
   const r = run.runner;
   r.vy = V_HOP;
   r.airHops += 1;
   run.events.airHopped = true;
}

function bossWorld(run: LaserRun, ms: number, held: boolean): void {
   const co = run.course;
   const boss = run.boss;
   const a = co.arena;
   if (!boss || !a) return;
   const ev = run.events;
   const r = run.runner;
   if (!run.bossAwake) {
      if (r.s < a.s0 + 2) return;
      run.bossAwake = true;
      ev.bossWoke = true;
   }
   const before = boss.phase;
   stepBoss(boss, VAULT_CORE, STEP_MS, run.bossEv);
   if (run.bossEv.telegraph) ev.bossTelegraph = true;
   if (run.bossEv.attack) ev.bossAttack = true;
   if (boss.phase !== before) ev.bossPhase = true;
   if (run.bossEv.done) ev.bossDone = true;
   // the core's sweep: a low beam crossing the arena
   const cs = coreSweepS(run);
   if (!held && Number.isFinite(cs) && Math.abs(r.s - cs) < BODY_R && heightOverlap(r.h, LOW[0], LOW[1])) touched(run, ms, -4, false, false);
}

/** One frame (dtMs = useRunFrame's dt x 1000). Returns run.events (the same object every step). */
export function step(run: LaserRun, dtMs: number, input: StepInput): StepEvents {
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
   zone: "zone",
   hits: "hits",
   finishMs: "finishMs",
   hero: "hero",
   power: "power",
   near: "near",
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

/** Which routes each hero can take (the gates the proof relies on). */
export const ROUTES: Record<HeroId, readonly string[]> = {
   riko: ["dash", "floor"],
   nami: ["high", "dash", "floor"],
   kiro: ["floor", "dash"],
   zuno: ["cage"],
   vexa: ["cage"],
};

/** The most orbs one hero can take: the main path's, plus its own routes'. */
export function maxOrbs(c: Course): number {
   const main = c.orbs.filter((o) => o.bonus === null).length;
   const own = Math.max(...(Object.keys(ROUTES) as HeroId[]).map((h) => c.orbs.filter((o) => o.bonus !== null && ROUTES[h].includes(o.bonus)).length));
   return main + own;
}

/** What the course can feed the flow meter: every orb one hero can take, every zone crossed clean, every core hit. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const hits = c.arena ? VAULT_CORE.maxHp : 0;
   return { combo: COMBO, sources: [{ count: maxOrbs(c), base: COMBO_BASE_MS.orb }, { count: c.zones.length + hits, base: COMBO_BASE_MS.zone }] };
}

/** The Vault Core's least defeat time (ms) once woken: a hit in the first ms of every open window. */
export function bossMinMs(): number {
   const b = createBoss(VAULT_CORE);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000 && b.step !== "done"; guard++) {
      stepBoss(b, VAULT_CORE, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, VAULT_CORE, 1, ev);
   }
   return ms;
}

/**
 * The least time (ms) to cover d metres down the corridor: never faster than the walk, except Riko's dash
 * (x1.6 for 0.6 s, at most once every 5 s from the first frame).
 */
export function leastRunMs(d: number): number {
   const v = SPEED;
   const extra = (DASH_X - 1) * (POWER_MS.dash / 1000);
   const per = heroById("riko").cooldownMs / 1000;
   return Math.max(0, ((d / v - extra) / (1 + extra / per)) * 1000);
}

/**
 * The least finish (ms): the corridor's length at the fastest pace; level 5 adds the Vault Core: it wakes
 * as you enter its arena, and the exit beam stays on until its least defeat time has passed.
 */
export function minFinishMs(c: Course): number {
   if (!c.arena) return leastRunMs(c.finishS) - STEP_MS;
   return leastRunMs(c.arena.s0 + 2) + bossMinMs() - STEP_MS;
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

/** The no-hit badge: never touched a laser. */
export function badgeHits(run: LaserRun): number {
   return run.hits;
}

export { LEVELS } from "./levels";
