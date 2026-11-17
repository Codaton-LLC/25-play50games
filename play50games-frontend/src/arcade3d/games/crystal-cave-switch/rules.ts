// Crystal Cave Switch rules (the design card's colour-switch puzzle): the hero runs and jumps through
// a crystal cave of linked rooms. Each room's gate opens when its crystal switches are struck (Action
// beside one) in the order its beacon shows; a wrong crystal or a decoy resets the room's sequence, and
// on timed rooms a started sequence must finish in time. A fall into the chasm puts the hero back at the
// room's entrance (the room keeps what is lit). Level 5 is the Hollow Prism.
// A time game: the finish less 0.15 s an orb and the flow bonus is the submitted time.
//
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Whole ms, stepped 1 ms at
// a time, the fraction carried: the same at 30, 60 or 144 fps.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { ACT_REACH, DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { RAIL_SPEED, courseFor, railOffset, type Box, type ColorId, type Course, type Point } from "./course";
import { COMBO, COMBO_BASE_MS, PRISM, SECRETS } from "./progression";

export { courseFor, buildCourse } from "./course";
export type { Course, Box } from "./course";

// ---------- tuning (1 unit = 1 m) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const V_RUN = 6;
export const ACCEL_GROUND = 50;
export const ACCEL_AIR = 22;
export const GRAV = 24;
export const V_JUMP = 11.2;
export const V_JUMP2 = 9;
export const COYOTE_MS = 90;
export const BUFFER_MS = 110;
export const HERO_R = 0.35;
export const HERO_H = 1.5;
export const VOID_Y = -10;
export const DEAD_MS = 800;
export const STUN_MS = 700;
export const PICK_R = 1.0;
/** a crystal can be struck from this far below / above its base (m) */
export const ACT_DY = 1.2;
/** the Prism's beam lane half width (m) */
export const LANE_HALF = 1.3;
export const BONUS_MS = { orb: 150 } as const;
/**
 * The fastest the hero's position advances (m/s), for the bound: his own 6 m/s, plus Riko's dash (4 m
 * in 0.2 s once per 1.2 s: 2.33 m/s more on average) with margin; a moving slab's 2 m/s is added where
 * the level has one (vBound).
 */
export const V_BOUND = V_RUN + 3;

// ---------- state ----------

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   vy: number;
   facing: number;
   ground: number;
   leftGroundMs: number;
   jumpedSinceGround: boolean;
   jumps: number;
   jumpBuf: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   stunUntil: number;
   deadMs: number;
   spawn: Point;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   doubled: boolean;
   landed: boolean;
   died: boolean;
   respawned: boolean;
   hurt: boolean;
   /** a crystal struck: right (lit) or wrong (the room reset) */
   struck: number;
   right: boolean;
   wrong: boolean;
   timeout: number;
   opened: number;
   orb: number;
   powered: boolean;
   comboBonus: number;
   secretList: number[];
   secretCount: number;
   finished: boolean;
   timeup: boolean;
   bossWake: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      doubled: false,
      landed: false,
      died: false,
      respawned: false,
      hurt: false,
      struck: NONE,
      right: false,
      wrong: false,
      timeout: NONE,
      opened: NONE,
      orb: NONE,
      powered: false,
      comboBonus: 0,
      secretList: [],
      secretCount: 0,
      finished: false,
      timeup: false,
      bossWake: false,
      bossTelegraph: false,
      bossAttack: false,
      bossOpen: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function clearEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.doubled = false;
   ev.landed = false;
   ev.died = false;
   ev.respawned = false;
   ev.hurt = false;
   ev.struck = NONE;
   ev.right = false;
   ev.wrong = false;
   ev.timeout = NONE;
   ev.opened = NONE;
   ev.orb = NONE;
   ev.powered = false;
   ev.comboBonus = 0;
   ev.secretCount = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.bossWake = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossOpen = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

export interface CaveRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   carry: number;
   hero: Hero;
   /** per room: crystals struck in order so far, solved, the timer's deadline */
   progress: Int32Array;
   solved: Uint8Array;
   deadline: Float64Array;
   /** per switch: lit in its room's current sequence; ever paid into the chain */
   lit: Uint8Array;
   paid: Uint8Array;
   taken: Uint8Array;
   orbs: number;
   wrongs: number;
   deaths: number;
   hurts: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   combo: ComboState;
   secrets: SecretTracker;
   powerReadyAt: number;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   /** the beam's lane heading (locked at the tell) */
   lane: number;
   /** the colour code the open core shows, and how far into it the hero is */
   code: ColorId[];
   codeAt: number;
   prevBossStep: string;
   events: StepEvents;
}

function freshHero(c: Course): Hero {
   return {
      x: c.start.x,
      y: c.start.y,
      z: c.start.z,
      vx: 0,
      vz: 0,
      vy: 0,
      facing: Math.PI,
      ground: NONE,
      leftGroundMs: NONE,
      jumpedSinceGround: false,
      jumps: 0,
      jumpBuf: NONE,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      stunUntil: NONE,
      deadMs: NONE,
      spawn: { ...c.start },
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, course: Course = courseFor(level)): CaveRun {
   const run: CaveRun = {
      course,
      level,
      heroId,
      seed: (seed >>> 0) || 1,
      simMs: 0,
      carry: 0,
      hero: freshHero(course),
      progress: new Int32Array(course.rooms.length),
      solved: new Uint8Array(course.rooms.length),
      deadline: new Float64Array(course.rooms.length).fill(Infinity),
      lit: new Uint8Array(course.switches.length),
      paid: new Uint8Array(course.switches.length),
      taken: new Uint8Array(course.orbs.length),
      orbs: 0,
      wrongs: 0,
      deaths: 0,
      hurts: 0,
      ended: null,
      finishMs: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      powerReadyAt: 0,
      boss: course.boss ? createBoss(PRISM) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      lane: 0,
      code: [],
      codeAt: 0,
      prevBossStep: "intro",
      events: createEvents(),
   };
   const s = support(run);
   run.hero.ground = s;
   return run;
}

// ---------- the cave (shared with the bot and the scene) ----------

const BP = { x: 0, z: 0 };

/** Box b's centre offset now (a moving slab rides its rail). */
export function boxOffset(run: Pick<CaveRun, "simMs">, b: Box, out = BP): { x: number; z: number } {
   if (!b.rail) {
      out.x = 0;
      out.z = 0;
      return out;
   }
   const o = railOffset((RAIL_SPEED * run.simMs) / 1000, b.rail.amp);
   out.x = b.rail.ax * o;
   out.z = b.rail.az * o;
   return out;
}

/** Is box b solid (an open gate is not)? */
export function boxSolid(run: Pick<CaveRun, "course" | "solved">, b: Box): boolean {
   if (b.kind !== "wall") return true;
   for (const r of run.course.rooms) if (r.gate === b.id) return !run.solved[r.id];
   return true;
}

/** The Prism's colour code for its current window: phase + 1 colours, each a step on from the last. */
export function codeFor(hits: number, phase: number): ColorId[] {
   const out: ColorId[] = [];
   for (let k = 0; k <= phase; k++) out.push(((hits * 3 + k + phase) % 4) as ColorId);
   return out;
}

// ---------- the bound (README "Server limits and why they hold") ----------

export function bossMinMs(): number {
   const b = createBoss(PRISM);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(b, PRISM, 1, ev);
      if (b.step === "vulnerable") hitBoss(b, PRISM, 1, ev);
      if (b.step === "defeat" || b.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

export function vBound(c: Course): number {
   return V_BOUND + (c.boxes.some((b) => b.rail) ? RAIL_SPEED : 0);
}

/**
 * The least distance (m) any run must cover: through every room's crystals in order (each struck from
 * as far as Zuno's magnet reaches) and its gate, to the goal (level 5: to the Prism's wake line).
 */
export function minPathM(c: Course): number {
   type Wp = { x: number; z: number; r: number };
   const pts: Wp[] = [{ x: c.start.x, z: c.start.z, r: 0 }];
   for (const room of c.rooms) {
      for (const id of room.seq) {
         const s = c.switches[id];
         pts.push({ x: s.x, z: s.z, r: MAGNET_REACH });
      }
      const g = c.boxes[room.gate];
      pts.push({ x: (g.minX + g.maxX) / 2, z: (g.minZ + g.maxZ) / 2, r: 0 });
   }
   if (c.boss) pts.push({ x: pts[pts.length - 1].x, z: c.boss.wakeZ, r: 0 });
   else {
      const g = c.boxes[c.goal];
      pts.push({ x: (g.minX + g.maxX) / 2, z: g.maxZ, r: 0 });
   }
   let m = 0;
   for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      m += Math.max(0, Math.hypot(b.x - a.x, b.z - a.z) - a.r - b.r);
   }
   return m;
}

/** The least finish (ms): the least path at vBound, plus on level 5 the Prism's least defeat time. */
export function minFinishMs(c: Course): number {
   return (minPathM(c) / vBound(c)) * 1000 + (c.boss ? BOSS_MIN_MS : 0);
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   const crystals = c.rooms.reduce((n, r) => n + r.seq.length, 0);
   const sources: { count: number; base: number }[] = [{ count: crystals, base: COMBO_BASE_MS.crystal }];
   if (c.boss) sources.push({ count: PRISM.maxHp, base: COMBO_BASE_MS.boss });
   return { combo: COMBO, sources };
}

export function maxBonusMs(c: Course): number {
   return c.orbs.length * BONUS_MS.orb + comboMaxBonus(comboSpecOf(c));
}

export function bonusMs(run: Pick<CaveRun, "orbs" | "combo">): number {
   return run.orbs * BONUS_MS.orb + run.combo.bonusTotal;
}

export function runTimeMs(finishMs: number, bonus: number): number {
   return Math.max(0, finishMs - bonus);
}

export const submittedMs = (run: CaveRun): number => runTimeMs(run.finishMs, bonusMs(run));

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

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
const PA = { x: 0, z: 0 };

export function step(run: CaveRun, dtMs: number, input: StepInput): StepEvents {
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
      stepMs(run, jump, action, ev);
      jump = false;
      action = false;
   }
   return ev;
}

function secret(run: CaveRun, id: string, ev: StepEvents): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i >= 0 && collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
}

function finish(run: CaveRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   if (run.wrongs === 0) secret(run, "flawless", ev);
   ev.finished = true;
}

function die(run: CaveRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.deadMs >= 0) return;
   h.deadMs = 0;
   h.ground = NONE;
   h.vx = h.vz = h.vy = 0;
   run.deaths += 1;
   comboBreak(run.combo);
   ev.died = true;
}

function hurt(run: CaveRun, ev: StepEvents): void {
   const h = run.hero;
   if (run.simMs <= h.shieldUntil || run.simMs <= h.stunUntil) return;
   h.stunUntil = run.simMs + STUN_MS;
   h.vx = h.vz = 0;
   h.vy = 5;
   h.ground = NONE;
   run.hurts += 1;
   ev.hurt = true;
}

function respawn(run: CaveRun, ev: StepEvents): void {
   const h = run.hero;
   h.deadMs = NONE;
   h.x = h.spawn.x;
   h.y = h.spawn.y;
   h.z = h.spawn.z;
   h.vx = h.vz = h.vy = 0;
   h.ground = support(run);
   h.jumps = 0;
   h.jumpedSinceGround = false;
   ev.respawned = true;
}

/** The nearest crystal the hero can strike now (reach and height), or -1. */
export function strikable(run: CaveRun): number {
   const h = run.hero;
   const reach = run.simMs <= h.magnetUntil ? MAGNET_REACH : ACT_REACH;
   const dy = run.simMs <= h.magnetUntil ? 3 : ACT_DY;
   let best = NONE;
   let bestD = Infinity;
   for (const s of run.course.switches) {
      if (Math.abs(h.y - s.base) > dy) continue;
      const d = Math.hypot(h.x - s.x, h.z - s.z);
      if (d > reach || d >= bestD) continue;
      if (s.room >= 0 && run.solved[s.room]) continue;
      best = s.id;
      bestD = d;
   }
   return best;
}

function resetRoom(run: CaveRun, room: number): void {
   run.progress[room] = 0;
   run.deadline[room] = Infinity;
   for (const s of run.course.switches) if (s.room === room) run.lit[s.id] = 0;
}

function strike(run: CaveRun, id: number, ev: StepEvents): void {
   const c = run.course;
   const s = c.switches[id];
   ev.struck = id;
   if (s.room < 0) {
      bossStrike(run, s.color, ev);
      return;
   }
   const room = c.rooms[s.room];
   const at = run.progress[room.id];
   if (!s.decoy && room.seq[at] === id) {
      run.lit[id] = 1;
      run.progress[room.id] = at + 1;
      ev.right = true;
      if (at === 0 && room.timerMs > 0) run.deadline[room.id] = run.simMs + room.timerMs;
      if (!run.paid[id]) {
         run.paid[id] = 1;
         ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.crystal);
      }
      if (at + 1 === room.seq.length) {
         run.solved[room.id] = 1;
         run.deadline[room.id] = Infinity;
         ev.opened = room.id;
      }
   } else if (!run.lit[id]) {
      run.wrongs += 1;
      resetRoom(run, room.id);
      comboBreak(run.combo);
      ev.wrong = true;
   }
}

function power(run: CaveRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < run.powerReadyAt || ms <= h.stunUntil) return;
   const def = heroById(run.heroId);
   if (def.power === "double") return;
   if (def.power === "dash") {
      const len = Math.hypot(STICK.x, STICK.z);
      h.dashX = len > 0.2 ? STICK.x / len : Math.sin(h.facing);
      h.dashZ = len > 0.2 ? STICK.z / len : Math.cos(h.facing);
      h.dashUntil = ms + POWER_MS.dash;
      h.vy = Math.max(0, h.vy);
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** The solid box under the hero's feet (within 0.06 m), or -1. */
function support(run: CaveRun): number {
   const h = run.hero;
   let best = NONE;
   let bestTop = -Infinity;
   for (const b of run.course.boxes) {
      if (Math.abs(h.y - b.top) > 0.06 || !boxSolid(run, b)) continue;
      boxOffset(run, b, PA);
      if (h.x < b.minX + PA.x - HERO_R * 0.4 || h.x > b.maxX + PA.x + HERO_R * 0.4 || h.z < b.minZ + PA.z - HERO_R * 0.4 || h.z > b.maxZ + PA.z + HERO_R * 0.4) continue;
      if (b.top > bestTop) {
         bestTop = b.top;
         best = b.id;
      }
   }
   return best;
}

function pushOut(run: CaveRun): void {
   const h = run.hero;
   for (const b of run.course.boxes) {
      if (h.y >= b.top - 0.02 || h.y + HERO_H <= b.bottom) continue;
      if (!boxSolid(run, b)) continue;
      boxOffset(run, b, PA);
      const minX = b.minX + PA.x - HERO_R;
      const maxX = b.maxX + PA.x + HERO_R;
      const minZ = b.minZ + PA.z - HERO_R;
      const maxZ = b.maxZ + PA.z + HERO_R;
      if (h.x <= minX || h.x >= maxX || h.z <= minZ || h.z >= maxZ) continue;
      if (b.top - h.y < 0.45 && h.vy <= 0) {
         h.y = b.top;
         h.vy = 0;
         continue;
      }
      const px = Math.min(h.x - minX, maxX - h.x);
      const pz = Math.min(h.z - minZ, maxZ - h.z);
      if (px < pz) h.x = h.x - minX < maxX - h.x ? minX : maxX;
      else h.z = h.z - minZ < maxZ - h.z ? minZ : maxZ;
   }
   if (run.simMs <= h.phaseUntil && run.heroId === "vexa") return;
   for (const w of run.course.ghostWalls) {
      if (h.y > w.y + 1.2 || h.y + HERO_H < w.y - 1.2) continue;
      const hx = w.normal === "x" ? 0.1 : 1;
      const hz = w.normal === "x" ? 1 : 0.1;
      const dx = h.x - w.x;
      const dz = h.z - w.z;
      const px = hx + HERO_R - Math.abs(dx);
      const pz = hz + HERO_R - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) h.x += dx >= 0 ? px : -px;
      else h.z += dz >= 0 ? pz : -pz;
   }
}

function land(run: CaveRun, id: number, ev: StepEvents): void {
   const h = run.hero;
   const b = run.course.boxes[id];
   h.ground = id;
   h.vy = 0;
   h.y = b.top;
   h.jumps = 0;
   h.jumpedSinceGround = false;
   ev.landed = true;
}

function bossStrike(run: CaveRun, color: ColorId, ev: StepEvents): void {
   const b = run.boss;
   if (!b || !run.bossAwake || b.step !== "vulnerable") return;
   if (run.code[run.codeAt] === color) {
      run.codeAt += 1;
      ev.right = true;
      if (run.codeAt >= run.code.length) {
         const r = hitBoss(b, PRISM, 1, run.bossEv);
         if (r === "ignored") return;
         ev.bossHit = true;
         ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.boss);
         if (r === "phase") ev.bossPhase = true;
         if (r === "defeated") {
            ev.bossDefeated = true;
            finish(run, ev);
         }
      }
   } else if (run.code[run.codeAt - 1] !== color) {
      run.codeAt = 0;
      run.wrongs += 1;
      ev.wrong = true;
   }
}

function stepBossMs(run: CaveRun, ev: StepEvents): void {
   const b = run.boss;
   const c = run.course;
   const h = run.hero;
   if (!b || !c.boss) return;
   if (!run.bossAwake) {
      if (h.z < c.boss.wakeZ && h.deadMs < 0) {
         run.bossAwake = true;
         ev.bossWake = true;
         h.spawn = { x: 0, y: 0, z: c.boss.wakeZ - 1.5 };
      } else return;
   }
   const before = b.phase;
   const bev = stepBoss(b, PRISM, 1, run.bossEv);
   if (b.phase !== before) ev.bossPhase = true;
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      run.lane = Math.atan2(h.x - c.boss.x, h.z - c.boss.z);
   }
   if (bev.attack) {
      ev.bossAttack = true;
      const dx = h.x - c.boss.x;
      const dz = h.z - c.boss.z;
      const along = dx * Math.sin(run.lane) + dz * Math.cos(run.lane);
      const across = Math.abs(dx * Math.cos(run.lane) - dz * Math.sin(run.lane));
      if (along > 0 && across <= LANE_HALF) hurt(run, ev);
   }
   if (b.step === "vulnerable" && run.prevBossStep !== "vulnerable") {
      run.code = codeFor(b.hits, b.phase);
      run.codeAt = 0;
      ev.bossOpen = true;
   }
   run.prevBossStep = b.step;
}

function stepMs(run: CaveRun, jumpPressed: boolean, actionPressed: boolean, ev: StepEvents): void {
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   const c = run.course;
   const dt = 0.001;
   comboTick(run.combo, COMBO, ms);
   // timed rooms: a started sequence runs out
   for (const r of c.rooms) {
      if (ms > run.deadline[r.id] && !run.solved[r.id]) {
         resetRoom(run, r.id);
         ev.timeout = r.id;
      }
   }
   if (h.deadMs >= 0) {
      h.deadMs += 1;
      if (h.deadMs >= DEAD_MS) respawn(run, ev);
      stepBossMs(run, ev);
      endCheck(run, ev);
      return;
   }
   // a moving slab carries whoever stands on it
   let carryX = 0;
   let carryZ = 0;
   if (h.ground >= 0) {
      const g = c.boxes[h.ground];
      if (g.rail) {
         run.simMs -= 1;
         const a = boxOffset(run, g, { x: 0, z: 0 });
         run.simMs += 1;
         const b = boxOffset(run, g, { x: 0, z: 0 });
         carryX = b.x - a.x;
         carryZ = b.z - a.z;
      }
   }
   // Action: strike the crystal at hand, else the hero power
   if (actionPressed && ms > h.stunUntil) {
      const s = strikable(run);
      if (s >= 0) strike(run, s, ev);
      else power(run, ev);
   }
   if (jumpPressed) h.jumpBuf = ms + BUFFER_MS;
   const stunned = ms <= h.stunUntil;
   if (h.jumpBuf >= ms && !stunned) {
      const coyote = h.ground < 0 && !h.jumpedSinceGround && h.leftGroundMs >= 0 && ms - h.leftGroundMs <= COYOTE_MS;
      if (h.ground >= 0 || coyote) {
         h.vy = V_JUMP;
         h.ground = NONE;
         h.jumpedSinceGround = true;
         h.jumps = 1;
         h.jumpBuf = NONE;
         ev.jumped = true;
      } else if (h.jumps === 1 && heroById(run.heroId).power === "double") {
         h.vy = V_JUMP2;
         h.jumps = 2;
         h.jumpBuf = NONE;
         ev.doubled = true;
      }
   }
   const dashing = ms <= h.dashUntil;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
      if (h.ground < 0) h.vy = 0;
   } else {
      const wx = stunned ? 0 : STICK.x * V_RUN;
      const wz = stunned ? 0 : STICK.z * V_RUN;
      const acc = (h.ground >= 0 ? ACCEL_GROUND : ACCEL_AIR) * dt;
      const dvx = wx - h.vx;
      const dvz = wz - h.vz;
      const dv = Math.hypot(dvx, dvz);
      if (dv > acc) {
         h.vx += (dvx / dv) * acc;
         h.vz += (dvz / dv) * acc;
      } else {
         h.vx = wx;
         h.vz = wz;
      }
      const sp = Math.hypot(h.vx, h.vz);
      if (sp > V_RUN) {
         h.vx *= V_RUN / sp;
         h.vz *= V_RUN / sp;
      }
      if (h.ground < 0) h.vy -= GRAV * dt;
   }
   if (Math.hypot(h.vx, h.vz) > 0.3) h.facing = Math.atan2(h.vx, h.vz);
   h.x += h.vx * dt + carryX;
   h.z += h.vz * dt + carryZ;
   pushOut(run);
   const prevY = h.y;
   h.y += h.vy * dt;
   if (h.ground < 0 && h.vy <= 0) {
      for (const b of c.boxes) {
         if (prevY < b.top - 0.001 || h.y > b.top || !boxSolid(run, b)) continue;
         boxOffset(run, b, PA);
         if (h.x < b.minX + PA.x - HERO_R * 0.4 || h.x > b.maxX + PA.x + HERO_R * 0.4 || h.z < b.minZ + PA.z - HERO_R * 0.4 || h.z > b.maxZ + PA.z + HERO_R * 0.4) continue;
         land(run, b.id, ev);
         break;
      }
   } else if (h.ground < 0 && h.vy > 0) {
      for (const b of c.boxes) {
         if (prevY + HERO_H > b.bottom + 0.001 || h.y + HERO_H < b.bottom || !boxSolid(run, b)) continue;
         boxOffset(run, b, PA);
         if (h.x < b.minX + PA.x || h.x > b.maxX + PA.x || h.z < b.minZ + PA.z || h.z > b.maxZ + PA.z) continue;
         h.vy = 0;
         h.y = b.bottom - HERO_H;
         break;
      }
   }
   if (h.ground >= 0) {
      const s = support(run);
      if (s >= 0) {
         if (s !== h.ground) land(run, s, ev);
         h.y = c.boxes[s].top;
         // the room you stand in is where a fall puts you back
         for (const r of c.rooms) if (r.floor === s) h.spawn = r.spawn;
         if (s === c.goal && !c.boss) finish(run, ev);
      } else {
         h.ground = NONE;
         h.leftGroundMs = ms;
         h.vy = Math.min(h.vy, 0);
      }
   }
   if (run.ended !== null) return;
   if (h.y < VOID_Y) die(run, ev);
   if (h.deadMs >= 0) {
      stepBossMs(run, ev);
      endCheck(run, ev);
      return;
   }
   const my = h.y + 0.75;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.taken[i]) continue;
      const o = c.orbs[i];
      if (Math.hypot(h.x - o.x, my - o.y, h.z - o.z) > PICK_R) continue;
      run.taken[i] = 1;
      run.orbs += 1;
      ev.orb = i;
   }
   for (const w of c.ghostWalls) if (Math.hypot(h.x - w.crystal.x, my - w.crystal.y, h.z - w.crystal.z) <= PICK_R) secret(run, "ghost", ev);
   if (Math.hypot(h.x - c.high.x, my - c.high.y, h.z - c.high.z) <= PICK_R + 0.3) secret(run, "high", ev);
   stepBossMs(run, ev);
   endCheck(run, ev);
}

function endCheck(run: CaveRun, ev: StepEvents): void {
   if (run.ended === null && run.simMs >= run.course.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

// ---------- reading the run ----------

/** The room the hero is in (by its floor's z band), or -1 (the boss arena / the goal). */
export function roomAt(run: CaveRun): number {
   const h = run.hero;
   for (const r of run.course.rooms) {
      const f = run.course.boxes[r.floor];
      if (h.z <= f.maxZ + 0.5 && h.z >= f.minZ - 0.5) return r.id;
   }
   return NONE;
}

export const STAT = {
   room: "room",
   progress: "progress",
   seqLen: "seqLen",
   timer: "timer",
   orbs: "orbs",
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
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   hint: "hint",
} as const;

export const HINT = { none: 0, strike: 1, order: 2, wrong: 3, timer: 4, hidden: 5, slab: 6, beam: 7, code: 8, died: 9 } as const;

export function hintFor(run: CaveRun): number {
   if (run.ended !== null) return HINT.none;
   const h = run.hero;
   if (h.deadMs >= 0) return HINT.died;
   const b = run.boss;
   if (b && run.bossAwake && b.step !== "defeat" && b.step !== "done" && b.step !== "intro") return b.step === "vulnerable" ? HINT.code : HINT.beam;
   const r = roomAt(run);
   if (r < 0) return HINT.none;
   if (run.solved[r]) return HINT.none;
   const cfg = run.course.cfg;
   if (r === 0 && run.progress[0] === 0) return run.course.level === 1 ? HINT.strike : HINT.order;
   if (cfg.timed && run.progress[r] > 0) return HINT.timer;
   if (cfg.moving && r === 1) return HINT.slab;
   if (cfg.hidden && run.course.switches.some((s) => s.room === r && s.hidden)) return HINT.hidden;
   return HINT.none;
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.bonusMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export function badgeHits(run: CaveRun): number {
   return run.deaths + run.hurts;
}
