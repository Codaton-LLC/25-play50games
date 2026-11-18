// Ultimate Color Trial rules. Pure and deterministic: one run, stepped in whole milliseconds (the
// fraction carries, so 30, 60 and 144 fps agree). The trial is one corridor of sections, each a
// mechanic of the Menu 2 worlds: jump pads over the void, trial rings to pass in order, colour
// switches that charge you with a colour and colour doors that open for it, laser runways (jump the
// beams), survival arenas (the exit opens surviveMs after you step in), an energy core to carry to
// its receptor, and on level 5 the Chroma Sentinel's arena, where the beacon turns those mechanics
// into his windows. A section with an objective has an exit gate that opens when it is done.
//
// The proof (README "Score limits"): the hero's centre never moves more than V_RUN / 1000 m in a ms,
// plus the speed of an active boost (Riko's dash: DASH_CHARGES x POWER_MS.dash x DASH_BOOST metres a
// run; a sliding pad is slower than V_RUN, so a ride adds nothing). Knocks are slower than V_RUN. A
// survival arena's exit opens no sooner than surviveMs after the hero crossed its start line, and
// the finish (level 5: the Sentinel's defeat, which begins at his beacon) lies beyond every exit. So
// a run takes at least the straight travel down the corridor (less the inside of each arena, which
// can be crossed during its wait) at V_RUN, less the dash budget, plus every survival wait, plus the
// Sentinel's least defeat time; the submitted time takes off every gem and the most flow bonus.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld, rngNext, type RngState } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import { HALF_W } from "./levels";
import {
   BEAM_CLEAR,
   BEAM_HALF,
   BOSS_HIT_R,
   CORE_R,
   FALL_Y,
   FINISH_R,
   GATE_T,
   HERO_R,
   MAGNET_CORE_R,
   MAGNET_R,
   ORB_R,
   PICKUP_R,
   RECEPTOR_R,
   STEP_UP,
   SWITCH_R,
   blobAt,
   buildCourse,
   courseFor,
   doorAt,
   floorAt,
   laserZ,
   padCenterAt,
   padSpeedAt,
   pushOutOfDisc,
   sectionAt,
   type Course,
} from "./course";
import { DASH_BOOST, DASH_CHARGES, DEFAULT_HERO, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, SECRETS, SENTINEL } from "./progression";

export { buildCourse, courseFor };

/** The W6 run speed. Nothing moves the hero faster except a dash (counted). */
export const V_RUN = 6.5;
export const G = 30;
export const V_JUMP = 14;
/** Nyla's second jump. */
export const V_AIR = 10;
/** A knock throws you at this speed (about 0.7 m). */
export const V_BOUNCE = 5;
export const ORB_BONUS_MS = 150;
/** A survival round starts once the hero is this far into its arena. */
export const ARENA_IN = 1.5;
/** The Sentinel wakes when the hero comes this close to his beacon. */
export const BEACON_WAKE_R = 2.5;
const ACCEL_G = 70;
const ACCEL_A = 24;
const COYOTE = 100;
const BUFFER = 130;
const STUN_KNOCK = 420;
const RESPAWN_MS = 700;

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
   /** the magnet pulls one core per activation */
   magnetPull: boolean;
   phaseUntil: number;
   powerReadyAt: number;
   stunUntil: number;
   /** the pad the hero stands on, -1 none (a floor) */
   onPad: number;
   /** fallen into the void: respawn at this ms */
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
   /** a ring passed in order (its index), one out of order */
   ring: number;
   ringWrong: number;
   /** charged with a colour (the colour), a door passed (the row), held at a door (the row) */
   charged: number;
   doorPassed: number;
   doorBlocked: number;
   /** a section's objective done (its index), the hero entered a section (its index) */
   sectionDone: number;
   entered: number;
   surviveStart: number;
   corePicked: number;
   coreDropped: number;
   coreDelivered: number;
   laserHit: boolean;
   knocked: boolean;
   shielded: boolean;
   fell: boolean;
   respawned: boolean;
   checkpoint: number;
   wallBroken: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboLinked: boolean;
   bossWake: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   bossMiss: boolean;
   bossHit: boolean;
   bossDefeated: boolean;
   finished: boolean;
   timeup: boolean;
}

export interface TrialRun {
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
   /** per section: its objective is done (a gated one opens its exit) */
   secDone: Uint8Array;
   /** per section: the hero has been in it */
   secEntered: Uint8Array;
   /** per section: the next ring (by order) and the next door row */
   ringNext: Int32Array;
   rowNext: Int32Array;
   /** per section: when its survival round began, -1 */
   surviveStart: Float64Array;
   /** per section: its energy core: 0 waiting, 1 carried, 2 delivered; and where it lies */
   coreState: Uint8Array;
   coreX: Float64Array;
   coreZ: Float64Array;
   /** the colour the hero carries (-1 none) */
   charge: number;
   /** the section the hero respawns at (its start line), -1 the start */
   checkpoint: number;
   wallBroken: Uint8Array;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   /** knocks (the no-hit badge) */
   strikes: number;
   falls: number;
   /** metres travelled above V_RUN (the dash): the proof's budget */
   extraMetres: number;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   /** Gates: the colour his beacon shows */
   bossColor: number;
   /** Rings: the next arena ring (by order) */
   bossRingNext: number;
   /** Siege: 0 no core, 1 lying at its spot, 2 carried */
   bossCore: number;
   bossCoreX: number;
   bossCoreZ: number;
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
      ring: -1, ringWrong: -1, charged: -1, doorPassed: -1, doorBlocked: -1, sectionDone: -1, entered: -1, surviveStart: -1,
      corePicked: -1, coreDropped: -1, coreDelivered: -1, laserHit: false, knocked: false, shielded: false, fell: false, respawned: false,
      checkpoint: -1, wallBroken: -1, orbCount: 0, orbList: new Array<number>(64).fill(0), secretCount: 0, secretList: new Array<number>(4).fill(0), comboLinked: false,
      bossWake: false, bossTelegraph: false, bossAttack: false, bossOpen: false, bossMiss: false, bossHit: false, bossDefeated: false,
      finished: false, timeup: false,
   };
}

function clearEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.powered = e.laserHit = e.knocked = e.shielded = e.fell = e.respawned = e.comboLinked = false;
   e.bossWake = e.bossTelegraph = e.bossAttack = e.bossOpen = e.bossMiss = e.bossHit = e.bossDefeated = e.finished = e.timeup = false;
   e.landSpeed = 0;
   e.ring = e.ringWrong = e.charged = e.doorPassed = e.doorBlocked = e.sectionDone = e.entered = e.surviveStart = -1;
   e.corePicked = e.coreDropped = e.coreDelivered = e.checkpoint = e.wallBroken = -1;
   e.orbCount = e.secretCount = 0;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): TrialRun {
   const course = courseFor(level);
   const n = course.sections.length;
   const hero: HeroBody = {
      x: course.startX, y: 0, z: course.startZ, vx: 0, vy: 0, vz: 0, grounded: true, coyote: COYOTE, buffer: 0, airJumps: 0, airSpeed: 0,
      dashUntil: -1, dashX: 0, dashZ: 1, dashes: DASH_CHARGES, shieldUntil: -1, magnetUntil: -1, magnetPull: false, phaseUntil: -1, powerReadyAt: 0,
      stunUntil: -1, onPad: -1, lostUntil: -1, lastKnockMs: -9999,
   };
   const coreX = new Float64Array(n);
   const coreZ = new Float64Array(n);
   course.sections.forEach((s, i) => {
      if (s.core) {
         coreX[i] = s.core.x;
         coreZ[i] = s.core.z;
      }
   });
   return {
      seed, seat: 0, level, heroId, course, hero, simMs: 0, frac: 0, rng: { s: seed },
      secDone: new Uint8Array(n), secEntered: new Uint8Array(n), ringNext: new Int32Array(n), rowNext: new Int32Array(n),
      surviveStart: new Float64Array(n).fill(-1), coreState: new Uint8Array(n), coreX, coreZ, charge: -1, checkpoint: -1,
      wallBroken: new Uint8Array(course.nooks.length), collected: new Uint8Array(course.gems.length), orbs: 0, mainOrbs: 0, strikes: 0, falls: 0, extraMetres: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      boss: course.boss ? createBoss(SENTINEL) : null, bossEv: createBossEvents(), bossAwake: false, bossColor: -1, bossRingNext: 0, bossCore: 0, bossCoreX: 0, bossCoreZ: 0,
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

function link(run: TrialRun, ev: StepEvents, base: number): void {
   comboHit(run.combo, COMBO, run.simMs, base);
   if (run.combo.chain > 1) ev.comboLinked = true;
}

/** Is the exit of section i shut (a gated one, not done)? */
export function exitShut(run: TrialRun, i: number): boolean {
   const s = run.course.sections[i];
   return !!s && s.gated && !run.secDone[i];
}

/** Does a door row let a hero of this charge through at x (the Sentinel's row is open outside his Gates)? */
export function doorOpen(run: TrialRun, rowIndex: number, x: number): boolean {
   const row = run.course.rows[rowIndex];
   const sec = run.course.sections[row.section];
   if (sec.kind === "boss" && (!run.boss || run.boss.phase !== 0 || run.boss.hp <= 0)) return doorAt(row, x) !== null;
   const d = doorAt(row, x);
   return d !== null && d.color === run.charge;
}

/** The section's next ring (by order), or null. */
export function nextRing(run: TrialRun, section: number) {
   const want = run.ringNext[section];
   for (const r of run.course.rings) if (r.section === section && r.order === want) return r;
   return null;
}

/** The section's next door row, or null. */
export function nextRow(run: TrialRun, section: number) {
   const want = run.rowNext[section];
   for (const r of run.course.rows) if (r.section === section && r.order === want) return r;
   return null;
}

/** The lowest section whose objective is not done (sections.length when all are). */
export function currentSection(run: TrialRun): number {
   const c = run.course;
   for (let i = 0; i < c.sections.length; i++) if (!run.secDone[i]) return i;
   return c.sections.length;
}

// ---------------------------------------------------------------------------------------------
// the hero

const pushed = { x: 0, z: 0 };
const bpos = { x: 0, z: 0 };

/** Every section before `upTo` is done (the Sentinel only wakes for a hero who has cleared the trial). */
function allSectionsDone(run: TrialRun, upTo: number): boolean {
   for (let i = 0; i < upTo; i++) if (!run.secDone[i]) return false;
   return true;
}

function knock(run: TrialRun, ev: StepEvents, dx: number, dz: number): void {
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
   dropCore(run, ev);
}

/** A carried core falls where the hero stands (inside the corridor). */
function dropCore(run: TrialRun, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   for (let i = 0; i < c.sections.length; i++) {
      if (run.coreState[i] !== 1) continue;
      const s = c.sections[i];
      run.coreState[i] = 0;
      run.coreX[i] = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, h.x));
      run.coreZ[i] = Math.max(s.z0 + 1, Math.min(s.z1 - 1.5, h.z));
      ev.coreDropped = i;
   }
   if (run.bossCore === 2) {
      run.bossCore = 1;
      run.bossCoreX = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, h.x));
      run.bossCoreZ = Math.max(c.sections[c.sections.length - 1].z0 + 1, Math.min(c.finish.z - 2, h.z));
      ev.coreDropped = c.sections.length - 1;
   }
}

function tryPower(run: TrialRun, input: StepInput, ev: StepEvents): void {
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
   } else h.phaseUntil = ms + POWER_MS.phase;
   h.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function respawn(run: TrialRun, ev: StepEvents): void {
   const h = run.hero;
   const c = run.course;
   const at = run.checkpoint >= 0 ? c.checkpoints[run.checkpoint] : { x: c.startX, z: c.startZ };
   h.x = at.x;
   h.z = at.z;
   h.y = 0;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
   h.onPad = -1;
   h.lostUntil = -1;
   ev.respawned = true;
}

/** The surface under the hero this ms: the floors, a pad; -Infinity over the void. */
function surfaceUnder(run: TrialRun, x: number, y: number, z: number): { y: number; pad: number } {
   const c = run.course;
   let best = floorAt(c, x, z, y);
   let pad = -1;
   for (let i = 0; i < c.pads.length; i++) {
      const p = c.pads[i];
      if (p.y > y + STEP_UP || p.y <= best) continue;
      padCenterAt(p, run.simMs, bpos);
      if (Math.hypot(x - bpos.x, z - bpos.z) <= p.r) {
         best = p.y;
         pad = i;
      }
   }
   return { y: best, pad };
}

function stepMs(run: TrialRun, input: StepInput, ev: StepEvents): void {
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
   if (stunned) {
      h.vx *= 0.994;
      h.vz *= 0.994;
   } else if (dashing) {
      h.vx = h.dashX * (V_RUN + DASH_BOOST);
      h.vz = h.dashZ * (V_RUN + DASH_BOOST);
   } else if (h.grounded) {
      h.vx = approach(h.vx, dirX * stick * V_RUN, ACCEL_G * 0.001);
      h.vz = approach(h.vz, dirZ * stick * V_RUN, ACCEL_G * 0.001);
   } else {
      const cap = Math.min(V_RUN, Math.max(3, h.airSpeed));
      h.vx = approach(h.vx, dirX * stick * cap, ACCEL_A * 0.001);
      h.vz = approach(h.vz, dirZ * stick * cap, ACCEL_A * 0.001);
   }
   // a sliding pad carries you
   let carry = 0;
   if (h.onPad >= 0 && h.grounded) carry = padSpeedAt(c.pads[h.onPad], ms);
   const px = h.x;
   const pz = h.z;
   let nx = px + (h.vx + carry) * 0.001;
   let nz = pz + h.vz * 0.001;
   // the corridor's walls (with the nook openings), the nook barriers, the exits and door rows
   const inOpening = c.nooks.some((n) => nz >= n.floor.z0 + HERO_R && nz <= n.floor.z1 - HERO_R);
   if (!inOpening) nx = Math.max(-HALF_W + HERO_R, Math.min(HALF_W - HERO_R, nx));
   else nx = Math.max(-HALF_W + HERO_R, Math.min(c.nooks[0].floor.x1 - HERO_R, nx));
   const phase = h.phaseUntil >= ms;
   c.nooks.forEach((n, i) => {
      const d = n.disc;
      if (h.y < d.y0 - 0.1 || h.y >= d.y1) return;
      if (n.kind === "wall") {
         if (run.wallBroken[i]) return;
         if (dashing && Math.hypot(nx - d.x, nz - d.z) < d.r + 0.6) {
            run.wallBroken[i] = 1;
            ev.wallBroken = i;
            return;
         }
      } else if (phase) return;
      if (pushOutOfDisc(d.x, d.z, d.r, nx, nz, pushed)) ((nx = pushed.x), (nz = pushed.z));
   });
   if (h.y < 3.5) {
      for (let i = 0; i < c.sections.length; i++) {
         if (!exitShut(run, i)) continue;
         const gz = c.sections[i].z1;
         if (pz <= gz - GATE_T - HERO_R && nz > gz - GATE_T - HERO_R) nz = gz - GATE_T - HERO_R;
      }
      for (let r = 0; r < c.rows.length; r++) {
         const row = c.rows[r];
         const z0 = row.z - GATE_T - HERO_R;
         const z1 = row.z + GATE_T + HERO_R;
         const crossing = (pz < z0 && nz >= z0) || (pz > z1 && nz <= z1) || (nz > z0 && nz < z1);
         if (!crossing) continue;
         if (doorOpen(run, r, nx)) continue;
         // held before the row (or behind it, coming back)
         nz = pz <= row.z ? Math.min(nz, z0) : Math.max(nz, z1);
         if (pz <= row.z && run.rowNext[row.section] === row.order) ev.doorBlocked = r;
      }
   }
   // the proof's invariant: V_RUN, plus an active boost, per ms (a pad ride under V_RUN adds nothing)
   const allow = (V_RUN + (dashing ? DASH_BOOST : 0) + Math.max(0, Math.abs(carry) - V_RUN)) * 0.001;
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

   // --- a door passed (the hero's z crossed the row's z through an open door)
   for (let r = 0; r < c.rows.length; r++) {
      const row = c.rows[r];
      if (!(pz < row.z && nz >= row.z)) continue;
      const sec = c.sections[row.section];
      if (sec.kind === "boss") continue;
      if (run.rowNext[row.section] === row.order) {
         run.rowNext[row.section] += 1;
         ev.doorPassed = r;
         link(run, ev, COMBO_BASE_MS.door);
         if (run.rowNext[row.section] >= sec.rowCount && !run.secDone[row.section]) {
            run.secDone[row.section] = 1;
            ev.sectionDone = row.section;
            link(run, ev, COMBO_BASE_MS.section);
         }
      }
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
      ev.jumped = true;
   } else if (!stunned && h.buffer > 0 && !h.grounded && h.airJumps > 0) {
      h.vy = V_AIR;
      h.airJumps = 0;
      h.buffer = 0;
      ev.airJumped = true;
      ev.powered = true;
   }
   const surf = surfaceUnder(run, h.x, h.y, h.z);
   if (h.grounded) {
      if (surf.y !== -Infinity && surf.y <= h.y + STEP_UP && surf.y >= h.y - 0.3) {
         h.y = surf.y;
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
      if (surf.y !== -Infinity && h.vy <= 0 && h.y <= surf.y && h.y >= surf.y - 0.9) {
         ev.landed = true;
         ev.landSpeed = -h.vy;
         h.y = surf.y;
         h.vy = 0;
         h.grounded = true;
         h.coyote = COYOTE;
      }
   }
   h.onPad = h.grounded ? surf.pad : -1;
   if (h.y < FALL_Y) {
      h.lostUntil = ms + RESPAWN_MS;
      run.falls += 1;
      comboBreak(run.combo);
      dropCore(run, ev);
      // a dropped core goes back to its spot
      for (let i = 0; i < c.sections.length; i++) {
         if (c.sections[i].core && run.coreState[i] === 0) {
            run.coreX[i] = c.sections[i].core!.x;
            run.coreZ[i] = c.sections[i].core!.z;
         }
      }
      ev.fell = true;
      if (run.bossAwake) stepBossMs(run, ev);
      return;
   }

   // --- the section the hero is in: entry, checkpoint
   const here = sectionAt(c, h.z);
   if (here >= 0 && here < c.sections.length) {
      if (!run.secEntered[here]) {
         run.secEntered[here] = 1;
         ev.entered = here;
         // a jump or a laser runway has no objective: it counts as done once left behind
      }
      if (h.grounded && run.checkpoint < here && h.y >= -0.1) {
         run.checkpoint = here;
         ev.checkpoint = here;
      }
      // a jump or a laser runway has no objective: it is done once its far end is reached on the ground
      for (let i = 0; i <= here; i++) {
         if (!run.secDone[i] && !c.sections[i].gated && c.sections[i].kind !== "boss" && (i < here || (h.grounded && h.z >= c.sections[i].z1 - 0.5))) {
            run.secDone[i] = 1;
            ev.sectionDone = i;
            link(run, ev, COMBO_BASE_MS.section);
         }
      }
   }

   // --- hazards: laser beams (jump them), rolling orbs (the arenas; the Sentinel's sweeps)
   const cy = h.y + 0.6;
   for (const l of c.lasers) {
      if (l.section !== here) continue;
      const bz = laserZ(l, ms);
      if (Math.abs(h.z - bz) < BEAM_HALF + HERO_R && h.y < BEAM_CLEAR) {
         ev.laserHit = true;
         knock(run, ev, 0, -1);
      }
   }
   for (const b of c.blobs) {
      if (b.section !== here) continue;
      const sec = c.sections[b.section];
      if (sec.kind === "boss" && !(run.bossAwake && run.boss && run.boss.step === "attack")) continue;
      blobAt(b, ms, bpos);
      const dx = h.x - bpos.x;
      const dz = h.z - bpos.z;
      if (h.y < 1.2 && Math.hypot(dx, dz) < ORB_R + HERO_R) knock(run, ev, dx, dz);
   }

   // --- the mechanics of the section the hero is in
   const magnet = h.magnetUntil >= ms;
   if (here >= 0 && here < c.sections.length) {
      const sec = c.sections[here];
      // colour switches charge the hero
      for (const w of c.switches) {
         if (w.section !== here || h.y > 0.5) continue;
         if (Math.hypot(h.x - w.x, h.z - w.z) <= SWITCH_R && run.charge !== w.color) {
            run.charge = w.color;
            ev.charged = w.color;
         }
      }
      // rings: the chest crosses the ring's plane inside its hoop
      if (nz !== pz) {
         for (const r of c.rings) {
            if (r.section !== here) continue;
            if (!((pz - r.z) * (nz - r.z) <= 0)) continue;
            const t = (r.z - pz) / (nz - pz);
            const x = px + t * (nx - px);
            if (Math.hypot(x - r.x, cy - r.y) > r.r) continue;
            if (sec.kind === "boss") {
               if (run.bossAwake && run.boss && run.boss.phase === 1 && run.boss.step === "vulnerable" && r.order === run.bossRingNext) {
                  run.bossRingNext += 1;
                  ev.ring = r.index;
                  if (run.bossRingNext >= 3) bossHitNow(run, ev);
               } else if (run.bossAwake && run.boss && run.boss.phase === 1) ev.ringWrong = r.index;
               continue;
            }
            if (run.secDone[here]) continue;
            if (r.order === run.ringNext[here]) {
               run.ringNext[here] += 1;
               ev.ring = r.index;
               link(run, ev, COMBO_BASE_MS.ring);
               if (run.ringNext[here] >= sec.ringCount) {
                  run.secDone[here] = 1;
                  ev.sectionDone = here;
                  link(run, ev, COMBO_BASE_MS.section);
               }
            } else ev.ringWrong = r.index;
         }
      }
      // a survival round: it starts as you step in, its exit opens surviveMs later
      if (sec.kind === "survive" && !run.secDone[here]) {
         if (run.surviveStart[here] < 0 && h.z >= sec.z0 + ARENA_IN) {
            run.surviveStart[here] = ms;
            ev.surviveStart = here;
         }
         if (run.surviveStart[here] >= 0 && ms >= run.surviveStart[here] + sec.surviveMs) {
            run.secDone[here] = 1;
            ev.sectionDone = here;
            link(run, ev, COMBO_BASE_MS.section);
         }
      }
      // the energy core: pick it up, carry it to the receptor
      if (sec.kind === "core" && sec.core && sec.receptor) {
         if (run.coreState[here] === 0) {
            const d = Math.hypot(h.x - run.coreX[here], h.z - run.coreZ[here]);
            const pull = magnet && h.magnetPull && d <= MAGNET_CORE_R;
            // never while stunned: a knock drops the core, and the hero must not take it back in the same instant
            if ((d <= CORE_R || pull) && h.y < 1.5 && ms >= h.stunUntil) {
               run.coreState[here] = 1;
               if (pull && d > CORE_R) h.magnetPull = false;
               ev.corePicked = here;
            }
         }
         if (run.coreState[here] === 1) {
            run.coreX[here] = h.x;
            run.coreZ[here] = h.z;
            if (Math.hypot(h.x - sec.receptor.x, h.z - sec.receptor.z) <= RECEPTOR_R) {
               run.coreState[here] = 2;
               run.coreX[here] = sec.receptor.x;
               run.coreZ[here] = sec.receptor.z;
               ev.coreDelivered = here;
               link(run, ev, COMBO_BASE_MS.core);
               if (!run.secDone[here]) {
                  run.secDone[here] = 1;
                  ev.sectionDone = here;
                  link(run, ev, COMBO_BASE_MS.section);
               }
            }
         }
      }
      // the Sentinel's arena: his beacon wakes him; his windows read the mechanics
      if (sec.kind === "boss" && c.bossSpec) {
         const bs = c.bossSpec;
         if (!run.bossAwake && run.boss && Math.hypot(h.x - bs.beacon.x, h.z - bs.beacon.z) <= BEACON_WAKE_R && allSectionsDone(run, here)) {
            run.bossAwake = true;
            ev.bossWake = true;
         }
         if (run.bossAwake && run.boss && run.boss.step === "vulnerable" && run.boss.hp > 0) {
            if (run.boss.phase === 0 && run.charge === run.bossColor && Math.hypot(h.x - bs.x, h.z - bs.z) <= BOSS_HIT_R) bossHitNow(run, ev);
            if (run.boss.phase === 2) {
               if (run.bossCore === 1) {
                  const d = Math.hypot(h.x - run.bossCoreX, h.z - run.bossCoreZ);
                  const pull = magnet && h.magnetPull && d <= MAGNET_CORE_R;
                  if ((d <= CORE_R || pull) && h.y < 1.5 && ms >= h.stunUntil) {
                     run.bossCore = 2;
                     if (pull && d > CORE_R) h.magnetPull = false;
                     ev.corePicked = here;
                  }
               }
               if (run.bossCore === 2) {
                  run.bossCoreX = h.x;
                  run.bossCoreZ = h.z;
                  if (Math.hypot(h.x - bs.receptor.x, h.z - bs.receptor.z) <= RECEPTOR_R) {
                     run.bossCore = 0;
                     ev.coreDelivered = here;
                     bossHitNow(run, ev);
                  }
               }
            }
         }
      }
   }

   // --- gems, secrets
   for (let i = 0; i < c.gems.length; i++) {
      if (run.collected[i]) continue;
      const o = c.gems[i];
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

   // --- the finish, or the Sentinel
   if (run.bossAwake) stepBossMs(run, ev);
   else if (!c.boss && Math.hypot(h.x - c.finish.x, h.z - c.finish.z) <= FINISH_R && h.y < 2 && currentSection(run) >= c.sections.length) {
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
// the Chroma Sentinel (level 5)

/** A hit lands (the window's objective met). */
function bossHitNow(run: TrialRun, ev: StepEvents): void {
   const boss = run.boss!;
   const r = hitBoss(boss, SENTINEL, 1, run.bossEv);
   if (r === "ignored") return;
   ev.bossHit = true;
   link(run, ev, COMBO_BASE_MS.hit);
   run.bossCore = 0;
   if (r === "defeated") {
      ev.bossDefeated = true;
      run.ended = "win";
      run.finishMs = run.simMs;
      ev.finished = true;
   } else if (run.bossEv.telegraph) bossNewRound(run, ev);
}

/** A telegraph begins: the beacon shows the window's ask. */
function bossNewRound(run: TrialRun, ev: StepEvents): void {
   const boss = run.boss!;
   const bs = run.course.bossSpec!;
   ev.bossTelegraph = true;
   run.bossRingNext = 0;
   run.bossCore = 0;
   if (boss.phase === 0) {
      const colours = bs.row.doors.map((d) => d.color);
      let c = colours[Math.floor(rngNext(run.rng) * colours.length) % colours.length];
      if (c === run.bossColor) c = colours[(colours.indexOf(c) + 1) % colours.length];
      run.bossColor = c;
   } else if (boss.phase === 2) {
      run.bossCore = 1;
      run.bossCoreX = bs.core.x;
      run.bossCoreZ = bs.core.z;
   }
}

function stepBossMs(run: TrialRun, ev: StepEvents): void {
   const boss = run.boss!;
   const be = run.bossEv;
   const before = boss.hits;
   stepBoss(boss, SENTINEL, 1, be);
   if (be.telegraph) bossNewRound(run, ev);
   if (be.attack) ev.bossAttack = true;
   if (be.vulnerable) ev.bossOpen = true;
   if (be.recovered && boss.hits === before) {
      ev.bossMiss = true;
      run.bossCore = 0;
   }
}

/**
 * Advances the run by dtMs (any frame time): whole ms are simulated, the fraction carries. The jump
 * and power presses of the frame count once.
 */
export function step(run: TrialRun, dtMs: number, input: StepInput): StepEvents {
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

/** The least rules-time to beat the Sentinel: every hit on the first instant of its window. */
export function bossMinMs(): number {
   const s = createBoss(SENTINEL);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 400_000 && s.step !== "defeat" && s.step !== "done"; guard++) {
      if (s.step === "vulnerable") {
         const r = hitBoss(s, SENTINEL, 1, ev);
         if (r === "defeated") return t;
         continue;
      }
      stepBoss(s, SENTINEL, 1, ev);
      t += 1;
   }
   return t;
}

/** The most metres any run can gain over V_RUN: every dash charge (the sliding pads are slower than V_RUN). */
export function boostBudgetMetres(_c: Course): number {
   return DASH_CHARGES * (POWER_MS.dash / 1000) * DASH_BOOST;
}

/** Every survival wait, back to back (ms). */
export function surviveTotalMs(c: Course): number {
   let t = 0;
   for (const s of c.sections) t += s.surviveMs;
   return t;
}

/**
 * The least distance (m) the hero must travel at V_RUN: straight down the corridor from the start to
 * the finish (level 5: to the Sentinel's beacon), less the finish's reach and less the inside of every
 * survival arena (from its start line to its exit), which can be crossed during the wait.
 */
export function travelMetres(c: Course): number {
   const goalZ = c.boss && c.bossSpec ? c.bossSpec.beacon.z - BEACON_WAKE_R : c.finish.z - FINISH_R;
   let d = Math.max(0, goalZ - c.startZ);
   for (const s of c.sections) if (s.kind === "survive") d -= Math.max(0, s.z1 - GATE_T - (s.z0 + ARENA_IN));
   return Math.max(0, d);
}

export function minFinishMs(c: Course): number {
   const travel = (Math.max(0, travelMetres(c) - boostBudgetMetres(c)) / V_RUN) * 1000;
   return travel + surviveTotalMs(c) + (c.boss ? bossMinMs() : 0);
}

export function comboSpecOf(c: Course): ComboLevelSpec {
   const rings = c.rings.filter((r) => c.sections[r.section].kind !== "boss").length;
   const rows = c.rows.filter((r) => c.sections[r.section].kind !== "boss").length;
   return {
      combo: COMBO,
      sources: [
         { count: rings, base: COMBO_BASE_MS.ring },
         { count: rows, base: COMBO_BASE_MS.door },
         { count: c.sections.filter((s) => s.kind !== "boss").length, base: COMBO_BASE_MS.section },
         { count: c.gems.length, base: COMBO_BASE_MS.orb },
         { count: c.sections.filter((s) => s.kind === "core").length, base: COMBO_BASE_MS.core },
         { count: c.boss ? SENTINEL.maxHp : 0, base: COMBO_BASE_MS.hit },
      ],
   };
}

export function minDurationMsOf(c: Course): number {
   const bonus = c.gems.length * ORB_BONUS_MS + comboMaxBonus(comboSpecOf(c));
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
   1: { kind: "time", maxScore: 9330, minDurationMs: 6700, maxDurationMs: 100000, timeBaseMs: 100000 },
   2: { kind: "time", maxScore: 10700, minDurationMs: 13000, maxDurationMs: 120000, timeBaseMs: 120000 },
   3: { kind: "time", maxScore: 12880, minDurationMs: 21200, maxDurationMs: 150000, timeBaseMs: 150000 },
   4: { kind: "time", maxScore: 14900, minDurationMs: 31000, maxDurationMs: 180000, timeBaseMs: 180000 },
   5: { kind: "time", maxScore: 18920, minDurationMs: 50800, maxDurationMs: 240000, timeBaseMs: 240000 },
};

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB_BONUS_MS - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: never knocked (a beam, an orb, the Sentinel's sweep). */
export function badgeHits(run: TrialRun): number {
   return run.strikes;
}

/**
 * Where the hero should head: the next ring, the switch of a door it can open (or the door once
 * charged), the arena's middle, the core or its receptor, the next section's start, the finish, or the
 * Sentinel (his beacon before he wakes). False when there is nothing to point at.
 */
export function guidePoint(run: TrialRun, out: { x: number; y: number; z: number }): boolean {
   const c = run.course;
   const h = run.hero;
   out.y = 0;
   const cur = currentSection(run);
   if (cur >= c.sections.length) {
      out.x = c.finish.x;
      out.z = c.finish.z;
      return !c.boss;
   }
   const sec = c.sections[cur];
   if (h.z < sec.z0 - 0.5 && sec.kind !== "jump" && sec.kind !== "runner") {
      out.x = 0;
      out.z = sec.z0 + 1;
      return true;
   }
   switch (sec.kind) {
      case "rings": {
         const r = nextRing(run, cur);
         if (!r) return false;
         out.x = r.x;
         out.y = r.y - 0.6;
         out.z = r.z;
         return true;
      }
      case "gates": {
         const row = nextRow(run, cur);
         if (!row) return false;
         const door = row.doors.find((d) => d.color === run.charge);
         if (door) {
            out.x = (door.x0 + door.x1) / 2;
            out.z = row.z;
            return true;
         }
         // the nearest of this row's own switches with a colour the row has a door for
         let best: { x: number; z: number } | null = null;
         let bd = Infinity;
         for (const w of c.switches) {
            if (w.section !== cur || w.z >= row.z || w.z < row.z - 9 || !row.doors.some((d) => d.color === w.color)) continue;
            const d = Math.hypot(w.x - h.x, w.z - h.z);
            if (d < bd) {
               bd = d;
               best = w;
            }
         }
         if (!best) return false;
         out.x = best.x;
         out.z = best.z;
         return true;
      }
      case "survive":
         out.x = 0;
         out.z = run.surviveStart[cur] < 0 ? sec.z0 + ARENA_IN + 1 : (sec.z0 + sec.z1) / 2;
         return true;
      case "core":
         if (run.coreState[cur] === 1) {
            out.x = sec.receptor!.x;
            out.z = sec.receptor!.z;
         } else {
            out.x = run.coreX[cur];
            out.z = run.coreZ[cur];
         }
         return true;
      case "boss": {
         const bs = c.bossSpec!;
         if (!run.bossAwake) {
            out.x = bs.beacon.x;
            out.z = bs.beacon.z;
            return true;
         }
         if (!run.boss || run.boss.hp <= 0) return false;
         out.x = bs.x;
         out.y = 1.5;
         out.z = bs.z;
         return true;
      }
      default:
         out.x = 0;
         out.z = sec.z1 + 1;
         return true;
   }
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
   /** the current section (index) and how many there are */
   section: "section",
   sections: "sections",
   /** the section's kind: 0 jump, 1 rings, 2 gates, 3 runner, 4 survive, 5 core, 6 boss */
   sectionKind: "sectionKind",
   /** the section's objective: done / total (rings, doors, ms left, core state) */
   objDone: "objDone",
   objTotal: "objTotal",
   /** the colour the hero carries + 1 (0 none) */
   charge: "charge",
   /** the survival round's seconds left (0 none) */
   surviveLeft: "surviveLeft",
   /** carrying the energy core */
   carrying: "carrying",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossOn: "bossOn",
   /** the colour the Sentinel's beacon shows + 1 (0 none) */
   bossColor: "bossColor",
   progress: "progress",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   strikes: "strikes",
} as const;
