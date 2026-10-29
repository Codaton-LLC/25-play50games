// Color Rail Grind rules (the design card's SWITCH-ROUTING): the hero grinds the workshop's toy train
// line automatically along -z. Left / Right hop to an adjacent parallel rail (only where one runs), Up
// jumps (gaps, grind rings), Down crouches (+3 m/s downhill, not on frozen rails). A track switch ahead
// lights up 1.5 s before it: the Switch press (or a tap on the view) throws it, and the hero (or a toy
// train) passing it takes the branch: an orb branch, a shortcut, a dead end with a buffer stop (a bonk:
// 3 s lost), a hero gate (Riko's barrier spur, Vexa's ghost door), level 2's golden caboose (two
// switches in a second). Level 3's rails are frozen (20 % faster, no crouch) and its frozen switches
// need a jump-stomp. Level 4's toy trains drive the network and follow the switches too: send them
// off your line, or hop. A missed gap drops the hero into the hook (2 s lost); nothing is fatal.
// Level 5: the Clockwork Express (menu2/boss): route it into buffers, dodge its wagons and charge on
// rings, then ride its roof and stomp its key.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time: the same run at 30, 60 or 144 fps.
// README "Rules" and "Server limits" explain the proof.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { LEVELS, type RailLevel } from "./levels";
import {
   BRANCH,
   BRANCH_OUT,
   END,
   GRID,
   HALF,
   HAZ,
   HIGH_Y,
   LANES,
   LANE_W,
   NONE,
   bendOf,
   buildNetwork,
   laneX,
   railX,
   type HazardDef,
   type Junction,
   type LoopDef,
   type OrbDef,
   type Piece,
   type RingDef,
   type SecretSpot,
   type SlopeDef,
   type TrainDef,
} from "./network";
import { ARENA_LINKS, CLOCKWORK, COMBO, COMBO_BASE_MS, SECRETS } from "./progression";

export { NONE, LANES, GRID, LANE_W, HALF, HIGH_Y, BRANCH, END, HAZ, laneX, railX, bendOf };
export type { HazardDef, Junction, LoopDef, OrbDef, Piece, RingDef, SecretSpot, SlopeDef, TrainDef };

// ---------- tuning ----------

export const MAX_STEP_MS = 50;
export const HERO = { height: 1.3, crouchHeight: 0.8 } as const;
/** frozen rails: this times the level's speed */
export const FROZEN = 1.2;
/** every boost on top of the base speed is capped at this (m/s) */
export const BOOST_CAP = 6;
/** the boosts (m/s): crouching downhill, the loop */
export const CROUCH_BOOST = 3;
export const LOOP_BOOST = 6;
export const CROUCH_MS = 900;
/** a hop to the next rail takes 0.35 s (the card) */
export const HOP_MS = 350;
export const LANE_V = LANE_W / (HOP_MS / 1000);
/** a jump (apex about 1.29 m, 0.61 s); Nami's second jump (up onto the high rails at HIGH_Y) */
export const V_JUMP = 8.5;
export const V_JUMP2 = 10;
export const G = 28;
export const JUMP_BUFFER_MS = 130;
/** a frozen switch's stomp: the hero slams down */
export const V_STOMP = -16;
/** Riko's dash in the air: it holds him up this long (the long gap) */
export const DASH_HANG = 0.42;
/** a switch lights up this long before the hero reaches it (the card: 1.5 s); a switch thrown less than SKIP_MS ago is skipped (the next press goes to the switch after it) */
export const HIGHLIGHT_MS = 1500;
export const SKIP_MS = 600;
/** bonks: a buffer stop (the card: 3 s), a train, a barrier or a ghost door */
export const BONK_MS = { buffer: 3000, bump: 1500 } as const;
/** a missed gap: the hook carries the hero across in this long */
export const HOOK_MS = 2000;
/** a stumble (an icicle): half speed for 0.7 s */
export const STUMBLE = { factor: 0.5, ms: 700 } as const;
/** pickups: radius round the hero's middle, the middle over the feet */
export const PICKUP = { r: 1.1, centerY: 0.6 } as const;
export const SECRET_R = 3.2;
/** a ring is passed by anything lower than this over its rail */
export const RING_TOP = 2.4;
/** time off the submitted time: per orb, per ring, and the relight bonus (90 %+ of the run on the rails) */
export const BONUS_MS = { orb: 150, ring: 100, relight: 1500 } as const;
export const RELIGHT_AT = 0.9;
/** level 4's toy trains: they bump a hero within this of them on the same rail (and lower than its roof) */
export const TRAIN = { half: 2.6, roof: 1.25 } as const;

/** Level 5's arena: a section every `spacing` m; at most `max` of them. */
export const ARENA = { lead: 40, spacing: 45, max: 80, spur: 22 } as const;
/** the Express's lead ahead of the hero per phase (m), its top chase speed is the level's vMax */
export const EXPRESS = { lead: [32, 26, 2], roofY: 2.5, rampV: 13 } as const;
/** after the defeat the finish gate stands this far ahead */
export const GATE_AHEAD = 45;

/** How a switch was met (run.junctionResult): 0 not yet, 1 straight on, 2 the branch. */
export const SWITCHED = { pending: 0, straight: 1, branch: 2 } as const;

// ---------- the course ----------

export interface Course {
   level: LevelId;
   speed: number;
   vMax: number;
   durationMs: number;
   boss: boolean;
   pieces: Piece[];
   /** per lane and tier: the pieces sorted by z0 (lane * 2 + tier) */
   byLane: Piece[][];
   junctions: Junction[];
   orbs: OrbDef[];
   mainOrbs: number;
   rings: RingDef[];
   hazards: HazardDef[];
   loops: LoopDef[];
   slopes: SlopeDef[];
   trains: TrainDef[];
   secrets: SecretSpot[];
   half: number;
   startZ: number;
   finishZ: number;
   bossStartZ: number;
}

export function buildCourse(level: RailLevel = LEVELS[1]): Course {
   const d = buildNetwork(level);
   const secrets = SECRETS[level.id].map((s) => {
      const p = d.secrets[s.id];
      if (!p) throw new Error(`color-rail-grind L${level.id}: secret ${s.id} is not placed`);
      return p;
   });
   const byLane: Piece[][] = [];
   for (let k = 0; k < LANES * 2; k++) byLane.push([]);
   for (const p of d.pieces) byLane[p.lane * 2 + p.tier].push(p);
   for (const list of byLane) list.sort((a, b) => b.z0 - a.z0);
   const frozen = d.pieces.some((p) => p.frozen);
   return {
      level: level.id,
      speed: level.speed,
      vMax: level.speed * (frozen ? FROZEN : 1) + BOOST_CAP,
      durationMs: level.durationMs,
      boss: level.boss,
      pieces: d.pieces,
      byLane,
      junctions: d.junctions,
      orbs: d.orbs,
      mainOrbs: d.orbs.filter((o) => o.kind === "main").length,
      rings: d.rings,
      hazards: d.hazards,
      loops: d.loops,
      slopes: d.slopes,
      trains: d.trains,
      secrets,
      half: HALF,
      startZ: d.startZ,
      finishZ: d.finishZ,
      bossStartZ: d.bossStartZ,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** The piece on (lane, tier) under z, or null. A grid rail only (no branch) when `grid`. */
export function pieceAt(c: Course, lane: number, tier: number, z: number, grid = false): Piece | null {
   if (lane < 0 || lane >= LANES) return null;
   for (const p of c.byLane[lane * 2 + tier]) {
      if (p.z0 < z) break;
      if (z > p.z1 && (!grid || p.side === 0)) return p;
   }
   return null;
}

// ---------- the bounds (README "Server limits and why they hold") ----------

/**
 * The least ms to the finish line by the z guard: every ms moves the hero at most vMax / 1000 m towards
 * -z (the forward step is capped there; hops are along x; the hook carries it slower; a bonk stops it;
 * on the Express's roof it moves with the Express, whose chase is capped at vMax), less 4 ms.
 */
export function progressFloorMs(course: Course): number {
   return Math.max(0, ((course.startZ - course.finishZ) * 1000) / course.vMax - 4);
}

export function bossMinMs(): number {
   const s = createBoss(CLOCKWORK);
   const ev = createBossEvents();
   for (let ms = 1; ms < 900_000; ms++) {
      stepBoss(s, CLOCKWORK, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, CLOCKWORK, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

export function bossFloorMs(course: Course): number {
   if (!course.boss) return 0;
   return Math.max(0, ((course.startZ - course.bossStartZ) * 1000) / course.vMax - 4) + BOSS_MIN_MS - 2;
}

export function minFinishMs(course: Course): number {
   const z = progressFloorMs(course);
   return course.boss ? Math.max(z, bossFloorMs(course)) : z;
}

/** What the course can feed the flow meter: every orb, every ring, each static switch once, the first ARENA_LINKS arena events. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.rings.length + (course.boss ? ARENA_LINKS : 0), base: COMBO_BASE_MS.ring },
         { count: course.junctions.length, base: COMBO_BASE_MS.switch },
      ],
   };
}

/** The most time off: every orb, every ring (level 5: plus its capped arena rings), the relight bonus, the most flow. */
export function maxBonusMs(course: Course): number {
   return course.orbs.length * BONUS_MS.orb + (course.rings.length + (course.boss ? ARENA_LINKS : 0)) * BONUS_MS.ring + BONUS_MS.relight + comboMaxBonus(comboSpecOf(course));
}

export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - maxBonusMs(course);
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
   z: number;
   vy: number;
   /** the rail it is on (or heads for) and the piece under it (NONE in the air) */
   lane: number;
   piece: number;
   tier: number;
   grounded: boolean;
   airJump: boolean;
   crouchUntil: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   stumbleUntil: number;
   loopUntil: number;
   /** a bonk: stopped until; the hook: carried across a gap until, at hookV m/ms */
   bonkUntil: number;
   hookUntil: number;
   hookV: number;
   /** level 5: riding the Express's roof */
   roof: boolean;
   v: number;
}

export interface StepInput {
   left: boolean;
   right: boolean;
   up: boolean;
   down: boolean;
   jumpPressed: boolean;
   /** E / Enter / the Action button: throws the lit switch, else the hero power */
   actionPressed: boolean;
   /** a tap on the view: always the switch */
   switchPressed: boolean;
   /** the camera's yaw (rad): hops are camera-relative */
   yaw: number;
}

export function createStepInput(): StepInput {
   return { left: false, right: false, up: false, down: false, jumpPressed: false, actionPressed: false, switchPressed: false, yaw: 0 };
}

export interface StepEvents {
   hopped: boolean;
   hopBlocked: boolean;
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   crouched: boolean;
   /** a switch thrown this step (index; arena switches are 1000 + section), frozen and not stomped */
   thrown: number;
   frozenClunk: boolean;
   /** a switch passed this step and how (SWITCHED.*) */
   junction: number;
   junctionResult: number;
   merged: boolean;
   bonked: boolean;
   bonkKind: number;
   hooked: boolean;
   stumbled: boolean;
   smashed: boolean;
   phased: boolean;
   looped: boolean;
   orbCount: number;
   orbList: number[];
   ringCount: number;
   ringList: number[];
   powered: boolean;
   dashed: boolean;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   trainCrashed: number;
   finished: boolean;
   timeup: boolean;
   /** level 5 */
   expressCrashed: boolean;
   wagonDropped: boolean;
   launched: boolean;
   roofLanded: boolean;
   stomped: boolean;
   knockedOff: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

function createEvents(): StepEvents {
   return {
      hopped: false,
      hopBlocked: false,
      jumped: false,
      airJumped: false,
      landed: false,
      crouched: false,
      thrown: NONE,
      frozenClunk: false,
      junction: NONE,
      junctionResult: 0,
      merged: false,
      bonked: false,
      bonkKind: 0,
      hooked: false,
      stumbled: false,
      smashed: false,
      phased: false,
      looped: false,
      orbCount: 0,
      orbList: new Array<number>(24).fill(0),
      ringCount: 0,
      ringList: [0, 0, 0, 0],
      powered: false,
      dashed: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      trainCrashed: NONE,
      finished: false,
      timeup: false,
      expressCrashed: false,
      wagonDropped: false,
      launched: false,
      roofLanded: false,
      stomped: false,
      knockedOff: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.hopped = false;
   ev.hopBlocked = false;
   ev.jumped = false;
   ev.airJumped = false;
   ev.landed = false;
   ev.crouched = false;
   ev.thrown = NONE;
   ev.frozenClunk = false;
   ev.junction = NONE;
   ev.junctionResult = 0;
   ev.merged = false;
   ev.bonked = false;
   ev.bonkKind = 0;
   ev.hooked = false;
   ev.stumbled = false;
   ev.smashed = false;
   ev.phased = false;
   ev.looped = false;
   ev.orbCount = 0;
   ev.ringCount = 0;
   ev.powered = false;
   ev.dashed = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.trainCrashed = NONE;
   ev.finished = false;
   ev.timeup = false;
   ev.expressCrashed = false;
   ev.wagonDropped = false;
   ev.launched = false;
   ev.roofLanded = false;
   ev.stomped = false;
   ev.knockedOff = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

/** The switches' states: shared by everyone on the network (versus: a switch you throw changes it for all). */
export interface SwitchBoard {
   thrown: Uint8Array;
   /** the ms each switch was last thrown (the skip window) */
   at: Float64Array;
}

export function createSwitchBoard(course: Course): SwitchBoard {
   return { thrown: new Uint8Array(course.junctions.length), at: new Float64Array(course.junctions.length).fill(-1e9) };
}

/** A toy train (level 4) or a dropped wagon (level 5) on a rail. */
export interface TrainState {
   lane: number;
   piece: number;
   x: number;
   z: number;
   /** its speed along -z (m/s; negative rolls back towards the hero) */
   speed: number;
   live: boolean;
   crashMs: number;
   started: boolean;
}

export interface RailRun {
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
   switchMs: number;
   powerReadyAt: number;
   board: SwitchBoard;
   junctionResult: Int8Array;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   ringsHit: Uint8Array;
   rings: number;
   hazardHit: Uint8Array;
   loopDone: Uint8Array;
   combo: ComboState;
   arenaLinks: number;
   secrets: SecretTracker;
   bonks: number;
   falls: number;
   stumbles: number;
   switchesThrown: number;
   /** ms on the rails (the relight: grounded, not bonked, not hooked) */
   railMs: number;
   finishMs: number;
   finishGate: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   trains: TrainState[];
   /** level 5 */
   boss: BossState | null;
   bossEv: BossEvents;
   bossOn: boolean;
   pendingHits: number;
   express: { lane: number; x: number; z: number; crashMs: number; diverted: boolean };
   /** the Express's speed this ms (m/s; the hero on its roof moves with it) */
   expressV: number;
   arenaSpawned: number;
   arenaZ: Float64Array;
   arenaPhase: Int8Array;
   /** arena switches on the Express's rail (phase 1): thrown, met */
   arenaThrown: Uint8Array;
   arenaAt: Float64Array;
   /** arena rings (phase 2) and ramps (phase 3): one per section, on a hero lane; taken */
   arenaTaken: Uint8Array;
   wagon: TrainState;
}

function freshHero(course: Course): Hero {
   const p = pieceAt(course, 1, 0, course.startZ - 0.01);
   return {
      x: laneX(1),
      y: 0,
      z: course.startZ,
      vy: 0,
      lane: 1,
      piece: p ? p.index : NONE,
      tier: 0,
      grounded: true,
      airJump: true,
      crouchUntil: NONE,
      dashUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      stumbleUntil: NONE,
      loopUntil: NONE,
      bonkUntil: NONE,
      hookUntil: NONE,
      hookV: 0,
      roof: false,
      v: course.speed,
   };
}

export interface RunOptions {
   /** versus: the switch board shared by every corridor */
   board?: SwitchBoard;
}

const freshTrain = (): TrainState => ({ lane: 1, piece: NONE, x: 0, z: 0, speed: 0, live: false, crashMs: -1e9, started: false });

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, options: RunOptions = {}): RailRun {
   const course = courseFor(level);
   const n = course.boss ? ARENA.max : 0;
   const run: RailRun = {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(course),
      pressMs: NONE,
      actionMs: NONE,
      switchMs: NONE,
      powerReadyAt: 0,
      board: options.board ?? createSwitchBoard(course),
      junctionResult: new Int8Array(course.junctions.length),
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      ringsHit: new Uint8Array(course.rings.length),
      rings: 0,
      hazardHit: new Uint8Array(course.hazards.length),
      loopDone: new Uint8Array(course.loops.length),
      combo: createCombo(),
      arenaLinks: 0,
      secrets: createSecretTracker(SECRETS[level]),
      bonks: 0,
      falls: 0,
      stumbles: 0,
      switchesThrown: 0,
      railMs: 0,
      finishMs: 0,
      finishGate: course.finishZ,
      ended: null,
      events: createEvents(),
      trains: course.trains.map((t) => ({ lane: t.lane, piece: NONE, x: laneX(t.lane), z: t.z, speed: t.speed, live: true, crashMs: -1e9, started: false })),
      boss: course.boss ? createBoss(CLOCKWORK) : null,
      bossEv: createBossEvents(),
      bossOn: false,
      pendingHits: 0,
      express: { lane: 3, x: laneX(3), z: course.boss ? course.bossStartZ - 60 : 0, crashMs: -1e9, diverted: false },
      expressV: course.speed,
      arenaSpawned: 0,
      arenaZ: new Float64Array(n),
      arenaPhase: new Int8Array(n),
      arenaThrown: new Uint8Array(n),
      arenaAt: new Float64Array(n).fill(-1e9),
      arenaTaken: new Uint8Array(n),
      wagon: freshTrain(),
   };
   for (const t of run.trains) {
      const p = pieceAt(course, t.lane, 0, t.z);
      t.piece = p ? p.index : NONE;
   }
   return run;
}

// ---------- reads (HUD, visuals, bots) ----------

export function bossAlive(run: Pick<RailRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step !== "defeat" && b.step !== "done";
}

export function bossVulnerable(run: Pick<RailRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

export function bossPhase(run: RailRun): number {
   return run.boss && run.bossOn ? run.boss.phase : NONE;
}

/** The base speed this ms: the level's (frozen rails x1.2), a stumble halves it. */
export function speedNow(run: RailRun, ms: number): number {
   const h = run.hero;
   const c = run.course;
   if (ms < h.bonkUntil) return 0;
   if (h.roof) return Math.min(c.vMax, Math.max(0, expressSpeed(run)));
   const p = h.piece !== NONE ? c.pieces[h.piece] : null;
   let v = c.speed * (p && p.frozen ? FROZEN : 1);
   if (ms < h.stumbleUntil) v *= STUMBLE.factor;
   let boost = p ? p.boost : 0;
   if (h.grounded && ms < h.crouchUntil && onSlope(c, h.z) && !(p && p.frozen) && CROUCH_BOOST > boost) boost = CROUCH_BOOST;
   if (ms < h.loopUntil && LOOP_BOOST > boost) boost = LOOP_BOOST;
   v += Math.min(BOOST_CAP, boost);
   return v > c.vMax ? c.vMax : v;
}

export function onSlope(c: Course, z: number): boolean {
   for (const s of c.slopes) if (z <= s.z0 && z > s.z1) return true;
   return false;
}

/**
 * The lit switch: the first switch on the hero's predicted path (the switches as they stand now) within
 * HIGHLIGHT_MS of it, skipping any thrown less than SKIP_MS ago (so a quick second press reaches the
 * switch after it: level 2's golden caboose). NONE when none is in range.
 */
export function litSwitch(run: RailRun): number {
   const h = run.hero;
   const c = run.course;
   if (h.roof) return NONE;
   let lane = h.lane;
   const v = Math.max(1, h.v || c.speed);
   const reach = (v * HIGHLIGHT_MS) / 1000;
   for (const j of c.junctions) {
      const gap = h.z - j.z;
      if (gap <= 0.2) continue;
      if (gap > reach) break;
      if (j.lane !== lane || run.junctionResult[j.index] !== SWITCHED.pending) continue;
      const recent = run.simMs - run.board.at[j.index] < SKIP_MS;
      if (recent) {
         if (run.board.thrown[j.index]) lane = j.to;
         continue;
      }
      return j.index;
   }
   return NONE;
}

/** Level 5, phase 1: the lit arena switch ahead of the Express (NONE when none). */
export function litArenaSwitch(run: RailRun): number {
   if (bossPhase(run) !== 0 || !bossAlive(run)) return NONE;
   const e = run.express;
   const reach = (Math.max(1, run.course.speed) * HIGHLIGHT_MS) / 1000 + 6;
   for (let s = 0; s < run.arenaSpawned; s++) {
      if (run.arenaPhase[s] !== 0) continue;
      const gap = e.z - run.arenaZ[s];
      if (gap <= 0.5) continue;
      if (gap > reach) return NONE;
      if (run.simMs - run.arenaAt[s] < SKIP_MS) continue;
      return s;
   }
   return NONE;
}

export function nextJunctionGap(run: RailRun): number {
   const j = litSwitch(run);
   return j === NONE ? Infinity : run.hero.z - run.course.junctions[j].z;
}

/** The share of the run spent grinding the rails (the relight %). */
export function relightOf(run: RailRun): number {
   return run.simMs > 0 ? Math.min(1, run.railMs / run.simMs) : 1;
}

export function distanceOf(run: RailRun): number {
   return Math.max(0, run.course.startZ - run.hero.z);
}

/** The submitted time: the finish less every orb, ring, the relight bonus and the flow bonus, never below 0. */
export function runTimeMs(run: Pick<RailRun, "finishMs" | "orbs" | "rings" | "combo" | "railMs" | "simMs">): number {
   const relight = run.simMs > 0 && run.railMs / run.simMs >= RELIGHT_AT ? BONUS_MS.relight : 0;
   return Math.max(0, run.finishMs - run.orbs * BONUS_MS.orb - run.rings * BONUS_MS.ring - relight - run.combo.bonusTotal);
}

// ---------- the step ----------

export function advanceClock(run: RailRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

/** A left / right press, camera-relative: -1, 0 or +1 along world x. */
export function laneDirection(left: boolean, right: boolean, yaw: number): number {
   const dx = (right ? 1 : 0) - (left ? 1 : 0);
   if (dx === 0) return 0;
   const c = Number.isFinite(yaw) ? Math.cos(yaw) : 1;
   if (Math.abs(c) >= 0.3) return Math.sign(c * dx);
   return dx;
}

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: RailRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (whole <= 0) return ev;
   const h = run.hero;
   const c = run.course;
   if (input.jumpPressed || input.up) run.pressMs = run.simMs + 1;
   // the Switch press throws the lit switch; with none lit, Action is the hero power
   if (input.switchPressed) run.switchMs = run.simMs + 1;
   if (input.actionPressed) {
      if (litSwitch(run) !== NONE || litArenaSwitch(run) !== NONE) run.switchMs = run.simMs + 1;
      else run.actionMs = run.simMs + 1;
   }
   const dir = laneDirection(input.left, input.right, input.yaw);
   if (dir !== 0 && !h.roof && !(run.simMs < h.bonkUntil) && !(run.simMs < h.hookUntil)) {
      const cur = h.piece !== NONE ? c.pieces[h.piece] : null;
      const to = h.lane + dir;
      // a hop only between parallel grid rails (a branch curves away: only a switch reaches it)
      const target = to >= 0 && to < GRID && !(cur && cur.side !== 0) ? pieceAt(c, to, h.tier, h.z, true) : null;
      if (target || (!h.grounded && to >= 0 && to < GRID)) {
         h.lane = to;
         h.piece = target ? target.index : NONE;
         ev.hopped = true;
      } else ev.hopBlocked = true;
   }
   if (input.down) {
      if (h.grounded) {
         h.crouchUntil = run.simMs + CROUCH_MS;
         ev.crouched = true;
      } else if (h.vy > -12) h.vy = -12;
   }
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= c.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run);
      if (run.ended !== null) return ev;
   }
   return ev;
}

function linkCombo(run: RailRun, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

function foundSecret(run: RailRun, i: number): void {
   if (collectSecret(run.secrets, i)) {
      const ev = run.events;
      if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
      ev.secretCount += 1;
   }
}

function tryPower(run: RailRun, ms: number): void {
   const h = run.hero;
   const ev = run.events;
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   if (def.power === "doubleJump") {
      if (!airJump(run)) return;
      run.powerReadyAt = ms + def.cooldownMs;
      ev.powered = true;
      return;
   }
   if (def.power === "dash") {
      h.dashUntil = ms + POWER_MS.dash;
      // in the air the dash holds him up (the long gap)
      if (!h.grounded && h.vy < DASH_HANG * G * 0.5) h.vy = Math.max(h.vy, DASH_HANG * G * 0.5);
      ev.dashed = true;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

function airJump(run: RailRun): boolean {
   const h = run.hero;
   if (h.grounded || !h.airJump || heroById(run.heroId).power !== "doubleJump") return false;
   h.airJump = false;
   h.vy = V_JUMP2;
   run.events.airJumped = true;
   run.events.jumped = true;
   return true;
}

/** Throws the lit switch (level 5 phase 1: the Express's). A frozen switch only with a jump-stomp. */
function throwSwitch(run: RailRun): void {
   const h = run.hero;
   const ev = run.events;
   const s = litArenaSwitch(run);
   if (s !== NONE) {
      run.arenaThrown[s] = run.arenaThrown[s] ? 0 : 1;
      run.arenaAt[s] = run.simMs;
      ev.thrown = 1000 + s;
      return;
   }
   const j = litSwitch(run);
   if (j === NONE) return;
   const jd = run.course.junctions[j];
   if (jd.frozen) {
      if (h.grounded) {
         ev.frozenClunk = true;
         return;
      }
      // the stomp: slam down onto the frozen lever
      h.vy = V_STOMP;
   }
   run.board.thrown[j] = run.board.thrown[j] ? 0 : 1;
   run.board.at[j] = run.simMs;
   run.switchesThrown += 1;
   ev.thrown = j;
}

function bonk(run: RailRun, ms: number, kind: number, length: number): void {
   const h = run.hero;
   h.bonkUntil = ms + length;
   h.dashUntil = NONE;
   h.loopUntil = NONE;
   h.crouchUntil = NONE;
   run.bonks += 1;
   comboBreak(run.combo);
   run.events.bonked = true;
   run.events.bonkKind = kind;
}

/** Puts the hero on the grid rail of `lane` at its z (after a bonk at a buffer, a barrier, a ghost door). */
function backToGrid(run: RailRun, lane: number): void {
   const h = run.hero;
   const c = run.course;
   let best: Piece | null = null;
   for (const l of [lane, 1, 2, 0, 3]) {
      best = pieceAt(c, l, 0, h.z, true);
      if (best) break;
   }
   if (!best) return;
   h.lane = best.lane;
   h.piece = best.index;
   h.tier = 0;
   h.grounded = true;
   h.y = 0;
   h.vy = 0;
}

/**
 * A missed gap: the hook catches the hero and carries it to the nearest grid rail ahead (or under it) in
 * HOOK_MS, never faster than the level's speed (the z guard holds through it).
 */
function startHook(run: RailRun, ms: number): void {
   const h = run.hero;
   const c = run.course;
   let landZ = Number.NEGATIVE_INFINITY;
   let lane = h.lane;
   for (const l of [h.lane, 1, 2, 0, 3]) {
      if (l < 0 || l >= GRID) continue;
      for (const p of c.byLane[l * 2]) {
         if (p.side !== 0 || p.z1 >= h.z) continue;
         // a rail under the hero lands it where it is; else the first one starting ahead
         const z = p.z0 >= h.z ? h.z : p.z0 - 1;
         if (z > landZ) {
            landZ = z;
            lane = l;
         }
         break;
      }
   }
   if (!Number.isFinite(landZ)) landZ = h.z;
   const dist = Math.max(0, h.z - landZ);
   const len = Math.max(HOOK_MS, Math.ceil((dist / c.speed) * 1000));
   h.hookUntil = ms + len;
   h.hookV = dist / len;
   h.lane = lane;
   h.piece = NONE;
   h.dashUntil = NONE;
   h.loopUntil = NONE;
   run.falls += 1;
   comboBreak(run.combo);
   run.events.hooked = true;
}

function tick(run: RailRun): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   const ev = run.events;
   if (run.boss) {
      if (!run.bossOn && h.z <= c.bossStartZ) run.bossOn = true;
      if (run.bossOn) bossMs(run);
   }
   comboTick(run.combo, COMBO, ms);
   if (run.pressMs !== NONE && ms - run.pressMs > JUMP_BUFFER_MS) run.pressMs = NONE;
   if (run.switchMs !== NONE) {
      throwSwitch(run);
      run.switchMs = NONE;
   }
   // the hook: carried across a gap, slower than the run
   if (ms < h.hookUntil) {
      h.z -= h.hookV;
      h.v = h.hookV * 1000;
      h.y = -0.4;
      if (ms + 1 >= h.hookUntil) backToGrid(run, h.lane);
      run.actionMs = NONE;
      trainsMs(run);
      return;
   }
   // a bonk: stopped
   if (ms < h.bonkUntil) {
      h.v = 0;
      run.actionMs = NONE;
      run.pressMs = NONE;
      moveSideways(run);
      trainsMs(run);
      return;
   }
   if (run.actionMs !== NONE) {
      tryPower(run, ms);
      run.actionMs = NONE;
   }
   // jumping (a press buffered 130 ms), Nami's air jump, gravity
   if (run.pressMs !== NONE) {
      if (h.grounded) {
         h.grounded = false;
         h.vy = V_JUMP;
         h.airJump = true;
         run.pressMs = NONE;
         ev.jumped = true;
      } else if (airJump(run)) {
         run.pressMs = NONE;
         run.powerReadyAt = Math.max(run.powerReadyAt, ms + heroById(run.heroId).cooldownMs);
      }
   }
   const prevY = h.y;
   if (!h.grounded) {
      const hang = ms < h.dashUntil ? 0.35 : 1;
      h.vy -= (G * hang) / 1000;
      h.y += h.vy / 1000;
   }
   moveSideways(run);
   // forward: the z guard
   const prevZ = h.z;
   const v = speedNow(run, ms);
   h.v = v;
   h.z -= v / 1000;
   if (run.bossOn) {
      spawnArena(run);
      roofMs(run, prevY);
   }
   if (!h.roof) support(run, ms, prevY, prevZ);
   if (run.ended !== null) return;
   if (h.grounded && !h.roof && h.piece !== NONE) run.railMs += 1;
   else if (h.roof) run.railMs += 1;
   contacts(run, ms, prevZ);
   trainsMs(run);
   if (h.z <= run.finishGate && !bossAlive(run) && h.grounded) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   } else if (h.z <= run.finishGate - 2 && !bossAlive(run)) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function moveSideways(run: RailRun): void {
   const h = run.hero;
   const c = run.course;
   let tx = laneX(h.lane);
   if (h.roof) tx = run.express.x;
   else if (h.piece !== NONE) tx = railX(c.pieces[h.piece], h.z);
   const d = tx - h.x;
   // a branch's own curve is followed exactly; a hop moves at LANE_V
   const p = h.piece !== NONE ? c.pieces[h.piece] : null;
   const m = p && p.side !== 0 && Math.abs(d) < 0.2 ? Math.abs(d) : LANE_V / 1000;
   h.x += d > m ? m : d < -m ? -m : d;
}

/** The rails under the hero: landing, piece ends (gaps, buffers, merges), the switches, the hazards on its piece. */
function support(run: RailRun, ms: number, prevY: number, prevZ: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   // landing: on a high rail from above, else on the low rail of its lane
   if (!h.grounded && h.vy <= 0) {
      const top = pieceAt(c, h.lane, 1, h.z);
      if (top && prevY >= HIGH_Y && h.y <= HIGH_Y && Math.abs(h.x - laneX(h.lane)) < 1) land(run, top, HIGH_Y);
      else if (h.y <= 0) {
         // its own rail first (a branch it jumped on), then the lane's grid rail
         const own = h.piece !== NONE ? c.pieces[h.piece] : null;
         const low = own && own.tier === 0 && own.z0 >= h.z && h.z > own.z1 ? own : pieceAt(c, h.lane, 0, h.z, true) ?? pieceAt(c, h.lane, 0, h.z);
         if (low) land(run, low, 0);
         else if (h.y < -0.6) {
            startHook(run, ms);
            return;
         }
      }
   }
   // the switches this ms (a hero grinding on that rail at the plane, or just over it)
   for (const j of c.junctions) {
      if (j.z > prevZ) continue;
      if (j.z < h.z) break;
      if (run.junctionResult[j.index] !== SWITCHED.pending) continue;
      if (j.lane !== h.lane || h.tier !== 0) continue;
      if (h.y > 1.6) continue;
      const branch = run.board.thrown[j.index] === 1;
      run.junctionResult[j.index] = branch ? SWITCHED.branch : SWITCHED.straight;
      ev.junction = j.index;
      ev.junctionResult = run.junctionResult[j.index];
      if (branch) {
         h.lane = j.to;
         h.piece = j.piece;
         linkCombo(run, COMBO_BASE_MS.switch);
      }
   }
   if (!h.grounded || h.piece === NONE) return;
   const p = c.pieces[h.piece];
   // the hazards at the head of a branch: Riko's barrier, Vexa's ghost door
   for (let i = 0; i < c.hazards.length; i++) {
      const hz = c.hazards[i];
      if (hz.piece !== p.index || run.hazardHit[i] || hz.kind === HAZ.icicles) continue;
      if (!(prevZ > hz.z0 && h.z <= hz.z0)) continue;
      run.hazardHit[i] = 1;
      if (hz.kind === HAZ.barrier) {
         if (ms < h.dashUntil) ev.smashed = true;
         else {
            bonk(run, ms, 1, BONK_MS.bump);
            const j = c.junctions.find((q) => q.piece === p.index);
            backToGrid(run, j ? j.lane : 1);
            return;
         }
      } else if (hz.kind === HAZ.ghost) {
         if (ms < h.phaseUntil) ev.phased = true;
         else {
            bonk(run, ms, 2, BONK_MS.bump);
            const j = c.junctions.find((q) => q.piece === p.index);
            backToGrid(run, j ? j.lane : 2);
            return;
         }
      }
   }
   // the piece's end
   if (h.z > p.z1) return;
   if (p.end === END.merge) {
      const to = pieceAt(c, p.mergeTo, 0, h.z, true) ?? pieceAt(c, p.mergeTo, 0, h.z);
      if (to) {
         h.lane = to.lane;
         h.piece = to.index;
         ev.merged = true;
         return;
      }
   }
   if (p.end === END.buffer) {
      bonk(run, ms, 0, BONK_MS.buffer);
      h.z = p.z1 + 0.5;
      const j = c.junctions.find((q) => q.piece === p.index);
      backToGrid(run, j ? j.lane : 1);
      return;
   }
   // an open end runs on into the next piece of the lane; a gap (or nothing) drops the hero
   const next = pieceAt(c, h.lane, p.tier, h.z);
   if (next) {
      h.piece = next.index;
      return;
   }
   h.grounded = false;
   h.piece = NONE;
   h.vy = 0;
   if (p.tier === 1) h.tier = 0;
}

function land(run: RailRun, p: Piece, y: number): void {
   const h = run.hero;
   h.grounded = true;
   h.y = y;
   h.vy = 0;
   h.tier = p.tier;
   h.piece = p.index;
   h.lane = p.lane;
   h.airJump = true;
   run.events.landed = true;
}

function contacts(run: RailRun, ms: number, prevZ: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const cy = h.y + PICKUP.centerY;
   const magnet = ms < h.magnetUntil;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      const reach = magnet ? MAGNET_REACH : PICKUP.r;
      const dz = o.z - h.z;
      if (dz > reach || dz < -reach) continue;
      if (o.hidden && !magnet) continue;
      // an orb over a branch is the branch's (its x is beyond the grid's reach anyway)
      if (o.piece !== NONE && c.pieces[o.piece].side !== 0 && h.piece !== o.piece) continue;
      const ox = o.piece !== NONE ? railX(c.pieces[o.piece], o.z) : o.x;
      const dx = ox - h.x;
      const dy = o.y - cy;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.kind === "main") run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount] = i;
      ev.orbCount += 1;
      linkCombo(run, COMBO_BASE_MS.orb);
   }
   for (let i = 0; i < c.rings.length; i++) {
      if (run.ringsHit[i]) continue;
      const r = c.rings[i];
      if (!(prevZ > r.z && h.z <= r.z)) continue;
      if (h.lane !== r.lane || h.y > RING_TOP || Math.abs(h.x - laneX(r.lane)) > 1.2) continue;
      run.ringsHit[i] = 1;
      run.rings += 1;
      if (ev.ringCount < ev.ringList.length) ev.ringList[ev.ringCount] = i;
      ev.ringCount += 1;
      linkCombo(run, COMBO_BASE_MS.ring);
   }
   // Kiro's icicle tunnels: judged on the way in (or a hop into it): a stumble, unless the shield is up
   for (let i = 0; i < c.hazards.length; i++) {
      const hz = c.hazards[i];
      if (hz.kind !== HAZ.icicles || run.hazardHit[i]) continue;
      if (h.lane !== hz.lane || h.tier !== 0 || h.z > hz.z0 || h.z < hz.z1 || h.y > 2) continue;
      run.hazardHit[i] = 1;
      if (ms < h.shieldUntil) continue;
      h.stumbleUntil = ms + STUMBLE.ms;
      run.stumbles += 1;
      comboBreak(run.combo);
      ev.stumbled = true;
   }
   // Zuno's loop: with the magnet up on its lane at its foot, he rides round it
   for (let i = 0; i < c.loops.length; i++) {
      const lp = c.loops[i];
      if (run.loopDone[i] || h.lane !== lp.lane || h.tier !== 0) continue;
      if (!(prevZ > lp.z0 && h.z <= lp.z0)) continue;
      run.loopDone[i] = 1;
      if (!(ms < h.magnetUntil)) continue;
      h.loopUntil = ms + Math.round(((lp.z0 - lp.z1) / (c.speed + LOOP_BOOST)) * 1000);
      ev.looped = true;
      const si = SECRETS[run.level].findIndex((s) => s.id === "loop");
      if (si >= 0) foundSecret(run, si);
   }
   for (let i = 0; i < c.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = c.secrets[i];
      if (s.need !== "piece" || h.piece !== s.piece) continue;
      if (Math.abs(s.z - h.z) > SECRET_R) continue;
      foundSecret(run, i);
   }
}

/** Level 4's toy trains (and level 5's wagon): they drive down the line, follow the switches, crash into buffers, bump a hero. */
function trainsMs(run: RailRun): void {
   const c = run.course;
   const h = run.hero;
   const ms = run.simMs;
   for (let i = 0; i < run.trains.length; i++) {
      const t = run.trains[i];
      if (!t.live) continue;
      // a train waits until the hero comes near, then drives
      if (!t.started && h.z - t.z < 90) t.started = true;
      if (!t.started) continue;
      const pz = t.z;
      t.z -= t.speed / 1000;
      trainRails(run, t, pz, i);
      if (!t.live) continue;
      bumpHero(run, t, ms);
   }
   if (run.wagon.live) {
      const w = run.wagon;
      w.z -= w.speed / 1000;
      if (w.z > h.z + 30) w.live = false;
      else bumpHero(run, w, ms);
   }
   void c;
}

function trainRails(run: RailRun, t: TrainState, pz: number, index: number): void {
   const c = run.course;
   for (const j of c.junctions) {
      if (j.z > pz) continue;
      if (j.z < t.z) break;
      if (j.lane !== t.lane) continue;
      if (run.board.thrown[j.index]) {
         t.lane = j.to;
         t.piece = j.piece;
      }
   }
   const p = t.piece !== NONE ? c.pieces[t.piece] : pieceAt(c, t.lane, 0, t.z);
   if (p) {
      t.piece = p.index;
      t.x = railX(p, t.z);
      if (t.z <= p.z1) {
         if (p.end === END.buffer) {
            t.live = false;
            t.crashMs = run.simMs;
            run.events.trainCrashed = index;
         } else if (p.end === END.merge) {
            t.lane = p.mergeTo;
            t.piece = NONE;
         } else t.piece = NONE;
      }
   }
}

function bumpHero(run: RailRun, t: TrainState, ms: number): void {
   const h = run.hero;
   if (h.roof || ms < h.bonkUntil || ms < h.hookUntil) return;
   if (Math.abs(t.z - h.z) > TRAIN.half || Math.abs(t.x - h.x) > 1.3 || h.y > TRAIN.roof) return;
   if (ms < h.phaseUntil) return;
   bonk(run, ms, 3, BONK_MS.bump);
   // knocked back behind it
   h.z = Math.max(h.z, t.z + TRAIN.half + 0.2);
}

// ---------- level 5: the Clockwork Express ----------

export function expressSpeed(run: RailRun): number {
   return run.expressV;
}

function spawnArena(run: RailRun): void {
   const c = run.course;
   const b = run.boss!;
   while (run.arenaSpawned < ARENA.max) {
      const z = c.bossStartZ - ARENA.lead - run.arenaSpawned * ARENA.spacing;
      if (z < run.hero.z - 130) return;
      if (!bossAlive(run)) return;
      const s = run.arenaSpawned;
      run.arenaZ[s] = z;
      run.arenaPhase[s] = b.phase;
      run.arenaSpawned += 1;
   }
}

/** The arena section's ring (phase 2) or ramp (phase 3) lane: the hero's lanes 0-2 in turn. */
export function arenaLane(s: number): number {
   return s % 3;
}

function bossMs(run: RailRun): void {
   const b = run.boss!;
   const ev = run.bossEv;
   const h = run.hero;
   const c = run.course;
   const e = run.express;
   const wasAlive = bossAlive(run);
   stepBoss(b, CLOCKWORK, 1, ev);
   if (ev.telegraph) run.events.bossTelegraph = true;
   if (ev.attack) {
      run.events.bossAttack = true;
      if (b.phase === 1 && !run.wagon.live) {
         // a wagon uncoupled back at the hero along its rail
         const w = run.wagon;
         w.lane = h.lane;
         w.x = laneX(h.lane);
         w.z = h.z - 34;
         w.speed = c.speed - 6;
         w.live = true;
         w.started = true;
         run.events.wagonDropped = true;
      }
      if (b.phase === 2 && h.roof && h.grounded) {
         // a steam puff blows the hero off the roof
         h.roof = false;
         run.events.knockedOff = true;
         bonk(run, run.simMs, 4, BONK_MS.bump);
         backToGrid(run, 2);
      }
   }
   if (run.pendingHits > 0 && bossVulnerable(run)) {
      const r = hitBoss(b, CLOCKWORK, 1, ev);
      if (r !== "ignored") {
         run.pendingHits -= 1;
         run.events.bossHit = true;
         if (r === "phase") run.events.bossPhase = true;
         if (r === "defeated") run.events.bossDefeated = true;
      }
   }
   if (wasAlive && !bossAlive(run)) {
      run.finishGate = Math.min(c.finishZ, h.z - GATE_AHEAD);
      run.pendingHits = 0;
      run.wagon.live = false;
      if (h.roof) {
         h.roof = false;
         backToGrid(run, 2);
         h.grounded = false;
         h.y = EXPRESS.roofY;
      }
   }
   // the Express runs ahead on its rail (lane 3); in phase 3 it runs beside the hero
   const phase = bossAlive(run) ? b.phase : 2;
   const target = h.z - EXPRESS.lead[phase];
   const crashed = run.simMs - e.crashMs < 1500;
   const vMaxMs = c.vMax / 1000;
   const pz = e.z;
   if (!crashed) {
      const d = target - e.z;
      e.z += d > vMaxMs ? vMaxMs : d < -vMaxMs ? -vMaxMs : d;
   }
   run.expressV = (pz - e.z) * 1000;
   // its switches (phase 1): a thrown one sends it onto the buffer spur, where it crashes
   for (let s = 0; s < run.arenaSpawned; s++) {
      const z = run.arenaZ[s];
      if (run.arenaPhase[s] !== 0 || z > pz || z < e.z) continue;
      if (run.arenaThrown[s] && bossAlive(run)) {
         e.diverted = true;
         e.crashMs = run.simMs;
         run.arenaThrown[s] = 0;
         run.pendingHits += 1;
         run.events.expressCrashed = true;
         if (run.arenaLinks < ARENA_LINKS) {
            run.arenaLinks += 1;
            linkCombo(run, COMBO_BASE_MS.ring);
         }
      }
   }
   e.x = laneX(3) + (crashed ? BRANCH_OUT * Math.min(1, (run.simMs - e.crashMs) / 400) : 0);
   if (!crashed) e.diverted = false;
}

/** Level 5's rings (phase 2) and ramps (phase 3) on the hero's lanes, and the roof. */
function roofMs(run: RailRun, prevY: number): void {
   const h = run.hero;
   const c = run.course;
   const e = run.express;
   const ev = run.events;
   const b = run.boss!;
   // the arena rings and ramps at their sections' planes
   for (let s = 0; s < run.arenaSpawned; s++) {
      if (run.arenaTaken[s]) continue;
      const z = run.arenaZ[s];
      if (z > h.z + 3 || z < h.z) continue;
      const phase = run.arenaPhase[s];
      if (phase === 0 || h.roof || h.lane !== arenaLane(s) || h.y > RING_TOP) continue;
      run.arenaTaken[s] = 1;
      if (phase === 1) {
         // a ring: it charges a hit while the Express is open
         if (bossAlive(run) && b.phase === 1) run.pendingHits += 1;
         if (run.arenaLinks < ARENA_LINKS) {
            run.arenaLinks += 1;
            run.rings += 1;
            linkCombo(run, COMBO_BASE_MS.ring);
         }
         ev.ringCount += 1;
      } else if (phase === 2 && h.grounded) {
         // a launch ramp: up and over onto the Express's roof beside it
         h.grounded = false;
         h.piece = NONE;
         h.vy = EXPRESS.rampV;
         h.lane = 3;
         ev.launched = true;
      }
   }
   // landing on the roof (from a launch, or a stomp jump on it)
   if (!h.grounded && h.vy <= 0 && prevY >= EXPRESS.roofY && h.y <= EXPRESS.roofY && Math.abs(h.z - e.z) < 3.2 && h.lane === 3 && bossAlive(run)) {
      const was = h.roof;
      h.roof = true;
      h.grounded = true;
      h.y = EXPRESS.roofY;
      h.vy = 0;
      h.airJump = true;
      h.piece = NONE;
      ev.landed = true;
      if (!was) ev.roofLanded = true;
      else {
         // a stomp on the wind-up key
         ev.stomped = true;
         if (b.phase === 2) run.pendingHits = Math.max(run.pendingHits, 1);
      }
   }
   if (h.roof) {
      if (!bossAlive(run)) {
         h.roof = false;
         return;
      }
      h.z = e.z;
      h.x = e.x;
      if (!h.grounded && h.y < EXPRESS.roofY - 0.5) h.roof = false;
   }
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

/** The snowfield under the rails near z (the camera stays over it). */
export function hallBoxes(_course: Course, z: number, reach: number, out: SolidBox[]): number {
   const b = out[0] ?? (out[0] = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
   b.minX = -80;
   b.maxX = 80;
   b.minY = -20;
   b.maxY = -0.6;
   b.minZ = z - reach;
   b.maxZ = z + reach;
   return 1;
}

// ---------- the store hand-off (README "Scoring") ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   rings: "rings",
   distance: "distance",
   finishMs: "finishMs",
   /** the submitted time (runTimeMs), set at the finish */
   submitted: "submitted",
   hero: "hero",
   power: "power",
   speed: "speed",
   relight: "relight",
   /** the lit switch: 1 lit, 0 none; 1 when it is frozen (a jump-stomp throws it); 1 when it is thrown */
   switchLit: "switchLit",
   switchFrozen: "switchFrozen",
   switchThrown: "switchThrown",
   /** the mini-map: the next two switches on the predicted path, each a code (0 none, 1 an orb / shortcut branch, 2 a dead end, 3 a hero gate), and whether thrown */
   map1: "map1",
   map2: "map2",
   map1Thrown: "map1Thrown",
   map2Thrown: "map2Thrown",
   bonks: "bonks",
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

/** The no-hit badge of this game: no bonk and no fall. */
export function badgeHits(run: RailRun): number {
   return run.bonks + run.falls;
}

/** The code of the branch a switch opens (the mini-map): 1 an orb branch or a shortcut, 2 a dead end, 3 a hero gate or the caboose. */
export function branchCode(c: Course, j: number): number {
   const p = c.pieces[c.junctions[j].piece];
   if (p.branch === BRANCH.dead) return 2;
   if (p.branch === BRANCH.orb || p.branch === BRANCH.fast) return 1;
   return 3;
}

/** The mini-map: the next two switches on the predicted path (switch indices; NONE). */
export function upcomingSwitches(run: RailRun, out: number[]): number[] {
   out[0] = NONE;
   out[1] = NONE;
   const h = run.hero;
   let lane = h.lane;
   let n = 0;
   for (const j of run.course.junctions) {
      if (j.z >= h.z) continue;
      if (h.z - j.z > 260) break;
      if (j.lane !== lane) continue;
      out[n++] = j.index;
      if (run.board.thrown[j.index]) lane = j.to;
      if (n >= 2) break;
   }
   return out;
}
