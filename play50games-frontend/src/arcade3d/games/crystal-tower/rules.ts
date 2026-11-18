// Crystal Tower rules. Pure and deterministic: one run, stepped in whole milliseconds (the fraction
// carries, so 30, 60 and 144 fps agree). The signature is the memory climb: stand in a tier's
// sequence beacon and it shows a colour sequence (one colour every SHOW_STEP_MS, the matching
// crystal pulsing); stay in the ring to the end, then climb and touch the tier's crystals in that
// order. A wrong crystal shoves you back onto the pad and the sequence starts over (the beacon
// shows it again if you step back in). A full sequence arms the next beacon up. The summit crystal
// ends the run once every tier is done; on level 5 the summit beacon wakes Prism Shade, whose
// attacks are sequences of their own (progression.ts PRISM).
//
// The proof (README "Score limits"): the hero's centre never moves more than V_RUN / 1000 m in a
// ms, plus the speed of an active boost (Riko's dash: DASH_CHARGES x POWER_MS.dash x DASH_BOOST
// metres a run; a sliding pad is slower than V_RUN, so a ride adds nothing). The shows are serial:
// show k starts with the hero inside beacon k's ring, ends with the hero inside RING of it (else it
// is cancelled), round k cannot end before show k ends, and beacon k+1 only arms after round k. A
// respawn goes back to a beacon already reached. So a run takes at least every show plus the
// straight-line travel start -> beacon 1 -> ... -> beacon n -> summit (each end less the ring reach)
// at V_RUN, less the dash budget; the submitted time takes off every gem and the most flow bonus.
// Level 5 adds Prism Shade's least defeat time (every hit on the first instant of its window).
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld, rngNext, type RngState } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import {
   BEACON_R,
   CORE_R,
   CRUMBLE_MS,
   CRYSTAL_LIFT,
   CRYSTAL_R,
   DRONE_R,
   FALL_DROP,
   FINISH_R,
   GONE_MS,
   MAGNET_CRYSTAL_R,
   MAGNET_R,
   PICKUP_R,
   RING,
   SHOW_STEP_MS,
   STEP_UP,
   STORM_R,
   WAVE_HALF_W,
   buildCourse,
   courseFor,
   crystalAt,
   droneAt,
   inDiscBand,
   padCenterAt,
   padSpeedAt,
   pushOutOfDisc,
   showMs,
   stormOn,
   waveRadius,
   type Course,
} from "./tower";
import { DASH_BOOST, DASH_CHARGES, DEFAULT_HERO, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, PRISM, SECRETS } from "./progression";

export { buildCourse, courseFor };

/** The W5 run speed. Nothing moves the hero faster except a dash (counted). */
export const V_RUN = 6.5;
export const G = 30;
export const V_JUMP = 14;
/** Nyla's second jump. */
export const V_AIR = 10;
/** A knock throws you at this speed (about 0.7 m). */
export const V_BOUNCE = 5;
export const ORB_BONUS_MS = 150;
const ACCEL_G = 70;
const ACCEL_A = 24;
/** glass pads: this share of the grip */
const SLICK_K = 0.35;
const COYOTE = 100;
const BUFFER = 130;
const STUN_KNOCK = 420;
const RESPAWN_MS = 700;
/** a crystal you have just touched right stays safe (no wrong) this long: a teammate or a lingering hero */
export const SAFE_MS = 3000;
/** the most boss sequence colours (PRISM telegraphs) */
const BOSS_SEQ_MAX = 8;

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
   /** the magnet pulls one crystal per activation */
   magnetPull: boolean;
   phaseUntil: number;
   powerReadyAt: number;
   stunUntil: number;
   /** the pad the hero stands on, -1 none */
   onPad: number;
   /** fallen into the cosmos: respawn at this ms */
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
   /** a tier's show started / stepped (colour `showColor`) / ended / was cancelled (the tier index, -1 none) */
   showStart: number;
   showStep: number;
   showColor: number;
   showDone: number;
   showCancel: number;
   /** a correct crystal (its index), a wrong one, a tier's round done, the next beacon armed */
   pick: number;
   wrong: number;
   roundDone: number;
   beaconArmed: number;
   knocked: boolean;
   shielded: boolean;
   fell: boolean;
   respawned: boolean;
   checkpoint: number;
   wallBroken: number;
   crumble: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboLinked: boolean;
   bossWake: boolean;
   bossTelegraph: boolean;
   /** the boss's show stepped (colour `showColor`) */
   bossShowStep: number;
   bossAttack: boolean;
   bossShuffle: boolean;
   bossOpen: boolean;
   bossMiss: boolean;
   bossHit: boolean;
   bossDefeated: boolean;
   finished: boolean;
   timeup: boolean;
}

export interface TierState {
   seq: Uint8Array;
   /** correct crystals so far */
   progress: number;
   /** the show running (its start ms), -1 none */
   showStart: number;
   /** the run (seat) whose hero stands in the ring for it: only that one can cancel or end it (co-op shares tiers) */
   showOwner: number;
   /** the show has run to its end at least once: the crystals are live */
   shown: boolean;
   done: boolean;
}

export interface TowerRun {
   seed: number;
   /** the player this run belongs to (0 solo; multiplayer.ts numbers the seats) */
   seat: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   hero: HeroBody;
   simMs: number;
   frac: number;
   rng: RngState;
   tiers: TierState[];
   /** the lowest tier not done (= the armed beacon) */
   tier: number;
   /** per crystal: 0 outside its rest reach, 1 inside (not yet counted), 2 counted this visit */
   inside: Uint8Array;
   /** per crystal: a right touch keeps it safe (no wrong) until this ms (-1 none); co-op shares it */
   crystalSafe: Float64Array;
   bossSafe: Float64Array;
   /** per pad: when it began to crumble, -1 none */
   crumbleAt: Float64Array;
   wallBroken: Uint8Array;
   /** the beacon the hero respawns at (tier index), -1 the start */
   checkpoint: number;
   /** the hero was inside the armed beacon's ring last ms (a repeat show needs a fresh entry) */
   ringIn: boolean;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   /** knocks and wrong crystals (the no-hit badge) */
   strikes: number;
   wrongs: number;
   falls: number;
   /** metres travelled above V_RUN (the dash): the proof's budget */
   extraMetres: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   bossSeq: Uint8Array;
   bossLen: number;
   bossProgress: number;
   /** colour -> the arena slot its crystal stands in */
   bossSlot: Uint8Array;
   bossInside: Uint8Array;
   /** the colours' colours are hidden (Blackout, from its shockwave to the hit) */
   bossDark: boolean;
   /** the order is flipped (Mirror, from its shockwave) */
   bossMirror: boolean;
   ended: "win" | "timeup" | null;
   finishMs: number;
   events: StepEvents;
   wish: { x: number; z: number };
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

function makeEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, landSpeed: 0, powered: false,
      showStart: -1, showStep: -1, showColor: -1, showDone: -1, showCancel: -1,
      pick: -1, wrong: -1, roundDone: -1, beaconArmed: -1,
      knocked: false, shielded: false, fell: false, respawned: false, checkpoint: -1, wallBroken: -1, crumble: -1,
      orbCount: 0, orbList: new Array<number>(48).fill(0), secretCount: 0, secretList: new Array<number>(4).fill(0), comboLinked: false,
      bossWake: false, bossTelegraph: false, bossShowStep: -1, bossAttack: false, bossShuffle: false, bossOpen: false, bossMiss: false, bossHit: false, bossDefeated: false,
      finished: false, timeup: false,
   };
}

function clearEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.powered = e.knocked = e.shielded = e.fell = e.respawned = e.comboLinked = false;
   e.bossWake = e.bossTelegraph = e.bossAttack = e.bossShuffle = e.bossOpen = e.bossMiss = e.bossHit = e.bossDefeated = e.finished = e.timeup = false;
   e.landSpeed = 0;
   e.showStart = e.showStep = e.showColor = e.showDone = e.showCancel = e.pick = e.wrong = e.roundDone = e.beaconArmed = -1;
   e.checkpoint = e.wallBroken = e.crumble = e.bossShowStep = -1;
   e.orbCount = e.secretCount = 0;
}

/** A colour sequence with no two alike in a row. */
function fillSequence(rng: RngState, out: Uint8Array, len: number, colors: number): void {
   for (let i = 0; i < len; i++) {
      let c = Math.floor(rngNext(rng) * colors) % colors;
      if (i > 0 && c === out[i - 1]) c = (c + 1) % colors;
      out[i] = c;
   }
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): TowerRun {
   const course = courseFor(level);
   const rng: RngState = { s: seed };
   const tiers: TierState[] = course.tiers.map((t) => {
      const seq = new Uint8Array(Math.max(1, t.seqLen));
      fillSequence(rng, seq, t.seqLen, course.colors);
      return { seq, progress: 0, showStart: -1, showOwner: 0, shown: false, done: false };
   });
   const hero: HeroBody = {
      x: course.startX, y: course.startY, z: course.startZ, vx: 0, vy: 0, vz: 0, grounded: true, coyote: COYOTE, buffer: 0, airJumps: 0, airSpeed: 0,
      dashUntil: -1, dashX: 0, dashZ: 1, dashes: DASH_CHARGES, shieldUntil: -1, magnetUntil: -1, magnetPull: false, phaseUntil: -1, powerReadyAt: 0,
      stunUntil: -1, onPad: 0, lostUntil: -1, lastKnockMs: -9999,
   };
   const bossSlot = new Uint8Array(5);
   for (let i = 0; i < 5; i++) bossSlot[i] = i;
   return {
      seed, seat: 0, level, heroId, course, hero, simMs: 0, frac: 0, rng, tiers, tier: 0,
      inside: new Uint8Array(course.crystals.length), crystalSafe: new Float64Array(course.crystals.length).fill(-1), bossSafe: new Float64Array(5).fill(-1), crumbleAt: new Float64Array(course.pads.length).fill(-1),
      wallBroken: new Uint8Array(course.walls.length), checkpoint: -1, ringIn: false,
      collected: new Uint8Array(course.orbs.length), orbs: 0, mainOrbs: 0, strikes: 0, wrongs: 0, falls: 0, extraMetres: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      boss: course.boss ? createBoss(PRISM) : null, bossEv: createBossEvents(), bossAwake: false,
      bossSeq: new Uint8Array(BOSS_SEQ_MAX), bossLen: 0, bossProgress: 0, bossSlot, bossInside: new Uint8Array(5), bossDark: false, bossMirror: false,
      ended: null, finishMs: 0, events: makeEvents(), wish: { x: 0, z: 0 },
   };
}

// ---------------------------------------------------------------------------------------------
// queries the bot, scene and proof share

function approach(v: number, target: number, maxDelta: number): number {
   const d = target - v;
   if (d > maxDelta) return v + maxDelta;
   if (d < -maxDelta) return v - maxDelta;
   return target;
}

function link(run: TowerRun, ev: StepEvents, base: number): void {
   comboHit(run.combo, COMBO, run.simMs, base);
   if (run.combo.chain > 1) ev.comboLinked = true;
}

/** Is pad i there this ms (a crumbled one is away for GONE_MS)? */
export function padAvailable(run: TowerRun, i: number): boolean {
   const t = run.crumbleAt[i];
   if (t < 0) return true;
   return run.simMs <= t + CRUMBLE_MS || run.simMs >= t + CRUMBLE_MS + GONE_MS;
}

/** The tier's crystals are live: shown, no show running, round not done. */
export function tierLive(run: TowerRun, t: number): boolean {
   const ts = run.tiers[t];
   return !!ts && ts.shown && ts.showStart < 0 && !ts.done;
}

/** The colour the hero should touch next on the current tier, -1 when none is expected. */
export function expectedColor(run: TowerRun): number {
   const ts = run.tiers[run.tier];
   if (!ts || !tierLive(run, run.tier)) return -1;
   return ts.seq[ts.progress];
}

/** The boss's next colour (Mirror: last to first), -1 outside a window. */
export function bossExpectedColor(run: TowerRun): number {
   const b = run.boss;
   if (!b || !run.bossAwake || b.step !== "vulnerable" || run.bossProgress >= run.bossLen) return -1;
   return run.bossMirror ? run.bossSeq[run.bossLen - 1 - run.bossProgress] : run.bossSeq[run.bossProgress];
}

const slotPos = { x: 0, y: 0, z: 0 };

/** Where the boss's crystal of `color` stands (its centre), by its slot. */
export function bossCrystalAt(run: TowerRun, color: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const s = run.course.slots[run.bossSlot[color]];
   out.x = s.x;
   out.z = s.z;
   out.y = s.y + CRYSTAL_LIFT;
   return out;
}

/** The hero is inside the beacon's ring (and on its level). */
function inRing(run: TowerRun, t: number, reach: number): boolean {
   const b = run.course.tiers[t].beacon;
   const h = run.hero;
   return Math.abs(h.y - b.y) < 1.5 && Math.hypot(h.x - b.x, h.z - b.z) <= reach;
}

// ---------------------------------------------------------------------------------------------
// the hero

function knock(run: TowerRun, ev: StepEvents, dx: number, dz: number): void {
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
   run.strikes += 1;
   comboBreak(run.combo);
   ev.knocked = true;
}

/** The pad the hero stands on, else the nearest pad at its height, -1 none. */
export function nearestPad(run: TowerRun): number {
   const h = run.hero;
   if (h.onPad >= 0) return h.onPad;
   let best = -1;
   let bestD = Infinity;
   const c = run.course;
   for (let i = 0; i < c.pads.length; i++) {
      const p = c.pads[i];
      if (Math.abs(p.y - h.y) > 1.5) continue;
      padCenterAt(p, run.simMs, pushed);
      const d = Math.hypot(h.x - pushed.x, h.z - pushed.z);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   return best;
}

/** A shove back toward the centre of the pad the hero is on (or the nearest one). */
function shoveOntoPad(run: TowerRun, ev: StepEvents): void {
   const h = run.hero;
   const i = nearestPad(run);
   let dx = -h.x;
   let dz = -h.z;
   if (i >= 0) {
      padCenterAt(run.course.pads[i], run.simMs, pushed);
      dx = pushed.x - h.x;
      dz = pushed.z - h.z;
   }
   if (Math.hypot(dx, dz) < 0.2) {
      dx = -h.vx;
      dz = -h.vz;
      if (Math.hypot(dx, dz) < 0.2) {
         dx = -h.x;
         dz = -h.z;
      }
   }
   knock(run, ev, dx, dz);
}

function tryPower(run: TowerRun, input: StepInput, ev: StepEvents): void {
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
   else if (def.power === "magnet") {
      h.magnetUntil = ms + POWER_MS.magnet;
      h.magnetPull = true;
   }
   else h.phaseUntil = ms + POWER_MS.phase;
   h.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function respawn(run: TowerRun, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   const at = run.checkpoint >= 0 ? c.tiers[run.checkpoint].beacon : { x: c.startX, y: c.startY, z: c.startZ };
   h.x = at.x;
   h.z = at.z;
   h.y = at.y;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.onPad = -1;
   h.lostUntil = -1;
   run.inside.fill(0);
   run.bossInside.fill(0);
   run.ringIn = false;
   ev.respawned = true;
}

const pushed = { x: 0, z: 0 };
const carryV = { x: 0, z: 0 };
const cpos = { x: 0, y: 0, z: 0 };

/** Respawn height: this far under the beacon the hero last reached (or the start) is the void. */
function fallY(run: TowerRun): number {
   const c = run.course;
   const y = run.checkpoint >= 0 ? c.tiers[run.checkpoint].beacon.y : c.startY;
   return y - FALL_DROP;
}

function stepMs(run: TowerRun, input: StepInput, ev: StepEvents): void {
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
   // crumbled pads come back
   for (let i = 0; i < c.pads.length; i++) {
      const t = run.crumbleAt[i];
      if (t >= 0 && ms >= t + CRUMBLE_MS + GONE_MS) run.crumbleAt[i] = -1;
   }
   if (h.lostUntil >= 0) {
      if (ms >= h.lostUntil) respawn(run, ev);
      if (run.bossAwake) stepBossMs(run, ev);
      return;
   }
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
   const onPad = h.onPad >= 0 ? c.pads[h.onPad] : null;
   const slick = onPad?.slick ? SLICK_K : 1;
   if (stunned) {
      h.vx *= 0.994;
      h.vz *= 0.994;
   } else if (dashing) {
      h.vx = h.dashX * (V_RUN + DASH_BOOST);
      h.vz = h.dashZ * (V_RUN + DASH_BOOST);
   } else if (h.grounded) {
      const accel = ACCEL_G * slick * 0.001;
      h.vx = approach(h.vx, dirX * stick * V_RUN, accel);
      h.vz = approach(h.vz, dirZ * stick * V_RUN, accel);
   } else {
      const cap = Math.min(V_RUN, Math.max(3, h.airSpeed));
      h.vx = approach(h.vx, dirX * stick * cap, ACCEL_A * 0.001);
      h.vz = approach(h.vz, dirZ * stick * cap, ACCEL_A * 0.001);
   }
   // a sliding pad carries you
   let carry = 0;
   carryV.x = carryV.z = 0;
   if (onPad && onPad.move && h.grounded) {
      padSpeedAt(onPad, ms, carryV);
      carry = Math.hypot(carryV.x, carryV.z);
   }
   const px = h.x;
   const pz = h.z;
   let nx = px + (h.vx + carryV.x) * 0.001;
   let nz = pz + (h.vz + carryV.z) * 0.001;
   // solids: the spire (under the arena), the dark crystal walls (a dash shatters them), the void gates (a phase passes)
   if (!c.arena || h.y < c.arena.y - 0.5) {
      if (pushOutOfDisc(0, 0, CORE_R, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   }
   for (let w = 0; w < c.walls.length; w++) {
      if (run.wallBroken[w]) continue;
      const d = c.walls[w];
      if (!inDiscBand(d, h.y)) continue;
      if (dashing && Math.hypot(nx - d.x, nz - d.z) < d.r + 0.6) {
         run.wallBroken[w] = 1;
         ev.wallBroken = w;
         continue;
      }
      if (pushOutOfDisc(d.x, d.z, d.r, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   }
   const phase = h.phaseUntil >= ms;
   if (!phase) {
      for (const d of c.gates) {
         if (!inDiscBand(d, h.y)) continue;
         if (pushOutOfDisc(d.x, d.z, d.r, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
      }
   }
   // the proof's invariant: V_RUN, plus an active boost, per ms (a pad ride under V_RUN adds nothing)
   const allow = (V_RUN + (dashing ? DASH_BOOST : 0) + Math.max(0, carry - V_RUN)) * 0.001;
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

   // --- vertical
   const canGround = h.grounded || h.coyote > 0;
   if (!stunned && h.buffer > 0 && canGround && h.vy <= 0.01) {
      h.vy = V_JUMP;
      h.grounded = false;
      h.coyote = 0;
      h.buffer = 0;
      h.airJumps = run.heroId === "nami" ? 1 : 0;
      h.airSpeed = Math.min(V_RUN, Math.hypot(h.vx, h.vz));
      ev.jumped = true;
   } else if (!stunned && h.buffer > 0 && !h.grounded && h.airJumps > 0) {
      h.vy = V_AIR;
      h.airJumps = 0;
      h.buffer = 0;
      ev.airJumped = true;
      ev.powered = true;
   }
   let surf = -Infinity;
   let padHere = -1;
   for (let i = 0; i < c.pads.length; i++) {
      const p = c.pads[i];
      if (p.y > h.y + STEP_UP || p.y <= surf) continue;
      if (Math.abs(p.y - h.y) > 6) continue;
      padCenterAt(p, ms, pushed);
      if (Math.hypot(h.x - pushed.x, h.z - pushed.z) > p.r) continue;
      if (!padAvailable(run, i)) continue;
      surf = p.y;
      padHere = i;
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
   h.onPad = h.grounded ? padHere : -1;
   // a crumbling pad starts to give way under you
   if (h.onPad >= 0 && c.pads[h.onPad].crumble && run.crumbleAt[h.onPad] < 0) {
      run.crumbleAt[h.onPad] = ms;
      ev.crumble = h.onPad;
   }
   if (h.y < fallY(run)) {
      h.lostUntil = ms + RESPAWN_MS;
      run.falls += 1;
      comboBreak(run.combo);
      ev.fell = true;
      if (run.bossAwake) stepBossMs(run, ev);
      return;
   }

   // --- hazards: shard storms (on their pads), spark drones (head height), the boss's shockwave
   for (let i = 0; i < c.pads.length; i++) {
      const p = c.pads[i];
      if (p.storm === undefined || Math.abs(h.y - p.y) > 1.5 || !stormOn(p, ms)) continue;
      padCenterAt(p, ms, pushed);
      const dx = pushed.x - h.x;
      const dz = pushed.z - h.z;
      if (Math.hypot(dx, dz) > STORM_R) continue;
      if (Math.hypot(dx, dz) > 0.2) knock(run, ev, dx, dz);
      else knock(run, ev, -h.vx || -h.x, -h.vz || -h.z);
   }
   const cy = h.y + 0.6;
   for (const d of c.drones) {
      droneAt(c, d, ms, cpos);
      const dx = h.x - cpos.x;
      const dy = cy - cpos.y;
      const dz = h.z - cpos.z;
      if (dx * dx + dy * dy + dz * dz < DRONE_R * DRONE_R) knock(run, ev, dx, dz);
   }

   // --- the beacons, the shows, the crystals
   const magnet = h.magnetUntil >= ms;
   const t = run.tier;
   if (t < c.tiers.length) {
      const ts = run.tiers[t];
      const tier = c.tiers[t];
      const ring = inRing(run, t, BEACON_R);
      if (ring && run.checkpoint < t) {
         run.checkpoint = t;
         ev.checkpoint = t;
      }
      if (tier.seqLen === 0) {
         // level 5's summit beacon: it wakes Prism Shade
         if (ring && !run.bossAwake && run.boss) {
            run.bossAwake = true;
            ev.bossWake = true;
         }
      } else if (ts.showStart >= 0) {
         if (ts.showOwner !== run.seat) {
            // a teammate's show (co-op shares the tiers): nothing to do but wait for it
         } else if (!inRing(run, t, RING)) {
            ts.showStart = -1;
            ev.showCancel = t;
         } else {
            const el = ms - ts.showStart;
            if (el % SHOW_STEP_MS === 0 && el / SHOW_STEP_MS < tier.seqLen) {
               ev.showStep = el / SHOW_STEP_MS;
               ev.showColor = ts.seq[ev.showStep];
            }
            if (el >= showMs(tier.seqLen)) {
               ts.showStart = -1;
               ts.shown = true;
               ev.showDone = t;
               // whatever the hero stands in now is not a visit
               for (let k = 0; k < tier.count; k++) {
                  const cr = c.crystals[tier.first + k];
                  run.inside[cr.index] = Math.hypot(h.x - cr.x, cy - cr.y - CRYSTAL_LIFT, h.z - cr.z) <= CRYSTAL_R ? 2 : 0;
               }
            }
         }
      } else if (ring && ts.progress === 0 && !ts.done && (!ts.shown || !run.ringIn)) {
         // the first show starts as you arrive; a repeat needs you to step out and back in
         ts.showStart = ms;
         ts.showOwner = run.seat;
         ev.showStart = t;
         ev.showStep = 0;
         ev.showColor = ts.seq[0];
      } else if (ts.shown && !ts.done) {
         const want = ts.seq[ts.progress];
         for (let k = 0; k < tier.count; k++) {
            const cr = c.crystals[tier.first + k];
            // a visit: inside the crystal's rest reach (its bobbing never re-enters you); it counts once,
            // the moment the crystal is within reach (a bobbing one as it sinks back down)
            const dRest = Math.hypot(h.x - cr.x, cy - cr.y - CRYSTAL_LIFT, h.z - cr.z);
            const pull = magnet && h.magnetPull && cr.color === want;
            const near = dRest <= CRYSTAL_R || (pull && dRest <= MAGNET_CRYSTAL_R);
            if (!near) {
               run.inside[cr.index] = 0;
               continue;
            }
            if (run.inside[cr.index] === 2) continue;
            crystalAt(cr, ms, cpos);
            const d = Math.hypot(h.x - cpos.x, cy - cpos.y, h.z - cpos.z);
            if (!(d <= CRYSTAL_R || (pull && d <= MAGNET_CRYSTAL_R))) {
               run.inside[cr.index] = 1;
               continue;
            }
            run.inside[cr.index] = 2;
            // a crystal just touched right never counts as a wrong (a lingering hero, a teammate a moment later)
            if (ts.done || (ms < run.crystalSafe[cr.index] && cr.color !== want)) continue;
            if (cr.color === want) {
               if (d > CRYSTAL_R) h.magnetPull = false;
               run.crystalSafe[cr.index] = ms + SAFE_MS;
               ts.progress += 1;
               ev.pick = cr.index;
               link(run, ev, COMBO_BASE_MS.pick);
               if (ts.progress >= tier.seqLen) {
                  ts.done = true;
                  ev.roundDone = t;
                  link(run, ev, COMBO_BASE_MS.round);
                  run.tier += 1;
                  if (run.tier < c.tiers.length) ev.beaconArmed = run.tier;
               }
            } else {
               ts.progress = 0;
               run.wrongs += 1;
               ev.wrong = cr.index;
               comboBreak(run.combo);
               shoveOntoPad(run, ev);
               if (ev.shielded) run.strikes += 1;
            }
         }
      }
      if (ev.checkpoint === t) link(run, ev, COMBO_BASE_MS.beacon);
      // the round done: the next beacon's ring is a fresh one
      run.ringIn = run.tier === t ? ring : false;
   }

   // --- gems, secrets
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      if (o.hidden && !magnet) continue;
      const reach = magnet ? MAGNET_R : PICKUP_R;
      const dx = h.x - o.x;
      const dy = cy - o.y;
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
      const dy = cy - s.y;
      const dz = h.z - s.z;
      if (dx * dx + dy * dy + dz * dz > PICKUP_R * PICKUP_R) continue;
      if (collectSecret(run.secrets, i)) ev.secretList[ev.secretCount++] = i;
   }

   // --- the summit, or Prism Shade
   if (run.bossAwake) stepBossMs(run, ev);
   else if (!c.boss && run.tier >= c.tiers.length && Math.abs(h.y - c.summit.y) < 2 && Math.hypot(h.x - c.summit.x, h.z - c.summit.z) <= FINISH_R) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
   if (!run.ended && run.simMs >= c.timerMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

// ---------------------------------------------------------------------------------------------
// Prism Shade (level 5)

/** A telegraph begins: a fresh sequence for this phase, the show's first colour. */
function bossNewSequence(run: TowerRun, ev: StepEvents): void {
   const boss = run.boss!;
   ev.bossTelegraph = true;
   run.bossLen = run.course.bossSeqLen[boss.phase];
   fillSequence(run.rng, run.bossSeq, run.bossLen, run.course.colors);
   run.bossProgress = 0;
   run.bossDark = false;
   run.bossMirror = false;
   ev.bossShowStep = 0;
   ev.showColor = run.bossSeq[0];
}

function stepBossMs(run: TowerRun, ev: StepEvents): void {
   const boss = run.boss!;
   const be = run.bossEv;
   const c = run.course;
   const ms = run.simMs;
   const h = run.hero;
   const before = boss.hits;
   stepBoss(boss, PRISM, 1, be);
   if (be.telegraph) bossNewSequence(run, ev);
   else if (boss.step === "telegraph" && boss.stepMs % SHOW_STEP_MS === 0 && boss.stepMs / SHOW_STEP_MS < run.bossLen) {
      ev.bossShowStep = boss.stepMs / SHOW_STEP_MS;
      ev.showColor = run.bossSeq[ev.bossShowStep];
   }
   if (be.attack) {
      ev.bossAttack = true;
      if (boss.phase === 0) {
         // the shuffle: a new slot for every colour (Fisher-Yates on the seeded stream)
         for (let i = 4; i > 0; i--) {
            const j = Math.floor(rngNext(run.rng) * (i + 1)) % (i + 1);
            const t = run.bossSlot[i];
            run.bossSlot[i] = run.bossSlot[j];
            run.bossSlot[j] = t;
         }
         ev.bossShuffle = true;
      } else if (boss.phase === 1) run.bossDark = true;
      else run.bossMirror = true;
   }
   if (be.vulnerable) {
      ev.bossOpen = true;
      // whatever the hero stands in as the window opens is not an entry
      for (let col = 0; col < 5; col++) {
         bossCrystalAt(run, col, slotPos);
         run.bossInside[col] = Math.hypot(h.x - slotPos.x, h.y + 0.6 - slotPos.y, h.z - slotPos.z) <= CRYSTAL_R ? 1 : 0;
      }
   }
   if (be.recovered && boss.hits === before) ev.bossMiss = true;
   if (h.lostUntil >= 0) return;
   const arena = c.arena!;
   // the shockwave: a ring from the centre to the rim; jump it
   if (boss.step === "attack") {
      const r = waveRadius(boss.stepMs, PRISM.phases[boss.phase].attacks[0].attackMs);
      const d = Math.hypot(h.x - arena.x, h.z - arena.z);
      if (Math.abs(d - r) < WAVE_HALF_W && h.y < arena.y + 0.5) knock(run, ev, h.x - arena.x, h.z - arena.z);
   }
   if (boss.step !== "vulnerable" || run.bossProgress >= run.bossLen) return;
   const want = bossExpectedColor(run);
   const magnet = h.magnetUntil >= ms;
   const cy = h.y + 0.6;
   for (let col = 0; col < 5; col++) {
      bossCrystalAt(run, col, slotPos);
      const d = Math.hypot(h.x - slotPos.x, cy - slotPos.y, h.z - slotPos.z);
      const pull = magnet && h.magnetPull && col === want;
      const now = d <= CRYSTAL_R || (pull && d <= MAGNET_CRYSTAL_R) ? 1 : 0;
      const entry = now === 1 && run.bossInside[col] === 0;
      run.bossInside[col] = now;
      if (!entry || (ms < run.bossSafe[col] && col !== want)) continue;
      if (col === want) {
         if (d > CRYSTAL_R) h.magnetPull = false;
         run.bossSafe[col] = ms + SAFE_MS;
         run.bossProgress += 1;
         ev.pick = -2 - col;
         if (run.bossProgress >= run.bossLen) {
            const r = hitBoss(boss, PRISM, 1, be);
            if (r === "ignored") return;
            ev.bossHit = true;
            link(run, ev, COMBO_BASE_MS.hit);
            if (r === "defeated") {
               ev.bossDefeated = true;
               run.ended = "win";
               run.finishMs = ms;
               ev.finished = true;
            } else if (be.telegraph) {
               // one hit a window: the next telegraph opens in this same step, with a new sequence
               bossNewSequence(run, ev);
            }
            return;
         }
      } else {
         run.bossProgress = 0;
         run.wrongs += 1;
         ev.wrong = -2 - col;
         comboBreak(run.combo);
         knock(run, ev, arena.x - h.x, arena.z - h.z);
         if (ev.shielded) run.strikes += 1;
      }
      return;
   }
}

/**
 * Advances the run by dtMs (any frame time): whole ms are simulated, the fraction carries. The jump
 * and power presses of the frame count once.
 */
export function step(run: TowerRun, dtMs: number, input: StepInput): StepEvents {
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

/** The least rules-time to beat Prism Shade: every hit on the first instant of its window. */
export function bossMinMs(): number {
   const s = createBoss(PRISM);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 400_000 && s.step !== "defeat" && s.step !== "done"; guard++) {
      if (s.step === "vulnerable") {
         const r = hitBoss(s, PRISM, 1, ev);
         if (r === "defeated") return t;
         continue;
      }
      stepBoss(s, PRISM, 1, ev);
      t += 1;
   }
   return t;
}

/** The most metres any run can gain over V_RUN: every dash charge (the sliding pads are slower than V_RUN). */
export function boostBudgetMetres(_c: Course): number {
   return DASH_CHARGES * (POWER_MS.dash / 1000) * DASH_BOOST;
}

/** Every show, back to back (ms). */
export function showTotalMs(c: Course): number {
   let t = 0;
   for (const tier of c.tiers) if (tier.seqLen > 0) t += showMs(tier.seqLen);
   return t;
}

/**
 * The least distance (m) the hero must travel between the shows: start -> beacon 1 -> ... -> beacon n
 * (each end less the ring reach), then on to the summit (less its reach) when the summit is the goal.
 */
export function travelMetres(c: Course): number {
   let d = 0;
   let x = c.startX;
   let z = c.startZ;
   let reach = 0;
   for (const t of c.tiers) {
      d += Math.max(0, Math.hypot(t.beacon.x - x, t.beacon.z - z) - reach - RING);
      x = t.beacon.x;
      z = t.beacon.z;
      reach = RING;
   }
   if (!c.boss) d += Math.max(0, Math.hypot(c.summit.x - x, c.summit.z - z) - reach - FINISH_R);
   return d;
}

export function minFinishMs(c: Course): number {
   const travel = (Math.max(0, travelMetres(c) - boostBudgetMetres(c)) / V_RUN) * 1000;
   return showTotalMs(c) + travel + (c.boss ? bossMinMs() : 0);
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   let picks = 0;
   for (const t of c.tiers) picks += t.seqLen;
   return {
      combo: COMBO,
      sources: [
         { count: picks, base: COMBO_BASE_MS.pick },
         { count: c.tiers.filter((t) => t.seqLen > 0).length, base: COMBO_BASE_MS.round },
         { count: c.tiers.length, base: COMBO_BASE_MS.beacon },
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: c.boss ? PRISM.maxHp : 0, base: COMBO_BASE_MS.hit },
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
   1: { kind: "time", maxScore: 8310, minDurationMs: 6900, maxDurationMs: 90000, timeBaseMs: 90000 },
   2: { kind: "time", maxScore: 11300, minDurationMs: 7000, maxDurationMs: 120000, timeBaseMs: 120000 },
   3: { kind: "time", maxScore: 13380, minDurationMs: 16200, maxDurationMs: 150000, timeBaseMs: 150000 },
   4: { kind: "time", maxScore: 15820, minDurationMs: 21800, maxDurationMs: 180000, timeBaseMs: 180000 },
   5: { kind: "time", maxScore: 20550, minDurationMs: 34500, maxDurationMs: 240000, timeBaseMs: 240000 },
};

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB_BONUS_MS - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: never knocked (a storm, a drone, the shockwave) and never a wrong crystal. */
export function badgeHits(run: TowerRun): number {
   return run.strikes;
}

/**
 * Where the hero should head: the armed beacon (until its show has run), the summit once every tier
 * is done, Prism Shade in his fight. False while the crystals are live: the arrow would give the
 * sequence away.
 */
export function guidePoint(run: TowerRun, out: { x: number; y: number; z: number }): boolean {
   const c = run.course;
   if (run.bossAwake && run.boss) {
      if (run.boss.hp <= 0) return false;
      out.x = c.arena!.x;
      out.y = c.arena!.y + 1;
      out.z = c.arena!.z;
      return true;
   }
   if (run.tier >= c.tiers.length) {
      out.x = c.summit.x;
      out.y = c.summit.y;
      out.z = c.summit.z;
      return true;
   }
   const ts = run.tiers[run.tier];
   const b = c.tiers[run.tier].beacon;
   if (ts.shown && ts.showStart < 0 && c.tiers[run.tier].seqLen > 0) return false;
   out.x = b.x;
   out.y = b.y;
   out.z = b.z;
   return true;
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
   tier: "tier",
   tiers: "tiers",
   seqLen: "seqLen",
   seqProgress: "seqProgress",
   /** the colours of the running show, revealed so far: base 8 digits, colour + 1, step 0 lowest; 0 = no show */
   seqShown: "seqShown",
   /** 1 while a show runs, 2 while the tier's crystals are live, 0 before the show */
   seqState: "seqState",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   /** 0 none, 1 Blackout (colours out), 2 Mirror (order flipped) */
   bossTrick: "bossTrick",
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
   wrongs: "wrongs",
} as const;
