// Jungle Vine Jump's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the
// same run, at any frame rate (the simulation advances in fixed 1000/120 ms steps).
//
// The signature mechanic (card "Climb the swing"): a vine is a pendulum whose length is the live
// control. Touch a vine in the air and the hands grab it; Up / Down slides the grip from 1.5 m to 6 m
// under the anchor (a short grip swings fast in a small arc, a long one slow and wide); Left / Right in
// time with the swing pumps it, up to 75 degrees; Jump lets go along the swing's tangent. Changing the
// grip mid-swing keeps the angular momentum (the swing speeds up when you pull in at the bottom, like a
// real pump; sliding down at the top reaches further). Off the vines it is a platformer: walk, jump,
// land on branches and leaf pads. Action fires the hero power.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { comboBreak, comboFlow, comboHit, comboTick, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { BOB, SNAP, TILT, bobSpeed, courseFor, padY, snapPhase, type Course, type Pad, type Vine } from "./course";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, HOWLER, SECRETS, starSpecFor } from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
/** a frame longer than this is cut (the shell's own play dt cap is 50 ms) */
export const MAX_FRAME_MS = 50;
export const V_WALK = 5.5;
export const V_JUMP = 9.4;
/** gravity (m/s^2): a 1.5 m grip swings in 1.6 s, a 6 m grip in 3.2 s (the card's periods) */
export const GRAV = 23;
export const HERO_R = 0.38;
/** the hands hang this far over the feet (m): the pendulum's mass point is the hands */
export const HANG = 1.4;
/** the chest over the feet (m): pickups and hits */
export const CHEST = 0.9;
export const GRIP_MIN = 1.5;
export const GRIP_MAX = 6;
/** Up / Down slides the grip this fast (m/s) */
export const GRIP_V = 3;
/** the pump's tangential push (m/s^2) while Left / Right goes with the swing */
export const PUMP_ACC = 7;
/** the swing never goes past this (the card: 75 degrees) */
export const MAX_AMP = (75 * Math.PI) / 180;
/** air drag on the swing (1/s) */
export const SWING_DAMP = 0.04;
/** the hands catch a vine this close to it (m, sideways) */
export const GRAB_R = 0.75;
/** after letting go, the same vine cannot be caught again for this long (ms) */
export const REGRAB_MS = 350;
/** a dry vine snaps this long after the grab (the card: 2.5 s), and grows back after DRY_BACK_MS */
export const DRY_MS = 2_500;
export const DRY_BACK_MS = 5_000;
/** a jump still works this long after walking off a ledge (ms) */
export const COYOTE_MS = 100;
/** a landing counts this far past a pad's rim (m) */
export const LAND_SLACK = 0.25;
/** under the checkpoint by this much is a fall (m) */
export const FALL_DEPTH = 9;
/** a knock-off or a bite: the hero is pushed this fast and can't be hit again this long */
export const KNOCK_V = 5;
/** the stick's push in the air (m/s^2) */
export const AIR_ACC = 9;
export const HURT_MS = 1_200;
/** a perfect release: within 5 degrees of 45 degrees on the upswing (the card's birds) */
export const PERFECT_DEG = 5;
export const ORB = { pickup: 1.0, bonusMs: 100 } as const;
export const EMERALD_R = 0.9;
/** Monkey Bars: this many vine-to-vine catches without touching a platform (the card) */
export const MONKEY_BARS = 10;
/** the glow vine reveals itself at this grip or longer (m) */
export const GLOW_GRIP = 5.9;
/** fruit pods: monkeys throw every MONKEY.everyMs when the hero is within MONKEY.range; a pod flies at speed and hits within r */
export const MONKEY = { everyMs: 4_200, warnMs: 700, range: 13, speed: 9, lifeMs: 2_000, r: 0.6 } as const;
/** the King: a hit needs this speed (m/s); contact within KING_R of his body */
export const HIT_SPEED = 7;
export const KING_R = 1.6;
/** the King's own swing in phase 3: amplitude, grip */
export const KING_SWING = { amp: (55 * Math.PI) / 180, attackAmp: (70 * Math.PI) / 180, grip: 4 } as const;
/** the main vine drops for this long after his roar (the card: 2 s) */
export const ROAR_DROP_MS = 2_000;

/** The fastest a pendulum swing can move the hands (m/s): the full 75 degree swing at the 6 m grip, at its bottom. */
export const V_SWING_MAX = Math.sqrt(2 * GRAV * GRIP_MAX * (1 - Math.cos(MAX_AMP)));
/** The fastest an anchor moves (m/s): a bobbing branch (arch tilts are horizontal). */
export const V_ANCHOR_MAX = BOB.amp * ((2 * Math.PI) / (BOB.periodMs / 1000));
/**
 * The fastest the hero can rise (m/s), used by the proof: a swing (tangential) plus the grip pulled in
 * (radial) plus a bobbing anchor; a jump or Nami's second jump is slower.
 */
export const V_RISE_MAX = Math.max(V_JUMP, V_SWING_MAX + GRIP_V + V_ANCHOR_MAX);

// ---------- the run ----------

export interface Hero {
   /** the feet */
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   /** standing on a pad this step (pad id, -1 none) */
   standing: number;
   grounded: boolean;
   lastGroundMs: number;
   airJumped: boolean;
   dashed: boolean;
   facing: number;
   /** the vine held (id), -1 when not hanging */
   vine: number;
   /** the grip (m from the anchor), the swing angle (rad, + along the vine's direction) and its rate */
   grip: number;
   theta: number;
   omega: number;
   /** the vine last let go of and when */
   releasedFrom: number;
   releaseMs: number;
   /** when the current vine was grabbed */
   grabMs: number;
}

export interface Pod {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   until: number;
   live: boolean;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: number;
   /** a vine caught this step (id), -1 none; `linked` when it chained from a release (the combo) */
   caught: number;
   released: boolean;
   perfect: boolean;
   snapped: number;
   powered: boolean;
   orbCount: number;
   orbList: number[];
   emeraldCount: number;
   secretCount: number;
   secretList: number[];
   thrown: number;
   blocked: boolean;
   hurt: "" | "pod" | "bite" | "king" | "fall";
   knocked: boolean;
   respawned: boolean;
   comboBonus: number;
   comboLinked: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossVulnerable: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   finished: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: -1, caught: -1, released: false, perfect: false, snapped: -1, powered: false,
      orbCount: 0, orbList: [], emeraldCount: 0, secretCount: 0, secretList: [], thrown: 0, blocked: false, hurt: "", knocked: false, respawned: false,
      comboBonus: 0, comboLinked: false, bossTelegraph: false, bossAttack: false, bossVulnerable: false, bossHit: false, bossPhase: false, bossDefeated: false,
      finished: false, timeup: false,
   };
}

export interface StepInput {
   /** the stick, -1..1 (up = -1) */
   moveX: number;
   moveZ: number;
   /** the camera's view yaw (menu2/camera orbit.viewYaw): the stick is camera-relative */
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface VineRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   simMs: number;
   acc: number;
   pendJump: boolean;
   pendAction: boolean;
   hero: Hero;
   /** per vine: snapped until (ms, dry vines and the roar), caught at least once, an arch's lean (m) */
   downUntil: number[];
   caughtOnce: boolean[];
   lean: number[];
   /** catches in a row without touching a platform (Monkey Bars) */
   barStreak: number;
   catches: number;
   orbTaken: boolean[];
   emeraldTaken: boolean[];
   orbs: number;
   emeralds: number;
   combo: ComboState;
   secrets: SecretTracker;
   /** the last platform stood on: the respawn */
   checkpoint: number;
   hits: number;
   hurtUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   powerReadyAt: number;
   pods: Pod[];
   /** per monkey: the last throw cycle fired */
   thrownCycle: number[];
   /** other heroes' grips (multiplayer): pumps add on a shared vine (co-op), a rival makes it heavy (versus) */
   pumpScale: number;
   boss: BossState | null;
   bossEvents: BossEvents;
   bossActive: boolean;
   /** the King's swing angle in phase 3 */
   kingTheta: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   ev: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): VineRun {
   const course = courseFor(level);
   const start = course.pads[course.route[0].pad];
   const nv = course.vines.length;
   return {
      seed, level, heroId, course, simMs: 0, acc: 0, pendJump: false, pendAction: false,
      hero: {
         x: start.x, y: start.y, z: start.z, vx: 0, vy: 0, vz: 0, standing: start.id, grounded: true, lastGroundMs: 0, airJumped: false, dashed: false, facing: 0,
         vine: -1, grip: GRIP_MAX, theta: 0, omega: 0, releasedFrom: -1, releaseMs: -1e9, grabMs: 0,
      },
      downUntil: new Array<number>(nv).fill(0), caughtOnce: new Array<boolean>(nv).fill(false), lean: new Array<number>(nv).fill(0),
      barStreak: 0, catches: 0,
      orbTaken: course.orbs.map(() => false), emeraldTaken: course.emeralds.map(() => false), orbs: 0, emeralds: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), checkpoint: start.id,
      hits: 0, hurtUntil: 0, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, dashUntil: -1, dashX: 0, dashZ: 0, powerReadyAt: 0,
      pods: [], thrownCycle: course.monkeys.map(() => -1), pumpScale: 1,
      boss: course.cfg.boss ? createBoss(HOWLER) : null, bossEvents: createBossEvents(), bossActive: false, kingTheta: 0,
      ended: null, finishMs: 0, ev: createEvents(),
   };
}

// ---------- geometry ----------

const P = { x: 0, y: 0, z: 0 };

/** A vine's anchor at `ms` (L2's bobbing branches lift it; L4's arches lean it along the swing). */
export function anchorOf(run: VineRun, v: Vine, out: { x: number; y: number; z: number } = P): { x: number; y: number; z: number } {
   const lean = run.lean[v.id] ?? 0;
   out.x = v.x + v.dx * lean;
   out.z = v.z + v.dz * lean;
   out.y = v.bob > 0 ? v.y + v.bob * Math.sin(((run.simMs / BOB.periodMs) + v.phase) * Math.PI * 2) : v.y;
   return out;
}

/** The hero's hands (the pendulum's point) while hanging, or the feet + HANG otherwise. */
export function handsOf(run: VineRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   out.x = h.x;
   out.y = h.y + HANG;
   out.z = h.z;
   return out;
}

export const vineDown = (run: VineRun, id: number): boolean => run.downUntil[id] > run.simMs;

/** The pad's walking surface at play time (bobbing on L2). */
export const padTop = (run: VineRun, p: Pad): number => padY(p, run.simMs);

/** The speed of the hero (m/s). */
export function heroSpeed(run: VineRun): number {
   const h = run.hero;
   return Math.hypot(h.vx, h.vy, h.vz);
}

/** Phasing (Vexa) right now. */
export const heroPhasing = (run: VineRun): boolean => run.simMs < run.phaseUntil;

/** The swing's turning sense for the stick's Left / Right: +1 when screen-right points along the vine's direction. */
export function pumpSense(v: Vine, yaw: number): number {
   // the camera looks along (sin yaw, cos yaw) on the ground (camera-relative stick: up = -z at yaw 0); screen right is (cos yaw, -sin yaw)
   const rx = Math.cos(yaw);
   const rz = -Math.sin(yaw);
   const d = v.dx * rx + v.dz * rz;
   return d >= -0.15 ? 1 : -1;
}

// ---------- the step ----------

function pushSecret(run: VineRun, index: number): void {
   const ev = run.ev;
   if (ev.secretCount < 4) ev.secretList[ev.secretCount++] = index;
}

function bossHit(run: VineRun): void {
   const b = run.boss;
   if (!b) return;
   const before = b.phase;
   const result = hitBoss(b, HOWLER, 1, run.bossEvents);
   if (result === "ignored") return;
   const ev = run.ev;
   ev.bossHit = true;
   if (result === "phase" || b.phase !== before) ev.bossPhase = true;
   if (result === "defeated") ev.bossDefeated = true;
   ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_MS.boss);
}

function respawn(run: VineRun, why: StepEvents["hurt"]): void {
   const ev = run.ev;
   const cp = run.course.pads[run.checkpoint];
   const h = run.hero;
   h.x = cp.x;
   h.z = cp.z;
   h.y = padTop(run, cp) + 0.02;
   h.vx = h.vy = h.vz = 0;
   h.standing = -1;
   h.grounded = false;
   h.lastGroundMs = -1e9;
   h.vine = -1;
   h.releasedFrom = -1;
   run.hits += 1;
   run.hurtUntil = run.simMs + HURT_MS;
   run.barStreak = 0;
   comboBreak(run.combo);
   ev.respawned = true;
   if (ev.hurt === "") ev.hurt = why;
}

/** Sends a hero back to its last platform (multiplayer: far under the highest hero). */
export function sendBack(run: VineRun): void {
   respawn(run, "fall");
}

/** Lets go of the vine (a release, a knock or a snap): the hands keep the swing's velocity times `keep`. */
function letGo(run: VineRun, keep: number): void {
   const h = run.hero;
   if (h.vine < 0) return;
   h.vx *= keep;
   h.vy *= keep;
   h.vz *= keep;
   h.releasedFrom = h.vine;
   h.releaseMs = run.simMs;
   h.vine = -1;
   h.grounded = false;
   h.airJumped = false;
   h.dashed = false;
}

/** A knock (pod, bite, the King's swing): off the vine, pushed away from (fx, fz), the combo breaks. */
function knock(run: VineRun, why: StepEvents["hurt"], fx: number, fz: number): void {
   const ev = run.ev;
   const h = run.hero;
   if (run.simMs < run.shieldUntil) {
      ev.blocked = true;
      return;
   }
   if (run.simMs < run.hurtUntil) return;
   const hanging = h.vine >= 0;
   letGo(run, 0.3);
   const dx = h.x - fx;
   const dz = h.z - fz;
   const n = Math.hypot(dx, dz) || 1;
   h.vx += (dx / n) * KNOCK_V;
   h.vz += (dz / n) * KNOCK_V;
   if (!hanging) h.vy = Math.max(h.vy, 3);
   h.grounded = false;
   run.hits += 1;
   run.hurtUntil = run.simMs + HURT_MS;
   run.barStreak = 0;
   comboBreak(run.combo);
   ev.hurt = why;
   ev.knocked = hanging;
}

function useAction(run: VineRun): void {
   const ev = run.ev;
   const h = run.hero;
   const ms = run.simMs;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump" || ms < run.powerReadyAt) return;
   if (def.power === "dash") {
      // Riko's second impulse: in the air only (after a release or a jump)
      if (h.vine >= 0 || h.grounded || h.dashed) return;
      const n = Math.hypot(h.vx, h.vz);
      run.dashX = n > 0.3 ? h.vx / n : Math.sin(h.facing);
      run.dashZ = n > 0.3 ? h.vz / n : Math.cos(h.facing);
      run.dashUntil = ms + POWER_MS.dash;
      // one impulse along the flight, and a little lift so it carries (never faster upward than a jump)
      h.vx += run.dashX * V_DASH;
      h.vz += run.dashZ * V_DASH;
      h.vy = Math.max(h.vy, 2);
      h.dashed = true;
   } else if (def.power === "shield") run.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") run.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** One frame: cut into fixed steps, so a run is the same at any frame rate. Returns the (reused) events. */
export function step(run: VineRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   ev.jumped = ev.airJumped = ev.released = ev.perfect = ev.powered = ev.blocked = ev.knocked = ev.respawned = false;
   ev.bossTelegraph = ev.bossAttack = ev.bossVulnerable = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.finished = ev.timeup = false;
   ev.landed = ev.caught = ev.snapped = -1;
   ev.orbCount = ev.emeraldCount = ev.secretCount = ev.thrown = 0;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.hurt = "";
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.acc += Math.min(MAX_FRAME_MS, dtMs);
   // a press is never lost: a frame shorter than a step (144 Hz) hands it to the next step that runs
   if (input.jumpPressed) run.pendJump = true;
   if (input.actionPressed) run.pendAction = true;
   while (run.acc >= STEP_MS - 1e-9 && run.ended === null) {
      run.acc -= STEP_MS;
      sub(run, input, run.pendJump, run.pendAction);
      run.pendJump = false;
      run.pendAction = false;
   }
   return ev;
}

const A = { x: 0, y: 0, z: 0 };
const H = { x: 0, y: 0, z: 0 };
const KING = { x: 0, y: 0, z: 0 };

/** The swing's energy cap: never past MAX_AMP for the current grip. */
function capSwing(h: Hero): void {
   const L = h.grip;
   const e = 0.5 * L * L * h.omega * h.omega + GRAV * L * (1 - Math.cos(h.theta));
   const emax = GRAV * L * (1 - Math.cos(MAX_AMP));
   if (e <= emax) return;
   const pot = GRAV * L * (1 - Math.cos(h.theta));
   if (pot >= emax) {
      h.theta = Math.sign(h.theta) * MAX_AMP;
      h.omega = 0;
      return;
   }
   h.omega = Math.sign(h.omega) * (Math.sqrt(2 * (emax - pot)) / L);
}

/** Puts the hero (feet, velocity) on the vine from the swing state. */
function placeOnVine(run: VineRun, v: Vine): void {
   const h = run.hero;
   anchorOf(run, v, A);
   const s = Math.sin(h.theta);
   const c = Math.cos(h.theta);
   const hx = A.x + v.dx * h.grip * s;
   const hy = A.y - h.grip * c;
   const hz = A.z + v.dz * h.grip * s;
   const tv = h.grip * h.omega;
   h.vx = v.dx * tv * c;
   h.vz = v.dz * tv * c;
   h.vy = tv * s + bobSpeed(v.bob, v.phase, run.simMs);
   h.x = hx;
   h.y = hy - HANG;
   h.z = hz;
}

function swing(run: VineRun, input: StepInput, mx: number, dt: number): void {
   const h = run.hero;
   const v = run.course.vines[h.vine];
   // the grip: Up shortens, Down lengthens; the angular momentum L^2 w is kept
   if (Math.abs(input.moveZ) > 0.2) {
      const L0 = h.grip;
      const L1 = Math.max(GRIP_MIN, Math.min(GRIP_MAX, L0 + input.moveZ * GRIP_V * dt));
      if (L1 !== L0) {
         h.omega *= (L0 * L0) / (L1 * L1);
         h.grip = L1;
      }
   }
   // the pump: Left / Right with the swing
   const push = mx * pumpSense(v, input.yaw);
   if (Math.abs(push) > 0.2) {
      const dir = Math.sign(push);
      if (dir === Math.sign(h.omega) || Math.abs(h.omega) < 0.25) h.omega += (dir * PUMP_ACC * run.pumpScale * dt) / h.grip;
   }
   // gravity and a little drag
   h.omega -= (GRAV / h.grip) * Math.sin(h.theta) * dt;
   h.omega *= 1 - SWING_DAMP * dt;
   h.theta += h.omega * dt;
   capSwing(h);
   // an arch leans with the weight (L4): the anchor slides toward the side the hero swings out to
   if (v.kind === "arch") {
      const want = TILT * Math.sin(h.theta);
      run.lean[v.id] += (want - run.lean[v.id]) * Math.min(1, dt * 2);
   }
   placeOnVine(run, v);
}

/** Tries to catch a vine with the hands; returns the vine caught or -1. */
function tryGrab(run: VineRun): number {
   const h = run.hero;
   const ms = run.simMs;
   handsOf(run, H);
   const vines = run.course.vines;
   for (let i = 0; i < vines.length; i++) {
      const v = vines[i];
      if (run.downUntil[i] > ms) continue;
      if (i === h.releasedFrom && ms - h.releaseMs < REGRAB_MS) continue;
      anchorOf(run, v, A);
      const ox = H.x - A.x;
      const oz = H.z - A.z;
      const along = ox * v.dx + oz * v.dz;
      const side = Math.abs(-ox * v.dz + oz * v.dx);
      if (side > GRAB_R) continue;
      const below = A.y - H.y;
      const L = Math.hypot(along, below);
      if (below <= 0 || L < GRIP_MIN - 0.3 || L > GRIP_MAX + 0.25) continue;
      if (Math.abs(along) > Math.min(GRAB_R + 0.4, L * 0.6)) continue;
      // caught: the grip is the hands' distance from the anchor, the angle their place in the plane
      h.vine = i;
      h.grip = Math.max(GRIP_MIN, Math.min(GRIP_MAX, L));
      h.theta = Math.atan2(along, below);
      const tx = v.dx * Math.cos(h.theta);
      const tz = v.dz * Math.cos(h.theta);
      const ty = Math.sin(h.theta);
      h.omega = (h.vx * tx + h.vy * ty + h.vz * tz) / h.grip;
      capSwing(h);
      h.grabMs = ms;
      h.grounded = false;
      h.standing = -1;
      h.airJumped = false;
      h.dashed = false;
      return i;
   }
   return -1;
}

function onCatch(run: VineRun, id: number): void {
   const ev = run.ev;
   const h = run.hero;
   const ms = run.simMs;
   ev.caught = id;
   run.catches += 1;
   const chained = h.releasedFrom >= 0 && h.releasedFrom !== id && ms - h.releaseMs <= COMBO.windowMs;
   if (chained) {
      run.barStreak += 1;
      if (run.barStreak >= MONKEY_BARS && collectSecret(run.secrets, 0)) pushSecret(run, 0);
   }
   if (!run.caughtOnce[id]) {
      run.caughtOnce[id] = true;
      const bonus = comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.catch);
      ev.comboBonus += bonus;
      ev.comboLinked = chained && run.combo.chain > 1;
   }
}

function sub(run: VineRun, input: StepInput, jumpEdge: boolean, actionEdge: boolean): void {
   const ev = run.ev;
   const course = run.course;
   const cfg = course.cfg;
   const h = run.hero;
   const dt = STEP_MS / 1000;
   const ms = (run.simMs += STEP_MS);
   comboTick(run.combo, COMBO, ms);

   // the boss's clock (phase 2's roar drops the main vine for 2 s)
   if (run.bossActive && run.boss && course.arena) {
      const be = stepBoss(run.boss, HOWLER, STEP_MS, run.bossEvents);
      if (be.telegraph) ev.bossTelegraph = true;
      if (be.attack) {
         ev.bossAttack = true;
         if (run.boss.phase === 0) throwVolley(run);
         if (run.boss.phase === 1) {
            const main = course.arena.main;
            run.downUntil[main] = ms + ROAR_DROP_MS;
            if (h.vine === main) {
               letGo(run, 0.5);
               ev.snapped = main;
            }
         }
      }
      if (be.vulnerable) ev.bossVulnerable = true;
      if (run.boss.phase === 2) {
         const amp = run.boss.step === "attack" ? KING_SWING.attackAmp : KING_SWING.amp;
         const period = 2 * Math.PI * Math.sqrt(KING_SWING.grip / GRAV);
         run.kingTheta = amp * Math.sin((ms / 1000 / period) * Math.PI * 2);
      }
   }

   // the stick, camera-relative
   const cos = Math.cos(input.yaw);
   const sin = Math.sin(input.yaw);
   let mx = input.moveX * cos + input.moveZ * sin;
   let mz = input.moveZ * cos - input.moveX * sin;
   const len = Math.hypot(mx, mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }
   if (len > 0.05 && h.vine < 0) h.facing = Math.atan2(mx, mz);
   if (actionEdge) useAction(run);

   if (h.vine >= 0) {
      const v = course.vines[h.vine];
      // a dry vine snaps 2.5 s after the grab; a dropped vine lets go at once
      if (v.kind === "dry" && ms - h.grabMs >= DRY_MS) {
         run.downUntil[v.id] = ms + DRY_BACK_MS;
         ev.snapped = v.id;
         letGo(run, 1);
      } else if (run.downUntil[v.id] > ms) {
         letGo(run, 1);
      } else {
         swing(run, input, input.moveX, dt);
         h.facing = Math.atan2(v.dx * Math.sign(h.omega || 1), v.dz * Math.sign(h.omega || 1));
         // the hidden emerald vine glows at the full grip
         if (v.kind === "glow" && h.grip >= GLOW_GRIP && collectSecret(run.secrets, 2)) pushSecret(run, 2);
         if (jumpEdge) {
            // the perfect release: within 5 degrees of 45 on the upswing
            const deg = (Math.abs(h.theta) * 180) / Math.PI;
            if (h.theta * h.omega > 0 && Math.abs(deg - 45) <= PERFECT_DEG) ev.perfect = true;
            letGo(run, 1);
            ev.released = true;
         }
      }
   }

   if (h.vine < 0) {
      // walk; in the air the flight's momentum carries and the stick steers it (AIR_ACC), never past
      // the speed it had or the walk
      if (h.grounded) {
         h.vx = mx * V_WALK;
         h.vz = mz * V_WALK;
      } else if (len > 0.05 && ms > run.dashUntil) {
         const before = Math.max(V_WALK, Math.hypot(h.vx, h.vz));
         h.vx += mx * AIR_ACC * dt;
         h.vz += mz * AIR_ACC * dt;
         const after = Math.hypot(h.vx, h.vz);
         if (after > before) {
            h.vx *= before / after;
            h.vz *= before / after;
         }
      }
      // jump: on a pad or a hair after it; Nami once more in the air
      const grounded = h.grounded || ms - h.lastGroundMs <= COYOTE_MS;
      if (jumpEdge && !ev.released) {
         if (grounded && h.vy <= 0.01) {
            h.vy = V_JUMP;
            h.grounded = false;
            h.lastGroundMs = -1e9;
            ev.jumped = true;
         } else if (run.heroId === "nami" && !h.airJumped && !h.grounded) {
            h.vy = V_JUMP;
            h.airJumped = true;
            ev.airJumped = true;
         }
      }
      const prevY = h.y;
      let nx = h.x + h.vx * dt;
      let nz = h.z + h.vz * dt;
      // the ghost-root wall round Vexa's hollow: solid unless she phases
      const g = course.ghost;
      if (!heroPhasing(run) && h.y > g.y0 && h.y < g.y1) {
         const d0 = Math.hypot(h.x - g.x, h.z - g.z);
         const d1 = Math.hypot(nx - g.x, nz - g.z);
         if (d1 < g.r && d0 >= g.r - 0.01) {
            nx = h.x;
            nz = h.z;
         }
      }
      h.x = nx;
      h.z = nz;
      h.vy -= GRAV * dt;
      h.y += h.vy * dt;
      // landing: the highest pad top the feet crossed this step
      let landed = -1;
      let best = -Infinity;
      if (h.vy <= 0) {
         for (const p of course.pads) {
            const top = padTop(run, p);
            if (prevY < top - 0.05 || h.y > top || top <= best) continue;
            if (Math.hypot(h.x - p.x, h.z - p.z) > p.r + LAND_SLACK) continue;
            // the hollow is behind the ghost wall: only a phasing hero gets in from outside
            if (p.id === course.hollow && !heroPhasing(run) && Math.hypot(h.x - g.x, h.z - g.z) > g.r) continue;
            landed = p.id;
            best = top;
         }
      }
      const wasAir = !h.grounded;
      if (landed >= 0) {
         const p = course.pads[landed];
         h.y = best;
         h.vy = 0;
         h.standing = landed;
         h.grounded = true;
         h.lastGroundMs = ms;
         h.airJumped = false;
         h.dashed = false;
         run.barStreak = 0;
         if (wasAir) ev.landed = landed;
         if (p.node >= 0 && (p.y >= course.pads[run.checkpoint].y || p.kind === "arena")) run.checkpoint = landed;
         if (p.kind === "goal") {
            run.ended = "win";
            run.finishMs = ms;
            ev.finished = true;
         }
         if (p.id === course.hollow && collectSecret(run.secrets, 1)) pushSecret(run, 1);
      } else {
         h.grounded = false;
         h.standing = -1;
         // the hands catch a vine
         const caught = tryGrab(run);
         if (caught >= 0) {
            onCatch(run, caught);
            placeOnVine(run, course.vines[caught]);
         }
      }
   }

   // the arena: the King wakes when the hero first stands on it
   if (cfg.boss && run.boss && !run.bossActive && h.standing >= 0 && course.pads[h.standing].kind === "arena") run.bossActive = true;

   hazards(run);
   pickups(run);
   if (run.bossActive) kingContact(run);

   // a fall: far under the last platform
   const cp = course.pads[run.checkpoint];
   if (h.y < cp.y - FALL_DEPTH) respawn(run, "fall");

   if (run.boss && run.boss.step === "done" && run.ended === null) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
   if (run.ended === null && ms >= cfg.durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

/** The chest point (pickups, hits). */
function chest(run: VineRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   out.x = h.x;
   out.y = h.y + CHEST;
   out.z = h.z;
   return out;
}

const C = { x: 0, y: 0, z: 0 };

function aimPod(run: VineRun, fx: number, fy: number, fz: number, lead: number, spread: number): void {
   const h = run.hero;
   const tx = h.x + h.vx * lead + spread * -h.vz * 0.05;
   const ty = h.y + CHEST + h.vy * lead * 0.5;
   const tz = h.z + h.vz * lead + spread * h.vx * 0.05;
   const dx = tx - fx;
   const dy = ty - fy;
   const dz = tz - fz;
   const n = Math.hypot(dx, dy, dz) || 1;
   let pod = run.pods.find((p) => !p.live);
   if (!pod) {
      pod = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, until: 0, live: false };
      if (run.pods.length < 12) run.pods.push(pod);
      else pod = run.pods[0];
   }
   pod.x = fx;
   pod.y = fy;
   pod.z = fz;
   pod.vx = (dx / n) * MONKEY.speed;
   pod.vy = (dy / n) * MONKEY.speed;
   pod.vz = (dz / n) * MONKEY.speed;
   pod.until = run.simMs + MONKEY.lifeMs;
   pod.live = true;
   run.ev.thrown += 1;
}

function throwVolley(run: VineRun): void {
   kingPos(run, KING);
   for (let k = -1; k <= 1; k++) aimPod(run, KING.x, KING.y + 1, KING.z, 0.35 + k * 0.12, k * 6);
}

/** A monkey's throw cycle number at `ms` (it throws at the end of each cycle's warning). */
export function monkeyCycle(phase: number, ms: number): number {
   return Math.floor((ms + phase) / MONKEY.everyMs);
}

/** Is a monkey winding up a throw at `ms` (the arm up: the warning)? */
export function monkeyWarning(phase: number, ms: number): boolean {
   const t = (ms + phase) % MONKEY.everyMs;
   return t >= MONKEY.everyMs - MONKEY.warnMs;
}

function hazards(run: VineRun): void {
   const course = run.course;
   const h = run.hero;
   const ms = run.simMs;
   const dt = STEP_MS / 1000;
   chest(run, C);
   // monkeys: a pod at the end of each cycle while the hero is near
   for (let i = 0; i < course.monkeys.length; i++) {
      const m = course.monkeys[i];
      const k = Math.floor((ms + m.phase) / MONKEY.everyMs) - 1;
      if (k <= run.thrownCycle[i]) continue;
      run.thrownCycle[i] = k;
      if (Math.hypot(C.x - m.x, C.y - m.y, C.z - m.z) > MONKEY.range) continue;
      aimPod(run, m.x, m.y + 1.1, m.z, 0.3, 0);
   }
   // pods fly straight; a hit knocks the hero off
   for (const p of run.pods) {
      if (!p.live) continue;
      if (ms >= p.until) {
         p.live = false;
         continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (Math.hypot(p.x - C.x, p.y - C.y, p.z - C.z) <= MONKEY.r) {
         p.live = false;
         knock(run, "pod", p.x - p.vx, p.z - p.vz);
      }
   }
   // snappers bite on their cycle
   for (const s of course.snappers) {
      if (snapPhase(s, ms) !== "bite") continue;
      if (Math.hypot(h.x - s.x, h.z - s.z) <= SNAP.reach && Math.abs(h.y - s.y) < 1.5) knock(run, "bite", s.x, s.z);
   }
}

function pickups(run: VineRun): void {
   const course = run.course;
   const ev = run.ev;
   const ms = run.simMs;
   chest(run, C);
   const magnet = ms <= run.magnetUntil;
   for (let i = 0; i < course.orbs.length; i++) {
      if (run.orbTaken[i]) continue;
      const o = course.orbs[i];
      if (Math.hypot(C.x - o.x, C.y - o.y, C.z - o.z) <= (magnet ? MAGNET_REACH : ORB.pickup)) {
         run.orbTaken[i] = true;
         run.orbs += 1;
         if (ev.orbCount < 8) ev.orbList[ev.orbCount++] = i;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
      }
   }
   for (let i = 0; i < course.emeralds.length; i++) {
      if (run.emeraldTaken[i]) continue;
      const e = course.emeralds[i];
      if (Math.hypot(C.x - e.x, C.y - e.y, C.z - e.z) <= (magnet ? MAGNET_REACH : EMERALD_R)) {
         run.emeraldTaken[i] = true;
         run.emeralds += 1;
         ev.emeraldCount += 1;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.emerald);
      }
   }
}

/** Where the King is now (level 5): his perch (phase 1), his hanging spot (2), on his own vine (3). */
export function kingPos(run: VineRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const a = run.course.arena;
   if (!a) {
      out.x = out.y = out.z = 0;
      return out;
   }
   const phase = run.boss?.phase ?? 0;
   if (phase === 0) {
      out.x = a.perch.x;
      out.y = a.perch.y;
      out.z = a.perch.z;
   } else if (phase === 1) {
      out.x = a.hang.x;
      out.y = a.hang.y;
      out.z = a.hang.z;
   } else {
      const v = run.course.vines[a.kingVine];
      const L = KING_SWING.grip;
      out.x = v.x + v.dx * L * Math.sin(run.kingTheta);
      out.y = v.y - L * Math.cos(run.kingTheta) - 0.5;
      out.z = v.z + v.dz * L * Math.sin(run.kingTheta);
   }
   return out;
}

/** The King's speed in phase 3 (m/s): what the hero must beat. */
export function kingSpeed(run: VineRun): number {
   if (!run.boss || run.boss.phase !== 2) return 0;
   const amp = run.boss.step === "attack" ? KING_SWING.attackAmp : KING_SWING.amp;
   const L = KING_SWING.grip;
   return Math.sqrt(Math.max(0, 2 * GRAV * L * (Math.cos(run.kingTheta) - Math.cos(amp))));
}

function kingContact(run: VineRun): void {
   const b = run.boss;
   if (!b || b.step === "done" || b.defeatMs >= 0) return;
   kingPos(run, KING);
   chest(run, C);
   if (Math.hypot(C.x - KING.x, C.y - KING.y, C.z - KING.z) > KING_R) return;
   const speed = heroSpeed(run);
   if (b.step === "vulnerable") {
      const fast = speed >= HIT_SPEED && (b.phase !== 2 || speed > kingSpeed(run));
      // phase 1: on a vine swinging into the perch; phase 2: in the air after a release; phase 3: meeting him faster
      const way = b.phase === 0 ? run.hero.vine >= 0 : b.phase === 1 ? run.hero.vine < 0 : true;
      if (fast && way) bossHit(run);
   } else if (b.step === "attack" && b.phase === 2) knock(run, "king", KING.x, KING.z);
}

export function bossVulnerable(run: VineRun): boolean {
   return run.bossActive && run.boss !== null && run.boss.step === "vulnerable";
}

// ---------- the score ----------

/** The submitted time: the finish less 0.1 s an orb and the combo bonus (README "Scoring"). */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export const submittedMs = (run: VineRun): number => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** The run's stars (clear, all five orbs, the target time) and the no-fall badge (no fall, no knock, no bite). */
export function runStars(run: VineRun): StarResult {
   const cleared = run.ended === "win";
   return evaluateStars(starSpecFor(run.level, run.course.orbs.length), { cleared, orbs: run.orbs, goalValue: cleared ? submittedMs(run) : Number.NaN, hits: run.hits });
}

/** The combo meter's fill 0..1 (the HUD). */
export function flowOf(run: VineRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

// ---------- the limits (README "Server limits and why they hold") ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The most the submitted time can be cut by orbs and the combo meter (ms). */
export function maxBonusMs(level: LevelId): number {
   const c = courseFor(level);
   const bases = c.vines.length * COMBO_BASE_MS.catch + c.orbs.length * COMBO_BASE_MS.orb + c.emeralds.length * COMBO_BASE_MS.emerald + (c.cfg.boss ? HOWLER.maxHp * COMBO_BASE_MS.boss : 0);
   return c.orbs.length * ORB.bonusMs + bases * (COMBO.cap - 1);
}

export { SECRETS, HOWLER };
export type { HeroId };

/** The shell's score for a win: the time game submits its submitted time (README "Scoring"). */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export const STAT = {
   orbs: "orbs",
   grip: "grip",
   swing: "swing",
   hanging: "hanging",
   height: "height",
   top: "top",
   hero: "hero",
   power: "power",
   finishMs: "finishMs",
   hits: "hits",
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

/** The level limits proven in proof.test.ts (README table): bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 19_910, minDurationMs: 900, maxDurationMs: 200_000, timeBaseMs: 200_000 },
   2: { kind: "time", maxScore: 23_880, minDurationMs: 1_200, maxDurationMs: 240_000, timeBaseMs: 240_000 },
   3: { kind: "time", maxScore: 27_800, minDurationMs: 2_000, maxDurationMs: 280_000, timeBaseMs: 280_000 },
   4: { kind: "time", maxScore: 31_750, minDurationMs: 2_500, maxDurationMs: 320_000, timeBaseMs: 320_000 },
   5: { kind: "time", maxScore: 37_860, minDurationMs: 21_400, maxDurationMs: 400_000, timeBaseMs: 400_000 },
};

export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];
