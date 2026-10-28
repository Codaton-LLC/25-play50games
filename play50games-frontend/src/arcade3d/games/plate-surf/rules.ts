// Plate Surf rules (the design card's CARVE AND PUMP): ride a rolling wave along -z on a hero plate.
// Steer up and down its face (x, trough 0 to lip FACE_W); a hard down-carve through the glowing sweet
// band pumps +1.5 m/s (up to 24 m/s); without pumping you slow down and the curl behind you catches
// up (a heart and a respawn). At the lip, Jump airs; hold a direction in the air for a trick (spin,
// flip, grab): a landed trick links the flow meter and buys 1 s of curl buffer, a trick landed half
// done is a bail. Rocks wipe you out, buoys slow you, jellies, diving gulls and the violet storm
// spray sting you (Kiro's shield shrugs them off). Side lanes behind the reef (Riko's cracked walls,
// Vexa's ghost arches), Nami's high ledges, Zuno's hidden foam trails, checkpoints, orbs (a time
// bonus), the flow meter, secrets, the level 5 boss and the lower bound behind the server limits.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx passes the stick
// plus the orbit camera's yaw (StepInput.yaw); step() turns it camera-relative with core inputToWorld.
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time: the same ride at 30, 60 or 144 fps.
// No allocation after createRun(). README "Rules" and "Server limits" explain the proof.
import type { Vec3Like } from "@/arcade3d/core/collision";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DASH, DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { LEVELS, type SurfLevel } from "./levels";
import {
   BAND,
   FACE_W,
   LANE,
   LIP_W,
   buildDraft,
   faceY,
   type BuoyDef,
   type GateDef,
   type GullDef,
   type JellyDef,
   type LaneDef,
   type NarrowDef,
   type OrbDef,
   type RockDef,
   type SecretSpot,
   type SprayDef,
   type WaveDraft,
} from "./waves";
import { COMBO, COMBO_BASE_MS, KING_BREAKER, SECRETS, TRICK_LINKS } from "./progression";

// ---------- tuning (1 unit = 1 m, the ride runs along -z, up is +y) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const HERO = { radius: 0.35, height: 1.3 } as const;
/** speed along the wave (m/s): the start, the floor you slow to, the cap (the card: up to 24) */
export const V_START = 13;
export const V_MIN = 9;
export const V_MAX = 24;
/** a pump (the card: +1.5 m/s): a down-carve from above the band through it within PUMP_WINDOW_MS */
export const PUMP_GAIN = 1.5;
export const PUMP_WINDOW_MS = 600;
/** the face's drag: this fraction of the speed is lost per second while riding (none in the calm lanes) */
export const DRAG_K = 0.02;
/** steering across the face (m/s, m/s²); pulling back on the stick brakes (m/s²) */
export const V_CARVE = 9;
export const CARVE_ACC = 45;
export const BRAKE = 6;
/** an air off the lip: launch speed and gravity (apex AIR_H ≈ 1.69 m, about 0.75 s) */
export const V_AIR = 9;
export const G = 24;
export const AIR_H = (V_AIR * V_AIR) / (2 * G);
export const BUFFER_MS = 130;
/** a trick: a direction held this long in the air; landed short of it, a bail costs this much speed */
export const TRICK_MS = 320;
export const BAIL_LOSS = 4;
/** the curl: where it starts behind you, how close swallows you, how far back it ever falls, a respawn's gap, a landed trick's buffer (s) */
export const CURL = { startGap: 24, catch: 0.8, maxGap: 26, respawnGap: 26, trickS: 1 } as const;
/** hearts: a wipeout (the curl, a rock) costs one; each checkpoint gives one back */
export const HEARTS = 3;
export const LOST_MS = 1100;
export const SPAWN_MS = 600;
/** a buoy slows you (m/s); a sting (jelly, gull, spray, boss) slows you more, then a short grace */
export const KNOCK = { buoy: 3, sting: 5 } as const;
export const STING_GRACE_MS = 900;
export const BUOY_COOLDOWN_MS = 600;
/** orbs: pickup radius round the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 1.1, bonusMs: 250, centerY: 0.6 } as const;
export const SECRET_R = 1.3;
/** the pearl's hidden tube section: entered only at this speed */
export const TUBE_SPEED = 21;
export const BUOY_R = 0.7;
export const JELLY_R = 0.8;
export const GULL = { r: 1.7, telegraph: 0.45, dive: 0.8 } as const;
export const MINE_R = 1.2;
/** King Breaker: its lead ahead of you, its slow ride while open, its fastest move, its reach, where it rests */
export const CRAB = { lead: 20, slow: 10, chase: 60, hitR: 2.8, lipX: FACE_W - 1.2, rideX: 7.5, midX: 6, barrelR: 2.4, start: 40, exitGap: 28 } as const;
/** the boss hit needs: phase 2 a trick in progress at this speed, phase 3 a carve at this speed */
export const BOSS_SPEED = { eyes: 16, barrel: 17 } as const;
/** level 5: with the boss up the beach is held this far off, and the curl that far behind */
export const BLOCK = { gap: 30, curl: 14 } as const;
/** the barrel (phase 3) closes this much faster (m/s) */
export const BARREL_CURL = 2;

// ---------- the course ----------

export type { BuoyDef, GateDef, GullDef, JellyDef, LaneDef, NarrowDef, OrbDef, RockDef, SecretSpot, SprayDef };

export interface Course {
   level: LevelId;
   H: number;
   curlMps: number;
   durationMs: number;
   boss: boolean;
   orbs: OrbDef[];
   mainOrbs: number;
   buoys: BuoyDef[];
   rocks: RockDef[];
   jellies: JellyDef[];
   gates: GateDef[];
   gulls: GullDef[];
   sprays: SprayDef[];
   lanes: LaneDef[];
   narrows: NarrowDef[];
   /** checkpoint z in order (the start first) */
   checkpoints: number[];
   /** the level's secrets (progression.ts SECRETS order) */
   secrets: SecretSpot[];
   arches: number[];
   canyon: WaveDraft["canyon"];
   startZ: number;
   /** the lagoon / beach line: reaching it finishes (level 5: once the boss is down) */
   finishZ: number;
   /** level 5: King Breaker rises once the rider passes this z (NaN without a boss) */
   bossStartZ: number;
}

export function buildCourse(level: SurfLevel = LEVELS[1], script?: Parameters<typeof buildDraft>[1]): Course {
   const d = buildDraft(level, script);
   const secrets = SECRETS[level.id].map((s) => {
      const p = d.secrets[s.id];
      if (!p) throw new Error(`plate-surf L${level.id}: secret ${s.id} is not placed`);
      return p;
   });
   return {
      level: level.id,
      H: level.waveH,
      curlMps: level.curlMps,
      durationMs: level.durationMs,
      boss: level.boss,
      orbs: d.orbs,
      mainOrbs: d.orbs.filter((o) => o.kind === "main").length,
      buoys: d.buoys,
      rocks: d.rocks,
      jellies: d.jellies,
      gates: d.gates,
      gulls: d.gulls,
      sprays: d.sprays,
      lanes: d.lanes,
      narrows: d.narrows,
      checkpoints: [0, ...d.checkpoints],
      secrets,
      arches: d.arches,
      canyon: d.canyon,
      startZ: 0,
      finishZ: -level.length,
      bossStartZ: level.boss ? d.bossStart : Number.NaN,
   };
}

/** A jelly's x now (it drifts slowly across the trough). */
export function jellyX(j: JellyDef, ms: number): number {
   return j.x + 0.45 * Math.sin(ms / 900 + j.phase * 6.283);
}

/** A gull's beat 0..1: circling, its telegraph shadow from GULL.telegraph, the dive from GULL.dive. */
export function gullBeat(g: GullDef, ms: number): number {
   const t = ms / g.periodMs + g.phase;
   return t - Math.floor(t);
}

export function gullDiving(g: GullDef, ms: number): boolean {
   return gullBeat(g, ms) >= GULL.dive;
}

/** The ground under x: the flat sea in front of the wave (and the side lanes), the face, the crest. */
export function groundY(course: Course, x: number): number {
   return faceY(x, course.H);
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

/**
 * The least ms to reach the finish line by the z guard alone: every ms moves at most V_MAX / 1000 m
 * towards -z (the forward step is capped there and nothing else moves you forward: carving is along
 * x, knocks and bounces are along x, a respawn and the level 5 hold move you back), less 4 ms for a
 * step that started before the start line.
 */
export function progressFloorMs(course: Course): number {
   return Math.max(0, ((course.startZ - course.finishZ) * 1000) / V_MAX - 4);
}

/** The earliest rules ms King Breaker can be down: every vulnerable window hit at its first ms (menu2/boss). */
export function bossMinMs(): number {
   const s = createBoss(KING_BREAKER);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, KING_BREAKER, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, KING_BREAKER, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/**
 * The proven least finish ms: the z floor, and on level 5 the boss's floor too: it starts at the first
 * ms the rider passes bossStartZ (the z guard: at least that stretch at V_MAX, less 4 ms), and it
 * cannot be down before BOSS_MIN_MS of its own ms after that (less 2 ms for the start's own step).
 */
export function bossFloorMs(course: Course): number {
   if (!course.boss) return 0;
   return Math.max(0, ((course.startZ - course.bossStartZ) * 1000) / V_MAX - 4) + BOSS_MIN_MS - 2;
}

export function minFinishMs(course: Course): number {
   const z = progressFloorMs(course);
   return course.boss ? Math.max(z, bossFloorMs(course)) : z;
}

/** What the course can feed the flow meter: every orb, each gate's first pass, the first TRICK_LINKS landed tricks. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.gates.length, base: COMBO_BASE_MS.gate },
         { count: TRICK_LINKS, base: COMBO_BASE_MS.trick },
      ],
   };
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus. */
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

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms (94-100 % of it). */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}

// ---------- the run ----------

export type HeroState = "play" | "lost" | "spawn";
/** 0 none, 1 spin (left / right), 2 flip (back), 3 grab (forward) */
export type TrickKind = 0 | 1 | 2 | 3;
export const TRICK_NAMES = ["", "spin", "flip", "grab"] as const;

export interface Hero extends Vec3Like {
   x: number;
   y: number;
   z: number;
   /** across the face (m/s), vertical in the air (m/s), and the speed along the wave (m/s) */
   vx: number;
   vy: number;
   v: number;
   state: HeroState;
   grounded: boolean;
   timerMs: number;
   /** Nami's second air is still up this air */
   airJump: boolean;
   /** the trick held this air (TrickKind) and how long (ms) */
   trick: TrickKind;
   trickMs: number;
   /** the pump: armed above the band; the ms the down-carve crossed its top (NONE = not started) */
   pumpArmed: boolean;
   bandAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** a sting's grace runs through this ms */
   graceUntil: number;
   /** the side lane ridden (index into course.lanes), NONE on the face */
   inLane: number;
}

export interface StepInput {
   /**
    * The stick: screen-relative (moveX right, moveZ = the core's moveY, up = -1), turned into the world
    * by `yaw` (core inputToWorld). With yaw 0 (bots, tests) it is the world direction: +x climbs the
    * face, -z is along the ride. Tricks read the raw stick (left / right spin, back flip, forward grab).
    */
   moveX: number;
   moveZ: number;
   /** the camera's yaw (rad): the orbit camera's viewYaw (menu2/camera); 0 = world space */
   yaw: number;
   /** a jump press this frame (keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   jumpHeld: boolean;
   /** the hero power (E / Enter / the Power button), one press */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   /** a trick landed this step (TrickKind, 0 = none) */
   trick: TrickKind;
   bailed: boolean;
   pumped: boolean;
   /** a down-carve through the band that was too slow to pump */
   pumpMissed: boolean;
   orbCount: number;
   orbList: number[];
   gate: number;
   buoy: number;
   stung: boolean;
   /** a wipeout: the curl swallowed you (swallowed) or a rock */
   lost: boolean;
   swallowed: boolean;
   respawned: boolean;
   checkpoint: number;
   finished: boolean;
   timeup: boolean;
   /** out of hearts: the run ends "lose" */
   out: boolean;
   powered: boolean;
   dashed: boolean;
   wallBroken: number;
   bounced: boolean;
   laneEntered: number;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

export interface SurfRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   pressMs: number;
   actionMs: number;
   powerReadyAt: number;
   checkpoint: number;
   hearts: number;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   gatePassed: Uint8Array;
   /** 1 = this lane's cracked wall is broken */
   laneOpen: Uint8Array;
   buoyAt: Float64Array;
   combo: ComboState;
   trickLinks: number;
   tricks: number;
   pumps: number;
   secrets: SecretTracker;
   /** hearts lost; swallows = the curl's share (the no-hit badge: never swallowed) */
   hits: number;
   swallows: number;
   stings: number;
   respawns: number;
   /** the furthest along the ride (m, the HUD's distance) */
   bestDist: number;
   /** the curl's front (z): it chases from behind (+z) */
   curlZ: number;
   finishMs: number;
   ended: "win" | "timeup" | "lose" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   /** King Breaker's spot (z along the ride, x on the face), and whether it shows above the water */
   crab: { x: number; z: number; up: boolean };
   /** level 5: the boss has risen (the rider passed bossStartZ) */
   bossOn: boolean;
   /** phase 1's claw slam lane and phase 2's bubble mines (x, z pairs) */
   slam: { x: number; z: number; live: boolean };
   mines: Float64Array;
   minesLive: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false,
      airJumped: false,
      landed: false,
      trick: 0,
      bailed: false,
      pumped: false,
      pumpMissed: false,
      orbCount: 0,
      orbList: new Array<number>(32).fill(0),
      gate: NONE,
      buoy: NONE,
      stung: false,
      lost: false,
      swallowed: false,
      respawned: false,
      checkpoint: NONE,
      finished: false,
      timeup: false,
      out: false,
      powered: false,
      dashed: false,
      wallBroken: NONE,
      bounced: false,
      laneEntered: NONE,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.airJumped = false;
   ev.landed = false;
   ev.trick = 0;
   ev.bailed = false;
   ev.pumped = false;
   ev.pumpMissed = false;
   ev.orbCount = 0;
   ev.gate = NONE;
   ev.buoy = NONE;
   ev.stung = false;
   ev.lost = false;
   ev.swallowed = false;
   ev.respawned = false;
   ev.checkpoint = NONE;
   ev.finished = false;
   ev.timeup = false;
   ev.out = false;
   ev.powered = false;
   ev.dashed = false;
   ev.wallBroken = NONE;
   ev.bounced = false;
   ev.laneEntered = NONE;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

export const COURSE: Course = courseFor(1);

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];

/** Where a ride starts and respawns: the face's middle, a little above the band. */
export const SPAWN_X = 6.5;

function freshHero(course: Course, z: number): Hero {
   return {
      x: SPAWN_X,
      y: groundY(course, SPAWN_X),
      z,
      vx: 0,
      vy: 0,
      v: V_START,
      state: "play",
      grounded: true,
      timerMs: 0,
      airJump: true,
      trick: 0,
      trickMs: 0,
      pumpArmed: false,
      bandAt: NONE,
      dashUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      graceUntil: NONE,
      inLane: NONE,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): SurfRun {
   const course = courseFor(level);
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(course, course.startZ),
      pressMs: NONE,
      actionMs: NONE,
      powerReadyAt: 0,
      checkpoint: 0,
      hearts: HEARTS,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      gatePassed: new Uint8Array(course.gates.length),
      laneOpen: new Uint8Array(course.lanes.length),
      buoyAt: new Float64Array(course.buoys.length).fill(-1e9),
      combo: createCombo(),
      trickLinks: 0,
      tricks: 0,
      pumps: 0,
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      swallows: 0,
      stings: 0,
      respawns: 0,
      bestDist: 0,
      curlZ: course.startZ + CURL.startGap,
      finishMs: 0,
      ended: null,
      events: createEvents(),
      boss: course.boss ? createBoss(KING_BREAKER) : null,
      bossEv: createBossEvents(),
      bossOn: false,
      crab: { x: CRAB.lipX, z: course.boss ? course.bossStartZ - CRAB.start : course.startZ - CRAB.start, up: false },
      slam: { x: 0, z: 0, live: false },
      mines: new Float64Array(6),
      minesLive: false,
   };
}

/** The boss is still up (level 5, risen or not): the beach's bell cannot ring. */
export function bossAlive(run: Pick<SurfRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step !== "defeat" && b.step !== "done";
}

/** King Breaker can be hit right now (its eyes glow, the HUD bar pulses). */
export function bossVulnerable(run: Pick<SurfRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

/** The curl's speed now: the level's, the barrel's closing on level 5's last phase. */
export function curlSpeed(run: SurfRun): number {
   const b = run.boss;
   return run.course.curlMps + (b && b.phase === 2 && bossAlive(run) ? BARREL_CURL : 0);
}

/** How far the curl is behind the hero (m). */
export function curlGap(run: SurfRun): number {
   return run.curlZ - run.hero.z;
}

function tryPower(run: SurfRun, ms: number, mx: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   const ev = run.events;
   if (def.power === "dash") {
      // a dash carve: on the water only, a burst of speed (never past the top speed) and a push along the stick
      if (!h.grounded) return;
      h.v = Math.min(V_MAX, h.v + DASH.boost);
      const side = Math.abs(mx) > 0.25 ? Math.sign(mx) : h.vx !== 0 ? Math.sign(h.vx) : -1;
      h.vx = side * DASH.push;
      h.dashUntil = ms + POWER_MS.dash;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      ev.dashed = true;
      return;
   }
   if (def.power === "doubleAir") {
      if (h.grounded || !h.airJump) return;
      h.vy = V_AIR;
      h.airJump = false;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      ev.airJumped = true;
      ev.jumped = true;
      return;
   }
   if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

export function advanceClock(run: SurfRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const STICK = { x: 0, z: 0 };

/** The trick a raw (screen-relative) stick asks for in the air. */
export function trickOf(rawX: number, rawZ: number): TrickKind {
   if (Math.abs(rawX) >= 0.5) return 1;
   if (rawZ >= 0.5) return 2;
   if (rawZ <= -0.5) return 3;
   return 0;
}

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: SurfRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   const rawX = finite(input.moveX);
   const rawZ = finite(input.moveZ);
   let mx = rawX;
   let mz = rawZ;
   const yaw = finite(input.yaw);
   if (yaw !== 0) {
      inputToWorld(mx, mz, yaw, STICK);
      mx = STICK.x;
      mz = STICK.z;
   }
   const len = Math.sqrt(mx * mx + mz * mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }
   const trick = trickOf(rawX, rawZ);
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= run.course.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, mx, mz, trick);
      if (run.ended !== null) return ev;
   }
   return ev;
}

function tick(run: SurfRun, mx: number, mz: number, trick: TrickKind): void {
   const h = run.hero;
   if (run.boss) {
      if (!run.bossOn && h.z <= run.course.bossStartZ) run.bossOn = true;
      if (run.bossOn) bossMs(run);
   }
   comboTick(run.combo, COMBO, run.simMs);
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      if (h.timerMs <= 0) respawn(run);
      return;
   }
   if (h.state === "spawn") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      if (h.timerMs <= 0) h.state = "play";
      return;
   }
   playMs(run, mx, mz, trick);
}

const BOUNDS = { lo: 0, hi: FACE_W };

/** The rider's x bounds at z: the face, narrowed in the canyon; a side lane's approach and exit open the flat water. */
export function boundsAt(run: SurfRun, z: number, out: { lo: number; hi: number } = BOUNDS): { lo: number; hi: number } {
   const c = run.course;
   let lo = 0;
   let hi = FACE_W;
   for (let i = 0; i < c.narrows.length; i++) {
      const n = c.narrows[i];
      if (z <= n.z0 && z >= n.z1) {
         lo = Math.max(lo, n.lo);
         hi = Math.min(hi, n.hi);
      }
   }
   const h = run.hero;
   for (let i = 0; i < c.lanes.length; i++) {
      const l = c.lanes[i];
      if (h.inLane === i && z <= l.z0 && z >= l.z1) {
         out.lo = LANE.x0;
         out.hi = LANE.x1;
         return out;
      }
      // the approach: the shallows open in front of the wave, down to the lane's mouth
      if (z > l.z0 && z <= l.z0 + LANE.ramp) lo = Math.min(lo, (LANE.x0 * (l.z0 + LANE.ramp - z)) / LANE.ramp);
      // the exit: the shallows close again and push you back onto the face
      if (z < l.z1 && z >= l.z1 - LANE.ramp) lo = Math.min(lo, (LANE.x0 * (z - (l.z1 - LANE.ramp))) / LANE.ramp);
   }
   out.lo = lo;
   out.hi = hi;
   return out;
}

function sting(run: SurfRun, ms: number): void {
   const h = run.hero;
   h.v = Math.max(V_MIN, h.v - KNOCK.sting);
   h.graceUntil = ms + STING_GRACE_MS;
   run.stings += 1;
   comboBreak(run.combo);
   run.events.stung = true;
}

function linkCombo(run: SurfRun, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

function playMs(run: SurfRun, mx: number, mz: number, trick: TrickKind): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const ms = run.simMs;
   if (run.pressMs !== NONE && ms - run.pressMs > BUFFER_MS) run.pressMs = NONE;
   if (run.actionMs !== NONE) {
      tryPower(run, ms, mx);
      run.actionMs = NONE;
   }
   const prevX = h.x;
   const prevZ = h.z;
   const b = boundsAt(run, h.z);
   if (h.grounded) {
      // steer across the face
      let target = mx * V_CARVE;
      if (h.dashUntil >= ms) target = h.vx;
      const dv = target - h.vx;
      const step = CARVE_ACC / 1000;
      h.vx += dv > step ? step : dv < -step ? -step : dv;
      // pulling back (towards the camera's side of the ride, more back than across) brakes
      if (mz > 0.5 && mz > Math.abs(mx)) h.v = Math.max(V_MIN, h.v - (BRAKE * mz) / 1000);
      if (h.inLane === NONE) h.v = Math.max(V_MIN, h.v - (DRAG_K * h.v) / 1000);
      h.x += h.vx / 1000;
      if (h.x < b.lo) {
         h.x = b.lo;
         if (h.vx < 0) h.vx = 0;
      } else if (h.x > b.hi) {
         h.x = b.hi;
         if (h.vx > 0) h.vx = 0;
      }
      h.y = groundY(c, h.x);
      // the pump: from above the band, a down-carve through it inside the window
      if (h.inLane === NONE) {
         if (h.x >= BAND.hi) {
            h.pumpArmed = true;
            h.bandAt = NONE;
         } else if (prevX >= BAND.hi && h.pumpArmed) h.bandAt = ms;
         if (prevX >= BAND.lo && h.x < BAND.lo && h.bandAt !== NONE) {
            if (ms - h.bandAt <= PUMP_WINDOW_MS) {
               h.v = Math.min(V_MAX, h.v + PUMP_GAIN);
               run.pumps += 1;
               ev.pumped = true;
            } else ev.pumpMissed = true;
            h.bandAt = NONE;
            h.pumpArmed = false;
         }
      }
      // an air off the lip
      if (run.pressMs !== NONE && h.inLane === NONE && h.x >= FACE_W - LIP_W) {
         run.pressMs = NONE;
         h.grounded = false;
         h.vy = V_AIR;
         h.vx = Math.max(-2, Math.min(0.8, h.vx));
         h.airJump = true;
         h.trick = 0;
         h.trickMs = 0;
         ev.jumped = true;
      }
   } else {
      h.vy -= G / 1000;
      h.y += h.vy / 1000;
      h.x += h.vx / 1000;
      if (h.x < b.lo) h.x = b.lo;
      if (h.x > b.hi + 0.8) h.x = b.hi + 0.8;
      if (trick !== 0) {
         if (h.trick === 0) h.trick = trick;
         if (trick === h.trick) h.trickMs += 1;
      }
      const gy = groundY(c, Math.min(h.x, FACE_W));
      if (h.vy < 0 && h.y <= gy) {
         if (h.x > b.hi) h.x = b.hi;
         h.y = groundY(c, h.x);
         h.grounded = true;
         h.vy = 0;
         ev.landed = true;
         h.pumpArmed = h.x >= BAND.hi;
         h.bandAt = NONE;
         if (h.trick !== 0) {
            if (h.trickMs >= TRICK_MS) {
               ev.trick = h.trick;
               run.tricks += 1;
               run.curlZ += curlSpeed(run) * CURL.trickS;
               if (run.trickLinks < TRICK_LINKS) {
                  run.trickLinks += 1;
                  linkCombo(run, COMBO_BASE_MS.trick);
               }
            } else {
               h.v = Math.max(V_MIN, h.v - BAIL_LOSS);
               comboBreak(run.combo);
               ev.bailed = true;
            }
         }
         h.trick = 0;
         h.trickMs = 0;
      }
   }
   // forward along the wave: the z guard (the proof's one rule)
   const v = h.v > V_MAX ? V_MAX : h.v;
   h.z -= v / 1000;
   // the side lanes' walls: crossing a lane's mouth below the ridge
   for (let i = 0; i < c.lanes.length; i++) {
      const l = c.lanes[i];
      if (!(prevZ > l.z0 && h.z <= l.z0)) continue;
      if (h.x >= 0) continue;
      if (h.x > LANE.x1 + 0.2) {
         h.x = 0;
         continue;
      }
      const pass = l.kind === "cracked" ? run.laneOpen[i] === 1 || h.dashUntil >= ms : ms <= h.phaseUntil;
      if (pass) {
         if (l.kind === "cracked" && run.laneOpen[i] === 0) {
            run.laneOpen[i] = 1;
            ev.wallBroken = i;
         }
         h.inLane = i;
         ev.laneEntered = i;
      } else {
         h.x = 0.4;
         h.vx = 6;
         h.v = Math.max(V_MIN, h.v - 3);
         ev.bounced = true;
      }
   }
   if (h.inLane !== NONE && h.z < c.lanes[h.inLane].z1) h.inLane = NONE;
   const dist = c.startZ - h.z;
   if (dist > run.bestDist) run.bestDist = dist;
   // level 5: King Breaker holds the beach until it is down
   if (c.boss && bossAlive(run) && h.z < c.finishZ + BLOCK.gap) {
      h.z = c.finishZ + BLOCK.gap;
      if (run.curlZ < h.z + BLOCK.curl) run.curlZ = h.z + BLOCK.curl;
   }
   contacts(run, ms, prevZ);
   if (h.state !== "play" || run.ended !== null) return;
   // checkpoints: passing a beacon; each one gives a heart back
   while (run.checkpoint + 1 < c.checkpoints.length && h.z <= c.checkpoints[run.checkpoint + 1]) {
      run.checkpoint += 1;
      run.hearts = Math.min(HEARTS, run.hearts + 1);
      ev.checkpoint = run.checkpoint;
   }
   // the curl chases you; it never falls further behind than CURL.maxGap
   run.curlZ -= curlSpeed(run) / 1000;
   if (run.curlZ > h.z + CURL.maxGap) run.curlZ = h.z + CURL.maxGap;
   if (run.curlZ - h.z <= CURL.catch) {
      lose(run, true);
      return;
   }
   if (h.z <= c.finishZ && !bossAlive(run)) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function near(dx: number, dz: number, r: number): boolean {
   return dx * dx + dz * dz <= r * r;
}

/** Everything the hero touches this ms: orbs, gates, secrets, hazards, the boss. */
function contacts(run: SurfRun, ms: number, prevZ: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const cy = h.y + ORB.centerY;
   const magnet = ms <= h.magnetUntil;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   const orbs = c.orbs;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      const dz = o.z - h.z;
      if (dz > reach || dz < -reach) continue;
      if (o.hidden && !magnet) continue;
      const dx = o.x - h.x;
      const dy = o.y - cy;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.kind === "main") run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount] = i;
      ev.orbCount += 1;
      linkCombo(run, COMBO_BASE_MS.orb);
   }
   for (let i = 0; i < c.gates.length; i++) {
      const g = c.gates[i];
      if (!(prevZ > g.z && h.z <= g.z)) continue;
      const dx = g.x - h.x;
      const dy = g.y - cy;
      if (dx * dx + dy * dy > g.r * g.r) continue;
      if (run.gatePassed[i]) continue;
      run.gatePassed[i] = 1;
      ev.gate = i;
      linkCombo(run, COMBO_BASE_MS.gate);
   }
   for (let i = 0; i < c.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = c.secrets[i];
      const dz = s.z - h.z;
      if (dz > SECRET_R || dz < -SECRET_R) continue;
      const dx = s.x - h.x;
      const dy = s.y - cy;
      if (dx * dx + dy * dy + dz * dz > SECRET_R * SECRET_R) continue;
      if (s.need === "speed" && h.v < TUBE_SPEED) continue;
      if (collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
         ev.secretCount += 1;
      }
   }
   // rocks: a wipeout (a heart and a respawn), unless you are in the air above them
   for (let i = 0; i < c.rocks.length; i++) {
      const r = c.rocks[i];
      const dz = r.z - h.z;
      const rr = r.r + HERO.radius;
      if (dz > rr || dz < -rr) continue;
      if (!near(r.x - h.x, dz, rr)) continue;
      if (h.y > groundY(c, r.x) + r.r * 1.1) continue;
      lose(run, false);
      return;
   }
   for (let i = 0; i < c.buoys.length; i++) {
      const bu = c.buoys[i];
      const dz = bu.z - h.z;
      const rr = BUOY_R + HERO.radius;
      if (dz > rr || dz < -rr) continue;
      if (ms - run.buoyAt[i] < BUOY_COOLDOWN_MS) continue;
      if (!near(bu.x - h.x, dz, rr)) continue;
      if (h.y > groundY(c, bu.x) + 1.6) continue;
      run.buoyAt[i] = ms;
      h.v = Math.max(V_MIN, h.v - KNOCK.buoy);
      const side = h.x >= bu.x ? 1 : -1;
      h.x += side * 0.5;
      h.vx = side * 4;
      comboBreak(run.combo);
      ev.buoy = i;
   }
   const shield = ms <= h.shieldUntil;
   if (shield || ms <= h.graceUntil) {
      bossContact(run, ms);
      return;
   }
   for (let i = 0; i < c.jellies.length; i++) {
      const j = c.jellies[i];
      const dz = j.z - h.z;
      const rr = JELLY_R + HERO.radius;
      if (dz > rr || dz < -rr) continue;
      const jx = jellyX(j, ms);
      if (!near(jx - h.x, dz, rr)) continue;
      if (h.y > groundY(c, jx) + 1.2) continue;
      sting(run, ms);
      return;
   }
   for (let i = 0; i < c.sprays.length; i++) {
      const s = c.sprays[i];
      if (h.z > s.z0 || h.z < s.z1 || h.x < s.x0) continue;
      if (h.y > groundY(c, h.x) + 3.5) continue;
      sting(run, ms);
      h.x = s.x0 - 0.4;
      h.vx = -5;
      if (!h.grounded) {
         h.y = Math.max(h.y, groundY(c, h.x));
      }
      return;
   }
   for (let i = 0; i < c.gulls.length; i++) {
      const g = c.gulls[i];
      const dz = g.z - h.z;
      if (dz > GULL.r || dz < -GULL.r) continue;
      if (!gullDiving(g, ms)) continue;
      if (!near(g.x - h.x, dz, GULL.r)) continue;
      sting(run, ms);
      return;
   }
   bossContact(run, ms);
}

/** Level 5: the boss's machine and its moves, one ms (rules time; the menu2/boss machine). */
function bossMs(run: SurfRun): void {
   const b = run.boss!;
   const ev = run.bossEv;
   const h = run.hero;
   const c = run.course;
   const before = b.step;
   stepBoss(b, KING_BREAKER, 1, ev);
   if (ev.telegraph) {
      run.events.bossTelegraph = true;
      const atk = KING_BREAKER.phases[b.phase].attacks[0];
      if (b.phase === 0) {
         // the claw comes down where you will be, in your lane: its shadow shows for the telegraph
         run.slam.x = Math.max(2.5, Math.min(FACE_W - 1.5, h.x));
         run.slam.z = h.z - (h.v * (atk.telegraphMs + atk.attackMs * 0.5)) / 1000;
         run.slam.live = true;
      } else if (b.phase === 1) {
         // bubble mines across the lower lanes, ahead of you: the high line stays open
         const z = h.z - (h.v * 1600) / 1000;
         const xs = [2.6, 5.2, 7.8];
         for (let k = 0; k < 3; k++) {
            run.mines[k * 2] = xs[k];
            run.mines[k * 2 + 1] = z - k * 2.5;
         }
         run.minesLive = true;
      }
   }
   if (ev.attack) run.events.bossAttack = true;
   if (before === "attack" && b.step !== "attack") {
      run.slam.live = false;
      run.minesLive = false;
   }
   if (b.step === "transition" || b.step === "defeat" || b.step === "done") {
      run.slam.live = false;
      run.minesLive = false;
   }
   // where it rides: ahead of you; while open it slows so you can catch it; never past the beach's exit
   const crab = run.crab;
   if (b.step === "vulnerable") {
      // it slows so you can catch it; once you are past it, it trails just behind (the window is missed)
      crab.z -= CRAB.slow / 1000;
      if (crab.z > h.z + 3) crab.z = h.z + 3;
   } else {
      const target = h.z - CRAB.lead;
      const d = target - crab.z;
      const m = CRAB.chase / 1000;
      crab.z += d > m ? m : d < -m ? -m : d;
   }
   if (crab.z < c.finishZ + CRAB.exitGap) crab.z = c.finishZ + CRAB.exitGap;
   // the barrel: the face's middle; phases 1-2: up on the lip while it can be hit, lower on the face while it attacks
   if (b.phase === 2) crab.x = CRAB.midX;
   else crab.x = b.step === "vulnerable" ? CRAB.lipX : CRAB.rideX;
   // phase 2 burrows: it shows only while it surfaces (the vulnerable window)
   crab.up = b.step !== "done" && !(b.phase === 1 && b.step !== "vulnerable" && b.step !== "transition");
}

function applyHit(run: SurfRun): void {
   const r = hitBoss(run.boss!, KING_BREAKER, 1, run.bossEv);
   if (r === "ignored") return;
   run.events.bossHit = true;
   if (r === "phase") run.events.bossPhase = true;
   if (r === "defeated") run.events.bossDefeated = true;
}

/** Level 5: the claw slam, the mines, the barrel block, and the hits (shield / grace skip the hazards). */
function bossContact(run: SurfRun, ms: number): void {
   const b = run.boss;
   if (!b || !run.bossOn) return;
   const h = run.hero;
   if (h.state !== "play") return;
   const safe = ms <= h.shieldUntil || ms <= h.graceUntil;
   if (b.step === "attack" && !safe) {
      if (b.phase === 0 && run.slam.live && h.grounded && Math.abs(h.x - run.slam.x) <= 1.8 && Math.abs(h.z - run.slam.z) <= 3.5) {
         sting(run, ms);
         return;
      }
      if (b.phase === 1 && run.minesLive) {
         for (let k = 0; k < 3; k++) {
            if (near(run.mines[k * 2] - h.x, run.mines[k * 2 + 1] - h.z, MINE_R + HERO.radius) && h.y < groundY(run.course, h.x) + 1.4) {
               sting(run, ms);
               return;
            }
         }
      }
      if (b.phase === 2 && Math.abs(h.x - run.crab.x) <= 2.2 && Math.abs(h.z - run.crab.z) <= 4) {
         sting(run, ms);
         return;
      }
   }
   if (b.step !== "vulnerable" || b.hp <= 0) return;
   const dx = h.x - run.crab.x;
   const dz = h.z - run.crab.z;
   if (b.phase === 0) {
      if (!h.grounded && Math.abs(dx) <= CRAB.hitR && Math.abs(dz) <= CRAB.hitR) applyHit(run);
   } else if (b.phase === 1) {
      if (!h.grounded && h.trick !== 0 && h.v >= BOSS_SPEED.eyes && Math.abs(dx) <= CRAB.hitR && Math.abs(dz) <= CRAB.hitR) applyHit(run);
   } else if (h.grounded && h.v >= BOSS_SPEED.barrel && Math.abs(dx) <= CRAB.barrelR && Math.abs(dz) <= CRAB.barrelR) applyHit(run);
}

/** A wipeout: a heart; out of hearts the run ends "lose", else the tumble then the last checkpoint. */
function lose(run: SurfRun, swallowed: boolean): void {
   const h = run.hero;
   run.hits += 1;
   if (swallowed) run.swallows += 1;
   run.hearts -= 1;
   comboBreak(run.combo);
   run.events.lost = true;
   run.events.swallowed = swallowed;
   h.grounded = false;
   h.vy = 3;
   h.vx = 0;
   h.dashUntil = NONE;
   h.trick = 0;
   h.trickMs = 0;
   h.inLane = NONE;
   if (run.hearts <= 0) {
      run.hearts = 0;
      run.ended = "lose";
      run.events.out = true;
      return;
   }
   h.state = "lost";
   h.timerMs = LOST_MS;
}

/** Back on the last checkpoint at the start speed, the curl a respawn gap behind, frozen for SPAWN_MS. */
function respawn(run: SurfRun): void {
   const c = run.course;
   const z = c.checkpoints[run.checkpoint];
   const fresh = freshHero(c, z);
   const h = run.hero;
   h.x = fresh.x;
   h.y = fresh.y;
   h.z = z;
   h.vx = 0;
   h.vy = 0;
   h.v = V_START;
   h.grounded = true;
   h.airJump = true;
   h.trick = 0;
   h.trickMs = 0;
   h.pumpArmed = false;
   h.bandAt = NONE;
   h.dashUntil = NONE;
   h.inLane = NONE;
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.curlZ = z + CURL.respawnGap;
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- solid boxes (for the orbit camera's collision, menu2/camera) ----------

export interface SolidBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** The wave's body (steps under the face, so the camera stays in front of it) and the sea: about `z`, ±reach. */
export function waveBoxes(course: Course, z: number, reach: number, out: SolidBox[]): number {
   let n = 0;
   const put = (minX: number, maxX: number, minY: number, maxY: number) => {
      const b = out[n] ?? (out[n] = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
      b.minX = minX;
      b.maxX = maxX;
      b.minY = minY;
      b.maxY = maxY;
      b.minZ = z - reach;
      b.maxZ = z + reach;
      n += 1;
   };
   // under the sea
   put(-80, 80, -40, -0.25);
   // the face in 2 m steps, each box topped by the face's height at its near edge (it never pokes out)
   for (let x = 2; x < FACE_W; x += 2) put(x, x + 2, -40, faceY(x, course.H) - 0.25);
   // the crest and the back of the wave
   put(FACE_W, FACE_W + 30, -40, course.H - 0.25);
   return n;
}

/** The rocks as boxes (static). */
export function rockBoxes(course: Course): SolidBox[] {
   return course.rocks.map((r) => ({ minX: r.x - r.r, maxX: r.x + r.r, minY: 0, maxY: faceY(r.x, course.H) + r.r * 1.1, minZ: r.z - r.r, maxZ: r.z + r.r }));
}

// ---------- the store hand-off (README "Scoring") ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   distance: "distance",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   hearts: "hearts",
   hero: "hero",
   power: "power",
   /** speed along the wave, tenths of m/s */
   speed: "speed",
   /** the curl's gap (m) */
   curl: "curl",
   tricks: "tricks",
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

/** The run time a player sees and submits: play ms minus the orb bonus and the flow bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge of this game (the card): never swallowed by the curl. */
export function badgeHits(run: SurfRun): number {
   return run.swallows;
}
