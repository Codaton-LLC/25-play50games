// Neon Cube Jump rules (the design card's FLIP): a field of 2 m neon cubes in sets A and B; only one set
// is solid at a time and every jump flips it on takeoff, so each jump lands on the other set. Walking
// off an edge does not flip. Nami's second jump flips again; Riko's air dash does not. Rogue ring cubes
// keep their own 1.6 s clock; B cubes on rails slide only while solid; laser walls and sentry drones
// belong to a set and only bite while it is solid. Level 5 is Flipframe.
// The hero is a 0.7 x 1.5 m box that runs at 6 m/s (camera-relative stick), jumps 2 cubes across and 1
// up. A fall or a laser / drone sends him back to the checkpoint, the field as it was there.
// A time game: the finish less 0.15 s an orb, 0.08 s a coin and the flow bonus is the submitted time.
//
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Whole ms, stepped 1 ms at
// a time, the fraction carried: the same at 30, 60 or 144 fps.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { HALF, RAIL_SPEED, ROGUE_MS, courseFor, railOffset, type Course, type Cube } from "./course";
import { COMBO, COMBO_BASE_MS, FLIPFRAME, OVERDRIVE_MS, SECRETS } from "./progression";

export { courseFor, buildCourse } from "./course";
export type { Course, Cube } from "./course";

// ---------- tuning (1 unit = 1 m) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const V_RUN = 6;
export const ACCEL_GROUND = 50;
export const ACCEL_AIR = 22;
export const GRAV = 24;
/** a jump clears 2.6 m (one cube up with room), lands 4-5.6 m on (two cubes across) */
export const V_JUMP = 11.2;
/** Nami's second jump */
export const V_JUMP2 = 9;
export const COYOTE_MS = 90;
export const BUFFER_MS = 110;
export const HERO_R = 0.35;
export const HERO_H = 1.5;
/** below this the hero has fallen into the void */
export const VOID_Y = -12;
export const DEAD_MS = 800;
export const STUN_MS = 700;
/** pickup reach (m, from the hero's middle) */
export const PICK_R = 1.0;
/** a drone's body (m) */
export const DRONE_R = 0.9;
/** the time bonuses (ms off the submitted time) */
export const BONUS_MS = { orb: 150, coin: 80 } as const;
/** a combo breaks after this long on the ground */
export const GROUND_BREAK_MS = 500;
/**
 * The fastest the hero's horizontal position can advance (m/s), for the bound: his own 6 m/s, plus
 * Riko's dash (4 m in 0.2 s once per 1.2 s cooldown: 10 m per 1.2 s, 2.33 m/s more on average), plus
 * margin for the rare push out of a cube that turned solid round him (rogue clocks, overdrive); a
 * moving cube's 2 m/s carry is added on level 2 (vBound).
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
   /** the cube he stands on (-1: in the air) */
   ground: number;
   leftGroundMs: number;
   groundMs: number;
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
   /** ms since death (-1: alive) */
   deadMs: number;
   checkpoint: number;
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
   flipped: boolean;
   autoFlip: boolean;
   landed: boolean;
   landedCube: number;
   walkedOff: boolean;
   died: boolean;
   respawned: boolean;
   hurt: boolean;
   orb: number;
   coin: number;
   powered: boolean;
   checkpoint: boolean;
   comboBonus: number;
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
   dodged: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      doubled: false,
      flipped: false,
      autoFlip: false,
      landed: false,
      landedCube: NONE,
      walkedOff: false,
      died: false,
      respawned: false,
      hurt: false,
      orb: NONE,
      coin: NONE,
      powered: false,
      checkpoint: false,
      comboBonus: 0,
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
      dodged: false,
   };
}

function clearEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.doubled = false;
   ev.flipped = false;
   ev.autoFlip = false;
   ev.landed = false;
   ev.landedCube = NONE;
   ev.walkedOff = false;
   ev.died = false;
   ev.respawned = false;
   ev.hurt = false;
   ev.orb = NONE;
   ev.coin = NONE;
   ev.powered = false;
   ev.checkpoint = false;
   ev.comboBonus = 0;
   ev.secretCount = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.bossWake = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
   ev.dodged = false;
}

export interface NeonRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   carry: number;
   hero: Hero;
   /** the solid set */
   solid: "A" | "B";
   flips: number;
   /** jumps since the last checkpoint (the parity glyph) */
   parity: number;
   /** the run's own jump flips (co-op hands them to the team) */
   ownFlips: number;
   /** the checkpoint's field state, restored on a respawn */
   cpSolid: "A" | "B";
   /** each moving cube's travel parameter (m) */
   railP: Float64Array;
   /** each cube landed on at least once (the combo pays a cube once) */
   landed: Uint8Array;
   taken: Uint8Array;
   coinTaken: Uint8Array;
   orbs: number;
   coins: number;
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
   /** P1: the set it will stomp (locked at the tell); dodged this stomp */
   stompSet: "A" | "B";
   stompDodged: boolean;
   /** P2: the cube its core drops onto */
   coreCube: number;
   /** P3: the next self-flip */
   nextAutoFlip: number;
   /** a shared flip from multiplayer co-op (multiplayer.ts); solo never sets it */
   pendingFlips: number;
   events: StepEvents;
}

function freshHero(c: Course): Hero {
   const s = c.cubes[c.start];
   return {
      x: s.x,
      y: s.top,
      z: s.z,
      vx: 0,
      vz: 0,
      vy: 0,
      facing: Math.PI,
      ground: s.id,
      leftGroundMs: NONE,
      groundMs: 0,
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
      checkpoint: s.id,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, course: Course = courseFor(level)): NeonRun {
   return {
      course,
      level,
      heroId,
      seed: (seed >>> 0) || 1,
      simMs: 0,
      carry: 0,
      hero: freshHero(course),
      solid: "A",
      flips: 0,
      parity: 0,
      ownFlips: 0,
      cpSolid: "A",
      railP: new Float64Array(course.cubes.length),
      landed: new Uint8Array(course.cubes.length),
      taken: new Uint8Array(course.orbs.length),
      coinTaken: new Uint8Array(course.coins.length),
      orbs: 0,
      coins: 0,
      deaths: 0,
      hurts: 0,
      ended: null,
      finishMs: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      powerReadyAt: 0,
      boss: course.boss ? createBoss(FLIPFRAME) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      stompSet: "A",
      stompDodged: false,
      coreCube: NONE,
      nextAutoFlip: NONE,
      pendingFlips: 0,
      events: createEvents(),
   };
}

// ---------- the field (shared with the bot and the scene) ----------

/** Is the rogue cube c solid at rules ms `ms`? */
export const rogueSolid = (c: Cube, ms: number): boolean => Math.floor(ms / ROGUE_MS) % 2 === c.phase;

/** Is cube c solid for the run's set state (rogues on their clock; neutral always)? Vexa's phase is not counted here. */
export function cubeSolid(run: Pick<NeonRun, "solid" | "simMs">, c: Cube): boolean {
   if (c.set === "N") return true;
   if (c.set === "R") return rogueSolid(c, run.simMs);
   return c.set === run.solid;
}

/** Solid for the hero: a phasing Vexa also stands on holograms. */
function solidForHero(run: NeonRun, c: Cube): boolean {
   if (cubeSolid(run, c)) return true;
   return run.simMs <= run.hero.phaseUntil && (c.set === "A" || c.set === "B");
}

const CP = { x: 0, z: 0 };

/** Cube c's centre on the plane now (a rail cube is moved by its travel parameter). */
export function cubePos(run: Pick<NeonRun, "railP">, c: Cube, out: { x: number; z: number } = CP): { x: number; z: number } {
   if (!c.rail) {
      out.x = c.x;
      out.z = c.z;
      return out;
   }
   const o = railOffset(run.railP[c.id], c.rail.amp);
   out.x = c.x + c.rail.ax * o;
   out.z = c.z + c.rail.az * o;
   return out;
}

/** Is laser wall on cube c live (its set solid)? */
export const laserLive = (run: Pick<NeonRun, "solid">, c: Cube): boolean => c.laser !== null && c.laser === run.solid;

const DP = { x: 0, y: 0, z: 0 };

/** Drone d's position at ms. */
export function dronePos(d: Course["drones"][number], ms: number, out = DP): { x: number; y: number; z: number } {
   const s = Math.sin((2 * Math.PI * ms) / d.periodMs) * d.amp;
   out.x = d.x + d.ax * s;
   out.y = d.y;
   out.z = d.z + d.az * s;
   return out;
}

// ---------- the bound (README "Server limits and why they hold") ----------

export function bossMinMs(): number {
   const b = createBoss(FLIPFRAME);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(b, FLIPFRAME, 1, ev);
      if (b.step === "vulnerable") hitBoss(b, FLIPFRAME, 1, ev);
      if (b.step === "defeat" || b.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** The fastest the hero's position advances on this level (m/s): V_BOUND, plus the rail carry where cubes move. */
export function vBound(c: Course): number {
   return V_BOUND + (c.cubes.some((q) => q.rail) ? RAIL_SPEED : 0);
}

/**
 * The least finish (ms): the straight line on the plane from the start to the goal (or, on level 5, to
 * Flipframe's wake line) at vBound, plus on level 5 its least defeat time.
 */
export function minFinishMs(c: Course): number {
   const s = c.cubes[c.start];
   if (c.boss) return (Math.max(0, s.z - c.boss.wakeZ) / vBound(c)) * 1000 + BOSS_MIN_MS;
   const g = c.cubes[c.goal];
   return (Math.hypot(g.x - s.x, g.z - s.z) / vBound(c)) * 1000;
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   const sources: { count: number; base: number }[] = [{ count: c.cubes.length, base: COMBO_BASE_MS.cube }];
   if (c.boss) sources.push({ count: FLIPFRAME.maxHp, base: COMBO_BASE_MS.boss });
   return { combo: COMBO, sources };
}

export function maxBonusMs(c: Course): number {
   return c.orbs.length * BONUS_MS.orb + c.coins.length * BONUS_MS.coin + comboMaxBonus(comboSpecOf(c));
}

export function bonusMs(run: Pick<NeonRun, "orbs" | "coins" | "combo">): number {
   return run.orbs * BONUS_MS.orb + run.coins * BONUS_MS.coin + run.combo.bonusTotal;
}

export function runTimeMs(finishMs: number, bonus: number): number {
   return Math.max(0, finishMs - bonus);
}

export const submittedMs = (run: NeonRun): number => runTimeMs(run.finishMs, bonusMs(run));

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
const PA = { x: 0, z: 0 };

export function step(run: NeonRun, dtMs: number, input: StepInput): StepEvents {
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

function secret(run: NeonRun, id: string, ev: StepEvents): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i >= 0 && collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
}

function chain(run: NeonRun, base: number, ev: StepEvents): void {
   ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
}

function finish(run: NeonRun, ev: StepEvents): void {
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

export function flip(run: NeonRun, ev: StepEvents, auto = false): void {
   run.solid = run.solid === "A" ? "B" : "A";
   run.flips += 1;
   ev.flipped = true;
   if (auto) ev.autoFlip = true;
}

function die(run: NeonRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.deadMs >= 0) return;
   if (run.simMs <= h.shieldUntil && h.y > VOID_Y) return;
   h.deadMs = 0;
   h.ground = NONE;
   h.vx = h.vz = h.vy = 0;
   run.deaths += 1;
   comboBreak(run.combo);
   ev.died = true;
}

function hurt(run: NeonRun, ev: StepEvents): void {
   const h = run.hero;
   if (run.simMs <= h.shieldUntil || run.simMs <= h.stunUntil) return;
   h.stunUntil = run.simMs + STUN_MS;
   h.vx = h.vz = 0;
   h.vy = 6;
   h.ground = NONE;
   run.hurts += 1;
   comboBreak(run.combo);
   ev.hurt = true;
}

function respawn(run: NeonRun, ev: StepEvents): void {
   const h = run.hero;
   const cp = run.course.cubes[h.checkpoint];
   h.deadMs = NONE;
   h.x = cp.x;
   h.z = cp.z;
   h.y = cp.top;
   h.vx = h.vz = h.vy = 0;
   h.ground = cp.id;
   h.jumps = 0;
   h.jumpedSinceGround = false;
   run.solid = run.cpSolid;
   run.parity = 0;
   ev.respawned = true;
}

function power(run: NeonRun, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < run.powerReadyAt || ms <= h.stunUntil) return;
   const def = heroById(run.heroId);
   if (def.power === "double") return;
   if (def.power === "dash") {
      if (h.ground >= 0) return;
      const len = Math.hypot(STICK.x, STICK.z);
      h.dashX = len > 0.2 ? STICK.x / len : Math.sin(h.facing);
      h.dashZ = len > 0.2 ? STICK.z / len : Math.cos(h.facing);
      h.dashUntil = ms + POWER_MS.dash;
      h.vy = 0;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** The hero's box overlaps cube c's volume (with a skin) on the plane at the cube's position (px, pz)? */
function overlapsPlane(h: Hero, px: number, pz: number, skin: number): boolean {
   return Math.abs(h.x - px) < HALF + HERO_R - skin && Math.abs(h.z - pz) < HALF + HERO_R - skin;
}

/** The solid cube under the hero's feet (within 0.06 m), or -1. */
function support(run: NeonRun): number {
   const h = run.hero;
   let best = NONE;
   let bestTop = -Infinity;
   for (const c of run.course.cubes) {
      if (Math.abs(h.y - c.top) > 0.06 || !solidForHero(run, c)) continue;
      cubePos(run, c, PA);
      if (!overlapsPlane(h, PA.x, PA.z, 0.12)) continue;
      if (c.top > bestTop) {
         bestTop = c.top;
         best = c.id;
      }
   }
   return best;
}

/** Pushes the hero out of solid cubes and ghost walls on the plane (the minimal axis). */
function pushOut(run: NeonRun): void {
   const h = run.hero;
   const phasing = run.simMs <= h.phaseUntil && run.heroId === "vexa";
   for (const c of run.course.cubes) {
      if (h.y >= c.top - 0.02 || h.y + HERO_H <= c.top - 2) continue;
      if (!solidForHero(run, c)) continue;
      cubePos(run, c, PA);
      const dx = h.x - PA.x;
      const dz = h.z - PA.z;
      const px = HALF + HERO_R - Math.abs(dx);
      const pz = HALF + HERO_R - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      // nearly on top: step up onto it (a cube that turned solid under the feet)
      if (c.top - h.y < 0.45 && h.vy <= 0) {
         h.y = c.top;
         h.vy = 0;
         continue;
      }
      if (px < pz) h.x += dx >= 0 ? px : -px;
      else h.z += dz >= 0 ? pz : -pz;
   }
   if (phasing) return;
   for (const w of run.course.ghostWalls) {
      if (h.y > w.y + 1.2 || h.y + HERO_H < w.y - 1.2) continue;
      const hx = w.normal === "x" ? 0.1 : HALF;
      const hz = w.normal === "x" ? HALF : 0.1;
      const dx = h.x - w.x;
      const dz = h.z - w.z;
      const px = hx + HERO_R - Math.abs(dx);
      const pz = hz + HERO_R - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) h.x += dx >= 0 ? px : -px;
      else h.z += dz >= 0 ? pz : -pz;
   }
}

function land(run: NeonRun, id: number, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course.cubes[id];
   h.ground = id;
   h.vy = 0;
   h.y = c.top;
   h.jumps = 0;
   h.jumpedSinceGround = false;
   h.groundMs = 0;
   ev.landed = true;
   ev.landedCube = id;
   if (!run.landed[id]) {
      run.landed[id] = 1;
      chain(run, COMBO_BASE_MS.cube, ev);
   }
   if (c.checkpoint && h.checkpoint !== id) {
      h.checkpoint = id;
      run.cpSolid = run.solid;
      run.parity = 0;
      ev.checkpoint = true;
   }
}

function stepBossMs(run: NeonRun, ev: StepEvents): void {
   const b = run.boss;
   const c = run.course;
   const h = run.hero;
   if (!b || !c.boss) return;
   if (!run.bossAwake) {
      if (h.z < c.boss.wakeZ && h.deadMs < 0) {
         run.bossAwake = true;
         ev.bossWake = true;
      } else return;
   }
   const before = b.phase;
   const bev = stepBoss(b, FLIPFRAME, 1, run.bossEv);
   if (b.phase !== before) ev.bossPhase = true;
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 0) {
         run.stompSet = run.solid;
         run.stompDodged = false;
      } else if (b.phase === 1) run.coreCube = pickCoreCube(run);
   }
   if (bev.attack) {
      ev.bossAttack = true;
      if (b.phase === 0) {
         const g = h.ground >= 0 ? c.cubes[h.ground] : null;
         const onTarget = g !== null && (g.set === "N" || g.set === run.stompSet);
         if (onTarget && run.simMs > h.shieldUntil) hurt(run, ev);
         else {
            run.stompDodged = true;
            ev.dodged = true;
         }
      }
   }
   if (b.phase === 2 && b.step !== "defeat" && b.step !== "done" && b.step !== "intro") {
      if (run.nextAutoFlip < 0) run.nextAutoFlip = run.simMs + OVERDRIVE_MS;
      else if (run.simMs >= run.nextAutoFlip) {
         run.nextAutoFlip += OVERDRIVE_MS;
         flip(run, ev, true);
      }
   }
   if (b.step !== "vulnerable") return;
   if (b.phase === 0 && run.stompDodged) {
      run.stompDodged = false;
      bossHit(run, ev);
   } else if (b.phase === 1 && ev.landed && ev.landedCube === run.coreCube) bossHit(run, ev);
   else if (b.phase === 2 && h.ground === c.boss.towerTop) bossHit(run, ev);
}

/** P2: the nearest arena cube of the hologram set to the hero (not the one he stands on), off the tower. */
function pickCoreCube(run: NeonRun): number {
   const h = run.hero;
   let best = NONE;
   let bestD = Infinity;
   for (const c of run.course.cubes) {
      if (!c.arena || c.tower || (c.set !== "A" && c.set !== "B") || c.set === run.solid || c.id === h.ground) continue;
      const d = Math.hypot(c.x - h.x, c.z - h.z);
      if (d < 1.5) continue;
      if (d < bestD) {
         bestD = d;
         best = c.id;
      }
   }
   return best;
}

function bossHit(run: NeonRun, ev: StepEvents): void {
   const b = run.boss;
   if (!b) return;
   const r = hitBoss(b, FLIPFRAME, 1, run.bossEv);
   if (r === "ignored") return;
   ev.bossHit = true;
   chain(run, COMBO_BASE_MS.boss, ev);
   if (r === "phase") ev.bossPhase = true;
   if (r === "defeated") {
      ev.bossDefeated = true;
      finish(run, ev);
   }
}

const DQ = { x: 0, y: 0, z: 0 };

function stepMs(run: NeonRun, jumpPressed: boolean, actionPressed: boolean, ev: StepEvents): void {
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   const c = run.course;
   const dt = 0.001;
   comboTick(run.combo, COMBO, ms);
   // a co-op partner's jump flipped the shared field
   while (run.pendingFlips > 0) {
      run.pendingFlips -= 1;
      flip(run, ev);
   }
   if (h.deadMs >= 0) {
      h.deadMs += 1;
      if (h.deadMs >= DEAD_MS) respawn(run, ev);
      stepBossMs(run, ev);
      endCheck(run, ev);
      return;
   }
   // rails: a moving cube slides only while solid; whoever stands on it rides
   let carryX = 0;
   let carryZ = 0;
   for (const q of c.cubes) {
      if (!q.rail || !cubeSolid(run, q)) continue;
      cubePos(run, q, PA);
      const x0 = PA.x;
      const z0 = PA.z;
      run.railP[q.id] += RAIL_SPEED * dt;
      cubePos(run, q, PA);
      if (h.ground === q.id) {
         carryX = PA.x - x0;
         carryZ = PA.z - z0;
      }
   }
   if (actionPressed) power(run, ev);
   if (jumpPressed) h.jumpBuf = ms + BUFFER_MS;
   const stunned = ms <= h.stunUntil;
   // the jump: from the ground or within the coyote time; Nami's second jump in the air
   if (h.jumpBuf >= ms && !stunned) {
      const coyote = h.ground < 0 && !h.jumpedSinceGround && h.leftGroundMs >= 0 && ms - h.leftGroundMs <= COYOTE_MS;
      if (h.ground >= 0 || coyote) {
         h.vy = V_JUMP;
         h.ground = NONE;
         h.jumpedSinceGround = true;
         h.jumps = 1;
         h.jumpBuf = NONE;
         run.parity += 1;
         run.ownFlips += 1;
         flip(run, ev);
         ev.jumped = true;
      } else if (h.jumps === 1 && heroById(run.heroId).power === "double") {
         h.vy = V_JUMP2;
         h.jumps = 2;
         h.jumpBuf = NONE;
         run.parity += 1;
         run.ownFlips += 1;
         flip(run, ev);
         ev.doubled = true;
      }
   }
   // the run: camera-relative stick, the dash overrides
   const dashing = ms <= h.dashUntil;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
      h.vy = 0;
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
      // after a dash the speed drops straight back to the run speed (the bound counts on it)
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
   // vertical: land on a solid top crossed this ms
   const prevY = h.y;
   h.y += h.vy * dt;
   if (h.ground < 0 && h.vy <= 0) {
      for (const q of c.cubes) {
         if (prevY < q.top - 0.001 || h.y > q.top || !solidForHero(run, q)) continue;
         cubePos(run, q, PA);
         if (!overlapsPlane(h, PA.x, PA.z, 0.12)) continue;
         land(run, q.id, ev);
         break;
      }
   } else if (h.ground < 0 && h.vy > 0) {
      // the head under a solid cube
      for (const q of c.cubes) {
         const bottom = q.top - 2;
         if (prevY + HERO_H > bottom + 0.001 || h.y + HERO_H < bottom || !solidForHero(run, q)) continue;
         cubePos(run, q, PA);
         if (!overlapsPlane(h, PA.x, PA.z, 0.05)) continue;
         h.vy = 0;
         h.y = bottom - HERO_H;
         break;
      }
   }
   // still standing? (the cube may have turned hologram, or he walked off its edge)
   if (h.ground >= 0) {
      const s = support(run);
      if (s >= 0) {
         if (s !== h.ground) land(run, s, ev);
         h.y = c.cubes[s].top;
         h.groundMs += 1;
         if (h.groundMs > GROUND_BREAK_MS) comboBreak(run.combo);
         const g = c.cubes[s];
         if (g.goal && !c.boss) finish(run, ev);
      } else {
         h.ground = NONE;
         h.leftGroundMs = ms;
         h.vy = Math.min(h.vy, 0);
         ev.walkedOff = true;
      }
   }
   if (run.ended !== null) return;
   // hazards: live lasers, active drones, the void
   const shield = ms <= h.shieldUntil;
   if (!shield) {
      for (const q of c.cubes) {
         if (!q.laser || !laserLive(run, q)) continue;
         if (h.y > q.top + 1.9 || h.y + HERO_H < q.top + 0.2) continue;
         if (Math.abs(h.x - q.x) < HALF + HERO_R && Math.abs(h.z - q.z) < 0.1 + HERO_R) {
            die(run, ev);
            break;
         }
      }
      for (const d of c.drones) {
         if (d.set !== run.solid) continue;
         dronePos(d, ms, DQ);
         if (Math.hypot(h.x - DQ.x, h.y + 0.75 - DQ.y, h.z - DQ.z) < DRONE_R + HERO_R) {
            die(run, ev);
            break;
         }
      }
   }
   if (h.y < VOID_Y) die(run, ev);
   if (h.deadMs >= 0) {
      stepBossMs(run, ev);
      endCheck(run, ev);
      return;
   }
   // pickups
   const my = h.y + 0.75;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.taken[i]) continue;
      const o = c.orbs[i];
      if (Math.hypot(h.x - o.x, my - o.y, h.z - o.z) > PICK_R) continue;
      run.taken[i] = 1;
      run.orbs += 1;
      ev.orb = i;
   }
   if (ms <= h.magnetUntil) {
      for (let i = 0; i < c.coins.length; i++) {
         if (run.coinTaken[i]) continue;
         const o = c.coins[i];
         if (Math.hypot(h.x - o.x, my - o.y, h.z - o.z) > MAGNET_REACH) continue;
         run.coinTaken[i] = 1;
         run.coins += 1;
         ev.coin = i;
      }
   }
   if (run.parity % 2 === 0 && Math.hypot(h.x - c.shard.x, my - c.shard.y, h.z - c.shard.z) <= PICK_R) secret(run, "parity", ev);
   for (const w of c.ghostWalls) {
      if (Math.hypot(h.x - w.crystal.x, my - w.crystal.y, h.z - w.crystal.z) > PICK_R) continue;
      secret(run, w.id === 0 ? "ghost-a" : run.level === 3 ? "ghost-a" : "ghost-b", ev);
   }
   if (c.ledge && Math.hypot(h.x - c.ledge.x, my - c.ledge.y, h.z - c.ledge.z) <= PICK_R) secret(run, "ledge", ev);
   stepBossMs(run, ev);
   endCheck(run, ev);
}

function endCheck(run: NeonRun, ev: StepEvents): void {
   if (run.ended === null && run.simMs >= run.course.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

// ---------- reading the run ----------

export const STAT = {
   solid: "solid",
   parity: "parity",
   orbs: "orbs",
   coins: "coins",
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

export const HINT = { none: 0, flip: 1, noBack: 2, moving: 3, rogue: 4, laser: 5, stomp: 6, core: 7, overdrive: 8, died: 9 } as const;

export function hintFor(run: NeonRun): number {
   if (run.ended !== null) return HINT.none;
   const h = run.hero;
   if (h.deadMs >= 0) return HINT.died;
   const b = run.boss;
   if (b && run.bossAwake && b.step !== "defeat" && b.step !== "done" && b.step !== "intro") return b.phase === 0 ? HINT.stomp : b.phase === 1 ? HINT.core : HINT.overdrive;
   if (run.flips === 0) return HINT.flip;
   const cfg = run.course.cfg;
   if (run.flips < 3 && run.level === 1) return HINT.noBack;
   if (cfg.moving && run.flips < 4) return HINT.moving;
   if (cfg.rogue && run.flips < 4) return HINT.rogue;
   if (cfg.lasers && run.flips < 4) return HINT.laser;
   return HINT.none;
}

/** A time game: a win submits the finish less the bonus (published as STAT.bonusMs before the end). */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.bonusMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: falls, lasers, drones and stomps. */
export function badgeHits(run: NeonRun): number {
   return run.deaths + run.hurts;
}
