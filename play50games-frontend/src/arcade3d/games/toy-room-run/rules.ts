// Toy Room Run rules. Pure and deterministic: one run, stepped in whole milliseconds (the fraction
// carries, so 30, 60 and 144 fps agree). The signature is riding the domino wave: walk into a
// chain's first piece and the wave runs along it at the chain's speed; each piece falls flat as the
// wave reaches it, and pieces over a gap become a walkable bridge that lasts BRIDGE_MS before it
// slides off. A standing piece bounces you back; an empty slot stalls the wave until a spare is
// pushed in; a fork starts a second chain; the wave fires drums, race cars and (level 5) drops books
// on Jack Wobble. The topple is a scripted timeline, never physics.
//
// The proof (README "Score limits"): the hero's centre never moves more than V_RUN / 1000 m in a
// ms, plus the speed of an active boost (Riko's dash, a race car's roof), and both are limited per
// run (DASH_CHARGES, one ride per car). A respawn goes back to a checkpoint already reached. So a
// run takes at least (straight-line distance start -> finish - the finish reach - every boost's
// extra metres) / V_RUN; the submitted time takes off every orb and the most flow bonus. Level 5's
// floor is Jack's least defeat time (every hit on the first instant of its window).
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import {
   BRIDGE_MS,
   CAR_HALF_L,
   CAR_HALF_W,
   CAR_ROOF,
   CHECKPOINT_R,
   DRUM_R,
   DRUM_TOP,
   DRUM_WINDOW_MS,
   FALL_Y,
   FINISH_R,
   HERO_R,
   PICKUP_R,
   PIECE_SPACING,
   TOP_R,
   buildCourse,
   carAt,
   cascadeOn,
   courseFor,
   inPiece,
   inZone,
   onFallen,
   pencilY,
   pushOutOf,
   topAt,
   type Course,
} from "./room";
import { BOXES, LANDING } from "./levels";
import { DASH_BOOST, DASH_CHARGES, DEFAULT_HERO, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, JACK, SECRETS } from "./progression";

export { buildCourse, courseFor };

/** The W4 run speed. Nothing moves the hero faster except a dash or a car roof (counted). */
export const V_RUN = 6.5;
export const G = 30;
export const V_JUMP = 14;
/** Nami's second jump. */
export const V_AIR = 10;
/** The drum's throw (straight up: it adds no horizontal speed). */
export const V_DRUM = 17;
/** Running into a standing piece throws you back at this speed (about 1.5 m). */
export const V_BOUNCE = 5;
export const ORB_BONUS_MS = 150;
export const MAGNET_R = 6;
/** Zuno's magnet pulls a spare piece into its slot from this far. */
export const MAGNET_SPARE_R = 5;
const ACCEL_G = 70;
const ACCEL_A = 24;
const COYOTE = 100;
const BUFFER = 130;
const STEP_UP = 0.75;
const STUN_BOUNCE = 260;
const STUN_KNOCK = 420;
const RESPAWN_MS = 700;
/** A "surf": crossing a gap with the wave front at most this far ahead. */
const SURF_M = 3;

export interface HeroBody {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   coyote: number;
   buffer: number;
   airJumps: number;
   airSpeed: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   dashes: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   powerReadyAt: number;
   stunUntil: number;
   /** the car whose roof the hero stands on, -1 none */
   onCar: number;
   onDrum: number;
   insideGhost: number;
   /** falling to the carpet: respawn at this ms */
   lostUntil: number;
   lastKnockMs: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the orbit camera's yaw: the stick is camera-relative (menu2/camera) */
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   landSpeed: number;
   powered: boolean;
   chainStarted: number;
   /** pieces that fell this step (count) and the last one */
   toppled: number;
   lastToppled: number;
   bounced: boolean;
   spare: number;
   drum: number;
   launched: boolean;
   carStarted: number;
   wallBroken: number;
   knocked: boolean;
   shielded: boolean;
   fell: boolean;
   respawned: boolean;
   checkpoint: number;
   gap: boolean;
   surf: boolean;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboLinked: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   bossHit: boolean;
   bossDefeated: boolean;
   slam: boolean;
   finished: boolean;
   timeup: boolean;
}

/** Chain status: idle (standing), running, done, down (lying flat, level 5 only). */
export type ChainStatus = 0 | 1 | 2 | 3;

export interface ToyRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   hero: HeroBody;
   simMs: number;
   frac: number;
   status: Uint8Array;
   /** per piece: when it falls (Infinity = not yet scheduled) */
   fallAt: Float64Array;
   /** per piece: a spare filled this empty slot */
   filled: Uint8Array;
   /** per spare (flattened over chains): pushed into its slot */
   spareUsed: Uint8Array;
   spares: { x: number; z: number; piece: number; chain: number }[];
   chainSeen: Uint8Array;
   drumFired: Float64Array;
   carStart: Float64Array;
   carDone: Uint8Array;
   wallBroken: Uint8Array;
   checkpoint: number;
   /** the gap (between desks) the hero last stood before, for the gap-cross link */
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   strikes: number;
   bounces: number;
   stalls: number;
   /** metres travelled above V_RUN (dash, car roofs): the proof's budget */
   extraMetres: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   jack: { x: number; z: number; y: number; box: number };
   /** local co-op: chains shared with an ally (multiplayer.ts sets it) */
   ended: "win" | "timeup" | null;
   finishMs: number;
   events: StepEvents;
   wish: { x: number; z: number };
   scratch: { x: number; z: number; yaw: number };
   deskSide: number;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

function makeEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, landSpeed: 0, powered: false, chainStarted: -1, toppled: 0, lastToppled: -1,
      bounced: false, spare: -1, drum: -1, launched: false, carStarted: -1, wallBroken: -1, knocked: false, shielded: false,
      fell: false, respawned: false, checkpoint: -1, gap: false, surf: false,
      orbCount: 0, orbList: new Array<number>(48).fill(0), secretCount: 0, secretList: new Array<number>(4).fill(0), comboLinked: false,
      bossTelegraph: false, bossAttack: false, bossOpen: false, bossHit: false, bossDefeated: false, slam: false, finished: false, timeup: false,
   };
}

function clearEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.powered = e.bounced = e.launched = e.knocked = e.shielded = e.fell = e.respawned = false;
   e.gap = e.surf = e.comboLinked = e.bossTelegraph = e.bossAttack = e.bossOpen = e.bossHit = e.bossDefeated = e.slam = false;
   e.finished = e.timeup = false;
   e.landSpeed = 0;
   e.chainStarted = e.lastToppled = e.spare = e.drum = e.carStarted = e.wallBroken = e.checkpoint = -1;
   e.toppled = e.orbCount = e.secretCount = 0;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): ToyRun {
   const course = courseFor(level);
   const spares: ToyRun["spares"] = [];
   course.chains.forEach((ch, ci) => {
      for (const sp of ch.spec.spares ?? []) spares.push({ x: sp.x, z: sp.z, piece: ch.first + sp.slot, chain: ci });
   });
   const hero: HeroBody = {
      x: course.startX, y: 0, z: course.startZ, vx: 0, vy: 0, vz: 0, grounded: true, coyote: COYOTE, buffer: 0, airJumps: 0, airSpeed: 0,
      dashUntil: -1, dashX: 0, dashZ: 1, dashes: DASH_CHARGES, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, powerReadyAt: 0,
      stunUntil: -1, onCar: -1, onDrum: -1, insideGhost: -1, lostUntil: -1, lastKnockMs: -9999,
   };
   const run: ToyRun = {
      seed, level, heroId, course, hero, simMs: 0, frac: 0,
      status: new Uint8Array(course.chains.length), fallAt: new Float64Array(course.pieces.length).fill(Infinity),
      filled: new Uint8Array(course.pieces.length), spareUsed: new Uint8Array(spares.length), spares,
      chainSeen: new Uint8Array(course.chains.length), drumFired: new Float64Array(course.drums.length).fill(-1),
      carStart: new Float64Array(course.cars.length).fill(-1), carDone: new Uint8Array(course.cars.length),
      wallBroken: new Uint8Array(course.walls.length), checkpoint: 0,
      collected: new Uint8Array(course.orbs.length), orbs: 0, mainOrbs: 0, strikes: 0, bounces: 0, stalls: 0, extraMetres: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      boss: course.boss ? createBoss(JACK) : null, bossEv: createBossEvents(),
      jack: { x: BOXES[1].x, z: BOXES[1].z, y: -2, box: 1 },
      ended: null, finishMs: 0, events: makeEvents(), wish: { x: 0, z: 0 }, scratch: { x: 0, z: 0, yaw: 0 }, deskSide: -1,
   };
   return run;
}

// ---------------------------------------------------------------------------------------------
// chains

function approach(v: number, target: number, maxDelta: number): number {
   const d = target - v;
   if (d > maxDelta) return v + maxDelta;
   if (d < -maxDelta) return v - maxDelta;
   return target;
}

function link(run: ToyRun, ev: StepEvents, base: number): void {
   comboHit(run.combo, COMBO, run.simMs, base);
   if (run.combo.chain > 1) ev.comboLinked = true;
}

/** Is the piece standing (a solid that bounces you)? */
export function pieceStanding(run: ToyRun, i: number): boolean {
   const p = run.course.pieces[i];
   if (p.missing && !run.filled[i]) return false;
   if (run.status[p.chain] === 3) return false;
   return run.fallAt[i] > run.simMs;
}

/** Is the piece lying as a bridge you can stand on (fallen, and not yet slid off)? */
export function pieceBridge(run: ToyRun, i: number): boolean {
   const p = run.course.pieces[i];
   if (p.missing && !run.filled[i]) return false;
   const t = run.fallAt[i];
   if (!(t <= run.simMs)) return false;
   if (!p.gap || run.course.chains[p.chain].spec.untimed) return true;
   return run.simMs < t + BRIDGE_MS;
}

/** Schedules the fall of a chain's pieces from `slot`, which falls at `at`, up to the next empty slot. */
function propagate(run: ToyRun, chain: number, slot: number, at: number): void {
   const ch = run.course.chains[chain];
   const p0 = run.course.pieces[ch.first + slot];
   for (let k = slot; k < ch.count; k++) {
      const i = ch.first + k;
      const p = run.course.pieces[i];
      if (p.missing && !run.filled[i]) {
         run.stalls += 1;
         return;
      }
      if (run.fallAt[i] !== Infinity && run.fallAt[i] <= at + ((p.s - p0.s) * 1000) / ch.speed) continue;
      run.fallAt[i] = at + ((p.s - p0.s) * 1000) / ch.speed;
   }
}

function startChain(run: ToyRun, chain: number, at: number, ev: StepEvents): void {
   if (run.status[chain] !== 0) return;
   run.status[chain] = 1;
   propagate(run, chain, 0, at);
   ev.chainStarted = chain;
   if (!run.chainSeen[chain]) {
      run.chainSeen[chain] = 1;
      link(run, ev, COMBO_BASE_MS.chain);
   }
}

/** Stands a chain back up (a respawn, level 5's re-arm). */
function resetChain(run: ToyRun, chain: number): void {
   const ch = run.course.chains[chain];
   run.status[chain] = 0;
   for (let k = 0; k < ch.count; k++) run.fallAt[ch.first + k] = Infinity;
}

function lastFall(run: ToyRun, chain: number): number {
   const ch = run.course.chains[chain];
   return run.fallAt[ch.first + ch.count - 1];
}

function stepChains(run: ToyRun, ev: StepEvents): void {
   const c = run.course;
   const ms = run.simMs;
   for (let ci = 0; ci < c.chains.length; ci++) {
      const ch = c.chains[ci];
      const st = run.status[ci];
      if (st === 0 && ch.spec.from) {
         const parent = c.chains[ch.spec.from.chain];
         const t = run.fallAt[parent.first + Math.min(ch.spec.from.index, parent.count - 1)];
         if (t <= ms) startChain(run, ci, t, ev);
      }
      if (st === 1) {
         for (let k = 0; k < ch.count; k++) {
            const i = ch.first + k;
            if (run.fallAt[i] <= ms && run.fallAt[i] > ms - 1) {
               ev.toppled += 1;
               ev.lastToppled = i;
            }
         }
         const end = lastFall(run, ci);
         if (end <= ms) run.status[ci] = 2;
      }
      if (run.status[ci] === 2 && ch.spec.rearmMs !== undefined && !run.boss) {
         if (ms >= lastFall(run, ci) + ch.spec.rearmMs) resetChain(run, ci);
      }
   }
   // drums fire the moment the wave hits them; cars drive off
   for (let d = 0; d < c.drums.length; d++) {
      const t = run.fallAt[c.drums[d].piece];
      if (t <= ms && run.drumFired[d] < t) {
         run.drumFired[d] = t;
         ev.drum = d;
      }
   }
   for (let k = 0; k < c.cars.length; k++) {
      if (run.carStart[k] >= 0) continue;
      const t = run.fallAt[c.cars[k].piece];
      if (t <= ms) {
         run.carStart[k] = t;
         ev.carStarted = k;
      }
   }
}

const carPose = { x: 0, z: 0, yaw: 0 };

/** Where car k is this ms (it waits at its start, drives once, parks at the end). */
export function carPoseAt(run: ToyRun, k: number, out: { x: number; z: number; yaw: number }): number {
   const car = run.course.cars[k];
   const t0 = run.carStart[k];
   const d = t0 < 0 ? 0 : Math.min(car.len, ((run.simMs - t0) * car.speed) / 1000);
   carAt(car, d, out);
   return t0 >= 0 && d < car.len ? car.speed : 0;
}

// ---------------------------------------------------------------------------------------------
// Jack Wobble (level 5)

/** Jack's spring height above his box (out = up). */
function stepBossMs(run: ToyRun, ev: StepEvents): void {
   const boss = run.boss!;
   const be = run.bossEv;
   const ms = run.simMs;
   const h = run.hero;
   stepBoss(boss, JACK, 1, be);
   if (be.telegraph) ev.bossTelegraph = true;
   if (be.attack) ev.bossAttack = true;
   if (be.vulnerable) ev.bossOpen = true;
   const ph = boss.phase;
   const step = boss.step;
   const j = run.jack;
   if (ph < 2) {
      j.box = boss.attack % 3;
      j.x = BOXES[j.box].x;
      j.z = BOXES[j.box].z;
      j.y = step === "attack" || step === "vulnerable" ? 2.4 : step === "telegraph" ? 0.3 : -1.5;
   } else if (step === "telegraph") {
      // bouncing round the room
      const k = boss.stepMs / JACK.phases[2].attacks[0].telegraphMs;
      const a = k * Math.PI * 2.5;
      j.x = Math.sin(a) * 9;
      j.z = 18 + Math.cos(a * 0.8) * 6;
      j.y = 4 * Math.abs(Math.sin(a * 2));
   } else if (step === "attack" || step === "vulnerable") {
      j.x = LANDING.x;
      j.z = LANDING.z;
      j.y = 0;
   }
   // which chains stand: Whack: the three box chains (each stands back up 2.5 s after a try);
   // Throwback: only the chain he spits toward his box, while he is out; Bounce: the giant line
   if (ph === 0) {
      run.status[3] = 3;
      for (let k = 0; k < 3; k++) if (run.status[k] === 2 && ms >= lastFall(run, k) + 2500) resetChain(run, k);
   } else if (ph === 1) {
      run.status[3] = 3;
      if (be.telegraph) resetChain(run, j.box);
      for (let k = 0; k < 3; k++) if (k !== j.box || step === "transition") run.status[k] = 3;
   } else {
      for (let k = 0; k < 3; k++) run.status[k] = 3;
      if (run.status[3] === 3 || (run.status[3] === 2 && ms >= lastFall(run, 3) + 2500)) resetChain(run, 3);
   }
   // the landing slam (phase 3): keep clear
   if (ph === 2 && step === "attack" && boss.stepMs < 2 && Math.hypot(h.x - LANDING.x, h.z - LANDING.z) < 3.6 && h.y < 1.5) knock(run, ev, h.x - LANDING.x, h.z - LANDING.z, true);
   if (step !== "vulnerable") return;
   let hit = false;
   if (ph < 2) {
      const t = lastFall(run, j.box);
      if (t <= ms && t > ms - 1) hit = true;
   } else {
      const t = lastFall(run, 3);
      if (t <= ms && t > ms - 1) hit = true;
   }
   if (!hit) return;
   const r = hitBoss(boss, JACK, 1, be);
   if (r === "ignored") return;
   ev.bossHit = true;
   if (ph === 2 || r === "phase") ev.slam = true;
   link(run, ev, COMBO_BASE_MS.hit);
   if (r === "defeated") {
      ev.bossDefeated = true;
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

// ---------------------------------------------------------------------------------------------
// the hero

function knock(run: ToyRun, ev: StepEvents, dx: number, dz: number, strike: boolean): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms - h.lastKnockMs < 600) return;
   if (h.shieldUntil >= ms) {
      ev.shielded = true;
      return;
   }
   h.lastKnockMs = ms;
   const m = Math.hypot(dx, dz) || 1;
   h.vx = (dx / m) * V_BOUNCE;
   h.vz = (dz / m) * V_BOUNCE;
   h.vy = Math.max(h.vy, 4);
   h.grounded = false;
   h.airSpeed = V_BOUNCE;
   h.stunUntil = ms + STUN_KNOCK;
   if (strike) run.strikes += 1;
   comboBreak(run.combo);
   ev.knocked = true;
}

function tryPower(run: ToyRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < h.powerReadyAt || ms < h.stunUntil || ms < h.lostUntil) return;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") return;
   if (def.power === "dash") {
      if (h.dashes <= 0) return;
      inputToWorld(input.moveX, input.moveZ, input.yaw, run.wish);
      let dx = run.wish.x;
      let dz = run.wish.z;
      const m = Math.hypot(dx, dz);
      if (m < 0.2) {
         const s = Math.hypot(h.vx, h.vz);
         dx = s > 0.2 ? h.vx / s : 0;
         dz = s > 0.2 ? h.vz / s : 1;
      } else {
         dx /= m;
         dz /= m;
      }
      h.dashX = dx;
      h.dashZ = dz;
      h.dashUntil = ms + POWER_MS.dash;
      h.dashes -= 1;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   h.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function respawn(run: ToyRun, ev: StepEvents): void {
   const h = run.hero;
   const cp = run.course.checkpoints[run.checkpoint];
   h.x = cp.x;
   h.z = cp.z;
   h.y = 0;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.onCar = -1;
   h.lostUntil = -1;
   // a chain whose bridge slid off stands back up: walk into it again
   const c = run.course;
   for (let ci = 0; ci < c.chains.length; ci++) {
      if (c.chains[ci].spec.untimed || run.status[ci] === 0 || run.status[ci] === 3) continue;
      const ch = c.chains[ci];
      let gone = false;
      for (let k = 0; k < ch.count; k++) {
         const i = ch.first + k;
         if (c.pieces[i].gap && run.fallAt[i] + BRIDGE_MS <= run.simMs) gone = true;
      }
      if (gone || run.status[ci] === 1) resetChain(run, ci);
   }
   ev.respawned = true;
}

const pushed = { x: 0, z: 0 };

function stepMs(run: ToyRun, input: StepInput, ev: StepEvents): void {
   if (run.ended) return;
   const c = run.course;
   if (run.simMs >= c.timerMs) {
      run.ended = "timeup";
      ev.timeup = true;
      return;
   }
   run.simMs += 1;
   const ms = run.simMs;
   const h = run.hero;
   comboTick(run.combo, COMBO, ms);
   stepChains(run, ev);
   if (h.lostUntil >= 0) {
      if (ms >= h.lostUntil) respawn(run, ev);
      if (run.boss) stepBossMs(run, ev);
      return;
   }
   const shield = h.shieldUntil >= ms;
   const dashing = h.dashUntil >= ms;
   const stunned = ms < h.stunUntil;
   if (h.buffer > 0) h.buffer -= 1;

   // --- horizontal
   inputToWorld(input.moveX, input.moveZ, input.yaw, run.wish);
   let dirX = run.wish.x;
   let dirZ = run.wish.z;
   const mag = Math.hypot(dirX, dirZ);
   const stick = mag > 1 ? 1 : mag;
   if (mag > 1e-6) {
      dirX /= mag;
      dirZ /= mag;
   }
   if (stunned) {
      h.vx *= 0.994;
      h.vz *= 0.994;
   } else if (dashing) {
      h.vx = h.dashX * (V_RUN + DASH_BOOST);
      h.vz = h.dashZ * (V_RUN + DASH_BOOST);
   } else if (h.grounded) {
      const accel = ACCEL_G * 0.001;
      h.vx = approach(h.vx, dirX * stick * V_RUN, accel);
      h.vz = approach(h.vz, dirZ * stick * V_RUN, accel);
   } else {
      const cap = Math.min(V_RUN, Math.max(3, h.airSpeed));
      h.vx = approach(h.vx, dirX * stick * cap, ACCEL_A * 0.001);
      h.vz = approach(h.vz, dirZ * stick * cap, ACCEL_A * 0.001);
   }
   // a car roof carries you
   let carry = 0;
   let carryX = 0;
   let carryZ = 0;
   if (h.onCar >= 0) {
      const sp = carPoseAt(run, h.onCar, carPose);
      if (sp > 0) {
         carry = sp;
         carryX = Math.sin(carPose.yaw) * sp;
         carryZ = Math.cos(carPose.yaw) * sp;
      }
   }
   const px = h.x;
   const pz = h.z;
   let nx = px + (h.vx + carryX) * 0.001;
   let nz = pz + (h.vz + carryZ) * 0.001;
   // solids: the castle, unbroken block walls, the ghost doorway (unless phasing or already inside)
   for (const z of c.castleWalls) if (pushOutOf(z, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   for (let w = 0; w < c.walls.length; w++) {
      if (run.wallBroken[w]) continue;
      const z = c.walls[w];
      if (dashing && inZone(z, nx, nz, HERO_R + 0.4)) {
         run.wallBroken[w] = 1;
         ev.wallBroken = w;
         continue;
      }
      if (pushOutOf(z, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   }
   const phase = h.phaseUntil >= ms;
   let ghostNow = -1;
   for (let g = 0; g < c.ghosts.length; g++) {
      const z = c.ghosts[g];
      if (phase || h.insideGhost === g) {
         if (inZone(z, nx, nz, HERO_R)) ghostNow = g;
         continue;
      }
      if (pushOutOf(z, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   }
   h.insideGhost = ghostNow;
   // level 5: the toyboxes are solid
   if (run.boss) {
      for (const b of BOXES) if (pushOutOf({ x0: b.x - 1.3, x1: b.x + 1.3, z0: b.z - 1.3, z1: b.z + 1.3 }, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   }
   // standing pieces: a starter starts its chain, any other bounces you back
   if (h.y < 2) {
      for (let i = 0; i < c.pieces.length; i++) {
         const p = c.pieces[i];
         if (Math.abs(p.x - nx) > 1.6 || Math.abs(p.z - nz) > 1.6) continue;
         if (!pieceStanding(run, i)) continue;
         const hit = inPiece(p, nx, nz);
         if (!hit) continue;
         const ci = p.chain;
         if (p.slot === 0 && run.status[ci] === 0 && !c.chains[ci].spec.from) {
            startChain(run, ci, ms, ev);
            continue;
         }
         // back out the way you came, and a bounce
         const s = hit.along >= 0 ? 1 : -1;
         nx = px;
         nz = pz;
         if (ms - h.lastKnockMs > 400) {
            h.lastKnockMs = ms;
            h.vx = p.dx * s * V_BOUNCE;
            h.vz = p.dz * s * V_BOUNCE;
            h.stunUntil = ms + STUN_BOUNCE;
            run.bounces += 1;
            ev.bounced = true;
         }
         break;
      }
   }
   // the pencil ramp's sides are a wall to a hero below its surface
   const rampHere = pencilY(c, nx, nz);
   if (rampHere - h.y > STEP_UP && h.vy <= 0.5) {
      nx = px;
      nz = pz;
   }
   // cars are solid at street level: they shove you aside
   for (let k = 0; k < c.cars.length; k++) {
      if (k === h.onCar) continue;
      const sp = carPoseAt(run, k, carPose);
      if (h.y >= CAR_ROOF - 0.4) continue;
      const fx = Math.sin(carPose.yaw);
      const fz = Math.cos(carPose.yaw);
      const rx = nx - carPose.x;
      const rz = nz - carPose.z;
      const along = rx * fx + rz * fz;
      const side = rx * fz - rz * fx;
      if (Math.abs(along) > CAR_HALF_L + HERO_R || Math.abs(side) > CAR_HALF_W + HERO_R) continue;
      nx = px;
      nz = pz;
      if (sp > 0) knock(run, ev, fz * Math.sign(side || 1), -fx * Math.sign(side || 1), true);
   }
   // the proof's invariant: V_RUN, plus an active boost, per ms
   const allow = (V_RUN + (dashing ? DASH_BOOST : 0) + Math.max(0, carry - V_RUN) + (carry > 0 ? 0 : 0)) * 0.001;
   const mx = nx - px;
   const mz = nz - pz;
   let moved = Math.hypot(mx, mz);
   if (moved > allow) {
      nx = px + (mx / moved) * allow;
      nz = pz + (mz / moved) * allow;
      moved = allow;
   }
   if (moved > V_RUN * 0.001) run.extraMetres += moved - V_RUN * 0.001;
   h.x = nx;
   h.z = nz;

   // spares: walk into one (or Zuno's magnet within 5 m) and it slides into its empty slot
   const magnet = h.magnetUntil >= ms;
   for (let s = 0; s < run.spares.length; s++) {
      if (run.spareUsed[s]) continue;
      const sp = run.spares[s];
      const d = Math.hypot(h.x - sp.x, h.z - sp.z);
      if (d > 1.2 && !(magnet && d <= MAGNET_SPARE_R)) continue;
      run.spareUsed[s] = 1;
      run.filled[sp.piece] = 1;
      ev.spare = s;
      // a stalled wave picks up again
      const ch = c.chains[sp.chain];
      const slot = sp.piece - ch.first;
      const before = slot > 0 ? run.fallAt[sp.piece - 1] : Infinity;
      if (before !== Infinity) propagate(run, sp.chain, slot, Math.max(ms + 300, before + (PIECE_SPACING * 1000) / ch.speed));
   }

   // --- vertical
   const canGround = h.grounded || h.coyote > 0;
   if (!stunned && h.buffer > 0 && canGround && h.vy <= 0.01) {
      h.vy = V_JUMP;
      h.grounded = false;
      h.coyote = 0;
      h.buffer = 0;
      h.airJumps = run.heroId === "nami" ? 1 : 0;
      h.airSpeed = Math.min(V_RUN, Math.hypot(h.vx, h.vz));
      if (h.onCar >= 0) h.onCar = -1;
      ev.jumped = true;
   } else if (!stunned && h.buffer > 0 && !h.grounded && h.airJumps > 0) {
      h.vy = V_AIR;
      h.airJumps = 0;
      h.buffer = 0;
      ev.airJumped = true;
      ev.powered = true;
   }
   let surf = -Infinity;
   for (const p of c.plats) {
      if (h.x >= p.x0 && h.x <= p.x1 && h.z >= p.z0 && h.z <= p.z1 && p.y <= h.y + STEP_UP && p.y > surf) surf = p.y;
   }
   if (rampHere > 0 && rampHere > surf) surf = rampHere;
   for (let i = 0; i < c.pieces.length; i++) {
      const p = c.pieces[i];
      if (!p.gap || Math.abs(p.x - h.x) > 2.2 || Math.abs(p.z - h.z) > 2.2) continue;
      if (pieceBridge(run, i) && onFallen(p, h.x, h.z) && 0 > surf && h.y >= -0.6) surf = 0;
   }
   let drumHere = -1;
   for (let d = 0; d < c.drums.length; d++) {
      const dr = c.drums[d];
      if (Math.hypot(h.x - dr.x, h.z - dr.z) <= DRUM_R && h.y >= DRUM_TOP - STEP_UP && DRUM_TOP > surf) {
         surf = DRUM_TOP;
         drumHere = d;
      }
   }
   let carHere = -1;
   for (let k = 0; k < c.cars.length; k++) {
      carPoseAt(run, k, carPose);
      const fx = Math.sin(carPose.yaw);
      const fz = Math.cos(carPose.yaw);
      const rx = h.x - carPose.x;
      const rz = h.z - carPose.z;
      if (Math.abs(rx * fx + rz * fz) <= CAR_HALF_L && Math.abs(rx * fz - rz * fx) <= CAR_HALF_W && h.y >= CAR_ROOF - 0.4 && CAR_ROOF > surf) {
         surf = CAR_ROOF;
         carHere = k;
      }
   }
   if (h.grounded) {
      if (surf !== -Infinity && surf <= h.y + STEP_UP && surf >= h.y - 0.3) {
         h.y = surf;
         h.vy = 0;
      } else {
         h.grounded = false;
         h.coyote = COYOTE;
         h.airSpeed = Math.min(V_RUN, Math.hypot(h.vx, h.vz));
         h.airJumps = run.heroId === "nami" ? 1 : 0;
      }
   }
   if (!h.grounded) {
      h.vy -= G * 0.001;
      h.y += h.vy * 0.001;
      if (h.coyote > 0) h.coyote -= 1;
      if (surf !== -Infinity && h.vy <= 0 && h.y <= surf && h.y >= surf - 0.9) {
         ev.landed = true;
         ev.landSpeed = -h.vy;
         h.y = surf;
         h.vy = 0;
         h.grounded = true;
         h.coyote = COYOTE;
      }
   }
   h.onCar = h.grounded ? carHere : -1;
   h.onDrum = h.grounded ? drumHere : -1;
   // the drum throws whoever stands on it as the wave hits it
   if (h.onDrum >= 0) {
      const t = run.drumFired[h.onDrum];
      if (t >= 0 && ms - t <= DRUM_WINDOW_MS) {
         h.vy = V_DRUM;
         h.grounded = false;
         h.onDrum = -1;
         h.airSpeed = Math.min(V_RUN, Math.hypot(h.vx, h.vz));
         ev.launched = true;
      }
   }
   if (h.y < FALL_Y) {
      h.lostUntil = ms + RESPAWN_MS;
      comboBreak(run.combo);
      ev.fell = true;
      if (run.boss) stepBossMs(run, ev);
      return;
   }

   // --- the gap links: a desk left behind, the wave close ahead (a surf)
   const side = deskIndex(c, h.x, h.z);
   if (h.grounded && side >= 0 && side !== run.deskSide) {
      if (run.deskSide >= 0 && side > run.deskSide) {
         ev.gap = true;
         const surfing = waveAhead(run, h.x, h.z) <= SURF_M;
         if (surfing) ev.surf = true;
         link(run, ev, surfing ? COMBO_BASE_MS.surf : COMBO_BASE_MS.gap);
      }
      run.deskSide = side;
   }

   // --- hazards
   if (h.y < 1.5) {
      for (let i = 0; i < c.cascades.length; i++) {
         if (!cascadeOn(i, ms) || !inZone(c.cascades[i], h.x, h.z)) continue;
         knock(run, ev, 0, -1, true);
      }
      for (let i = 0; i < c.tops.length; i++) {
         topAt(c.tops[i], i, ms, pushed);
         const dx = h.x - pushed.x;
         const dz = h.z - pushed.z;
         if (dx * dx + dz * dz < TOP_R * TOP_R) knock(run, ev, dx, dz, true);
      }
   }

   // --- checkpoints, orbs, secrets, the finish
   for (let k = run.checkpoint + 1; k < c.checkpoints.length; k++) {
      const cp = c.checkpoints[k];
      if (Math.hypot(h.x - cp.x, h.z - cp.z) <= CHECKPOINT_R) {
         run.checkpoint = k;
         ev.checkpoint = k;
      }
   }
   const oy = h.y + 0.6;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      if (o.hidden && !magnet) continue;
      const reach = magnet ? MAGNET_R : PICKUP_R;
      const dx = h.x - o.x;
      const dy = oy - o.y;
      const dz = h.z - o.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.main) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      link(run, ev, COMBO_BASE_MS.orb);
   }
   for (let i = 0; i < c.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = c.secrets[i];
      const dx = h.x - s.x;
      const dy = oy - s.y;
      const dz = h.z - s.z;
      if (dx * dx + dy * dy + dz * dz > PICKUP_R * PICKUP_R) continue;
      if (collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
   }
   if (run.boss) stepBossMs(run, ev);
   else if (Math.hypot(h.x - c.finish.x, h.z - c.finish.z) <= FINISH_R && h.y < 2) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
   if (!run.ended && run.simMs >= c.timerMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

/** Which desk (index into the y = 0 plats in z order) a point is on, -1 none. */
export function deskIndex(c: Course, x: number, z: number): number {
   let k = -1;
   for (let i = 0; i < c.plats.length; i++) {
      const p = c.plats[i];
      if (p.y !== 0) continue;
      k += 1;
      if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return k;
   }
   return -1;
}

/** How far ahead (m) the nearest running wave front is from a point (Infinity if none near). */
export function waveAhead(run: ToyRun, x: number, z: number): number {
   const c = run.course;
   let best = Infinity;
   for (let ci = 0; ci < c.chains.length; ci++) {
      if (run.status[ci] !== 1 && run.status[ci] !== 2) continue;
      const ch = c.chains[ci];
      for (let k = 0; k < ch.count; k++) {
         const i = ch.first + k;
         if (run.fallAt[i] > run.simMs) continue;
         const next = k + 1 < ch.count ? ch.first + k + 1 : -1;
         if (next >= 0 && run.fallAt[next] <= run.simMs) continue;
         const p = c.pieces[i];
         const d = Math.hypot(p.x - x, p.z - z);
         if (d < best) best = d;
      }
   }
   return best;
}

/**
 * Advances the run by dtMs (any frame time): whole ms are simulated, the fraction carries. The jump
 * and power presses of the frame count once.
 */
export function step(run: ToyRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   clearEvents(ev);
   if (run.ended || !(dtMs > 0)) return ev;
   if (input.jumpPressed) run.hero.buffer = BUFFER;
   if (input.actionPressed) tryPower(run, input, ev);
   run.frac += dtMs;
   let n = Math.floor(run.frac);
   run.frac -= n;
   const room = run.course.timerMs - run.simMs;
   if (n > room) n = room + 1;
   for (let i = 0; i < n && !run.ended; i++) stepMs(run, input, ev);
   return ev;
}

// ---------------------------------------------------------------------------------------------
// the proof

/** The least rules-time to beat Jack: every hit on the first instant of its window. */
export function bossMinMs(): number {
   const s = createBoss(JACK);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 400_000 && s.step !== "defeat" && s.step !== "done"; guard++) {
      if (s.step === "vulnerable") {
         const r = hitBoss(s, JACK, 1, ev);
         if (r === "defeated") return t;
         continue;
      }
      stepBoss(s, JACK, 1, ev);
      t += 1;
   }
   return t;
}

/** The most metres any run can gain over V_RUN: every dash charge, every car ride. */
export function boostBudgetMetres(c: Course): number {
   let m = DASH_CHARGES * (POWER_MS.dash / 1000) * DASH_BOOST;
   for (const car of c.cars) m += Math.max(0, car.speed - V_RUN) * (car.len / car.speed);
   return m;
}

/** The least distance (m) to the finish: the straight line, less its reach. */
export function travelMetres(c: Course): number {
   return Math.max(0, Math.hypot(c.finish.x - c.startX, c.finish.z - c.startZ) - FINISH_R);
}

export function minFinishMs(c: Course): number {
   if (c.boss) return bossMinMs();
   return (Math.max(0, travelMetres(c) - boostBudgetMetres(c)) / V_RUN) * 1000;
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   const desks = c.plats.filter((p) => p.y === 0).length;
   return {
      combo: COMBO,
      sources: [
         { count: c.chains.length, base: COMBO_BASE_MS.chain },
         { count: Math.max(0, desks - 1), base: Math.max(COMBO_BASE_MS.gap, COMBO_BASE_MS.surf) },
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: c.boss ? JACK.maxHp : 0, base: COMBO_BASE_MS.hit },
      ],
   };
}

export function minDurationMsOf(c: Course): number {
   const bonus = c.orbs.length * ORB_BONUS_MS + comboMaxBonus(comboSpecOf(c));
   return Math.max(0, minFinishMs(c) - bonus);
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(_id: LevelId, c: Course): LevelLimits {
   const least = minDurationMsOf(c);
   const minDurationMs = Math.floor((least * 0.95) / 100) * 100;
   const timeBaseMs = c.timerMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 0, timeBaseMs: 0 },
   2: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 0, timeBaseMs: 0 },
   3: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 0, timeBaseMs: 0 },
   4: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 0, timeBaseMs: 0 },
   5: { kind: "time", maxScore: 0, minDurationMs: 0, maxDurationMs: 0, timeBaseMs: 0 },
};

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB_BONUS_MS - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: never knocked by a cascade, a top, a car or Jack. Bounces off a piece don't count. */
export function badgeHits(run: ToyRun): number {
   return run.strikes;
}

/** Where the hero should head: the next standing starter / spare / the finish, or Jack's spot. */
export function guidePoint(run: ToyRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const c = run.course;
   const h = run.hero;
   out.y = 0;
   if (run.boss && run.boss.hp > 0) {
      const ph = run.boss.phase;
      const ch = c.chains[ph === 2 ? 3 : run.jack.box];
      const p = c.pieces[ch.first];
      out.x = p.x;
      out.z = p.z;
      return out;
   }
   // the nearest idle starter ahead of the hero, else the finish
   let best = Infinity;
   out.x = c.finish.x;
   out.z = c.finish.z;
   for (let ci = 0; ci < c.chains.length; ci++) {
      if (run.status[ci] !== 0 || c.chains[ci].spec.from) continue;
      const p = c.pieces[c.chains[ci].first];
      if (p.z < h.z - 2) continue;
      const d = p.z - h.z;
      if (d < best) {
         best = d;
         out.x = p.x;
         out.z = p.z;
      }
   }
   for (let s = 0; s < run.spares.length; s++) {
      if (run.spareUsed[s]) continue;
      const sp = run.spares[s];
      const d = sp.z - h.z;
      if (d > -2 && d < best) {
         best = d;
         out.x = sp.x;
         out.z = sp.z;
      }
   }
   return out;
}

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   hero: "hero",
   power: "power",
   dashes: "dashes",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   chainLen: "chainLen",
   wave: "wave",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossOn: "bossOn",
   progress: "progress",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   strikes: "strikes",
} as const;
