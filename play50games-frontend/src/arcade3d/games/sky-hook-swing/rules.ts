// Sky Hook Swing's rules: an analytic pendulum (the card's fix: no physics engine). Action throws a
// hook at the ring in the stick's cone, up reels in, down reels out, Action again releases along the
// tangent. A release in the green window (still climbing, past the bottom) leaves 25% faster.
// Fixed substeps, a speed cap, and every anchor's place is a function of the clock.
import type { LevelId } from "@/arcade3d/types";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboHit, comboMaxBonus, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { heroById, type HeroId, DEFAULT_HERO, V_DASH, POWER_MS, MAGNET_REACH } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, GUST_GALLEON, SECRETS } from "./progression";
import {
   anchorAt, buildCourse, gustAt,
   type Anchor, type Block, type Course, type Vec3,
} from "./course";

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const SUB_MS = 16;

export const G = 30;
export const V_RUN = 6.4;
export const V_JUMP = 11.2;
export const AIR = 18;
export const L_MIN = 3;
export const L_MAX = 12;
export const HOOK_RANGE = 14;
export const CONE = (35 * Math.PI) / 180;
export const COS_CONE = Math.cos(CONE);
export const REEL = 5.5;
export const STEER = 2.4;
/** the swing plane turns at most this fast sideways (m/s at the hero), so steering never outruns the rope */
export const STEER_V = 4.5;
export const V_CAP = 22;
export const PEAK_BONUS = 1.25;
export const V_FREE_CAP = V_CAP * PEAK_BONUS;
/**
 * The proof's pace: the hero's x never passes startX + V_X_CAP * t (rules ms), in every mode. It is an
 * average from the start, not a top speed: a peak release flies at up to 27.5 m/s for a moment, but the
 * fastest bot run (Riko dashing out of every release) averages 16.8 m/s at its best moment, so honest
 * play stays well under it (proof.test.ts pins under 80 %). The clamp is the guarantee.
 */
export const V_X_CAP = V_CAP;
export const HOOK_MIN_MS = 160;
export const PEAK_MIN = 5.2;
export const ORB = { pickup: 1.15, bonusMs: 80 } as const;
export const FALL_Y = -12;
export const LOST_MS = 680;
export const SPAWN_MS = 420;
export const BODY_R = 0.42;
export const LOCK_MS = 1000;

export type MoveMode = "ground" | "air" | "swing" | "lost" | "spawn";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   mode: MoveMode;
   grounded: boolean;
   faceX: number;
   faceZ: number;
   /** pendulum: anchor index (NONE off the rope, -2 = a co-op tether) */
   anchor: number;
   L: number;
   theta: number;
   omega: number;
   phi: number;
   hookAt: number;
   peak: boolean;
   /** a heavy ring held still until a second rope is on it */
   heavyHold: boolean;
   /** the next hook continues the air chain */
   chaining: boolean;
   airJump: boolean;
   dashUsed: boolean;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** hooked a drone since the last landing (the mast hit) */
   swungDrone: boolean;
   timer: number;
   support: number;
   /** the island the hook left; the swing ignores it until it passes the bottom */
   takeoff: number;
}

export interface StepInput {
   /** screen stick. moveZ is the core's moveY (up = -1). yaw turns it into the world for walking and aiming. */
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   hooked: number;
   released: boolean;
   peakRelease: boolean;
   landed: boolean;
   landedOn: number;
   checkpoint: number;
   orbCount: number;
   orbList: number[];
   lost: boolean;
   struck: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   dashed: boolean;
   /** a crate broken by the dash */
   smashed: number;
   snapped: boolean;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossTelegraph: boolean;
}

export interface Tether {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   live: boolean;
}

export interface SwingRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   /** where the reach bound starts (the start deck's x, or a multiplayer seat's x) */
   startX: number;
   simMs: number;
   remainder: number;
   hero: Hero;
   jumpLatch: number;
   powerReadyAt: number;
   checkpoint: number;
   respawns: number;
   collected: Uint8Array;
   /** 1 once this anchor has paid a flow link */
   hookedCombo: Uint8Array;
   broken: Uint8Array;
   /** inside a ghost hull (the panels let the hero back out) */
   inHull: boolean;
   /** 1 once a cracked ring has snapped; mended on the next checkpoint or respawn */
   ringBroken: Uint8Array;
   orbs: number;
   mainOrbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   /** 1 once that turret is knocked off */
   turretHit: Uint8Array;
   /** rules ms when the galleon starts falling (-1 before) */
   fallMs: number;
   /** cannonball during a salvo */
   shotX: number;
   shotY: number;
   shotZ: number;
   shotLive: boolean;
   /** co-op: a partner can be a ring. Versus: taking a ring locks it. */
   multi: boolean;
   versus: boolean;
   seat: number;
   heavyLive: boolean;
   tether: Tether;
   lockUntil: Float64Array;
   lockOwner: Int8Array;
}

const STICK = { x: 0, z: 0 };
const P = { x: 0, y: 0, z: 0 };
const Q = { x: 0, y: 0, z: 0 };

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, hooked: NONE, released: false, peakRelease: false,
      landed: false, landedOn: NONE, checkpoint: NONE, orbCount: 0, orbList: new Array<number>(16).fill(0),
      lost: false, struck: false, respawned: false, finished: false, timeup: false,
      powered: false, dashed: false, smashed: NONE, snapped: false,
      comboBonus: 0, comboLinked: false, secretCount: 0, secretList: [0, 0, 0],
      bossHit: false, bossPhase: false, bossDefeated: false, bossTelegraph: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = ev.airJumped = ev.released = ev.peakRelease = ev.landed = false;
   ev.lost = ev.struck = ev.respawned = ev.finished = ev.timeup = false;
   ev.powered = ev.dashed = ev.snapped = ev.comboLinked = false;
   ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.bossTelegraph = false;
   ev.hooked = ev.landedOn = ev.checkpoint = ev.smashed = NONE;
   ev.orbCount = ev.secretCount = ev.comboBonus = 0;
}

function freshHero(x: number, y: number, z: number, support: number): Hero {
   return {
      x, y, z, vx: 0, vy: 0, vz: 0, mode: "ground", grounded: true,
      faceX: 1, faceZ: 0, anchor: NONE, L: 8, theta: 0, omega: 0, phi: 0,
      hookAt: NONE, peak: false, heavyHold: false, chaining: false, airJump: true,
      dashUsed: false, dashUntil: NONE, dashX: 1, dashZ: 0,
      shieldUntil: NONE, magnetUntil: NONE, phaseUntil: NONE, swungDrone: false,
      timer: 0, support, takeoff: NONE,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): SwingRun {
   const course = courseFor(level);
   const start = course.islands[0];
   const nA = course.anchors.length;
   return {
      course, level, heroId, seed, startX: start.x, simMs: 0, remainder: 0,
      hero: freshHero(start.x, start.y, start.z, 0),
      jumpLatch: NONE, powerReadyAt: 0, checkpoint: 0, respawns: 0,
      collected: new Uint8Array(course.orbs.length),
      hookedCombo: new Uint8Array(nA),
      broken: new Uint8Array(course.blocks.length),
      ringBroken: new Uint8Array(nA),
      inHull: false,
      orbs: 0, mainOrbs: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0, finishMs: 0, ended: null, events: createEvents(),
      boss: course.boss ? createBoss(GUST_GALLEON) : null,
      bossEv: createBossEvents(),
      turretHit: new Uint8Array(course.turrets.length),
      fallMs: -1, shotX: 0, shotY: 0, shotZ: 0, shotLive: false,
      multi: false, versus: false, seat: 0, heavyLive: false,
      tether: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, live: false },
      lockUntil: new Float64Array(nA),
      lockOwner: new Int8Array(nA).fill(-1),
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}

export const COURSE: Course = courseFor(1);

function finite(v: number): number {
   return Number.isFinite(v) ? v : 0;
}

function clamp(v: number, a: number, b: number): number {
   return v < a ? a : v > b ? b : v;
}

function hypot3(x: number, y: number, z: number): number {
   return Math.hypot(x, y, z);
}

export function anchorPoint(run: SwingRun, index: number, ms: number, out: Vec3): Vec3 {
   if (index === -2) {
      out.x = run.tether.x;
      out.y = run.tether.y;
      out.z = run.tether.z;
      return out;
   }
   return anchorAt(run.course.anchors[index], ms, run.fallMs, out);
}

function anchorLocked(run: SwingRun, index: number): boolean {
   if (index < 0) return false;
   return run.lockUntil[index] > run.simMs && run.lockOwner[index] !== run.seat;
}

export function canAim(run: SwingRun, index: number): boolean {
   if (index === -2) return run.tether.live;
   const a = run.course.anchors[index];
   if (!a) return false;
   if (anchorLocked(run, index)) return false;
   if (run.ringBroken[index]) return false;
   if (a.kind === "drone" && (!run.boss || run.boss.phase !== 1)) return false;
   if (a.kind === "fall" && run.fallMs < 0) return false;
   if (a.cut && run.boss && run.boss.phase >= 1) return false;
   return true;
}

/** The ring the stick is pointing at, or NONE. Screen-up is not required: the cone is the stick's direction, biased upward. */
export function aimedAnchor(run: SwingRun, input: StepInput): number {
   const h = run.hero;
   inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
   let ax = STICK.x;
   let az = STICK.z;
   const mag = Math.hypot(ax, az);
   if (mag < 0.18) {
      ax = h.faceX;
      az = h.faceZ;
   } else {
      ax /= mag;
      az /= mag;
      h.faceX = ax;
      h.faceZ = az;
   }
   const ay = 0.62;
   const al = Math.hypot(ax, ay, az) || 1;
   ax /= al;
   const ayy = ay / al;
   az /= al;
   let best = NONE;
   let bestDot = COS_CONE - 1e-4;
   let bestDist = HOOK_RANGE;
   const consider = (index: number, px: number, py: number, pz: number) => {
      const dx = px - h.x;
      const dy = py - h.y;
      const dz = pz - h.z;
      const dist = hypot3(dx, dy, dz);
      if (dist > HOOK_RANGE || dist < 0.75 || dy < dist * 0.06) return;
      const inv = 1 / dist;
      const dot = dx * inv * ax + dy * inv * ayy + dz * inv * az;
      if (dot > bestDot || (dot >= bestDot && dist < bestDist)) {
         bestDot = dot;
         bestDist = dist;
         best = index;
      }
   };
   if (run.tether.live) consider(-2, run.tether.x, run.tether.y, run.tether.z);
   const anchors = run.course.anchors;
   for (let i = 0; i < anchors.length; i++) {
      if (!canAim(run, i)) continue;
      anchorPoint(run, i, run.simMs, P);
      consider(i, P.x, P.y, P.z);
   }
   return best;
}

const PEEK = createStepInput();

/** The ring a press would take now (the HUD's auto-target highlight). Changes nothing in the run. */
export function peekAim(run: SwingRun, moveX: number, moveZ: number, yaw: number): number {
   const h = run.hero;
   if (h.mode !== "ground" && h.mode !== "air") return NONE;
   const fx = h.faceX;
   const fz = h.faceZ;
   PEEK.moveX = moveX;
   PEEK.moveZ = moveZ;
   PEEK.yaw = yaw;
   const i = aimedAnchor(run, PEEK);
   h.faceX = fx;
   h.faceZ = fz;
   return i;
}

function capFree(h: Hero): void {
   const s = Math.hypot(h.vx, h.vz);
   if (s > V_FREE_CAP) {
      const k = V_FREE_CAP / s;
      h.vx *= k;
      h.vz *= k;
   }
   h.vy = clamp(h.vy, -V_FREE_CAP, V_FREE_CAP);
}

function shielded(h: Hero, ms: number): boolean {
   return h.shieldUntil >= ms;
}

function phasing(h: Hero, ms: number): boolean {
   return h.phaseUntil >= ms;
}

function magnetOn(h: Hero, ms: number): boolean {
   return h.magnetUntil >= ms;
}

/** inside a ghost hull (a phased-in Vexa), `grow` m past its inner faces */
export function insideHull(course: Course, x: number, y: number, z: number, grow = 0): boolean {
   for (const b of course.hulls) {
      if (x > b.x0 - grow && x < b.x1 + grow && y > b.y0 - grow && y < b.y1 + grow && z > b.z0 - grow && z < b.z1 + grow) return true;
   }
   return false;
}

/** Once inside a hull the ghost panels stay open until the hero is clear of the panels again. */
function updateHull(run: SwingRun): void {
   const h = run.hero;
   const cy = h.y + 0.55;
   if (insideHull(run.course, h.x, cy, h.z)) run.inHull = true;
   else if (run.inHull && !insideHull(run.course, h.x, cy, h.z, HULL_SHELL)) run.inHull = false;
}

/** a hull panel's thickness plus the body's radius: past this the hero is clear of the panels */
const HULL_SHELL = 0.3 + BODY_R + 0.05;

function blockSolid(run: SwingRun, b: Block, i: number): boolean {
   if (b.kind === "crate" && run.broken[i]) return false;
   if (b.kind === "ghost") {
      const h = run.hero;
      if (phasing(h, run.simMs) || run.inHull) return false;
   }
   return true;
}

function overlapsBlock(x: number, y: number, z: number, b: Block): boolean {
   const cx = clamp(x, b.x0, b.x1);
   const cy = clamp(y, b.y0, b.y1);
   const cz = clamp(z, b.z0, b.z1);
   const dx = x - cx;
   const dy = y - cy;
   const dz = z - cz;
   return dx * dx + dy * dy + dz * dz < BODY_R * BODY_R;
}

/** Pushes the body out of solid blocks. Returns true when a swing should snag. */
function resolveBlocks(run: SwingRun, ev: StepEvents): boolean {
   const h = run.hero;
   const blocks = run.course.blocks;
   let snag = false;
   const cy = h.y + 0.55;
   for (let n = 0; n < 3; n++) {
      for (let i = 0; i < blocks.length; i++) {
         const b = blocks[i];
         if (b.kind === "crate" && run.hero.dashUntil >= run.simMs && overlapsBlock(h.x, cy, h.z, b) && !run.broken[i]) {
            run.broken[i] = 1;
            ev.smashed = i;
            continue;
         }
         if (!blockSolid(run, b, i) || !overlapsBlock(h.x, cy, h.z, b)) continue;
         const dl = h.x - b.x0;
         const dr = b.x1 - h.x;
         const dd = cy - b.y0;
         const du = b.y1 - cy;
         const df = h.z - b.z0;
         const db = b.z1 - h.z;
         const m = Math.min(dl, dr, dd, du, df, db);
         if (m === dl) h.x = b.x0 - BODY_R;
         else if (m === dr) h.x = b.x1 + BODY_R;
         else if (m === dd) h.y = b.y0 - BODY_R - 0.55;
         else if (m === du) h.y = b.y1 + BODY_R - 0.55;
         else if (m === df) h.z = b.z0 - BODY_R;
         else h.z = b.z1 + BODY_R;
         if (m > 0.22) snag = true;
      }
   }
   return snag;
}

function islandAt(course: Course, x: number, z: number, y: number): number {
   let best = NONE;
   let top = -Infinity;
   const islands = course.islands;
   for (let i = 0; i < islands.length; i++) {
      const s = islands[i];
      if (s.y > y + 0.25 || s.y < top) continue;
      const dx = x - s.x;
      const dz = z - s.z;
      if (Math.abs(dx) <= s.r && Math.abs(dz) <= s.r) {
         best = i;
         top = s.y;
      }
   }
   return best;
}

/** A falling body crosses a deck this step when the feet go from above it to on or below it. */
function crossedDeck(course: Course, x: number, z: number, y0: number, y1: number): number {
   let best = NONE;
   let top = -Infinity;
   const islands = course.islands;
   for (let i = 0; i < islands.length; i++) {
      const s = islands[i];
      if (y0 < s.y - 0.25 || y1 > s.y + 0.35 || s.y < top) continue;
      const dx = x - s.x;
      const dz = z - s.z;
      if (Math.abs(dx) <= s.r && Math.abs(dz) <= s.r) {
         best = i;
         top = s.y;
      }
   }
   return best;
}

function lose(run: SwingRun, ev: StepEvents, struck: boolean): void {
   const h = run.hero;
   if (h.mode === "lost" || h.mode === "spawn" || run.ended) return;
   h.mode = "lost";
   h.grounded = false;
   h.anchor = NONE;
   h.peak = false;
   h.heavyHold = false;
   h.timer = 0;
   h.chaining = false;
   comboBreak(run.combo);
   run.hits += 1;
   ev.lost = true;
   ev.struck = struck;
}

function land(run: SwingRun, index: number, ev: StepEvents): void {
   const h = run.hero;
   const s = run.course.islands[index];
   h.mode = "ground";
   h.grounded = true;
   h.x = clamp(h.x, s.x - s.r + 0.05, s.x + s.r - 0.05);
   h.z = clamp(h.z, s.z - s.r + 0.05, s.z + s.r - 0.05);
   h.y = s.y;
   h.vx = h.vz = h.vy = 0;
   h.anchor = NONE;
   h.peak = false;
   h.heavyHold = false;
   h.support = index;
   h.airJump = true;
   h.dashUsed = false;
   h.swungDrone = false;
   if (h.chaining) comboBreak(run.combo);
   h.chaining = false;
   ev.landed = true;
   ev.landedOn = index;
   if (s.cp) {
      run.ringBroken.fill(0);
      if (run.checkpoint !== index) ev.checkpoint = index;
      run.checkpoint = index;
      if (index === run.course.finish && !run.course.boss) win(run, ev);
   } else {
      run.hits += 1;
   }
}

function win(run: SwingRun, ev: StepEvents): void {
   if (run.ended) return;
   run.finishMs = run.simMs;
   run.ended = "win";
   ev.finished = true;
}

function release(run: SwingRun, boost: boolean, ev: StepEvents): void {
   const h = run.hero;
   if (boost) {
      h.vx *= PEAK_BONUS;
      h.vy *= PEAK_BONUS;
      h.vz *= PEAK_BONUS;
      ev.peakRelease = true;
   }
   capFree(h);
   h.mode = "air";
   h.grounded = false;
   h.anchor = NONE;
   h.peak = false;
   h.heavyHold = false;
   h.airJump = true;
   h.dashUsed = false;
   h.chaining = true;
   ev.released = true;
}

function hook(run: SwingRun, index: number, ev: StepEvents): void {
   const h = run.hero;
   anchorPoint(run, index, run.simMs, P);
   // the rope takes the hero where they are (no snap): a rope past 12 m or under 3 m is reeled
   // to the range by swingStep at the reel speed ("the rope snaps tight")
   const dx = h.x - P.x;
   const dy = h.y - P.y;
   const dz = h.z - P.z;
   const L = Math.max(0.75, hypot3(dx, dy, dz));
   const horiz = Math.hypot(dx, dz) || 0.001;
   h.phi = Math.atan2(dx, dz);
   h.theta = Math.atan2(horiz, -dy);
   const tx = Math.cos(h.theta) * Math.sin(h.phi);
   const ty = Math.sin(h.theta);
   const tz = Math.cos(h.theta) * Math.cos(h.phi);
   h.omega = (h.vx * tx + h.vy * ty + h.vz * tz) / L;
   const sp = Math.abs(h.omega) * L;
   if (sp > V_CAP) h.omega *= V_CAP / sp;
   h.L = L;
   h.mode = "swing";
   h.grounded = false;
   h.anchor = index;
   h.hookAt = run.simMs;
   h.takeoff = h.support;
   h.peak = false;
   const heavy = index >= 0 && run.course.anchors[index].kind === "heavy" && run.multi && !run.heavyLive;
   h.heavyHold = heavy;
   if (heavy) h.omega = 0;
   if (index >= 0 && run.course.anchors[index].kind === "drone") h.swungDrone = true;
   if (index >= 0 && run.versus) {
      run.lockUntil[index] = run.simMs + LOCK_MS;
      run.lockOwner[index] = run.seat;
   }
   if (h.chaining && index >= 0 && !run.hookedCombo[index]) {
      run.hookedCombo[index] = 1;
      ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.hook);
      ev.comboLinked = true;
   }
   ev.hooked = index;
}

function tryHook(run: SwingRun, input: StepInput, ev: StepEvents): boolean {
   const index = aimedAnchor(run, input);
   if (index === NONE) return false;
   hook(run, index, ev);
   return true;
}

function firePower(run: SwingRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   if (run.simMs < run.powerReadyAt) return;
   const id = run.heroId;
   if (id === "nami") return;
   if (id === "riko") {
      if (h.mode !== "air" || h.dashUsed) return;
      inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
      let dx = STICK.x;
      let dz = STICK.z;
      if (Math.hypot(dx, dz) < 0.2) {
         dx = h.faceX;
         dz = h.faceZ;
      }
      const m = Math.hypot(dx, dz) || 1;
      h.dashX = dx / m;
      h.dashZ = dz / m;
      h.dashUntil = run.simMs + POWER_MS.dash;
      h.dashUsed = true;
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
      ev.dashed = true;
   } else if (id === "kiro") h.shieldUntil = run.simMs + POWER_MS.shield;
   else if (id === "zuno") h.magnetUntil = run.simMs + POWER_MS.magnet;
   else h.phaseUntil = run.simMs + POWER_MS.phase;
   run.powerReadyAt = run.simMs + heroById(id).cooldownMs;
   ev.powered = true;
}

function tryJump(run: SwingRun, ev: StepEvents): void {
   const h = run.hero;
   if (run.jumpLatch < 0 || run.simMs - run.jumpLatch > 140) return;
   if (h.mode === "ground") {
      h.mode = "air";
      h.grounded = false;
      h.vy = V_JUMP;
      h.airJump = true;
      run.jumpLatch = NONE;
      ev.jumped = true;
      return;
   }
   if (h.mode === "air" && run.heroId === "nami" && h.airJump) {
      h.vy = V_JUMP;
      h.airJump = false;
      run.jumpLatch = NONE;
      ev.airJumped = true;
   }
}

function swingStep(run: SwingRun, dt: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   const index = h.anchor;
   if (index >= 0) {
      const a = run.course.anchors[index];
      if (a.cut && run.boss && run.boss.phase >= 1) {
         release(run, false, ev);
         ev.snapped = true;
         return;
      }
      if (a.crackMs > 0 && run.simMs - h.hookAt > a.crackMs) {
         run.ringBroken[index] = 1;
         release(run, false, ev);
         ev.snapped = true;
         return;
      }
   }
   if (index === -2 && !run.tether.live) {
      release(run, false, ev);
      return;
   }
   if (h.heavyHold && run.heavyLive) h.heavyHold = false;
   anchorPoint(run, index, run.simMs, P);
   anchorPoint(run, index, run.simMs - dt * 1000, Q);
   const avx = dt > 0 ? (P.x - Q.x) / dt : 0;
   const avy = dt > 0 ? (P.y - Q.y) / dt : 0;
   const avz = dt > 0 ? (P.z - Q.z) / dt : 0;
   let lDot = 0;
   let phiDot = 0;
   if (!h.heavyHold) {
      const reel = input.moveZ < -0.35 ? -1 : input.moveZ > 0.35 ? 1 : 0;
      let next = h.L + reel * REEL * dt;
      if (next > L_MAX) next = Math.max(L_MAX, Math.min(next, h.L) - REEL * dt);
      else if (next < L_MIN) next = Math.min(L_MIN, Math.max(next, h.L) + REEL * dt);
      lDot = dt > 0 ? (next - h.L) / dt : 0;
      h.L = next;
      const wind = gustAt(run.course, run.simMs);
      const tx0 = Math.cos(h.theta) * Math.sin(h.phi);
      const acc = -(G / h.L) * Math.sin(h.theta) - (2 * lDot * h.omega) / h.L + (wind * tx0) / h.L;
      h.omega += acc * dt;
      const turn = Math.min(STEER, STEER_V / Math.max(0.5, h.L * Math.abs(Math.sin(h.theta))));
      phiDot = clamp(finite(input.moveX), -1, 1) * turn;
      h.phi += phiDot * dt;
      const sp = Math.abs(h.omega) * h.L;
      if (sp > V_CAP) h.omega *= V_CAP / sp;
      h.theta += h.omega * dt;
      if (h.theta > 1.52) h.theta = 1.52;
      else if (h.theta < -1.52) h.theta = -1.52;
   }
   const s = Math.sin(h.theta);
   const c = Math.cos(h.theta);
   const tx = Math.cos(h.theta) * Math.sin(h.phi);
   const ty = Math.sin(h.theta);
   const tz = Math.cos(h.theta) * Math.cos(h.phi);
   h.x = P.x + h.L * s * Math.sin(h.phi);
   h.y = P.y - h.L * c;
   h.z = P.z + h.L * s * Math.cos(h.phi);
   // the swing plane's turn moves the hero sideways round the anchor (released with the rest)
   const side = phiDot * h.L * s;
   if (index === -2) {
      h.vx = h.omega * h.L * tx + lDot * s * Math.sin(h.phi) + side * Math.cos(h.phi) + run.tether.vx;
      h.vy = h.omega * h.L * ty + lDot * -c + run.tether.vy;
      h.vz = h.omega * h.L * tz + lDot * s * Math.cos(h.phi) - side * Math.sin(h.phi) + run.tether.vz;
   } else {
      h.vx = h.omega * h.L * tx + lDot * s * Math.sin(h.phi) + side * Math.cos(h.phi) + avx;
      h.vy = h.omega * h.L * ty + lDot * -c + avy;
      h.vz = h.omega * h.L * tz + lDot * s * Math.cos(h.phi) - side * Math.sin(h.phi) + avz;
   }
   const speed = Math.abs(h.omega) * h.L;
   h.peak = !h.heavyHold && h.omega * h.theta > 0 && Math.abs(h.theta) >= 0.5 && Math.abs(h.theta) <= 1.52 && speed >= PEAK_MIN;
   if (Math.abs(h.theta) >= 1.5 && !h.heavyHold && h.omega * h.theta > 0 && run.simMs - h.hookAt >= HOOK_MIN_MS) {
      release(run, h.peak, ev);
      return;
   }
   if (resolveBlocks(run, ev) && !h.heavyHold) {
      release(run, false, ev);
      h.vx *= 0.45;
      h.vy *= 0.45;
      h.vz *= 0.45;
      ev.snapped = true;
      return;
   }
   if (edge && run.simMs - h.hookAt >= HOOK_MIN_MS) {
      release(run, h.peak, ev);
      return;
   }
   if (h.vy <= 1) {
      const pad = islandAt(run.course, h.x, h.z, h.y);
      if (pad !== NONE && !(pad === h.takeoff && h.theta > -0.12) && h.y <= run.course.islands[pad].y + 0.2 && h.y >= run.course.islands[pad].y - 0.65) land(run, pad, ev);
   }
}

function airStep(run: SwingRun, dt: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   const wind = gustAt(run.course, run.simMs);
   if (h.dashUntil >= run.simMs) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else {
      inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
      const m = Math.hypot(STICK.x, STICK.z);
      if (m > 0.15) {
         h.vx += (STICK.x / m) * AIR * dt;
         h.vz += (STICK.z / m) * AIR * dt;
         h.faceX = STICK.x / m;
         h.faceZ = STICK.z / m;
      }
      h.vx += wind * dt;
   }
   h.vy -= G * dt;
   capFree(h);
   const y0 = h.y;
   h.x += h.vx * dt;
   h.y += h.vy * dt;
   h.z += h.vz * dt;
   resolveBlocks(run, ev);
   if (edge) {
      if (!tryHook(run, input, ev)) firePower(run, input, ev);
   }
   tryJump(run, ev);
   if (h.mode !== "air") return;
   if (h.vy <= 0.8) {
      const pad = crossedDeck(run.course, h.x, h.z, y0, h.y);
      if (pad !== NONE) land(run, pad, ev);
   }
}

function groundStep(run: SwingRun, dt: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   const s = run.course.islands[h.support];
   inputToWorld(finite(input.moveX), finite(input.moveZ), finite(input.yaw), STICK);
   const m = Math.hypot(STICK.x, STICK.z);
   if (m > 0.12) {
      const wx = (STICK.x / m) * V_RUN;
      const wz = (STICK.z / m) * V_RUN;
      h.vx += (wx - h.vx) * Math.min(1, 10 * dt);
      h.vz += (wz - h.vz) * Math.min(1, 10 * dt);
      h.faceX = STICK.x / m;
      h.faceZ = STICK.z / m;
   } else {
      h.vx *= Math.max(0, 1 - 12 * dt);
      h.vz *= Math.max(0, 1 - 12 * dt);
   }
   h.x += h.vx * dt;
   h.z += h.vz * dt;
   h.vy = 0;
   const still = islandAt(run.course, h.x, h.z, s.y + 0.3);
   if (still === NONE) {
      h.mode = "air";
      h.grounded = false;
      h.y = s.y;
      return;
   }
   h.support = still;
   h.y = run.course.islands[still].y;
   h.grounded = true;
   resolveBlocks(run, ev);
   if (edge && tryHook(run, input, ev)) return;
   tryJump(run, ev);
   if (edge && h.mode === "ground") firePower(run, input, ev);
}

function pickup(run: SwingRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.mode === "lost" || h.mode === "spawn") return;
   const reach = magnetOn(h, run.simMs) ? MAGNET_REACH : ORB.pickup;
   const orbs = run.course.orbs;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      const dx = h.x - o.x;
      const dy = h.y + 0.7 - o.y;
      const dz = h.z - o.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.kind === "main") run.mainOrbs += 1;
      ev.orbList[ev.orbCount] = i;
      ev.orbCount += 1;
      ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.orb);
      ev.comboLinked = true;
   }
   const spots = run.course.secrets;
   for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const dx = h.x - s.x;
      const dy = h.y + 0.6 - s.y;
      const dz = h.z - s.z;
      if (dx * dx + dy * dy + dz * dz > s.r * s.r) continue;
      if (collectSecret(run.secrets, i)) {
         ev.secretList[ev.secretCount] = i;
         ev.secretCount += 1;
      }
   }
}

function hurt(run: SwingRun, ev: StepEvents): void {
   const h = run.hero;
   if (h.mode === "lost" || h.mode === "spawn" || shielded(h, run.simMs)) return;
   const hazards = run.course.hazards;
   for (let i = 0; i < hazards.length; i++) {
      const z = hazards[i];
      const dx = h.x - z.x;
      const dy = h.y + 0.6 - z.y;
      const dz = h.z - z.z;
      if (dx * dx + dy * dy + dz * dz < z.r * z.r) {
         lose(run, ev, true);
         return;
      }
   }
   if (run.shotLive && h.y < 6.4) {
      const dx = h.x - run.shotX;
      const dy = h.y + 0.5 - run.shotY;
      const dz = h.z - run.shotZ;
      if (dx * dx + dy * dy + dz * dz < 1.2 * 1.2) lose(run, ev, true);
   }
}

function bossFrame(run: SwingRun, dtMs: number, ev: StepEvents): void {
   const b = run.boss;
   if (!b) return;
   const bev = stepBoss(b, GUST_GALLEON, dtMs, run.bossEv);
   if (bev.telegraph) ev.bossTelegraph = true;
   if (bev.phaseChanged) ev.bossPhase = true;
   if (b.phase >= 2 && run.fallMs < 0) run.fallMs = run.simMs;
   run.shotLive = false;
   if (b.phase === 0 && b.step === "attack") {
      let i = 0;
      while (i < run.turretHit.length && run.turretHit[i]) i += 1;
      const t = run.course.turrets[i];
      if (t) {
         const u = clamp(b.stepMs / 800, 0, 1);
         run.shotX = t.x - 8 * u;
         run.shotY = 6.2;
         run.shotZ = t.z;
         run.shotLive = true;
      }
   }
}

function bossTouch(run: SwingRun, ev: StepEvents): void {
   const b = run.boss;
   if (!b || b.step !== "vulnerable" || run.ended) return;
   const h = run.hero;
   const course = run.course;
   if (b.phase === 0 && h.mode !== "swing") {
      for (let i = 0; i < course.turrets.length; i++) {
         if (run.turretHit[i]) continue;
         const t = course.turrets[i];
         const dx = h.x - t.x;
         const dy = h.y + 0.5 - t.y;
         const dz = h.z - t.z;
         if (dx * dx + dy * dy + dz * dz > t.r * t.r) continue;
         run.turretHit[i] = 1;
         noteBossHit(run, ev);
         return;
      }
   } else if (b.phase === 1 && course.mast && h.swungDrone) {
      const m = course.mast;
      const dx = h.x - m.x;
      const dy = h.y + 0.5 - m.y;
      const dz = h.z - m.z;
      if (dx * dx + dy * dy + dz * dz <= m.r * m.r) noteBossHit(run, ev);
   } else if (b.phase === 2 && course.bell) {
      const bell = course.bell;
      const dx = h.x - bell.x;
      const dy = h.y + 0.6 - bell.y;
      const dz = h.z - bell.z;
      if (dx * dx + dy * dy + dz * dz <= bell.r * bell.r) noteBossHit(run, ev);
   }
}

function noteBossHit(run: SwingRun, ev: StepEvents): void {
   const b = run.boss;
   if (!b) return;
   const result = hitBoss(b, GUST_GALLEON, 1, run.bossEv);
   if (result === "ignored") return;
   ev.bossHit = true;
   if (result === "phase") {
      ev.bossPhase = true;
      // the cut hull rings are behind now: the respawn moves up with the fight
      const cp = run.course.phaseCp[b.phase] ?? -1;
      if (cp >= 0 && run.course.islands[cp].x > run.course.islands[run.checkpoint].x) run.checkpoint = cp;
   }
   if (result === "defeated") {
      ev.bossDefeated = true;
      win(run, ev);
   }
}

/** The proof's guard: x never passes startX + V_X_CAP * t. Never reached in honest play. */
export function reachX(run: SwingRun): number {
   return run.startX + (V_X_CAP * run.simMs) / 1000;
}

function clampReach(run: SwingRun): void {
   const limit = reachX(run);
   if (run.hero.x > limit) run.hero.x = limit;
}

function substep(run: SwingRun, dtMs: number, input: StepInput, edge: boolean, ev: StepEvents): void {
   const h = run.hero;
   run.simMs += dtMs;
   const dt = dtMs / 1000;
   if (h.mode === "lost") {
      h.timer += dtMs;
      if (h.timer >= LOST_MS) {
         const s = run.course.islands[run.checkpoint];
         h.x = s.x;
         h.y = s.y;
         h.z = s.z;
         clampReach(run);
         h.vx = h.vy = h.vz = 0;
         h.mode = "spawn";
         h.timer = 0;
         h.support = run.checkpoint;
         h.anchor = NONE;
         run.ringBroken.fill(0);
         run.inHull = false;
         run.respawns += 1;
         ev.respawned = true;
      }
      return;
   }
   if (h.mode === "spawn") {
      h.timer += dtMs;
      if (h.timer >= SPAWN_MS) {
         h.mode = "ground";
         h.grounded = true;
      }
      return;
   }
   if (run.course.hulls.length > 0) updateHull(run);
   if (h.mode === "swing") swingStep(run, dt, input, edge, ev);
   else if (h.mode === "air") airStep(run, dt, input, edge, ev);
   else groundStep(run, dt, input, edge, ev);
   clampReach(run);
   if (run.ended) return;
   if (h.y < FALL_Y || Math.abs(h.z) > 34 || h.x < -30 || h.x > run.course.islands[run.course.finish].x + 40) lose(run, ev, false);
}

export function step(run: SwingRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;
   if (input.jumpPressed) run.jumpLatch = run.simMs;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   if (whole <= 0) return ev;
   bossFrame(run, whole, ev);
   let left = whole;
   let edge = input.actionPressed;
   while (left > 0 && run.ended === null) {
      const d = Math.min(SUB_MS, left);
      substep(run, d, input, edge, ev);
      edge = false;
      left -= d;
      if (run.hero.mode === "lost") break;
   }
   if (run.ended === null && run.hero.mode !== "lost") {
      pickup(run, ev);
      hurt(run, ev);
      bossTouch(run, ev);
   }
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   return ev;
}

// ---------- the proof ----------

let bossFloor = 0;

/** The least rules ms to land every Gust Galleon hit, striking at the first moment of each window. */
export function bossMinMs(): number {
   if (bossFloor > 0) return bossFloor;
   const s = createBoss(GUST_GALLEON);
   const ev = createBossEvents();
   let ms = 0;
   while (s.hp > 0 && ms < 80_000) {
      stepBoss(s, GUST_GALLEON, 20, ev);
      ms += 20;
      if (s.step === "vulnerable") hitBoss(s, GUST_GALLEON, 1, ev);
   }
   bossFloor = ms;
   return ms;
}

const BOSS_MIN = bossMinMs();

/** No run covers the docks faster than the reach bound: x <= startX + V_X_CAP * t in every mode (clampReach). */
export function travelFloorMs(course: Course): number {
   return (course.span / V_X_CAP) * 1000;
}

export function minFinishMs(course: Course): number {
   const travel = travelFloorMs(course);
   return course.boss ? Math.max(travel, BOSS_MIN) : travel;
}

export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.anchors.length, base: COMBO_BASE_MS.hook },
      ],
   };
}

/** The least submitted duration: the finish floor minus every orb and the most the flow meter can pay. */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   if (!(lb > 200)) throw new Error(`sky-hook-swing L${course.level} floor ${lb} is not positive`);
   let minDurationMs = Math.floor((lb * 0.95) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const timeBaseMs = LEVELS[course.level].durationMs;
   return {
      kind: "time",
      maxScore: Math.floor((timeBaseMs - minDurationMs) / 10),
      minDurationMs,
      maxDurationMs: timeBaseMs,
      timeBaseMs,
   };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   distance: "distance",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   rope: "rope",
   peak: "peak",
   /** 0 ground, 1 air, 2 on the rope, 3 falling (the HUD's coach and rope meter) */
   mode: "mode",
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

/** The sky chain is the no-hit badge: a fall or a landing off a checkpoint breaks it. */
export function badgeHits(run: SwingRun): number {
   return run.hits;
}

/** Where the hero is launched if they release now (peak bonus included when the window is open). */
export function releaseVelocity(h: Hero, out: Vec3): Vec3 {
   const k = h.peak ? PEAK_BONUS : 1;
   out.x = h.vx * k;
   out.y = h.vy * k;
   out.z = h.vz * k;
   return out;
}
