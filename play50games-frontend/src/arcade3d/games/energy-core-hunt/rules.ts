// Energy Core Hunt's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same level + hero + inputs always give the same run,
// at any frame rate (the simulation advances in fixed STEP_MS steps).
//
// The signature mechanic (card GAME 29, "collect a requested combination of coloured energy cores"): the
// hero walks freely (6 m/s) round the arena. The ORDER asks for so many cores of each colour; cores drop
// in waves (1 s to land), and the next wave drops as soon as this one's share of the order is in. A core
// of a colour that is already full (or a flickering decoy) is a WRONG PICK: a jolt (0.8 s stunned) and a
// hit. A core left too long fades and drops again across the arena (level 2 on); some orbit a pylon or
// sit sealed in a capsule (Action opens it; level 3 on); tesla coils zap round them (level 4 on). When the
// order is complete the core gate opens: walk into it. Level 5: the Core Sprite holds the last cores.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, stepProgress, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { CRATE_H, CRATE_R, courseFor, type CoreDef, type Course } from "./course";
import { DASH_X, DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, CORE_SPRITE, SECRETS } from "./progression";

export type { Course } from "./course";
export { courseFor } from "./course";

// ---------- tuning ----------

export const STEP_MS = 4;
export const MAX_FRAME_MS = 50;
/** the walk (m/s); Riko's dash x1.6 */
export const SPEED = 6;
export const V_HOP = 7.5;
export const G = 25;
export const BODY_R = 0.4;
/** a core lands this long after its wave drops (it cannot be taken while it falls) */
export const DROP_MS = 1000;
/** a faded core is gone this long before it lands again */
export const FADE_MS = 600;
/** a core is taken this close; a capsule opens with Action this close */
export const PICK_R = 1.0;
export const CAPSULE_R = 1.6;
/** an orbiting core circles its pylon this far out, this fast (rad/s) */
export const ORBIT_R = 1.5;
export const ORBIT_W = 0.9;
/** a decoy flickers between its two colours this often */
export const FLICKER_MS = 700;
/** a wrong pick / a zap / a shock ring: stunned this long, then blinking */
export const STUN_MS = 800;
export const INVULN_MS = 1400;
/** the Core Sprite: touched this close while it is dazed; its shock ring spreads this far */
export const SPRITE_R = 1.7;
export const RING_MAX = 13;
export const GATE_R = 1.3;
export const ORB = { pickup: 1.0, bonusMs: 100 } as const;
export const SECRET_R = 1.0;
export const BUFFER_MS = 120;

// ---------- the run ----------

export interface Hero {
   x: number;
   z: number;
   h: number;
   vy: number;
   vx: number;
   vz: number;
   airHops: number;
   heldUntil: number;
   invulnUntil: number;
   bufferUntil: number;
}

export interface StepInput {
   /** the stick / keys (core useInput: moveX right = 1, moveY up = -1), turned by the camera's yaw */
   moveX: number;
   moveY: number;
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
   /** a core of the order taken (its colour, -1 none), a wrong pick (its colour), a decoy */
   took: number;
   wrong: number;
   decoy: boolean;
   zapped: boolean;
   shocked: boolean;
   soaked: boolean;
   /** a capsule opened, a wave dropped (its index), a core faded and dropped again */
   opened: boolean;
   wave: number;
   faded: boolean;
   gateOpen: boolean;
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
      hopped: false, airHopped: false, landed: false, took: -1, wrong: -1, decoy: false, zapped: false, shocked: false, soaked: false,
      opened: false, wave: -1, faded: false, gateOpen: false, orbCount: 0, orbList: new Array<number>(8).fill(0), secretCount: 0, secretList: [0, 0, 0],
      powered: false, comboBonus: 0, comboLinked: false, bossWoke: false, bossTelegraph: false, bossAttack: false, bossHit: false, bossPhase: false,
      bossDefeated: false, bossDone: false, finished: false, timeup: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.hopped = e.airHopped = e.landed = e.decoy = e.zapped = e.shocked = e.soaked = e.opened = e.faded = e.gateOpen = false;
   e.took = e.wrong = e.wave = -1;
   e.orbCount = e.secretCount = 0;
   e.powered = false;
   e.comboBonus = 0;
   e.comboLinked = false;
   e.bossWoke = e.bossTelegraph = e.bossAttack = e.bossHit = e.bossPhase = e.bossDefeated = e.bossDone = false;
   e.finished = e.timeup = false;
}

export interface CoreRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   hero: Hero;
   /** the wave in play (waves.length once every wave is in) and when it dropped */
   wave: number;
   /** per core of the wave in play: taken, (re)dropped at (ms), at its other spot, its capsule open */
   taken: Uint8Array;
   dropAt: Float64Array;
   alt: Uint8Array;
   open: Uint8Array;
   /** per colour: cores of the order in hand */
   count: number[];
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   hits: number;
   wrongs: number;
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
   /** the sprite's spot (it hops to a new one at each telegraph) */
   spriteSpot: number;
   gateOpen: boolean;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

const MAX_WAVE = 8;

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): CoreRun {
   const course = courseFor(level);
   const run: CoreRun = {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      hero: { x: course.start.x, z: course.start.z, h: 0, vy: 0, vx: 0, vz: 0, airHops: 0, heldUntil: -1, invulnUntil: -1, bufferUntil: -1 },
      wave: 0,
      taken: new Uint8Array(MAX_WAVE),
      dropAt: new Float64Array(MAX_WAVE),
      alt: new Uint8Array(MAX_WAVE),
      open: new Uint8Array(MAX_WAVE),
      count: [0, 0, 0, 0, 0],
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      hits: 0,
      wrongs: 0,
      powerReadyAt: 0,
      dashUntil: -1,
      shieldUntil: -1,
      magnetUntil: -1,
      phaseUntil: -1,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      boss: course.boss ? createBoss(CORE_SPRITE) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      spriteSpot: 0,
      gateOpen: false,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
   dropWave(run, 0);
   return run;
}

function dropWave(run: CoreRun, w: number): void {
   run.wave = w;
   run.taken.fill(0);
   run.alt.fill(0);
   run.open.fill(0);
   run.dropAt.fill(run.ms);
   run.events.wave = w;
}

// ---------- queries ----------

export function bossDone(run: CoreRun): boolean {
   return !run.boss || run.boss.step === "done";
}

export function bossOpen(run: CoreRun): boolean {
   const b = run.boss;
   return !!b && run.bossAwake && b.step === "vulnerable" && b.hp > 0;
}

/** The order so far, per colour: what the waves up to (and including) w ask for. */
export function quotaUpTo(c: Course, w: number): number[] {
   const q = [0, 0, 0, 0, 0];
   for (let i = 0; i <= w && i < c.waves.length; i++) for (let k = 0; k < 5; k++) q[k] += c.waves[i].quota[k];
   return q;
}

/** Is the wave in play's share of the order in? */
export function waveDone(run: CoreRun): boolean {
   if (run.wave >= run.course.waves.length) return true;
   const q = quotaUpTo(run.course, run.wave);
   for (let k = 0; k < 5; k++) if (run.count[k] < q[k]) return false;
   return true;
}

/** Would a core of colour c be wanted now (its colour not full yet)? */
export function wanted(run: CoreRun, color: number): boolean {
   if (run.wave >= run.course.waves.length) return false;
   return run.count[color] < quotaUpTo(run.course, run.wave)[color];
}

/** Where core i of the wave in play is now (an orbiting core circles its pylon). */
export function corePos(run: CoreRun, i: number, ms = run.ms, out = { x: 0, z: 0 }): { x: number; z: number } {
   const c = run.course.waves[run.wave]?.cores[i];
   if (!c) return out;
   const bx = run.alt[i] ? c.altX : c.x;
   const bz = run.alt[i] ? c.altZ : c.z;
   if (c.kind === "orbit") {
      const a = (ms / 1000) * ORBIT_W + i;
      out.x = bx + Math.cos(a) * ORBIT_R;
      out.z = bz + Math.sin(a) * ORBIT_R;
   } else {
      out.x = bx;
      out.z = bz;
   }
   return out;
}

/** Can core i be taken now (landed, not faded, not taken, its capsule open)? */
export function coreReady(run: CoreRun, i: number, ms = run.ms): boolean {
   const c = run.course.waves[run.wave]?.cores[i];
   if (!c || run.taken[i]) return false;
   if (ms < run.dropAt[i] + DROP_MS) return false;
   if (c.kind === "capsule" && !run.open[i]) return false;
   return true;
}

/** A decoy's colour now. */
export function decoyColor(run: CoreRun, d: { colors: [number, number] }, ms = run.ms): number {
   return d.colors[Math.floor(ms / FLICKER_MS) % 2];
}

export function teslaOn(run: CoreRun, i: number, ms = run.ms): boolean {
   const t = run.course.teslas[i];
   return (ms + t.offset) % t.period < t.onMs;
}

/** The Core Sprite's position. */
export function spritePos(run: CoreRun, out = { x: 0, z: 0 }): { x: number; z: number } {
   const b = run.course.boss;
   if (!b) return out;
   const k = run.spriteSpot;
   out.x = b.x + (k === 0 ? 0 : Math.cos(k * 2.1) * 5);
   out.z = b.z + (k === 0 ? 0 : Math.sin(k * 2.1) * 4);
   return out;
}

/** The sprite's shock ring radius while it attacks (NaN otherwise). */
export function shockRadius(run: CoreRun): number {
   const b = run.boss;
   if (!b || !run.bossAwake || b.step !== "attack") return NaN;
   return stepProgress(b, CORE_SPRITE) * RING_MAX;
}

export function dashing(run: CoreRun, ms = run.ms): boolean {
   return ms < run.dashUntil;
}

/** The crate under / at (x, z), else -1. */
export function crateAt(run: CoreRun, x: number, z: number, pad = 0): number {
   const cr = run.course.crates;
   for (let i = 0; i < cr.length; i++) if (Math.abs(x - cr[i].x) < CRATE_R + pad && Math.abs(z - cr[i].z) < CRATE_R + pad) return i;
   return -1;
}

// ---------- the step ----------

const WORLD = { x: 0, z: 0 };
const P = { x: 0, z: 0 };

function stun(run: CoreRun, ms: number): void {
   const h = run.hero;
   run.hits += 1;
   h.heldUntil = ms + STUN_MS;
   h.invulnUntil = ms + INVULN_MS;
   comboBreak(run.combo);
}

/** A zap or a shock: soaked by the shield, else a stun. */
function hurt(run: CoreRun, ms: number): boolean {
   if (ms < run.shieldUntil) {
      run.events.soaked = true;
      return false;
   }
   if (ms < run.hero.invulnUntil) return false;
   stun(run, ms);
   return true;
}

function tryPower(run: CoreRun, ms: number): void {
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

function airJump(run: CoreRun): void {
   const h = run.hero;
   h.vy = V_HOP;
   h.airHops += 1;
   run.events.airHopped = true;
}

/** The closed capsule in reach (its index in the wave), else -1. */
export function capsuleNear(run: CoreRun): number {
   const w = run.course.waves[run.wave];
   if (!w) return -1;
   for (let i = 0; i < w.cores.length; i++) {
      const c = w.cores[i];
      if (c.kind !== "capsule" || run.open[i] || run.taken[i] || run.ms < run.dropAt[i] + DROP_MS) continue;
      corePos(run, i, run.ms, P);
      if (Math.hypot(P.x - run.hero.x, P.z - run.hero.z) < CAPSULE_R) return i;
   }
   return -1;
}

function takeCore(run: CoreRun, ms: number, color: number): void {
   run.count[color] += 1;
   run.events.took = color;
   run.events.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.core);
   run.events.comboLinked = true;
}

function substep(run: CoreRun, ms: number, input: StepInput, first: boolean, dtMs: number): void {
   const h = run.hero;
   const co = run.course;
   const ev = run.events;
   const dt = dtMs / 1000;
   comboTick(run.combo, COMBO, ms);
   const held = ms < h.heldUntil;

   // Action: a capsule in reach opens; else the power (Nami's second jump in the air)
   if (first && input.actionPressed && !held) {
      const cap = capsuleNear(run);
      if (cap >= 0) {
         run.open[cap] = 1;
         ev.opened = true;
      } else if (run.heroId === "nami" && h.h > 0.05 && h.airHops < 1) airJump(run);
      else tryPower(run, ms);
   }
   if (first && input.jumpPressed && !held) {
      if (h.h <= 0.001) h.bufferUntil = ms + BUFFER_MS;
      else if (run.heroId === "nami" && h.airHops < 1) airJump(run);
   }
   if (!held && h.bufferUntil >= ms && h.h <= 0.001) {
      h.vy = V_HOP;
      h.bufferUntil = -1;
      h.airHops = 0;
      ev.hopped = true;
   }

   // the walk (crates are solid unless phasing; the arena's rim holds you in)
   h.vx = h.vz = 0;
   if (!held) {
      inputToWorld(Number.isFinite(input.moveX) ? input.moveX : 0, Number.isFinite(input.moveY) ? input.moveY : 0, Number.isFinite(input.yaw) ? input.yaw : 0, WORLD);
      let mx = WORLD.x;
      let mz = WORLD.z;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
         mx /= len;
         mz /= len;
      }
      const v = SPEED * (ms < run.dashUntil ? DASH_X : 1);
      h.vx = mx * v;
      h.vz = mz * v;
      const nx = h.x + h.vx * dt;
      const nz = h.z + h.vz * dt;
      const phase = ms < run.phaseUntil;
      const blocked = (x: number, z: number) => {
         if (phase) return false;
         const i = crateAt(run, x, z, BODY_R);
         return i >= 0 && h.h < co.crates[i].stack * CRATE_H - 0.1;
      };
      if (!blocked(nx, nz)) {
         h.x = nx;
         h.z = nz;
      } else if (!blocked(nx, h.z)) h.x = nx;
      else if (!blocked(h.x, nz)) h.z = nz;
      const lim = co.half - BODY_R;
      h.x = Math.max(-lim, Math.min(lim, h.x));
      h.z = Math.max(-lim, Math.min(lim, h.z));
   }
   if (h.h > 0 || h.vy > 0) {
      h.vy -= G * dt;
      h.h += h.vy * dt;
      if (h.h <= 0) {
         h.h = 0;
         h.vy = 0;
         h.airHops = 0;
         ev.landed = true;
      }
   }

   // the wave in play: fading cores drop again elsewhere; cores are taken (or a wrong pick jolts you)
   const w = co.waves[run.wave];
   if (w) {
      for (let i = 0; i < w.cores.length; i++) {
         const c = w.cores[i];
         if (run.taken[i]) continue;
         // a needed core left too long fades and drops again at its other spot (level 2 on: alt differs)
         if ((c.altX !== c.x || c.altZ !== c.z) && ms > run.dropAt[i] + DROP_MS + co.config.lifeMs) {
            run.alt[i] = run.alt[i] ? 0 : 1;
            run.dropAt[i] = ms + FADE_MS;
            run.open[i] = 0;
            ev.faded = true;
            continue;
         }
         if (!coreReady(run, i, ms) || held || h.h > 1.4) continue;
         corePos(run, i, ms, P);
         if (Math.hypot(P.x - h.x, P.z - h.z) > PICK_R) continue;
         run.taken[i] = 1;
         if (wanted(run, c.color)) takeCore(run, ms, c.color);
         else if (ms >= h.invulnUntil) {
            run.wrongs += 1;
            ev.wrong = c.color;
            stun(run, ms);
         }
      }
      for (const d of w.decoys) {
         if (held || h.h > 1.0 || ms < run.dropAt[0] + DROP_MS || ms < h.invulnUntil) continue;
         if (Math.hypot(d.x - h.x, d.z - h.z) > PICK_R) continue;
         run.wrongs += 1;
         ev.wrong = decoyColor(run, d, ms);
         ev.decoy = true;
         stun(run, ms);
      }
      if (waveDone(run)) {
         if (run.wave + 1 < co.waves.length) dropWave(run, run.wave + 1);
         else {
            run.wave = co.waves.length;
            ev.wave = run.wave;
         }
      }
   }

   // tesla coils
   if (!held) {
      for (let i = 0; i < co.teslas.length; i++) {
         const t = co.teslas[i];
         if (!teslaOn(run, i, ms) || h.h > 1.0) continue;
         if (Math.hypot(t.x - h.x, t.z - h.z) < t.radius && hurt(run, ms)) {
            ev.zapped = true;
            break;
         }
      }
   }

   // orbs (Zuno's magnet pulls the low ones in) and secrets
   const magnet = ms < run.magnetUntil;
   for (let i = 0; i < co.orbs.length; i++) {
      const o = co.orbs[i];
      if (run.collected[i] || o.wave > run.wave) continue;
      const dx = o.x - h.x;
      const dz = o.z - h.z;
      const dy = o.h - (h.h + 0.8);
      const pulled = magnet && o.h < 2 && dx * dx + dz * dz <= MAGNET_REACH * MAGNET_REACH;
      if (!pulled && dx * dx + dz * dz + dy * dy > ORB.pickup * ORB.pickup) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
      ev.comboLinked = true;
   }
   for (let i = 0; i < co.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const sp = co.secrets[i];
      const dx = sp.x - h.x;
      const dz = sp.z - h.z;
      const dy = sp.h - (h.h + 0.8);
      if (dx * dx + dz * dz + dy * dy < SECRET_R * SECRET_R && collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }

   bossWorld(run, ms, held);

   // the core gate
   const open = run.wave >= co.waves.length && bossDone(run);
   if (open && !run.gateOpen) {
      run.gateOpen = true;
      ev.gateOpen = true;
   }
   if (run.gateOpen && Math.hypot(co.gate.x - h.x, co.gate.z - h.z) < GATE_R && run.ended === null) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

function bossWorld(run: CoreRun, ms: number, held: boolean): void {
   const co = run.course;
   const boss = run.boss;
   if (!boss || !co.boss) return;
   const ev = run.events;
   const h = run.hero;
   if (!run.bossAwake) {
      if (run.wave < co.waves.length) return;
      run.bossAwake = true;
      ev.bossWoke = true;
   }
   const before = boss.phase;
   const stepBefore = boss.step;
   stepBoss(boss, CORE_SPRITE, STEP_MS, run.bossEv);
   if (run.bossEv.telegraph) ev.bossTelegraph = true;
   if (run.bossEv.attack) ev.bossAttack = true;
   if (boss.phase !== before) ev.bossPhase = true;
   if (run.bossEv.done) ev.bossDone = true;
   // it hops to a new spot as each telegraph begins
   if (boss.step === "telegraph" && stepBefore !== "telegraph") run.spriteSpot += 1;
   const sp = spritePos(run, P);
   const d = Math.hypot(sp.x - h.x, sp.z - h.z);
   // the shock ring: jump it
   const ring = shockRadius(run);
   if (!held && Number.isFinite(ring) && Math.abs(d - ring) < 0.45 && h.h < 0.4 && hurt(run, ms)) ev.shocked = true;
   // dazed: touch it to knock a core loose
   if (bossOpen(run) && !held && d < SPRITE_R) {
      const res = hitBoss(boss, CORE_SPRITE, 1, run.bossEv);
      if (res !== "ignored") {
         ev.bossHit = true;
         if (res === "phase") ev.bossPhase = true;
         if (res === "defeated") ev.bossDefeated = true;
         takeCore(run, ms, co.boss.colors[Math.min(co.boss.colors.length - 1, boss.hits - 1)]);
      }
   }
}

/** One frame (dtMs = useRunFrame's dt x 1000). Returns run.events (the same object every step). */
export function step(run: CoreRun, dtMs: number, input: StepInput): StepEvents {
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
   if (first && input.jumpPressed) run.hero.bufferUntil = run.ms + BUFFER_MS;
   return ev;
}

// ---------- the store hand-off ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   cores: "cores",
   wave: "wave",
   hits: "hits",
   finishMs: "finishMs",
   hero: "hero",
   power: "power",
   near: "near",
   gate: "gate",
   need0: "need0",
   need1: "need1",
   need2: "need2",
   need3: "need3",
   need4: "need4",
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

/** Which routes each hero can take (the gates the proof relies on); the tesla orbs are open to all. */
export const ROUTES: Record<HeroId, readonly string[]> = {
   riko: ["tesla"],
   nami: ["tesla", "high"],
   kiro: ["tesla"],
   zuno: ["tesla", "ring"],
   vexa: ["tesla", "ring"],
};

/** The most orbs one hero can take: the main ones plus its own routes'. */
export function maxOrbs(c: Course): number {
   const main = c.orbs.filter((o) => o.bonus === null).length;
   const own = Math.max(...(Object.keys(ROUTES) as HeroId[]).map((h) => c.orbs.filter((o) => o.bonus !== null && ROUTES[h].includes(o.bonus)).length));
   return main + own;
}

/** What the course can feed the flow meter: every orb one hero can take, every core of the order. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   const cores = c.order.reduce((a, b) => a + b, 0);
   return { combo: COMBO, sources: [{ count: maxOrbs(c), base: COMBO_BASE_MS.orb }, { count: cores, base: COMBO_BASE_MS.core }] };
}

/** The Core Sprite's least defeat time (ms) once woken: a hit in the first ms of every dazed window. */
export function bossMinMs(): number {
   const b = createBoss(CORE_SPRITE);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000 && b.step !== "done"; guard++) {
      stepBoss(b, CORE_SPRITE, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, CORE_SPRITE, 1, ev);
   }
   return ms;
}

/** The least time (ms) to cover d metres: the walk, plus Riko's dash (x1.6 for 0.6 s, once per 5 s from the first frame). */
export function leastRunMs(d: number): number {
   const v = SPEED;
   const extra = (DASH_X - 1) * (POWER_MS.dash / 1000);
   const per = heroById("riko").cooldownMs / 1000;
   return Math.max(0, ((d / v - extra) / (1 + extra / per)) * 1000);
}

/** Every spot a core of this wave can be at (an orbiting core: anywhere on its circle; fading: both spots). */
function spotsOf(core: CoreDef): { x: number; z: number; r: number }[] {
   const r = core.kind === "orbit" ? ORBIT_R : 0;
   const out = [{ x: core.x, z: core.z, r }];
   if (core.altX !== core.x || core.altZ !== core.z) out.push({ x: core.altX, z: core.altZ, r });
   return out;
}

/**
 * The least time one wave can take once it drops: its cores land (DROP_MS), and the hero has to touch
 * as many cores as the wave asks for, any two of which are at least the wave's closest spacing apart
 * (less the pick-up reach at both ends and the orbit circles).
 */
export function waveMinMs(c: Course, w: number): number {
   const wave = c.waves[w];
   const need = wave.quota.reduce((a, b) => a + b, 0);
   let dmin = Infinity;
   for (let i = 0; i < wave.cores.length; i++)
      for (let j = i + 1; j < wave.cores.length; j++)
         for (const p of spotsOf(wave.cores[i]))
            for (const q of spotsOf(wave.cores[j])) dmin = Math.min(dmin, Math.hypot(p.x - q.x, p.z - q.z) - p.r - q.r);
   if (!Number.isFinite(dmin)) dmin = 0;
   const leg = Math.max(0, dmin - 2 * PICK_R);
   return DROP_MS + leastRunMs((need - 1) * leg);
}

/**
 * The least finish (ms): every wave's least time one after another (a wave drops only once the one
 * before is in); level 5 adds the Core Sprite's least defeat time (it wakes once the last wave is in).
 */
export function minFinishMs(c: Course): number {
   let ms = 0;
   for (let w = 0; w < c.waves.length; w++) ms += waveMinMs(c, w);
   if (c.boss) ms += bossMinMs();
   return ms - STEP_MS;
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

/** The no-hit badge: no wrong pick, no zap, no shock. */
export function badgeHits(run: CoreRun): number {
   return run.hits;
}

export { LEVELS } from "./levels";
