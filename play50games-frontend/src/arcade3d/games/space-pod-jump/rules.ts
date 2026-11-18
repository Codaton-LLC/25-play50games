// Space Pod Jump rules (the design card's ORBIT, patched-conic gravity): the hero walks round tiny
// planetoids in the x-y plane, jumps (4.5 m/s: always comes back down), and launches from station pod
// cradles (hold Jump 0-0.8 s: 5-9 m/s, aimed with the stick) to cross to the next body. In flight only the
// dominant body pulls (the smallest distance / SOI among the SOIs the hero is in; mu = 6 R^2), so arcs
// are true Kepler arcs; moving moons give slingshots. Holding Jump in flight fires the retro jets (1.5 m/s^2
// against the motion, 1.2 s of fuel, refilled on landing). Touching a body lands on it. Leaving the map
// outside every SOI is "lost in space": back to the last planetoid after 1 s. Solar flares, debris and
// closed slingshot gates knock the hero back (Kiro's shield crosses them). Hero gates: Riko's prograde
// burn and her cracked panel, Nami's second impulse, Kiro's shield, Zuno's magnet, Vexa's chord through a
// planetoid and her ghost hatch. Level 4: floating crates to push off. Level 5: the Orbit Warden.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time (a fixed 1 kHz sub-step): the same run
// at 30, 60 or 144 fps. README "Rules" and "Server limits" explain the proof.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { LEVELS, type PodLevel } from "./levels";
import { DOCK_R, NONE, buildSystem, type BodyDef, type CrateDef, type DebrisDef, type FlareDef, type GateDef, type OrbDef, type PanelDef, type SecretSpot } from "./system";
import { COMBO, COMBO_BASE_MS, PERFECT_CHAIN, SECRETS, WARDEN } from "./progression";

export { NONE, DOCK_R };
export type { BodyDef, CrateDef, DebrisDef, FlareDef, GateDef, OrbDef, PanelDef, SecretSpot };

// ---------- tuning ----------

export const MAX_STEP_MS = 50;
/** the speed cap (m/s): every ms the hero moves at most V_MAX / 1000 m (the proof's one rule) */
export const V_MAX = 14;
/** walking round a body (m/s) */
export const WALK = 4;
/** a jump (the card: 4.5 m/s, always comes back down on an R = 4 planetoid) */
export const V_JUMP = 4.5;
/** a pod launch: 5 to 9 m/s over a 0-0.8 s charge; aimed up to 50 degrees off the cradle's normal */
export const POD = { min: 5, max: 9, chargeMs: 800, aim: (50 * Math.PI) / 180, reach: 0.22 } as const;
/** the retro jets: 1.5 m/s^2 for 1.2 s of fuel (the card) */
export const JETS = { accel: 1.5, fuelMs: 1200 } as const;
/** Riko's prograde burn, Nami's second impulse (m/s) */
export const BURN = { dash: 2.5, nami: 3 } as const;
/** Vexa's chord through a planetoid (m/s) */
export const CHORD_V = 6;
/** a knock (a flare, debris, a closed gate, a cracked panel): bounced back at half speed, then 0.6 s of grace */
export const KNOCK = { factor: 0.5, graceMs: 600 } as const;
/** lost in space: outside every SOI and the map for this long, then back to the last planetoid */
export const LOST_MS = 1000;
/** pickups: radius round the hero's middle; the middle over the feet */
export const PICKUP = { r: 1.1, centerY: 0.6 } as const;
export const SECRET_R = 1.6;
/** slingshot gates (level 3): a ring of this radius, open only at this speed (m/s); the time bonus */
export const GATE = { r: 1.6, speed: 8 } as const;
/** debris pieces: contact radius; a flare zone's edge is its r */
export const DEBRIS_R = 1.0;
/** level 4's crates: a jump press within reach pushes off (+ the impulse to the hero, - to the crate) */
export const CRATE = { reach: 1.8, impulse: 3, cooldownMs: 500 } as const;
/** level 5: the Warden's vents (half-width rad), thruster, belt, mines, the fast hit, the spin */
export const WARDEN_PLAY = {
   spin: 0.15,
   ventHalf: 0.35,
   thrusterHalf: 0.3,
   beltK: 1.6,
   beltGapHalf: (35 * Math.PI) / 180,
   beltPeriodMs: 2400,
   mineMu: 35,
   mineReach: 6,
   mineMs: 3000,
   fastHit: 8.5,
} as const;

// ---------- the course ----------

export interface Course {
   level: LevelId;
   durationMs: number;
   boss: boolean;
   vMax: number;
   bodies: BodyDef[];
   orbs: OrbDef[];
   mainOrbs: number;
   gates: GateDef[];
   flares: FlareDef[];
   debris: DebrisDef[];
   panels: PanelDef[];
   crates: CrateDef[];
   secrets: SecretSpot[];
   startBody: number;
   startAngle: number;
   startX: number;
   startY: number;
   dock: { x: number; y: number; r: number };
   bounds: { minX: number; maxX: number; minY: number; maxY: number };
   warden: number;
   arenaBodies: number[];
   /** level 5: the least x of an arena body's surface (the boss can only start past it) */
   arenaX: number;
}

export function buildCourse(level: PodLevel = LEVELS[1]): Course {
   const d = buildSystem(level);
   const secrets = SECRETS[level.id].map((s) => {
      const p = d.secrets[s.id];
      if (!p) throw new Error(`space-pod-jump L${level.id}: secret ${s.id} is not placed`);
      return p;
   });
   const b0 = d.bodies[d.startBody];
   let arenaX = Number.NaN;
   for (const i of d.arenaBodies) {
      const b = d.bodies[i];
      const cx = b.orbit ? d.bodies[b.orbit.parent].x - b.orbit.r : b.x;
      arenaX = Number.isNaN(arenaX) ? cx - b.R : Math.min(arenaX, cx - b.R);
   }
   return {
      level: level.id,
      durationMs: level.durationMs,
      boss: level.boss,
      vMax: V_MAX,
      bodies: d.bodies,
      orbs: d.orbs,
      mainOrbs: d.orbs.filter((o) => o.kind === "main").length,
      gates: d.gates,
      flares: d.flares,
      debris: d.debris,
      panels: d.panels,
      crates: d.crates,
      secrets,
      startBody: d.startBody,
      startAngle: d.startAngle,
      startX: b0.x + b0.R * Math.cos(d.startAngle),
      startY: b0.y + b0.R * Math.sin(d.startAngle),
      dock: d.dock,
      bounds: d.bounds,
      warden: d.warden,
      arenaBodies: d.arenaBodies,
      arenaX,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** A body's centre (and velocity) at ms. */
export function bodyAt(c: Course, i: number, ms: number, out: { x: number; y: number; vx: number; vy: number }): { x: number; y: number; vx: number; vy: number } {
   const b = c.bodies[i];
   if (!b.orbit) {
      out.x = b.x;
      out.y = b.y;
      out.vx = 0;
      out.vy = 0;
      return out;
   }
   const p = c.bodies[b.orbit.parent];
   const a = b.orbit.phase + (b.orbit.w * ms) / 1000;
   out.x = p.x + b.orbit.r * Math.cos(a);
   out.y = p.y + b.orbit.r * Math.sin(a);
   out.vx = -b.orbit.r * b.orbit.w * Math.sin(a);
   out.vy = b.orbit.r * b.orbit.w * Math.cos(a);
   return out;
}

/** A debris piece's place at ms. */
export function debrisAt(c: Course, i: number, ms: number, out: { x: number; y: number }): { x: number; y: number } {
   const d = c.debris[i];
   const p = c.bodies[d.parent];
   const a = d.phase + (d.w * ms) / 1000;
   out.x = p.x + d.r * Math.cos(a);
   out.y = p.y + d.r * Math.sin(a);
   return out;
}

export function flareOn(f: FlareDef, ms: number): boolean {
   return (ms + f.phase) % f.period < f.on;
}

// ---------- the bounds (README "Server limits and why they hold") ----------

/**
 * The least ms to the dock: the hero must come within DOCK_R of it, so its x must grow from startX to
 * dock.x - DOCK_R; every ms it moves at most vMax / 1000 m (the velocity is capped in flight, walking and
 * a moon's motion stay under it, Vexa's chord is 6 m/s) or is put back on a point it reached before (lost
 * in space), so its farthest x grows at most vMax / 1000 m a ms. Less 4 ms.
 */
export function progressFloorMs(course: Course): number {
   return Math.max(0, ((course.dock.x - DOCK_R - course.startX) * 1000) / course.vMax - 4);
}

export function bossMinMs(): number {
   const s = createBoss(WARDEN);
   const ev = createBossEvents();
   for (let ms = 1; ms < 900_000; ms++) {
      stepBoss(s, WARDEN, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, WARDEN, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** Level 5: the boss starts only once the hero lands on an arena body (x past arenaX), then needs BOSS_MIN_MS of its own. */
export function bossFloorMs(course: Course): number {
   if (!course.boss) return 0;
   return Math.max(0, ((course.arenaX - course.startX) * 1000) / course.vMax - 4) + BOSS_MIN_MS - 2;
}

export function minFinishMs(course: Course): number {
   const z = progressFloorMs(course);
   return course.boss ? Math.max(z, bossFloorMs(course)) : z;
}

export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.gates.length, base: COMBO_BASE_MS.gate },
         { count: course.bodies.length, base: COMBO_BASE_MS.capture },
      ],
   };
}

/** The most flow bonus a run could build (juice only: the submitted time is the finish time). */
export function maxFlowBonus(course: Course): number {
   return comboMaxBonus(comboSpecOf(course));
}

/** The least submitted duration: the submitted time is the finish time (no bonus comes off it). */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course);
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms (94-100 % of it). */
export function proposeLimits(course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

// ---------- the run ----------

export interface Hero {
   x: number;
   y: number;
   vx: number;
   vy: number;
   /** grounded: the body and the surface angle (rad) */
   grounded: boolean;
   body: number;
   angle: number;
   /** the pod being charged (index into its body's pods; NONE), the charge so far */
   pod: number;
   chargeMs: number;
   airJump: boolean;
   fuelMs: number;
   /** the jets fire only after Jump was let go once in this flight */
   jetsArmed: boolean;
   jetsThisFlight: boolean;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** Vexa's chord: from-angle, start ms, length ms (NONE: not in one) */
   chordFrom: number;
   chordAt: number;
   chordMs: number;
   knockUntil: number;
   lostMs: number;
   /** the last planetoid (a body with no orbit) it stood on, and where */
   homeBody: number;
   homeAngle: number;
   /** the dominant body this ms (NONE: free space) */
   dom: number;
   /** the farthest x reached (the proof's guard) */
   maxX: number;
   /** the relative speed of the last landing */
   landSpeed: number;
   /** the body it took off from, and when (the lift-off grace) */
   leftBody: number;
   leftAt: number;
}

export interface StepInput {
   /** the stick / A-D (-1..1): walk round the body; aims a pod launch */
   moveX: number;
   /** up held (W / up): Nami's second impulse goes straight out */
   up: boolean;
   /** Jump held: charges a pod launch, fires the jets in flight */
   jump: boolean;
   jumpPressed: boolean;
   /** E / Enter / the Power button */
   actionPressed: boolean;
   /** the camera's roll and yaw (rad): walking and aiming are screen-relative */
   roll: number;
   yaw: number;
}

export function createStepInput(): StepInput {
   return { moveX: 0, up: false, jump: false, jumpPressed: false, actionPressed: false, roll: 0, yaw: 0 };
}

export interface StepEvents {
   jumped: boolean;
   launched: boolean;
   launchSpeed: number;
   charging: boolean;
   airJumped: boolean;
   burned: boolean;
   landed: boolean;
   landBody: number;
   capture: boolean;
   perfect: boolean;
   soiEnter: number;
   jets: boolean;
   knocked: boolean;
   smashed: boolean;
   lost: boolean;
   respawned: boolean;
   chordStart: boolean;
   chordEnd: boolean;
   pushed: number;
   gatePassed: number;
   orbCount: number;
   orbList: number[];
   powered: boolean;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   finished: boolean;
   timeup: boolean;
   /** level 5 */
   vent: boolean;
   thruster: boolean;
   fastHit: boolean;
   mine: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      launched: false,
      launchSpeed: 0,
      charging: false,
      airJumped: false,
      burned: false,
      landed: false,
      landBody: NONE,
      capture: false,
      perfect: false,
      soiEnter: NONE,
      jets: false,
      knocked: false,
      smashed: false,
      lost: false,
      respawned: false,
      chordStart: false,
      chordEnd: false,
      pushed: NONE,
      gatePassed: NONE,
      orbCount: 0,
      orbList: new Array<number>(24).fill(0),
      powered: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      finished: false,
      timeup: false,
      vent: false,
      thruster: false,
      fastHit: false,
      mine: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.launched = false;
   ev.launchSpeed = 0;
   ev.charging = false;
   ev.airJumped = false;
   ev.burned = false;
   ev.landed = false;
   ev.landBody = NONE;
   ev.capture = false;
   ev.perfect = false;
   ev.soiEnter = NONE;
   ev.jets = false;
   ev.knocked = false;
   ev.smashed = false;
   ev.lost = false;
   ev.respawned = false;
   ev.chordStart = false;
   ev.chordEnd = false;
   ev.pushed = NONE;
   ev.gatePassed = NONE;
   ev.orbCount = 0;
   ev.powered = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.vent = false;
   ev.thruster = false;
   ev.fastHit = false;
   ev.mine = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

export interface PodRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   jumpMs: number;
   actionMs: number;
   /** the frame's held input (applied every ms of the frame) */
   held: { moveX: number; up: boolean; jump: boolean; roll: number; yaw: number };
   powerReadyAt: number;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   gateDone: Uint8Array;
   gates: number;
   panelBroken: Uint8Array;
   crateX: Float64Array;
   crateY: Float64Array;
   crateVx: Float64Array;
   crateVy: Float64Array;
   crateAt: Float64Array;
   captured: Uint8Array;
   perfectChain: number;
   perfects: number;
   combo: ComboState;
   secrets: SecretTracker;
   knocks: number;
   losts: number;
   jetsUsedMs: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   /** level 5 */
   boss: BossState | null;
   bossEv: BossEvents;
   bossOn: boolean;
   pendingHits: number;
   ventUsed: Uint8Array;
   thrusterOffset: number;
   mineX: number;
   mineY: number;
   mineUntil: number;
   /** a co-op double launch (multiplayer.ts): the next launch gets this much more speed */
   launchBonus: number;
}

export interface RunOptions {
   heroStart?: number;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): PodRun {
   const c = courseFor(level);
   const hero: Hero = {
      x: c.startX,
      y: c.startY,
      vx: 0,
      vy: 0,
      grounded: true,
      body: c.startBody,
      angle: c.startAngle,
      pod: NONE,
      chargeMs: 0,
      airJump: true,
      fuelMs: JETS.fuelMs,
      jetsArmed: false,
      jetsThisFlight: false,
      dashUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      chordFrom: NONE,
      chordAt: NONE,
      chordMs: 0,
      knockUntil: NONE,
      lostMs: 0,
      homeBody: c.startBody,
      homeAngle: c.startAngle,
      dom: c.startBody,
      maxX: c.startX,
      landSpeed: 0,
      leftBody: NONE,
      leftAt: -1e9,
   };
   const run: PodRun = {
      course: c,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero,
      jumpMs: NONE,
      actionMs: NONE,
      held: { moveX: 0, up: false, jump: false, roll: 0, yaw: 0 },
      powerReadyAt: 0,
      collected: new Uint8Array(c.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      gateDone: new Uint8Array(c.gates.length),
      gates: 0,
      panelBroken: new Uint8Array(c.panels.length),
      crateX: Float64Array.from(c.crates.map((q) => q.x)),
      crateY: Float64Array.from(c.crates.map((q) => q.y)),
      crateVx: new Float64Array(c.crates.length),
      crateVy: new Float64Array(c.crates.length),
      crateAt: new Float64Array(c.crates.length).fill(-1e9),
      captured: new Uint8Array(c.bodies.length),
      perfectChain: 0,
      perfects: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      knocks: 0,
      losts: 0,
      jetsUsedMs: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
      boss: c.boss ? createBoss(WARDEN) : null,
      bossEv: createBossEvents(),
      bossOn: false,
      pendingHits: 0,
      ventUsed: new Uint8Array(3),
      thrusterOffset: 0,
      mineX: 0,
      mineY: 0,
      mineUntil: NONE,
      launchBonus: 0,
   };
   run.captured[c.startBody] = 1;
   return run;
}

/** A deep copy of a run's moving state (the bot's look-ahead): the course is shared. */
export function cloneRun(run: PodRun): PodRun {
   const { course, ...rest } = run;
   const copy = structuredClone(rest) as Omit<PodRun, "course">;
   return { ...copy, course } as PodRun;
}

// ---------- reads ----------

export function bossAlive(run: Pick<PodRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step !== "defeat" && b.step !== "done";
}

export function bossVulnerable(run: Pick<PodRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

export function bossPhase(run: PodRun): number {
   return run.boss && run.bossOn ? run.boss.phase : NONE;
}

/** The Warden's vent k's surface angle at ms (level 5). */
export function ventAngle(k: number, ms: number): number {
   return Math.PI / 2 + (k * 2 * Math.PI) / 3 + (WARDEN_PLAY.spin * ms) / 1000;
}

/** The Warden's thruster angle at ms (level 5). */
export function thrusterAngle(run: PodRun, ms: number): number {
   return -Math.PI / 2 + run.thrusterOffset + (WARDEN_PLAY.spin * ms) / 1000;
}

/** The debris belt's gap angle at ms (level 5, phase 2). */
export function beltGapAngle(ms: number): number {
   return (2 * Math.PI * ms) / WARDEN_PLAY.beltPeriodMs;
}

export function beltActive(run: PodRun): boolean {
   return bossPhase(run) === 1 && bossAlive(run);
}

/** The signed difference a - b, wrapped to (-pi, pi]. */
export function angleDiff(a: number, b: number): number {
   let d = (a - b) % (2 * Math.PI);
   if (d > Math.PI) d -= 2 * Math.PI;
   if (d <= -Math.PI) d += 2 * Math.PI;
   return d;
}

/**
 * The dominant body at (x, y) at ms: the smallest distance / SOI among the SOIs that hold the point
 * (patched conics: only one body pulls). NONE in free space.
 */
const SCR = { x: 0, y: 0, vx: 0, vy: 0 };
export function dominantAt(c: Course, x: number, y: number, ms: number): number {
   let best = NONE;
   let bestK = Infinity;
   for (let i = 0; i < c.bodies.length; i++) {
      const b = c.bodies[i];
      bodyAt(c, i, ms, SCR);
      const d = Math.hypot(x - SCR.x, y - SCR.y);
      if (d > b.soi) continue;
      const k = d / b.soi;
      if (k < bestK) {
         bestK = k;
         best = i;
      }
   }
   return best;
}

/** The pod cradle the hero stands at (index into its body's pods), or NONE. */
export function podUnder(run: PodRun): number {
   const h = run.hero;
   if (!h.grounded) return NONE;
   const pods = run.course.bodies[h.body].pods;
   for (let k = 0; k < pods.length; k++) if (Math.abs(angleDiff(h.angle, pods[k])) <= POD.reach) return k;
   return NONE;
}

/** The launch speed for a charge (ms). */
export function launchSpeed(chargeMs: number): number {
   return POD.min + (POD.max - POD.min) * Math.min(1, Math.max(0, chargeMs) / POD.chargeMs);
}

/**
 * Which way a right press turns the hero round its body: +1 counter-clockwise (angle up), -1 clockwise,
 * from the camera's roll and yaw (screen-relative walking). With the camera rolled so the local up is
 * the screen's up, right is always clockwise.
 */
export function walkSign(angle: number, roll: number, yaw: number): number {
   const c = Number.isFinite(yaw) ? Math.cos(yaw) : 1;
   const flip = Math.abs(c) >= 0.3 ? Math.sign(c) : 1;
   const rx = Math.cos(roll) * flip;
   const ry = Math.sin(roll);
   const dot = rx * -Math.sin(angle) + ry * Math.cos(angle);
   if (Math.abs(dot) < 0.15) return -1;
   return dot > 0 ? 1 : -1;
}

/** The launch velocity a pod would give now (for the HUD's preview and the bot), into out. */
export function launchVelocity(run: PodRun, chargeMs: number, moveX: number, out: { x: number; y: number }): { x: number; y: number } {
   const h = run.hero;
   const c = run.course;
   const pods = c.bodies[h.body].pods;
   const pa = h.pod !== NONE ? pods[h.pod] : h.angle;
   const aim = pa + walkSign(h.angle, run.held.roll, run.held.yaw) * Math.max(-1, Math.min(1, moveX)) * POD.aim;
   const v = launchSpeed(chargeMs) + run.launchBonus;
   bodyAt(c, h.body, run.simMs, SCR);
   out.x = SCR.vx + v * Math.cos(aim);
   out.y = SCR.vy + v * Math.sin(aim);
   return out;
}

/** The submitted time: the finish time (orbs feed the star, gates and captures the flow: no time comes off). */
export function runTimeMs(run: Pick<PodRun, "finishMs">): number {
   return Math.max(0, run.finishMs);
}

export function distanceOf(run: PodRun): number {
   return Math.max(0, run.hero.x - run.course.startX);
}

// ---------- the step ----------

export function advanceClock(run: PodRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: PodRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (whole <= 0) return ev;
   if (input.jumpPressed) run.jumpMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   run.held.moveX = Number.isFinite(input.moveX) ? Math.max(-1, Math.min(1, input.moveX)) : 0;
   run.held.up = input.up;
   run.held.jump = input.jump;
   run.held.roll = Number.isFinite(input.roll) ? input.roll : 0;
   run.held.yaw = Number.isFinite(input.yaw) ? input.yaw : 0;
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= run.course.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run);
      if (run.ended !== null) return ev;
   }
   return ev;
}

function linkCombo(run: PodRun, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

function foundSecret(run: PodRun, id: string): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i < 0 || run.secrets.found[i]) return;
   if (collectSecret(run.secrets, i)) {
      const ev = run.events;
      if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
      ev.secretCount += 1;
   }
}

const B = { x: 0, y: 0, vx: 0, vy: 0 };

/** Places the grounded hero on its body's surface at its angle (the body's place at ms). */
function placeOnSurface(run: PodRun, ms: number): void {
   const h = run.hero;
   const b = run.course.bodies[h.body];
   bodyAt(run.course, h.body, ms, B);
   h.x = B.x + b.R * Math.cos(h.angle);
   h.y = B.y + b.R * Math.sin(h.angle);
   h.vx = B.vx;
   h.vy = B.vy;
}

function takeOff(run: PodRun, vx: number, vy: number): void {
   const h = run.hero;
   h.grounded = false;
   h.vx = vx;
   h.vy = vy;
   h.pod = NONE;
   h.chargeMs = 0;
   h.airJump = true;
   h.jetsArmed = false;
   h.jetsThisFlight = false;
   // the body it leaves cannot catch it for the first LIFTOFF_MS (no teleport off the surface)
   h.leftBody = h.body;
   h.leftAt = run.simMs;
}

/** after a take-off, the body left does not count for landing this long (ms) */
export const LIFTOFF_MS = 40;

function tryPower(run: PodRun, ms: number): void {
   const h = run.hero;
   const ev = run.events;
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") {
      if (h.grounded || !h.airJump) return;
      h.airJump = false;
      const d = h.dom;
      let dx: number;
      let dy: number;
      if (run.held.up && d !== NONE) {
         bodyAt(run.course, d, ms, B);
         dx = h.x - B.x;
         dy = h.y - B.y;
      } else {
         if (d !== NONE) bodyAt(run.course, d, ms, B);
         else {
            B.vx = 0;
            B.vy = 0;
         }
         dx = h.vx - B.vx;
         dy = h.vy - B.vy;
      }
      const n = Math.hypot(dx, dy) || 1;
      h.vx += (BURN.nami * dx) / n;
      h.vy += (BURN.nami * dy) / n;
      ev.airJumped = true;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      return;
   }
   if (def.power === "dash") {
      h.dashUntil = ms + POWER_MS.dash;
      if (!h.grounded) {
         // a prograde burn: along the motion relative to the dominant body
         if (h.dom !== NONE) bodyAt(run.course, h.dom, ms, B);
         else {
            B.vx = 0;
            B.vy = 0;
         }
         const dx = h.vx - B.vx;
         const dy = h.vy - B.vy;
         const n = Math.hypot(dx, dy) || 1;
         h.vx += (BURN.dash * dx) / n;
         h.vy += (BURN.dash * dy) / n;
         ev.burned = true;
      }
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else {
      h.phaseUntil = ms + POWER_MS.phase;
      // Vexa on a planetoid: the chord through it to the far side
      if (h.grounded && run.course.bodies[h.body].kind !== "warden") {
         const b = run.course.bodies[h.body];
         h.chordFrom = h.angle;
         h.chordAt = ms;
         h.chordMs = Math.round(((2 * b.R) / CHORD_V) * 1000);
         ev.chordStart = true;
         const sec = run.course.secrets;
         for (let i = 0; i < sec.length; i++) {
            const s = sec[i];
            if (s.body !== h.body) continue;
            if (s.need === "hatch" && Math.abs(angleDiff(h.angle, s.angle)) <= 0.3) foundSecret(run, SECRETS[run.level][i].id);
            if (s.need === "core") foundSecret(run, SECRETS[run.level][i].id);
         }
      }
   }
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function knock(run: PodRun, ms: number): void {
   const h = run.hero;
   h.vx = -h.vx * KNOCK.factor;
   h.vy = -h.vy * KNOCK.factor;
   h.knockUntil = ms + KNOCK.graceMs;
   run.knocks += 1;
   run.perfectChain = 0;
   comboBreak(run.combo);
   run.events.knocked = true;
}

function respawn(run: PodRun, ms: number): void {
   const h = run.hero;
   h.grounded = true;
   h.body = h.homeBody;
   h.angle = h.homeAngle;
   h.pod = NONE;
   h.chargeMs = 0;
   h.fuelMs = JETS.fuelMs;
   h.lostMs = 0;
   h.chordFrom = NONE;
   placeOnSurface(run, ms);
   run.losts += 1;
   run.perfectChain = 0;
   comboBreak(run.combo);
   run.events.respawned = true;
}

function land(run: PodRun, b: number, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const body = c.bodies[b];
   bodyAt(c, b, ms, B);
   h.landSpeed = Math.hypot(h.vx - B.vx, h.vy - B.vy);
   h.grounded = true;
   h.body = b;
   h.angle = Math.atan2(h.y - B.y, h.x - B.x);
   h.fuelMs = JETS.fuelMs;
   h.airJump = true;
   h.lostMs = 0;
   placeOnSurface(run, ms);
   const ev = run.events;
   ev.landed = true;
   ev.landBody = b;
   if (!body.orbit) {
      h.homeBody = b;
      h.homeAngle = h.angle;
   }
   if (!run.captured[b]) {
      run.captured[b] = 1;
      ev.capture = true;
      linkCombo(run, COMBO_BASE_MS.capture);
      if (!h.jetsThisFlight) {
         run.perfectChain += 1;
         if (run.perfectChain >= PERFECT_CHAIN) {
            run.perfectChain = 0;
            run.perfects += 1;
            ev.perfect = true;
         }
      } else run.perfectChain = 0;
   }
   // the secrets on a body (the moonlet)
   const sec = c.secrets;
   for (let i = 0; i < sec.length; i++) if (sec[i].need === "spot" && sec[i].body === b) foundSecret(run, SECRETS[run.level][i].id);
   // level 5: the arena starts; the Warden's vents (phase 1) and a fast hit (phase 3)
   if (c.boss && !run.bossOn && c.arenaBodies.includes(b)) run.bossOn = true;
   if (c.boss && run.bossOn && b === c.warden && bossAlive(run)) {
      const ph = run.boss!.phase;
      if (ph === 0) {
         for (let k = 0; k < 3; k++) {
            if (run.ventUsed[k]) continue;
            if (Math.abs(angleDiff(h.angle, ventAngle(k, ms))) <= WARDEN_PLAY.ventHalf) {
               run.ventUsed[k] = 1;
               run.pendingHits += 1;
               ev.vent = true;
               break;
            }
         }
      } else if (ph === 2 && h.landSpeed >= WARDEN_PLAY.fastHit) {
         run.pendingHits = Math.max(run.pendingHits, 1);
         ev.fastHit = true;
      }
   }
}

function tick(run: PodRun): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   const ev = run.events;
   if (run.boss && run.bossOn) bossMs(run);
   comboTick(run.combo, COMBO, ms);
   if (run.jumpMs !== NONE && ms - run.jumpMs > 120) run.jumpMs = NONE;
   if (run.actionMs !== NONE) {
      tryPower(run, ms);
      run.actionMs = NONE;
   }
   const px = h.x;
   const py = h.y;
   if (h.chordFrom !== NONE) chordMs(run, ms);
   else if (h.grounded) groundMs(run, ms);
   else flightMs(run, ms);
   if (run.ended !== null) return;
   // the guard: the farthest x
   if (h.x > h.maxX) h.maxX = h.x;
   void px;
   void py;
   if (!h.grounded && h.chordFrom === NONE) hazards(run, ms);
   pickups(run, ms);
   // the dock
   const d = c.dock;
   if (!bossAlive(run) && Math.hypot(h.x - d.x, h.y - d.y) <= d.r) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function chordMs(run: PodRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const b = c.bodies[h.body];
   bodyAt(c, h.body, ms, B);
   const t = Math.min(1, (ms - h.chordAt) / h.chordMs);
   const ax = Math.cos(h.chordFrom);
   const ay = Math.sin(h.chordFrom);
   // straight through the middle, from the surface point to its antipode
   const k = 1 - 2 * t;
   h.x = B.x + b.R * ax * k;
   h.y = B.y + b.R * ay * k;
   h.vx = B.vx;
   h.vy = B.vy;
   if (t >= 1) {
      h.angle = h.chordFrom + Math.PI;
      h.chordFrom = NONE;
      h.grounded = true;
      placeOnSurface(run, ms);
      run.events.chordEnd = true;
   }
}

function groundMs(run: PodRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const b = c.bodies[h.body];
   h.dom = h.body;
   const podK = podUnder(run);
   const sign = walkSign(h.angle, run.held.roll, run.held.yaw);
   // a pod: Jump held charges it (the hero settles into the cradle); let go, it launches
   if (podK !== NONE && (h.pod !== NONE || run.jumpMs !== NONE) && (run.held.jump || h.pod !== NONE)) {
      if (h.pod === NONE) {
         h.pod = podK;
         h.chargeMs = 0;
         run.jumpMs = NONE;
      }
      // it settles into the cradle at walking speed (never a jump in place: the speed guard)
      const d = angleDiff(b.pods[h.pod], h.angle);
      const m = (WALK * 0.001) / b.R;
      h.angle += d > m ? m : d < -m ? -m : d;
      placeOnSurface(run, ms);
      if (run.held.jump) {
         h.chargeMs = Math.min(POD.chargeMs, h.chargeMs + 1);
         ev.charging = true;
         return;
      }
      const v = SCR_V;
      launchVelocity(run, h.chargeMs, run.held.moveX, v);
      ev.launched = true;
      ev.launchSpeed = launchSpeed(h.chargeMs) + run.launchBonus;
      run.launchBonus = 0;
      takeOff(run, v.x, v.y);
      return;
   }
   // walking round the body
   if (run.held.moveX !== 0) h.angle += (sign * run.held.moveX * WALK * 0.001) / b.R;
   placeOnSurface(run, ms);
   // level 5, phase 2: walking onto the Warden's thruster
   if (c.boss && run.bossOn && h.body === c.warden && bossPhase(run) === 1 && bossAlive(run)) {
      if (Math.abs(angleDiff(h.angle, thrusterAngle(run, ms))) <= WARDEN_PLAY.thrusterHalf) {
         run.pendingHits += 1;
         run.thrusterOffset += 2.1;
         ev.thruster = true;
      }
   }
   // a jump: straight up off the surface, plus the walk and the body's own motion
   if (run.jumpMs !== NONE) {
      run.jumpMs = NONE;
      const tx = -Math.sin(h.angle) * sign * run.held.moveX * WALK;
      const ty = Math.cos(h.angle) * sign * run.held.moveX * WALK;
      takeOff(run, h.vx + tx + V_JUMP * Math.cos(h.angle), h.vy + ty + V_JUMP * Math.sin(h.angle));
      ev.jumped = true;
   }
}

const SCR_V = { x: 0, y: 0 };
const G = { x: 0, y: 0 };

/** The gravity at (x, y) at ms from the dominant body (and level 5's mine), into G; returns the dominant body. */
export function gravityAt(run: PodRun, x: number, y: number, ms: number, out = G): number {
   const c = run.course;
   const d = dominantAt(c, x, y, ms);
   out.x = 0;
   out.y = 0;
   if (d !== NONE) {
      bodyAt(c, d, ms, B);
      const dx = B.x - x;
      const dy = B.y - y;
      const r2 = Math.max(0.25, dx * dx + dy * dy);
      const r = Math.sqrt(r2);
      const a = c.bodies[d].mu / r2;
      out.x = (a * dx) / r;
      out.y = (a * dy) / r;
   }
   if (ms < run.mineUntil) {
      const dx = run.mineX - x;
      const dy = run.mineY - y;
      const r2 = dx * dx + dy * dy;
      if (r2 < WARDEN_PLAY.mineReach * WARDEN_PLAY.mineReach) {
         const r = Math.sqrt(Math.max(1, r2));
         const a = WARDEN_PLAY.mineMu / Math.max(1, r2);
         out.x += (a * dx) / r;
         out.y += (a * dy) / r;
      }
   }
   return d;
}

function flightMs(run: PodRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const prevDom = h.dom;
   const d = gravityAt(run, h.x, h.y, ms);
   h.dom = d;
   if (d !== prevDom && d !== NONE) ev.soiEnter = d;
   let ax = G.x;
   let ay = G.y;
   // the retro jets: Jump held (after a release in this flight), against the motion relative to the dominant body
   if (!run.held.jump) h.jetsArmed = true;
   if (run.held.jump && h.jetsArmed && h.fuelMs > 0) {
      if (d !== NONE) bodyAt(c, d, ms, B);
      else {
         B.vx = 0;
         B.vy = 0;
      }
      const rx = h.vx - B.vx;
      const ry = h.vy - B.vy;
      const n = Math.hypot(rx, ry);
      if (n > 0.05) {
         ax -= (JETS.accel * rx) / n;
         ay -= (JETS.accel * ry) / n;
      }
      h.fuelMs -= 1;
      run.jetsUsedMs += 1;
      h.jetsThisFlight = true;
      ev.jets = true;
   }
   // level 4: a jump press next to a crate pushes off it
   if (run.jumpMs !== NONE) {
      for (let i = 0; i < c.crates.length; i++) {
         if (ms - run.crateAt[i] < CRATE.cooldownMs) continue;
         if (Math.hypot(run.crateX[i] - h.x, run.crateY[i] - h.y) > CRATE.reach) continue;
         const n = Math.hypot(h.vx, h.vy) || 1;
         const ux = n > 0.2 ? h.vx / n : 1;
         const uy = n > 0.2 ? h.vy / n : 0;
         h.vx += CRATE.impulse * ux;
         h.vy += CRATE.impulse * uy;
         run.crateVx[i] -= CRATE.impulse * ux;
         run.crateVy[i] -= CRATE.impulse * uy;
         run.crateAt[i] = ms;
         run.jumpMs = NONE;
         ev.pushed = i;
         break;
      }
   }
   h.vx += ax * 0.001;
   h.vy += ay * 0.001;
   // the speed cap (the proof's guard)
   const sp = Math.hypot(h.vx, h.vy);
   if (sp > c.vMax) {
      h.vx *= c.vMax / sp;
      h.vy *= c.vMax / sp;
   }
   h.x += h.vx * 0.001;
   h.y += h.vy * 0.001;
   // the crates drift
   for (let i = 0; i < c.crates.length; i++) {
      run.crateX[i] += run.crateVx[i] * 0.001;
      run.crateY[i] += run.crateVy[i] * 0.001;
   }
   // landing: touching any body (not the one just left, for LIFTOFF_MS)
   for (let i = 0; i < c.bodies.length; i++) {
      if (i === h.leftBody && ms - h.leftAt < LIFTOFF_MS) continue;
      bodyAt(c, i, ms, B);
      if (Math.hypot(h.x - B.x, h.y - B.y) <= c.bodies[i].R) {
         land(run, i, ms);
         return;
      }
   }
   // lost in space
   const bd = c.bounds;
   if (d === NONE && (h.x < bd.minX || h.x > bd.maxX || h.y < bd.minY || h.y > bd.maxY)) {
      h.lostMs += 1;
      if (h.lostMs === 1) ev.lost = true;
      if (h.lostMs >= LOST_MS) respawn(run, ms);
   } else h.lostMs = 0;
}

const P = { x: 0, y: 0 };

function hazards(run: PodRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const shielded = ms < h.shieldUntil;
   const grace = ms < h.knockUntil;
   // slingshot gates: open at GATE.speed, else a closed ring knocks you back
   for (let i = 0; i < c.gates.length; i++) {
      if (run.gateDone[i]) continue;
      const g = c.gates[i];
      if (Math.hypot(h.x - g.x, h.y - g.y) > GATE.r) continue;
      if (Math.hypot(h.vx, h.vy) >= GATE.speed) {
         run.gateDone[i] = 1;
         run.gates += 1;
         ev.gatePassed = i;
         linkCombo(run, COMBO_BASE_MS.gate);
      } else if (!grace) knock(run, ms);
   }
   // Riko's cracked panels: her dash breaks one, anyone else bounces
   for (let i = 0; i < c.panels.length; i++) {
      if (run.panelBroken[i]) continue;
      const p = c.panels[i];
      if (Math.hypot(h.x - p.x, h.y - p.y) > p.r) continue;
      if (ms < h.dashUntil) {
         run.panelBroken[i] = 1;
         ev.smashed = true;
      } else if (!grace) knock(run, ms);
   }
   if (shielded || grace) return;
   for (const f of c.flares) {
      if (!flareOn(f, ms)) continue;
      if (Math.hypot(h.x - f.x, h.y - f.y) <= f.r) {
         knock(run, ms);
         return;
      }
   }
   for (let i = 0; i < c.debris.length; i++) {
      debrisAt(c, i, ms, P);
      if (Math.hypot(h.x - P.x, h.y - P.y) <= DEBRIS_R) {
         knock(run, ms);
         return;
      }
   }
   // level 5, phase 2: the debris belt round the Warden (one gap)
   if (beltActive(run)) {
      bodyAt(c, c.warden, ms, B);
      const rr = c.bodies[c.warden].R * WARDEN_PLAY.beltK;
      const dist = Math.hypot(h.x - B.x, h.y - B.y);
      if (Math.abs(dist - rr) < 0.6) {
         const a = Math.atan2(h.y - B.y, h.x - B.x);
         if (Math.abs(angleDiff(a, beltGapAngle(ms))) > WARDEN_PLAY.beltGapHalf) knock(run, ms);
      }
   }
}

function pickups(run: PodRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const reach = ms < h.magnetUntil ? MAGNET_REACH : PICKUP.r;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      const dx = o.x - h.x;
      const dy = o.y - h.y;
      if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
      if (dx * dx + dy * dy > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.kind === "main") run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount] = i;
      ev.orbCount += 1;
      linkCombo(run, COMBO_BASE_MS.orb);
   }
   const sec = c.secrets;
   for (let i = 0; i < sec.length; i++) {
      const s = sec[i];
      if (s.need !== "spot" || s.body !== NONE || run.secrets.found[i]) continue;
      if (Math.hypot(s.x - h.x, s.y - h.y) <= SECRET_R) foundSecret(run, SECRETS[run.level][i].id);
   }
}

// ---------- level 5: the Orbit Warden ----------

function bossMs(run: PodRun): void {
   const b = run.boss!;
   const ev = run.bossEv;
   const h = run.hero;
   const wasAlive = bossAlive(run);
   stepBoss(b, WARDEN, 1, ev);
   if (ev.telegraph) run.events.bossTelegraph = true;
   if (ev.attack) {
      run.events.bossAttack = true;
      if (b.phase === 0) {
         // a slow gravity mine where the hero is heading (it bends the arc)
         run.mineX = h.grounded ? h.x + 5 * Math.cos(h.angle) : h.x + h.vx * 1.2;
         run.mineY = h.grounded ? h.y + 5 * Math.sin(h.angle) : h.y + h.vy * 1.2;
         run.mineUntil = run.simMs + WARDEN_PLAY.mineMs;
         run.events.mine = true;
      }
   }
   if (run.pendingHits > 0 && bossVulnerable(run)) {
      const r = hitBoss(b, WARDEN, 1, ev);
      if (r !== "ignored") {
         run.pendingHits -= 1;
         run.events.bossHit = true;
         if (r === "phase") {
            run.events.bossPhase = true;
            run.pendingHits = 0;
         }
         if (r === "defeated") run.events.bossDefeated = true;
      }
   }
   if (wasAlive && !bossAlive(run)) {
      run.pendingHits = 0;
      run.mineUntil = NONE;
   }
}

// ---------- the trajectory preview (the HUD's dots and the bot's planner; pure, cheap) ----------

export interface ArcResult {
   /** 0 still in flight, 1 lands on a body, 2 leaves the map (lost), 3 knocked (a hazard), 4 reaches the dock */
   kind: number;
   body: number;
   /** the run ms it ends at, the landing's relative speed and surface angle */
   ms: number;
   speed: number;
   angle: number;
   orbs: number;
}

export function createArcResult(): ArcResult {
   return { kind: 0, body: NONE, ms: 0, speed: 0, angle: 0, orbs: 0 };
}

/**
 * The next `ms` of a free flight from (x, y, vx, vy) at run time t (5 ms steps, the dominant body's
 * gravity, moving bodies, level 5's mine; no jets): writes up to out.length / 2 points (x, y) and returns
 * how many; `result` says how it ends. With `orbHits` it marks the orbs it passes (uncollected only).
 */
export function predictArc(run: PodRun, x: number, y: number, vx: number, vy: number, t: number, ms: number, out: Float32Array | null, result: ArcResult, orbHits: Uint8Array | null = null, stepMs = 5, skipBody = NONE): number {
   const c = run.course;
   let n = 0;
   const cap = out ? out.length / 2 : 0;
   const dt = stepMs / 1000;
   const every = Math.max(1, Math.ceil(ms / stepMs / Math.max(1, cap)));
   result.kind = 0;
   result.body = NONE;
   result.orbs = 0;
   const boss = bossAlive(run);
   for (let k = 0; k * stepMs < ms; k++) {
      const now = t + k * stepMs;
      result.ms = now;
      gravityAt(run, x, y, now, G);
      vx += G.x * dt;
      vy += G.y * dt;
      const sp = Math.hypot(vx, vy);
      if (sp > c.vMax) {
         vx *= c.vMax / sp;
         vy *= c.vMax / sp;
      }
      const px = x;
      const py = y;
      x += vx * dt;
      y += vy * dt;
      if (out && k % every === 0 && n < cap) {
         out[n * 2] = x;
         out[n * 2 + 1] = y;
         n++;
      }
      if (orbHits) {
         for (let i = 0; i < c.orbs.length; i++) {
            if (run.collected[i] || orbHits[i]) continue;
            const o = c.orbs[i];
            if (Math.abs(o.x - x) > PICKUP.r || Math.abs(o.y - y) > PICKUP.r) continue;
            if (Math.hypot(o.x - x, o.y - y) <= PICKUP.r) {
               orbHits[i] = 1;
               result.orbs += o.kind === "main" ? 3 : 1;
            }
         }
      }
      for (let i = 0; i < c.bodies.length; i++) {
         if (i === skipBody && (k + 1) * stepMs < LIFTOFF_MS) continue;
         bodyAt(c, i, now, B);
         if (Math.hypot(x - B.x, y - B.y) <= c.bodies[i].R) {
            result.kind = 1;
            result.body = i;
            result.speed = Math.hypot(vx - B.vx, vy - B.vy);
            result.angle = Math.atan2(y - B.y, x - B.x);
            return n;
         }
      }
      if (!boss && Math.hypot(x - c.dock.x, y - c.dock.y) <= c.dock.r) {
         result.kind = 4;
         return n;
      }
      // the hazards a hero without powers would hit
      let hit = false;
      for (const f of c.flares) if (flareOn(f, now) && Math.hypot(x - f.x, y - f.y) <= f.r) hit = true;
      for (let i = 0; i < c.debris.length && !hit; i++) {
         debrisAt(c, i, now, P);
         if (Math.hypot(x - P.x, y - P.y) <= DEBRIS_R) hit = true;
      }
      for (let i = 0; i < c.gates.length && !hit; i++) {
         const g = c.gates[i];
         if (!run.gateDone[i] && Math.hypot(x - g.x, y - g.y) <= GATE.r && sp < GATE.speed) hit = true;
      }
      for (let i = 0; i < c.panels.length && !hit; i++) {
         const q = c.panels[i];
         if (!run.panelBroken[i] && Math.hypot(x - q.x, y - q.y) <= q.r) hit = true;
      }
      if (!hit && boss && beltActive(run)) {
         bodyAt(c, c.warden, now, B);
         const rr = c.bodies[c.warden].R * WARDEN_PLAY.beltK;
         const d1 = Math.hypot(px - B.x, py - B.y);
         const d2 = Math.hypot(x - B.x, y - B.y);
         if ((d1 - rr) * (d2 - rr) <= 0 && Math.abs(angleDiff(Math.atan2(y - B.y, x - B.x), beltGapAngle(now))) > WARDEN_PLAY.beltGapHalf) hit = true;
      }
      if (hit) {
         result.kind = 3;
         return n;
      }
      const bd = c.bounds;
      if (x < bd.minX || x > bd.maxX || y < bd.minY || y > bd.maxY) {
         result.kind = 2;
         return n;
      }
   }
   return n;
}

// ---------- solid boxes (the orbit camera) ----------

export interface SolidBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** No solid boxes: the camera floats in space (the bodies never come between it and the play plane). */
export function hallBoxes(): number {
   return 0;
}

// ---------- the store hand-off ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   gates: "gates",
   distance: "distance",
   finishMs: "finishMs",
   submitted: "submitted",
   hero: "hero",
   power: "power",
   speed: "speed",
   fuel: "fuel",
   charge: "charge",
   onPod: "onPod",
   lost: "lost",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossOn: "bossOn",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: Math.max(0, s.stats[STAT.submitted] ?? finishMs) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: no knock and never lost; on levels 1-2 also no jet fuel used (the card's bonus). */
export function badgeHits(run: PodRun): number {
   return run.knocks + run.losts + (run.level <= 2 && run.jetsUsedMs > 0 ? 1 : 0);
}
