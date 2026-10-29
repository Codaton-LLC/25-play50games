// Ice Peak Jumper's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same seed + level + hero + inputs always give the
// same run, at any frame rate (the simulation advances in fixed STEP_MS steps).
//
// The signature mechanic (card "Slide-launch"): ICE has no grip. The stick accelerates the hero at
// 5 m/s² (to 9 m/s) and nothing slows it but the brake (6 m/s², Down / the Brake button) or pushing the
// other way. A jump keeps the slide's speed, so the run-up sets the distance: 0-9 m/s gives 2.5-7.0 m
// with a fixed 2.2 m apex (gravity x1.6 after it). SNOW grips: walk (5 m/s), stop, turn, re-aim. The
// route's snow patches carry the cairn BEACONS: each lights when you land on it after the one before
// (the summit opens once all are lit), and a fall drops you back on the last one lit. CRACKED ice
// shatters 1.2 s after the first touch. Level 2 adds icicles (they shake 0.8 s, then drop), level 3 a yeti's
// snowballs (every 3 s) and rolling snowballs you can ride, level 4 night (snow grips only while its
// lantern is lit, 4 s of every 6 s) and ice slimes, level 5 the Frost Golem.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { LANTERN, courseFor, topAt, type Course, type Plat } from "./course";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, FROST_GOLEM, SECRETS } from "./progression";

export type { Course } from "./course";

// ---------- tuning ----------

export const STEP_MS = 4;
/** a frame longer than this is cut (the shell's own play dt cap is 50 ms) */
export const MAX_FRAME_MS = 50;
/** the jump's apex over the take-off (the card's fixed 2.2 m) */
export const APEX = 2.2;
/** gravity rising; x1.6 falling (the card's fast fall) */
export const G = 23.2;
export const FALL_X = 1.6;
export const V_JUMP = Math.sqrt(2 * G * APEX);
/** ice: the stick's acceleration, the speed it builds to, the brake */
export const ICE_ACCEL = 5;
export const V_ICE = 9;
export const BRAKE = 6;
/** Riko's dash: +4 m/s at once on ice (the most any hero ever slides) */
export const DASH_DV = 4;
export const V_MAX = V_ICE + DASH_DV;
/** snow: grip; walking speed and how fast it is reached / lost */
export const V_WALK = 5;
export const GRIP_ACCEL = 30;
/** a jump launches at least this fast (2.5 m at a standstill) */
export const V_LAUNCH_MIN = 3.2;
/** air steering (it never adds speed beyond the launch) */
export const AIR_ACCEL = 2.5;
export const COYOTE_MS = 120;
export const BUFFER_MS = 120;
export const HERO_R = 0.35;
export const HERO_H = 1.1;
/** a landing within this of the platform's centre is perfect (the card's 0.3 m) */
export const PERFECT_R = 0.3;
export const ORB = { pickup: 1.2, bonusMs: 100 } as const;
export const SECRET_R = 1.3;
export const SLAB = 1.0;
export const HIT_KNOCK = 5;
export const INVULN_MS = 1000;
export const LOST_MS = 600;
/** a fall this far below the checkpoint's top drops you back on it */
export const FALL_DEPTH = 9;
/** cracked ice and the cairn climb come back this long after they crumble */
export const REGROW_MS = 4000;
/** icicles: shake, then fall (impact), then grow back */
export const ICICLE = { reach: 2.4, shakeMs: 800, dropMs: 260, hitR: 1.0, regrowMs: 3000 } as const;
/** the yeti: a snowball every 3 s, landing 1.2 s later where you were */
export const YETI = { everyMs: 3000, flightMs: 1200, hitR: 1.0 } as const;
export const ROLLER_R = 0.9;
/** a rolling snowball can be ridden this long */
export const RIDE_MS = 2000;
export const SLIME_R = 0.8;
/** the landing arc shows above this speed (levels 1-2) */
export const ARC_MIN_V = 4;

/**
 * The climb's speed limit (the proof): every take-off sets vy = V_JUMP (never more) and gravity takes
 * it back at G, so a hero rises at V_JUMP / 2 on average at best; ramps climb at most V_ICE x 0.46.
 */
export const V_CLIMB_MAX = V_JUMP / 2;

// ---------- the run ----------

export type HeroState = "play" | "lost";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   /** the platform stood on (-1 in the air) */
   ground: number;
   lastGroundMs: number;
   coyoteUsed: boolean;
   airJumped: boolean;
   /** the speed of the last launch (air steering never exceeds it) */
   launchV: number;
   facing: number;
   state: HeroState;
   timerMs: number;
   braking: boolean;
   /** riding a rolling snowball (its index), -1 none */
   riding: number;
   rideUntil: number;
}

export interface StepInput {
   /** the stick, screen-relative (moveZ = the core's moveY, up = -1), turned by `yaw` */
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   /** the brake held (Down / S / the Brake button) */
   brake: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, brake: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   /** the platform landed on (-1 none), how hard (m/s down), and a perfect landing */
   landed: number;
   landSpeed: number;
   perfect: boolean;
   checkpoint: number;
   cracked: number;
   crumbled: number;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   powered: boolean;
   broke: number;
   hit: "" | "icicle" | "snowball" | "roller" | "slime" | "chute";
   blocked: boolean;
   lost: boolean;
   respawned: boolean;
   rideStart: boolean;
   icicleShake: number;
   icicleDrop: number;
   thrown: number;
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
      jumped: false, airJumped: false, landed: -1, landSpeed: 0, perfect: false, checkpoint: -1, cracked: -1, crumbled: -1,
      orbCount: 0, orbList: new Array<number>(16).fill(0), secretCount: 0, secretList: [0, 0, 0], powered: false, broke: -1,
      hit: "", blocked: false, lost: false, respawned: false, rideStart: false, icicleShake: -1, icicleDrop: -1, thrown: -1,
      comboBonus: 0, comboLinked: false, bossWoke: false, bossTelegraph: false, bossAttack: false, bossCharge: -1, bossHit: false,
      bossPhase: false, bossDefeated: false, bossDone: false, finished: false, timeup: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.perfect = e.powered = e.blocked = e.lost = e.respawned = e.rideStart = false;
   e.landed = e.checkpoint = e.cracked = e.crumbled = e.broke = e.icicleShake = e.icicleDrop = e.thrown = e.bossCharge = -1;
   e.landSpeed = 0;
   e.orbCount = e.secretCount = 0;
   e.hit = "";
   e.comboBonus = 0;
   e.comboLinked = false;
   e.bossWoke = e.bossTelegraph = e.bossAttack = e.bossHit = e.bossPhase = e.bossDefeated = e.bossDone = false;
   e.finished = e.timeup = false;
}

/** A yeti's snowball in flight: thrown at (x, z) on the hero's top; lands at `landAt`. */
export interface Throw {
   x: number;
   y: number;
   z: number;
   fromAt: number;
   landAt: number;
   done: boolean;
}

export interface PeakRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   ms: number;
   remainder: number;
   hero: Hero;
   /** per platform: first touched at (-1), crumbled at (-1) */
   touchedAt: Float64Array;
   goneAt: Float64Array;
   /** per wall: broken */
   broken: Uint8Array;
   /** per platform: a perfect landing already counted */
   perfects: Uint8Array;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   /** per icicle: triggered at (-1 idle) */
   icicleAt: Float64Array;
   throws: Throw[];
   nextThrow: number;
   checkpoint: number;
   /** beacons lit (course.beacons[0 .. lit-1]) */
   lit: number;
   falls: number;
   hits: number;
   invulnUntil: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** Kiro's shield blocks one hit per raise */
   shieldUsed: boolean;
   combo: ComboState;
   secrets: SecretTracker;
   boss: BossState | null;
   bossEv: BossEvents;
   bossAwake: boolean;
   /** a hit charged for the golem's next open window (at most one) */
   pending: number;
   /** a jump press waits this long for the ground (the buffer); an Action press for the next step */
   jumpBufferUntil: number;
   pendingAction: boolean;
   /** the highest top reached so far (HUD, multiplayer) */
   best: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): PeakRun {
   const course = courseFor(level);
   const s = course.plats[course.start];
   const n = course.plats.length;
   return {
      course,
      level,
      heroId,
      seed,
      ms: 0,
      remainder: 0,
      hero: { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, ground: s.id, lastGroundMs: 0, coyoteUsed: false, airJumped: false, launchV: 0, facing: 0, state: "play", timerMs: 0, braking: false, riding: -1, rideUntil: -1 },
      touchedAt: new Float64Array(n).fill(-1),
      goneAt: new Float64Array(n).fill(-1),
      broken: new Uint8Array(course.walls.length),
      perfects: new Uint8Array(n),
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      icicleAt: new Float64Array(course.icicles.length).fill(-1),
      throws: [],
      nextThrow: YETI.everyMs,
      checkpoint: s.id,
      lit: 0,
      falls: 0,
      hits: 0,
      invulnUntil: -1,
      powerReadyAt: 0,
      dashUntil: -1,
      shieldUntil: -1,
      magnetUntil: -1,
      phaseUntil: -1,
      shieldUsed: false,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      boss: course.arena ? createBoss(FROST_GOLEM) : null,
      bossEv: createBossEvents(),
      bossAwake: false,
      pending: 0,
      jumpBufferUntil: -1,
      pendingAction: false,
      best: s.y,
      finishMs: 0,
      ended: null,
      events: createEvents(),
   };
}

// ---------- queries ----------

/** Is a platform solid now (its boss phase, not crumbled)? */
export function platSolid(run: PeakRun, p: Plat): boolean {
   if (p.phase >= 0) {
      if (!run.boss || !run.bossAwake) return false;
      // the head-crystal climb stays up through his defeat (you stand on it)
      const ph = run.boss.step === "done" || run.boss.step === "defeat" ? 2 : run.boss.phase;
      if (ph !== p.phase) return false;
   }
   return run.goneAt[p.id] < 0;
}

/** Is a lantern lit (level 4: lit 4 s of every 6 s)? */
export function lanternLit(run: PeakRun, i: number): boolean {
   const l = run.course.lanterns[i];
   if (!l) return true;
   return (run.ms + l.phaseMs) % LANTERN.periodMs < LANTERN.litMs;
}

/** Does a platform grip (snow; on level 4 only while its lantern is lit)? */
export function grips(run: PeakRun, p: Plat): boolean {
   if (p.surface !== "snow") return false;
   return p.lantern < 0 || lanternLit(run, p.lantern);
}

/** Is a wall solid for this hero now? */
export function wallSolid(run: PeakRun, i: number): boolean {
   const w = run.course.walls[i];
   if (run.broken[i]) return false;
   if (w.kind === "ghost") return run.ms > run.phaseUntil;
   return true;
}

export function bossVulnerable(run: PeakRun): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

export function bossDone(run: PeakRun): boolean {
   return !run.boss || run.boss.step === "done";
}

/** A rolling snowball's position (x, z) now, or null between rolls. */
export function rollerAt(run: PeakRun, i: number, ms = run.ms, out = { x: 0, z: 0 }): { x: number; z: number } | null {
   const r = run.course.rollers[i];
   const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
   const t = ((ms + r.phaseMs) % r.periodMs) / 1000;
   const d = t * r.speed;
   if (d > len) return null;
   out.x = r.x0 + ((r.x1 - r.x0) / len) * d;
   out.z = r.z0 + ((r.z1 - r.z0) / len) * d;
   return out;
}

/** An ice slime's position (x, z) now. */
export function slimeAt(run: PeakRun, i: number, out = { x: 0, z: 0 }): { x: number; z: number } {
   const s = run.course.slimes[i];
   const p = run.course.plats[s.plat];
   const k = Math.sin((run.ms / 1000) * s.speed) * s.amp;
   if (s.axis === "x") {
      out.x = p.x + k;
      out.z = p.z + s.offset;
   } else {
      out.x = p.x + s.offset;
      out.z = p.z + k;
   }
   return out;
}

/** An icicle's state: 0 idle, shaking 0..1, falling 1..2, gone (regrowing) 3. */
export function icicleState(run: PeakRun, i: number): number {
   const at = run.icicleAt[i];
   if (at < 0) return 0;
   const t = run.ms - at;
   if (t < ICICLE.shakeMs) return t / ICICLE.shakeMs;
   if (t < ICICLE.shakeMs + ICICLE.dropMs) return 1 + (t - ICICLE.shakeMs) / ICICLE.dropMs;
   return 3;
}

/** The horizontal speed (m/s). */
export function speedOf(run: PeakRun): number {
   return Math.hypot(run.hero.vx, run.hero.vz);
}

/** How far a launch at speed v reaches when it lands `rise` m higher (m): the landing-arc maths. */
export function launchReach(v: number, rise: number): number {
   return Math.max(v, V_LAUNCH_MIN) * flightMs(rise) / 1000;
}

/** The flight time of a jump that lands `rise` m above its take-off (ms). */
export function flightMs(rise: number): number {
   const up = V_JUMP / G;
   const drop = Math.max(0, APEX - rise);
   return (up + Math.sqrt((2 * drop) / (G * FALL_X))) * 1000;
}

// ---------- the step ----------

const STICK = { x: 0, z: 0 };
const P2 = { x: 0, z: 0 };

function clampSpeed(h: Hero, max: number): void {
   const s = Math.hypot(h.vx, h.vz);
   if (s > max) {
      h.vx *= max / s;
      h.vz *= max / s;
   }
}

function hit(run: PeakRun, kind: StepEvents["hit"], fromX: number, fromZ: number): void {
   const h = run.hero;
   if (run.ms < run.invulnUntil || h.state !== "play") return;
   if (run.ms <= run.shieldUntil && !run.shieldUsed) {
      run.shieldUsed = true;
      run.events.blocked = true;
      run.invulnUntil = run.ms + 400;
      return;
   }
   run.hits += 1;
   run.events.hit = kind;
   run.invulnUntil = run.ms + INVULN_MS;
   comboBreak(run.combo);
   let dx = h.x - fromX;
   let dz = h.z - fromZ;
   const d = Math.hypot(dx, dz) || 1;
   dx /= d;
   dz /= d;
   h.vx = dx * HIT_KNOCK;
   h.vz = dz * HIT_KNOCK;
   h.vy = 4;
   h.ground = -1;
   h.riding = -1;
}

function respawn(run: PeakRun): void {
   const h = run.hero;
   const p = run.course.plats[run.checkpoint];
   h.x = p.x;
   h.z = p.z;
   h.y = topAt(p, p.x, p.z);
   h.vx = h.vy = h.vz = 0;
   h.ground = p.id;
   h.lastGroundMs = run.ms;
   h.state = "play";
   h.riding = -1;
   run.goneAt[p.id] = -1;
   run.touchedAt[p.id] = -1;
   run.invulnUntil = run.ms + INVULN_MS;
   run.events.respawned = true;
}

function tryPower(run: PeakRun, ms: number): void {
   const h = run.hero;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") return;
   if (ms < run.powerReadyAt) return;
   if (def.power === "dash") {
      // on ice only: +4 m/s along the slide (or the facing)
      const p = h.ground >= 0 ? run.course.plats[h.ground] : null;
      if (!p || p.surface === "snow") return;
      const s = Math.hypot(h.vx, h.vz);
      const dx = s > 0.3 ? h.vx / s : Math.sin(h.facing) * -1;
      const dz = s > 0.3 ? h.vz / s : -Math.cos(h.facing);
      h.vx += dx * DASH_DV;
      h.vz += dz * DASH_DV;
      clampSpeed(h, V_MAX);
      run.dashUntil = ms + POWER_MS.dash;
   } else if (def.power === "shield") {
      run.shieldUntil = ms + POWER_MS.shield;
      run.shieldUsed = false;
   } else if (def.power === "magnet") run.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   run.events.powered = true;
}

function launch(run: PeakRun, air: boolean): void {
   const h = run.hero;
   let s = Math.hypot(h.vx, h.vz);
   const sl = Math.hypot(STICK.x, STICK.z);
   if (air) {
      // Nami: re-aim along the stick, keeping the speed
      if (sl > 0.3) {
         const v = Math.max(s, V_LAUNCH_MIN);
         h.vx = (STICK.x / sl) * v;
         h.vz = (STICK.z / sl) * v;
         s = v;
      }
   } else if (s < V_LAUNCH_MIN) {
      let dx: number;
      let dz: number;
      if (sl > 0.2) {
         dx = STICK.x / sl;
         dz = STICK.z / sl;
      } else if (s > 0.05) {
         dx = h.vx / s;
         dz = h.vz / s;
      } else {
         dx = -Math.sin(h.facing);
         dz = -Math.cos(h.facing);
      }
      h.vx = dx * V_LAUNCH_MIN;
      h.vz = dz * V_LAUNCH_MIN;
      s = V_LAUNCH_MIN;
   }
   h.vy = V_JUMP;
   h.launchV = Math.max(s, V_LAUNCH_MIN);
   h.ground = -1;
   h.riding = -1;
   h.coyoteUsed = true;
   if (air) {
      h.airJumped = true;
      run.events.airJumped = true;
   } else run.events.jumped = true;
}

function land(run: PeakRun, p: Plat, ms: number): void {
   const h = run.hero;
   const ev = run.events;
   ev.landed = p.id;
   ev.landSpeed = Math.max(0, -h.vy);
   h.vy = 0;
   h.ground = p.id;
   h.airJumped = false;
   h.coyoteUsed = false;
   if (run.touchedAt[p.id] < 0) run.touchedAt[p.id] = ms;
   if (p.surface === "cracked" && ev.cracked < 0) ev.cracked = p.id;
   if (!run.perfects[p.id] && Math.hypot(h.x - p.x, h.z - p.z) <= PERFECT_R && !p.ramp) {
      run.perfects[p.id] = 1;
      ev.perfect = true;
      const bonus = comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.landing);
      ev.comboBonus += bonus;
      ev.comboLinked = true;
   }
   // the next beacon in order lights (and becomes the checkpoint)
   if (run.lit < run.course.beacons.length && p.id === run.course.beacons[run.lit]) {
      run.lit += 1;
      run.checkpoint = p.id;
      ev.checkpoint = p.id;
   }
   if (p.y > run.best) run.best = p.y;
   // level 5: the golem's targets charge a hit for his next open window
   const a = run.course.arena;
   if (a && run.boss && run.bossAwake && run.boss.hp > 0 && p.id === a.targets[run.boss.phase] && run.pending === 0) {
      run.pending = 1;
      ev.bossCharge = run.boss.phase;
   }
}

/** Platform under (x, z) whose top is between y - down and y + up (solid now), or null. */
function platUnder(run: PeakRun, x: number, z: number, y: number, up: number, down: number, slack: number): Plat | null {
   let best: Plat | null = null;
   let bestTop = -Infinity;
   for (const p of run.course.plats) {
      if (Math.abs(x - p.x) > p.hx + slack || Math.abs(z - p.z) > p.hz + slack) continue;
      if (!platSolid(run, p)) continue;
      const t = topAt(p, x, z);
      if (t > y + up || t < y - down) continue;
      if (t > bestTop) {
         bestTop = t;
         best = p;
      }
   }
   return best;
}

function pushOutOfBox(h: Hero, x: number, z: number, hx: number, hz: number): boolean {
   const ox = hx + HERO_R - Math.abs(h.x - x);
   const oz = hz + HERO_R - Math.abs(h.z - z);
   if (ox <= 0 || oz <= 0) return false;
   if (ox < oz) {
      const s = h.x >= x ? 1 : -1;
      h.x = x + s * (hx + HERO_R);
      if (h.vx * s < 0) h.vx = 0;
   } else {
      const s = h.z >= z ? 1 : -1;
      h.z = z + s * (hz + HERO_R);
      if (h.vz * s < 0) h.vz = 0;
   }
   return true;
}

function substep(run: PeakRun, ms: number, input: StepInput, first: boolean, dtMs: number): void {
   const h = run.hero;
   const co = run.course;
   const ev = run.events;
   const dt = dtMs / 1000;
   comboTick(run.combo, COMBO, ms);

   // crumbling platforms: cracked ice 1.2 s after the first touch, the cairn climb 3 s; back after 4 s
   for (const p of co.plats) {
      if (p.crumbleMs <= 0) continue;
      const t = run.touchedAt[p.id];
      if (run.goneAt[p.id] < 0 && t >= 0 && ms - t >= p.crumbleMs) {
         run.goneAt[p.id] = ms;
         ev.crumbled = p.id;
         if (h.ground === p.id) h.ground = -1;
      } else if (run.goneAt[p.id] >= 0 && ms - run.goneAt[p.id] >= REGROW_MS) {
         run.goneAt[p.id] = -1;
         run.touchedAt[p.id] = -1;
      }
   }

   if (h.state === "lost") {
      h.timerMs -= dtMs;
      if (h.timerMs <= 0) respawn(run);
      return;
   }

   inputToWorld(Number.isFinite(input.moveX) ? input.moveX : 0, Number.isFinite(input.moveZ) ? input.moveZ : 0, Number.isFinite(input.yaw) ? input.yaw : 0, STICK);
   const sl = Math.hypot(STICK.x, STICK.z);
   if (sl > 1) {
      STICK.x /= sl;
      STICK.z /= sl;
   }
   if (sl > 0.2) h.facing = Math.atan2(-STICK.x, -STICK.z);
   if (first && (input.actionPressed || run.pendingAction)) {
      run.pendingAction = false;
      if (run.heroId === "nami" && h.ground < 0 && !h.airJumped) launch(run, true);
      else tryPower(run, ms);
   }

   const ground = h.ground >= 0 ? co.plats[h.ground] : null;
   h.braking = false;
   if (h.riding >= 0) {
      // riding a rolling snowball: carried at its speed; a jump launches off it
      const r = co.rollers[h.riding];
      const at = rollerAt(run, h.riding, ms, P2);
      if (!at || ms > h.rideUntil) h.riding = -1;
      else {
         const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
         h.vx = ((r.x1 - r.x0) / len) * r.speed;
         h.vz = ((r.z1 - r.z0) / len) * r.speed;
         h.vy = 0;
         h.x = at.x;
         h.z = at.z;
         h.y = r.y + ROLLER_R * 2;
      }
   }
   if (ground && h.riding < 0) {
      if (grips(run, ground)) {
         const tx = STICK.x * V_WALK;
         const tz = STICK.z * V_WALK;
         const dx = tx - h.vx;
         const dz = tz - h.vz;
         const d = Math.hypot(dx, dz);
         const step = GRIP_ACCEL * dt;
         if (d <= step) {
            h.vx = tx;
            h.vz = tz;
         } else {
            h.vx += (dx / d) * step;
            h.vz += (dz / d) * step;
         }
      } else {
         // ice: the stick accelerates (not past V_ICE), nothing else slows you but the brake
         const s0 = Math.hypot(h.vx, h.vz);
         h.vx += STICK.x * ICE_ACCEL * dt;
         h.vz += STICK.z * ICE_ACCEL * dt;
         const s1 = Math.hypot(h.vx, h.vz);
         if (s1 > V_ICE && s1 > s0) clampSpeed(h, Math.max(V_ICE, s0));
         if (input.brake && s1 > 0) {
            h.braking = true;
            const s = Math.hypot(h.vx, h.vz);
            const ns = Math.max(0, s - BRAKE * dt);
            h.vx *= ns / s;
            h.vz *= ns / s;
         }
         // a slope never carries you faster than the ice does (the climb proof)
         if (ground.ramp) clampSpeed(h, V_ICE);
      }
   } else if (h.riding < 0) {
      // air: a little steering, never past the launch speed
      const cap = Math.max(h.launchV, V_WALK);
      const s0 = Math.hypot(h.vx, h.vz);
      h.vx += STICK.x * AIR_ACCEL * dt;
      h.vz += STICK.z * AIR_ACCEL * dt;
      const s1 = Math.hypot(h.vx, h.vz);
      if (s1 > cap && s1 > s0) clampSpeed(h, Math.max(cap, s0));
   }

   // a dash's extra speed lasts only its 0.5 s window: then the slide is cut back to the ice's 9 m/s
   if (ms > run.dashUntil) clampSpeed(h, V_ICE);

   // the jump: buffered 120 ms, coyote 120 ms after leaving an edge
   if (first && input.jumpPressed) run.jumpBufferUntil = ms + BUFFER_MS;
   if (run.jumpBufferUntil >= ms) {
      const canGround = h.ground >= 0 || h.riding >= 0 || (!h.coyoteUsed && ms - h.lastGroundMs <= COYOTE_MS && h.vy <= 0);
      if (canGround) {
         launch(run, false);
         run.jumpBufferUntil = -1;
      } else if (first && input.jumpPressed && run.heroId === "nami" && !h.airJumped) {
         launch(run, true);
         run.jumpBufferUntil = -1;
      }
   }

   // move
   const prevY = h.y;
   if (h.riding < 0) {
      if (h.ground < 0) h.vy -= (h.vy > 0 ? G : G * FALL_X) * dt;
      h.x += h.vx * dt;
      h.z += h.vz * dt;
      h.y += h.vy * dt;
   }

   // walls (the frozen trails, ghost ice, cracked walls, the mitten cube)
   for (let i = 0; i < co.walls.length; i++) {
      const w = co.walls[i];
      if (h.y + HERO_H < w.y0 || h.y > w.y1) continue;
      if (!wallSolid(run, i)) continue;
      if (Math.abs(h.x - w.x) >= w.hx + HERO_R || Math.abs(h.z - w.z) >= w.hz + HERO_R) continue;
      if ((w.kind === "cube" || w.kind === "cracked") && ms <= run.dashUntil) {
         run.broken[i] = 1;
         ev.broke = i;
         continue;
      }
      pushOutOfBox(h, w.x, w.z, w.hx, w.hz);
   }

   // the ground: stay on it, follow a slope, or leave it
   if (h.ground >= 0) {
      const p = co.plats[h.ground];
      if (!platSolid(run, p) || Math.abs(h.x - p.x) > p.hx || Math.abs(h.z - p.z) > p.hz) {
         h.ground = -1;
         h.lastGroundMs = ms;
      } else {
         h.y = topAt(p, h.x, h.z);
         h.lastGroundMs = ms;
         // onto a slope's foot (its low edge is level with the floor: no step up, the climb proof)
         const up = platUnder(run, h.x, h.z, h.y, 0.3, -0.01, 0);
         if (up && up.id !== p.id && up.ramp) {
            h.ground = up.id;
            h.y = topAt(up, h.x, h.z);
            if (run.touchedAt[up.id] < 0) run.touchedAt[up.id] = ms;
         }
      }
   }
   if (h.ground < 0 && h.riding < 0) {
      // landing: falling through a top from above
      if (h.vy <= 0) {
         const p = platUnder(run, h.x, h.z, h.y, Math.max(0.05, prevY - h.y + 0.05), 0.6, 0);
         if (p && prevY >= topAt(p, h.x, h.z) - 0.05) {
            h.y = topAt(p, h.x, h.z);
            land(run, p, ms);
         }
      } else {
         // a head bump on a slab's underside
         for (const p of co.plats) {
            if (!platSolid(run, p)) continue;
            if (Math.abs(h.x - p.x) > p.hx || Math.abs(h.z - p.z) > p.hz) continue;
            const bottom = p.y - SLAB;
            if (prevY + HERO_H <= bottom && h.y + HERO_H > bottom) {
               h.y = bottom - HERO_H;
               h.vy = 0;
            }
         }
      }
      // ride a rolling snowball: land on its top
      for (let i = 0; i < co.rollers.length && h.ground < 0; i++) {
         const at = rollerAt(run, i, ms, P2);
         if (!at) continue;
         const top = co.rollers[i].y + ROLLER_R * 2;
         if (h.vy <= 0 && Math.hypot(h.x - at.x, h.z - at.z) < ROLLER_R && prevY >= top - 0.05 && h.y <= top) {
            h.riding = i;
            h.rideUntil = ms + RIDE_MS;
            h.airJumped = false;
            h.coyoteUsed = false;
            ev.rideStart = true;
         }
      }
   }
   // slab sides
   for (const p of co.plats) {
      if (p.id === h.ground || !platSolid(run, p)) continue;
      const top = topAt(p, h.x, h.z);
      if (h.y >= top - 0.05 || h.y + HERO_H <= p.y - SLAB) continue;
      pushOutOfBox(h, p.x, p.z, p.hx, p.hz);
   }

   // a fall: back on the last snow patch
   const cp = co.plats[run.checkpoint];
   if (h.y < Math.min(cp.y, co.floor) - FALL_DEPTH) {
      h.state = "lost";
      h.timerMs = LOST_MS;
      run.falls += 1;
      comboBreak(run.combo);
      ev.lost = true;
      return;
   }

   // orbs (Zuno's magnet pulls them from the reach, the frozen ones only by magnet)
   const magnet = ms <= run.magnetUntil;
   for (let i = 0; i < co.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = co.orbs[i];
      const reach = magnet ? MAGNET_REACH : ORB.pickup;
      if (o.magnet && !magnet) continue;
      const dx = o.x - h.x;
      const dy = o.y - (h.y + 0.6);
      const dz = o.z - h.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.bonus === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
      ev.comboLinked = true;
   }
   for (let i = 0; i < co.secrets.length; i++) {
      const s = co.secrets[i];
      const dx = s.x - h.x;
      const dy = s.y - (h.y + 0.6);
      const dz = s.z - h.z;
      if (dx * dx + dy * dy + dz * dz > SECRET_R * SECRET_R) continue;
      // the mitten sits inside its cube until the cube breaks
      const cube = co.walls.findIndex((w) => w.kind === "cube" && Math.abs(w.x - s.x) < 0.01 && Math.abs(w.z - s.z) < 0.01);
      if (cube >= 0 && !run.broken[cube]) continue;
      if (collectSecret(run.secrets, i) && ev.secretCount < 3) ev.secretList[ev.secretCount++] = i;
   }

   hazards(run, ms);
   bossWorld(run, dtMs);

   // the goal
   if (h.ground === co.goal && run.lit === co.beacons.length && bossDone(run) && run.ended === null) {
      run.ended = "win";
      run.finishMs = ms;
      ev.finished = true;
   }
}

function hazards(run: PeakRun, ms: number): void {
   const h = run.hero;
   const co = run.course;
   const ev = run.events;
   // icicles: the hero under one starts it shaking; 0.8 s later it drops
   for (let i = 0; i < co.icicles.length; i++) {
      const c = co.icicles[i];
      const at = run.icicleAt[i];
      const dx = h.x - c.x;
      const dz = h.z - c.z;
      const near = dx * dx + dz * dz < ICICLE.reach * ICICLE.reach && Math.abs(h.y - c.y) < 2.5;
      if (at < 0) {
         if (near) {
            run.icicleAt[i] = ms;
            ev.icicleShake = i;
         }
         continue;
      }
      const t = ms - at;
      if (t >= ICICLE.shakeMs + ICICLE.dropMs && t - STEP_MS < ICICLE.shakeMs + ICICLE.dropMs) {
         ev.icicleDrop = i;
         if (dx * dx + dz * dz < ICICLE.hitR * ICICLE.hitR && h.y < c.y + 2) hit(run, "icicle", c.x, c.z);
      }
      if (t >= ICICLE.shakeMs + ICICLE.dropMs + ICICLE.regrowMs) run.icicleAt[i] = -1;
   }
   // the yeti's snowballs: thrown at where you stand, landing 1.2 s later
   for (const y of co.yetis) {
      const z = y.zone;
      const inZone = h.x >= z.x0 && h.x <= z.x1 && h.z >= z.z0 && h.z <= z.z1 && h.y >= z.y0;
      // he throws at where you stand (never at you mid-air: he waits for your landing)
      if (inZone && ms >= run.nextThrow && h.ground >= 0) {
         run.throws.push({ x: h.x, y: h.y, z: h.z, fromAt: ms, landAt: ms + YETI.flightMs, done: false });
         run.nextThrow = ms + YETI.everyMs;
         ev.thrown = run.throws.length - 1;
      } else if (!inZone && run.nextThrow < ms + 1000) run.nextThrow = ms + 1000;
   }
   for (const t of run.throws) {
      if (t.done || ms < t.landAt) continue;
      t.done = true;
      if (Math.hypot(h.x - t.x, h.z - t.z) < YETI.hitR && Math.abs(h.y - t.y) < 1.5) hit(run, "snowball", t.x, t.z);
   }
   if (run.throws.length > 8) run.throws.splice(0, run.throws.length - 8);
   // rolling snowballs (unless riding one)
   for (let i = 0; i < co.rollers.length; i++) {
      if (h.riding === i) continue;
      const at = rollerAt(run, i, ms, P2);
      if (!at) continue;
      const r = co.rollers[i];
      if (Math.hypot(h.x - at.x, h.z - at.z) < ROLLER_R + HERO_R && h.y < r.y + ROLLER_R * 1.6 && h.y > r.y - 0.5) hit(run, "roller", at.x, at.z);
   }
   // ice slimes
   for (let i = 0; i < co.slimes.length; i++) {
      const at = slimeAt(run, i, P2);
      const p = co.plats[co.slimes[i].plat];
      if (Math.hypot(h.x - at.x, h.z - at.z) < SLIME_R + HERO_R && Math.abs(h.y - p.y) < 0.8) hit(run, "slime", at.x, at.z);
   }
   // Kiro's chutes: icicle rain, a hit unless shielded
   for (const c of co.chutes) {
      if (Math.abs(h.x - c.x) < c.hx && Math.abs(h.z - c.z) < c.hz && h.y >= c.y0 && h.y <= c.y1) {
         if (ms <= run.shieldUntil) continue;
         hit(run, "chute", c.x, c.z + c.hz + 1);
      }
   }
}

function bossWorld(run: PeakRun, dtMs: number): void {
   const co = run.course;
   const a = co.arena;
   const b = run.boss;
   if (!a || !b) return;
   const h = run.hero;
   const ev = run.events;
   if (!run.bossAwake) {
      const arena = co.plats[co.route[co.route.length - 2]];
      if (h.ground === arena.id && run.checkpoint === arena.id) {
         run.bossAwake = true;
         ev.bossWoke = true;
      } else return;
   }
   const before = b.phase;
   stepBoss(b, FROST_GOLEM, dtMs, run.bossEv);
   if (run.bossEv.telegraph) ev.bossTelegraph = true;
   if (run.bossEv.attack) ev.bossAttack = true;
   if (b.step === "vulnerable" && run.pending > 0 && b.hp > 0) {
      const r = hitBoss(b, FROST_GOLEM, 1, run.bossEv);
      if (r !== "ignored") {
         run.pending = 0;
         ev.bossHit = true;
         if (r === "phase") ev.bossPhase = true;
         if (r === "defeated") ev.bossDefeated = true;
         // off his back / shoulder: set down on the arena again (the head hit leaves you on the summit side)
         if (before < 2) {
            h.x = a.reset.x;
            h.z = a.reset.z;
            h.y = a.y;
            h.vx = h.vy = h.vz = 0;
            h.ground = co.route[co.route.length - 2];
            h.riding = -1;
         }
      }
   }
   if (b.phase !== before) ev.bossPhase = true;
   if (run.bossEv.done) ev.bossDone = true;
}

/** One frame (dtMs = useRunFrame's dt x 1000). Returns run.events (the same object every step). */
export function step(run: PeakRun, dtMs: number, input: StepInput): StepEvents {
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
   // a press in a frame shorter than one step waits for the next frame
   if (first && input.jumpPressed) run.jumpBufferUntil = run.ms + BUFFER_MS;
   if (first && input.actionPressed) run.pendingAction = true;
   return ev;
}

// ---------- the store hand-off ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   speed: "speed",
   height: "height",
   grip: "grip",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   falls: "falls",
   hits: "hits",
   hero: "hero",
   power: "power",
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

/** The no-hit badge: hazard hits (falls do not count). */
export function badgeHits(run: PeakRun): number {
   return run.hits;
}

// ---------- the proof ----------

/**
 * The most orbs one hero can take on a level: the main route's, the snowball ride's and Kiro's chute
 * (anyone can take a chute's icicles to reach them), plus the one hero route (Riko's speed ledges, Nami's
 * cornices, Zuno's frozen trails, Vexa's ghost caves) that is its own: the others' are out of reach
 * without their power (powers.test.ts).
 */
export function maxOrbs(c: Course): number {
   const open = c.orbs.filter((o) => o.bonus === null || o.bonus === "ride" || o.bonus === "kiro").length;
   const own = Math.max(...(["riko", "nami", "zuno", "vexa"] as const).map((h) => c.orbs.filter((o) => o.bonus === h).length));
   return open + own;
}

/** What the course can feed the flow meter: every orb one hero can take, and one perfect landing per platform. */
export function comboSpecOf(c: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: maxOrbs(c), base: COMBO_BASE_MS.orb },
         { count: c.plats.length, base: COMBO_BASE_MS.landing },
      ],
   };
}

/** The Frost Golem's least defeat time (ms) once woken: a hit in the first ms of every open window. */
export function bossMinMs(): number {
   const b = createBoss(FROST_GOLEM);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000 && b.step !== "done"; guard++) {
      stepBoss(b, FROST_GOLEM, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, FROST_GOLEM, 1, ev);
   }
   return ms;
}

/**
 * How far (m) a hero can travel horizontally in `ms` at most: 9 m/s always, plus each dash's 4 m/s for
 * its 0.5 s window (one dash, then one per 4 s cooldown).
 */
export function maxTravel(ms: number): number {
   const t = ms / 1000;
   return V_ICE * t + DASH_DV * (POWER_MS.dash / 1000) * (1 + Math.floor(ms / heroById("riko").cooldownMs));
}

/** The least ms to travel `d` m by maxTravel. */
export function travelFloorMs(d: number): number {
   const dashes = DASH_DV * (POWER_MS.dash / 1000);
   const perMs = V_ICE / 1000 + dashes / heroById("riko").cooldownMs;
   return Math.max(0, (d - dashes) / perMs);
}

/**
 * The least finish (ms): no hero climbs faster than V_CLIMB_MAX on average nor travels further than
 * maxTravel, so the climb to the goal (level 5: to the arena) and the straight line to it are both
 * floors; level 5 adds the golem's least defeat time (he wakes only once you stand in the arena).
 */
export function minFinishMs(c: Course): number {
   // leg by leg between beacons (each must be lit in order; a fall drops you on the last lit, so no
   // shortcut carries you ahead): the leg's climb and its straight line, whichever is longer
   const chain = [c.start, ...c.beacons];
   const end = c.arena ? chain.indexOf(c.route[c.route.length - 2]) : chain.length - 1;
   let ms = 0;
   for (let i = 1; i <= end; i++) {
      const a = c.plats[chain[i - 1]];
      const b = c.plats[chain[i]];
      const climb = (Math.max(0, b.y - a.y) / V_CLIMB_MAX) * 1000;
      // the nearest points of the two footprints
      const dx = Math.max(0, Math.abs(b.x - a.x) - a.hx - b.hx);
      const dz = Math.max(0, Math.abs(b.z - a.z) - a.hz - b.hz);
      ms += Math.max(climb, travelFloorMs(Math.hypot(dx, dz)));
   }
   return ms + (c.arena ? bossMinMs() : 0);
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

/** The level's limits row: the bound less 6 %, to the 100 ms below. */
export function proposeLimits(c: Course): LevelLimits {
   const minDurationMs = Math.max(0, Math.floor((minDurationMsOf(c) * 0.94) / 100) * 100);
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

export { LEVELS } from "./levels";
export { courseFor } from "./course";
