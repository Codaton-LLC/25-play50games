// Color Door Sprint rules (the design card's READ AND COMMIT): an auto-run corridor along -z with door
// walls every 35-45 m. A rule lamp ahead shows the rule for the next wall (match the colour, match the
// chime, NOT this colour; the echo rule shows the wall after next). Doors lock 0.6 s before impact: a
// lane change after that does nothing. The true door gives a 0.5 s speed surge and a flow link; a wrong
// door bounces you back (1.5 s) and breaks the flow. Jump over floor bars, roll under low beams. Hero
// gates: Riko's cracked fake doors (dash: a side corridor that skips two walls), Nami's upper doors
// (double jump), Kiro's shield (absorbs a wrong door, bars, beams and flame vents), Zuno's hidden wall
// trails (magnet), Vexa's ghost doors (phase). Level 5: Flicker, the Fire Spirit (menu2/boss).
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Each run rolls the door
// colours from its seed (a fixed pool of rules); the course geometry is fixed (halls.ts).
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time: the same run at 30, 60 or 144 fps.
// No allocation after createRun(). README "Rules" and "Server limits" explain the proof.
import type { RunState } from "@/arcade3d/core/types";
import { rngNext, type RngState } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, HERO_COLOR_INDEX, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { LEVELS, type DoorLevel } from "./levels";
import {
   ARENA,
   DOOR_COLORS,
   LANE_W,
   NONE,
   buildHall,
   hallHalf,
   laneX,
   type BarDef,
   type LampDef,
   type OrbDef,
   type PadDef,
   type RuleMode,
   type SecretSpot,
   type SideDef,
   type VentDef,
   type WallDef,
} from "./halls";
import { ARENA_LINKS, COMBO, COMBO_BASE_MS, FLICKER, SECRETS } from "./progression";

export { NONE };
export type { BarDef, LampDef, OrbDef, PadDef, RuleMode, SecretSpot, SideDef, VentDef, WallDef };

// ---------- tuning (1 unit = 1 m, the run goes along -z, up is +y) ----------

export const MAX_STEP_MS = 50;
export const HERO = { height: 1.3, rollHeight: 0.7 } as const;
/** every boost on top of the level's run speed is capped at this (m/s): V_MAX = speed + BOOST_CAP */
export const BOOST_CAP = 6;
/** the boosts (m/s, ms): the true door's surge (the card: +0.5 s), a speed pad, Riko's dash, the red rush */
export const BOOST = { surge: 3, pad: 4, dash: 5, rush: 6 } as const;
export const SURGE_MS = 500;
export const PAD_MS = 1000;
export const RUSH_MS = 700;
/** doors lock this long before impact (the card: 0.6 s) */
export const LOCK_MS = 600;
/** a sliding wall's doors shift one lane this long before impact (1.0 s of reaction left before the lock) */
export const SLIDE_MS = 1600;
/** a wrong door: bounced back for this long (the card: 1.5 s), knocked this far back over BOUNCE_BACK_MS */
export const BOUNCE_MS = 1500;
export const BOUNCE_BACK = 3;
export const BOUNCE_BACK_MS = 300;
/** a stumble (a floor bar, a low beam, a flame vent, Flicker's fire): this share of the speed for this long */
export const STUMBLE = { factor: 0.45, ms: 700 } as const;
/** sideways (m/s): a lane change of 2.4 m takes about 0.17 s */
export const LANE_V = 14;
/** a jump (apex about 1.29 m, 0.61 s), Nami's second jump (apex about 1.61 m more) */
export const V_JUMP = 8.5;
export const V_JUMP2 = 9.5;
export const G = 28;
export const JUMP_BUFFER_MS = 130;
/** a roll (under the low beams) */
export const ROLL_MS = 700;
/** a floor bar is cleared with the feet this high; a low beam's underside */
export const BAR_CLEAR = 0.5;
/** the upper door row: the feet this high at the wall (only a double jump gets there) */
export const UPPER_FEET = 2.25;
/** orbs: pickup radius round the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 1.0, bonusMs: 150, centerY: 0.6 } as const;
export const SECRET_R = 1.3;
/** the red rush (level 5): this many true doors in a row charge it */
export const RUSH_STREAK = 4;
/** level 5's arena: its walls carry up to this many lanes' doors; at most ARENA_MAX of them */
export const ARENA_MAX = 160;
/** Flicker's phase 3: each hit adds this to the run speed (m/s, inside the cap) */
export const P3_SPEEDUP = 1;
/** Flicker's place (visual): his lead ahead of the hero, closer while he is open */
export const FLICK = { lead: 34, open: 17, chase: 40 } as const;
/** after the defeat the finish gate stands this far ahead */
export const GATE_AHEAD = 45;

export const DOOR_SHUT = -1;
export const DOOR_CRACKED = -2;
export const DOOR_GHOST = -3;

/** What happened at a wall (run.result), for the visuals. */
export const WALL = { pending: 0, truePass: 1, wrong: 2, absorbed: 3, skipped: 4, smashed: 5, ghost: 6, upper: 7, opened: 8 } as const;

// ---------- the course ----------

export interface Course {
   level: LevelId;
   lanes: number;
   speed: number;
   vMax: number;
   durationMs: number;
   boss: boolean;
   walls: WallDef[];
   lamps: LampDef[];
   orbs: OrbDef[];
   mainOrbs: number;
   bars: BarDef[];
   pads: PadDef[];
   vents: VentDef[];
   sides: SideDef[];
   /** the level's secrets (progression.ts SECRETS order) */
   secrets: SecretSpot[];
   half: number;
   startZ: number;
   /** the finish line (level 5: the static finish; the gate after Flicker never lies past it) */
   finishZ: number;
   bossStartZ: number;
}

export function buildCourse(level: DoorLevel = LEVELS[1]): Course {
   const d = buildHall(level);
   const secrets = SECRETS[level.id].map((s) => {
      const p = d.secrets[s.id];
      if (!p) throw new Error(`color-door-sprint L${level.id}: secret ${s.id} is not placed`);
      return p;
   });
   return {
      level: level.id,
      lanes: d.lanes,
      speed: level.speed,
      vMax: level.speed + BOOST_CAP,
      durationMs: level.durationMs,
      boss: level.boss,
      walls: d.walls,
      lamps: d.lamps,
      orbs: d.orbs,
      mainOrbs: d.orbs.filter((o) => o.kind === "main").length,
      bars: d.bars,
      pads: d.pads,
      vents: d.vents,
      sides: d.sides,
      secrets,
      half: hallHalf(d.lanes),
      startZ: d.startZ,
      finishZ: d.finishZ,
      bossStartZ: d.bossStartZ,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

/**
 * The least ms to reach the finish line by the z guard alone: every ms moves the hero at most
 * vMax / 1000 m towards -z (the forward step is capped there; lane changes are along x, a bounce moves
 * the hero back, a side corridor runs parallel), less 4 ms for a step that started before the line.
 */
export function progressFloorMs(course: Course): number {
   return Math.max(0, ((course.startZ - course.finishZ) * 1000) / course.vMax - 4);
}

/** The earliest rules ms Flicker can be down: every vulnerable window hit at its first ms (menu2/boss). */
export function bossMinMs(): number {
   const s = createBoss(FLICKER);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, FLICKER, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, FLICKER, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/** Level 5: the boss starts at the first ms the hero passes bossStartZ (the z guard), then needs BOSS_MIN_MS of its own. */
export function bossFloorMs(course: Course): number {
   if (!course.boss) return 0;
   return Math.max(0, ((course.startZ - course.bossStartZ) * 1000) / course.vMax - 4) + BOSS_MIN_MS - 2;
}

export function minFinishMs(course: Course): number {
   const z = progressFloorMs(course);
   return course.boss ? Math.max(z, bossFloorMs(course)) : z;
}

/** What the course can feed the flow meter: every orb, each static wall once, the first ARENA_LINKS arena doors. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.walls.length + (course.boss ? ARENA_LINKS : 0), base: COMBO_BASE_MS.door },
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

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];

// ---------- the run ----------

export type HeroState = "play" | "bounce";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vy: number;
   /** the lane it runs in (or heads for) */
   lane: number;
   state: HeroState;
   timerMs: number;
   grounded: boolean;
   airJump: boolean;
   rollUntil: number;
   /** a roll asked for in the air: it starts on landing */
   rollPending: boolean;
   surgeUntil: number;
   padUntil: number;
   dashUntil: number;
   rushUntil: number;
   stumbleUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** the side corridor it runs in (index into course.sides), NONE in the hall */
   side: number;
   /** the lane is locked for the next wall */
   locked: boolean;
   /** the speed this ms (m/s) */
   v: number;
}

export interface StepInput {
   /** one-frame direction presses (keys and swipes, core input.pressed): left / right change lanes, up jumps, down rolls */
   left: boolean;
   right: boolean;
   up: boolean;
   down: boolean;
   jumpPressed: boolean;
   /** the hero power (E / Enter / the Power button); on level 5 with the rush charged it fires the rush */
   actionPressed: boolean;
   /** the camera's yaw (rad): the orbit camera's viewYaw; left / right are turned camera-relative */
   yaw: number;
}

export function createStepInput(): StepInput {
   return { left: false, right: false, up: false, down: false, jumpPressed: false, actionPressed: false, yaw: 0 };
}

export interface StepEvents {
   laneChanged: boolean;
   locked: boolean;
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   rolled: boolean;
   /** a wall was met this step (index), and how (WALL.*) */
   wall: number;
   wallResult: number;
   slid: number;
   stumbled: boolean;
   padded: boolean;
   orbCount: number;
   orbList: number[];
   powered: boolean;
   dashed: boolean;
   sideEntered: boolean;
   sideLeft: boolean;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   finished: boolean;
   timeup: boolean;
   rushCharged: boolean;
   rushFired: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   arenaSpawned: boolean;
}

function createEvents(): StepEvents {
   return {
      laneChanged: false,
      locked: false,
      jumped: false,
      airJumped: false,
      landed: false,
      rolled: false,
      wall: NONE,
      wallResult: 0,
      slid: NONE,
      stumbled: false,
      padded: false,
      orbCount: 0,
      orbList: new Array<number>(32).fill(0),
      powered: false,
      dashed: false,
      sideEntered: false,
      sideLeft: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      finished: false,
      timeup: false,
      rushCharged: false,
      rushFired: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      arenaSpawned: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.laneChanged = false;
   ev.locked = false;
   ev.jumped = false;
   ev.airJumped = false;
   ev.landed = false;
   ev.rolled = false;
   ev.wall = NONE;
   ev.wallResult = 0;
   ev.slid = NONE;
   ev.stumbled = false;
   ev.padded = false;
   ev.orbCount = 0;
   ev.powered = false;
   ev.dashed = false;
   ev.sideEntered = false;
   ev.sideLeft = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.finished = false;
   ev.timeup = false;
   ev.rushCharged = false;
   ev.rushFired = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
   ev.arenaSpawned = false;
}

/** Flicker's live hazard (level 5): a fire wave to jump, a flame arc to roll under, a lane of fire to leave. */
export interface BossHazard {
   kind: 0 | 1 | 2;
   z: number;
   lane: number;
   live: boolean;
}

export interface DoorRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   /** co-op "Door Roulette": every match / sound wall's true colour is this hero's own colour */
   roulette: boolean;
   rng: RngState;
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   pressMs: number;
   actionMs: number;
   powerReadyAt: number;
   /** the walls: the course's static walls, then level 5's arena walls as they spawn */
   wallCount: number;
   wallZ: Float64Array;
   wallMode: Int8Array;
   /** per wall: its lamp colour (the rule's colour), the true lane, the cracked door's drawn colour */
   ruleColor: Int8Array;
   trueLane: Int8Array;
   crackColor: Int8Array;
   /** per wall and lane (wall * lanes + lane): a colour index, or DOOR_SHUT / DOOR_CRACKED / DOOR_GHOST */
   doors: Int8Array;
   slid: Uint8Array;
   result: Int8Array;
   /** the ms each wall was met (visual) */
   resultMs: Float64Array;
   /** the next wall to meet */
   nextWall: number;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   ventHit: Uint8Array;
   combo: ComboState;
   arenaLinks: number;
   secrets: SecretTracker;
   /** wrong doors (the no-hit badge: none), stumbles, absorbed (Kiro), true doors */
   wrong: number;
   stumbles: number;
   absorbed: number;
   trueDoors: number;
   streak: number;
   bestStreak: number;
   finishMs: number;
   /** the finish gate (level 5: set when Flicker falls, never past course.finishZ) */
   finishGate: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   bossOn: boolean;
   arenaSpawned: number;
   rushStreak: number;
   rushReady: boolean;
   p3Hits: number;
   flick: { z: number; x: number };
   hazard: BossHazard;
}

const MODE_CODE: Record<RuleMode, number> = { match: 0, sound: 1, not: 2 };
export const MODE_OF: readonly RuleMode[] = ["match", "sound", "not"];

function rand(run: DoorRun, n: number): number {
   return Math.floor(rngNext(run.rng) * n) % n;
}

/** Rolls a wall's doors: the rule's colour, the true lane, the other doors (pure on the run's rng). */
function rollWall(run: DoorRun, w: number, mode: number, open: number, cracked: number, ghost: number): void {
   const lanes = run.course.lanes;
   const base = w * lanes;
   for (let l = 0; l < lanes; l++) run.doors[base + l] = DOOR_SHUT;
   // the free lanes (not a special one), shuffled; the first `open` of them get coloured doors
   let free = 0;
   const pick = SCRATCH_LANES;
   for (let l = 0; l < lanes; l++) if (l !== cracked && l !== ghost) pick[free++] = l;
   for (let i = free - 1; i > 0; i--) {
      const j = rand(run, i + 1);
      const t = pick[i];
      pick[i] = pick[j];
      pick[j] = t;
   }
   const n = Math.max(1, Math.min(open, free));
   const rule = run.roulette ? HERO_COLOR_INDEX[run.heroId] : rand(run, DOOR_COLORS.length);
   run.ruleColor[w] = rule;
   run.wallMode[w] = mode;
   const trueAt = pick[0];
   run.trueLane[w] = trueAt;
   if (mode === MODE_CODE.not) {
      // NOT this colour: every coloured door is the lamp's colour but one
      const other = (rule + 1 + rand(run, DOOR_COLORS.length - 1)) % DOOR_COLORS.length;
      run.doors[base + trueAt] = other;
      for (let i = 1; i < n; i++) run.doors[base + pick[i]] = rule;
   } else {
      // match the colour (or its chime): distinct colours, one of them the rule's
      run.doors[base + trueAt] = rule;
      let c = (rule + 1 + rand(run, DOOR_COLORS.length - 1)) % DOOR_COLORS.length;
      for (let i = 1; i < n; i++) {
         if (c === rule) c = (c + 1) % DOOR_COLORS.length;
         run.doors[base + pick[i]] = c;
         c = (c + 1) % DOOR_COLORS.length;
      }
   }
   if (cracked !== NONE) {
      run.doors[base + cracked] = DOOR_CRACKED;
      // a cracked fake door is always the wrong colour
      run.crackColor[w] = mode === MODE_CODE.not ? rule : (rule + 2) % DOOR_COLORS.length;
   }
   if (ghost !== NONE) run.doors[base + ghost] = DOOR_GHOST;
}

const SCRATCH_LANES = new Int8Array(8);

function freshHero(course: Course): Hero {
   const lane = Math.floor((course.lanes - 1) / 2);
   return {
      x: laneX(lane, course.lanes),
      y: 0,
      z: course.startZ,
      vy: 0,
      lane,
      state: "play",
      timerMs: 0,
      grounded: true,
      airJump: true,
      rollUntil: NONE,
      rollPending: false,
      surgeUntil: NONE,
      padUntil: NONE,
      dashUntil: NONE,
      rushUntil: NONE,
      stumbleUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      side: NONE,
      locked: false,
      v: course.speed,
   };
}

export interface RunOptions {
   roulette?: boolean;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, options: RunOptions = {}): DoorRun {
   const course = courseFor(level);
   const total = course.walls.length + (course.boss ? ARENA_MAX : 0);
   const run: DoorRun = {
      course,
      level,
      heroId,
      seed,
      roulette: options.roulette ?? false,
      rng: { s: seed >>> 0 },
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(course),
      pressMs: NONE,
      actionMs: NONE,
      powerReadyAt: 0,
      wallCount: course.walls.length,
      wallZ: new Float64Array(total),
      wallMode: new Int8Array(total),
      ruleColor: new Int8Array(total),
      trueLane: new Int8Array(total),
      crackColor: new Int8Array(total),
      doors: new Int8Array(total * course.lanes),
      slid: new Uint8Array(total),
      result: new Int8Array(total),
      resultMs: new Float64Array(total).fill(-1e9),
      nextWall: 0,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      ventHit: new Uint8Array(course.vents.length),
      combo: createCombo(),
      arenaLinks: 0,
      secrets: createSecretTracker(SECRETS[level]),
      wrong: 0,
      stumbles: 0,
      absorbed: 0,
      trueDoors: 0,
      streak: 0,
      bestStreak: 0,
      finishMs: 0,
      finishGate: course.finishZ,
      ended: null,
      events: createEvents(),
      boss: course.boss ? createBoss(FLICKER) : null,
      bossEv: createBossEvents(),
      bossOn: false,
      arenaSpawned: 0,
      rushStreak: 0,
      rushReady: false,
      p3Hits: 0,
      flick: { z: course.boss ? course.bossStartZ - 60 : 0, x: 0 },
      hazard: { kind: 0, z: 0, lane: 0, live: false },
   };
   for (const w of course.walls) {
      run.wallZ[w.index] = w.z;
      rollWall(run, w.index, MODE_CODE[w.mode], w.open, w.cracked, w.ghost);
   }
   return run;
}

// ---------- reads (HUD, visuals, bots) ----------

/** The wall's static def (null for an arena wall). */
export function wallDef(run: DoorRun, w: number): WallDef | null {
   return w < run.course.walls.length ? run.course.walls[w] : null;
}

export function doorAt(run: DoorRun, w: number, lane: number): number {
   return run.doors[w * run.course.lanes + lane];
}

/** Is this door the true one for its wall (the one the rule picks)? */
export function isTrueDoor(run: DoorRun, w: number, lane: number): boolean {
   return lane === run.trueLane[w];
}

export function bossAlive(run: Pick<DoorRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step !== "defeat" && b.step !== "done";
}

export function bossVulnerable(run: Pick<DoorRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

/** The arena walls' phase rule: 0 slam (match), 1 false cues (the sound rule, the lamp flickers), 2 three flames. */
export function arenaPhaseOf(run: DoorRun, w: number): number {
   if (w < run.course.walls.length) return NONE;
   return run.slid[w] === 2 ? 2 : run.wallMode[w] === MODE_CODE.sound ? 1 : 0;
}

/**
 * Phase 2's false cues: the lamp of an arena wall shows its true colour for 600 ms, then a fake one for
 * 200 ms (the card: the true one is held longest, and it chimes). Returns the colour shown at `ms`.
 */
export function cueColorAt(run: DoorRun, w: number, ms: number): number {
   const rule = run.ruleColor[w];
   if (run.wallMode[w] !== MODE_CODE.sound || w < run.course.walls.length) return rule;
   const t = ms % 800;
   if (t < 600) return rule;
   return (rule + 1 + (Math.floor(ms / 800) % (DOOR_COLORS.length - 1))) % DOOR_COLORS.length;
}

/** The current run speed's base (the level's, plus Flicker's phase 3 speed-ups). */
export function baseSpeed(run: DoorRun): number {
   return run.course.speed + run.p3Hits * P3_SPEEDUP;
}

/** The speed this ms: the base (a stumble slows it), plus the biggest boost up, never past vMax. */
export function speedNow(run: DoorRun, ms: number): number {
   const h = run.hero;
   if (h.state === "bounce") return 0;
   let v = baseSpeed(run);
   if (ms < h.stumbleUntil) v *= STUMBLE.factor;
   let boost = 0;
   if (ms < h.surgeUntil) boost = BOOST.surge;
   if (ms < h.padUntil && BOOST.pad > boost) boost = BOOST.pad;
   if (ms < h.dashUntil && BOOST.dash > boost) boost = BOOST.dash;
   if (ms < h.rushUntil && BOOST.rush > boost) boost = BOOST.rush;
   v += boost;
   return v > run.course.vMax ? run.course.vMax : v;
}

/** How far the next wall is (m), Infinity when none is left. */
export function nextWallGap(run: DoorRun): number {
   if (run.nextWall >= run.wallCount) return Infinity;
   return run.hero.z - run.wallZ[run.nextWall];
}

// ---------- the step ----------

export function advanceClock(run: DoorRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

/** The lane direction of a left / right press, camera-relative: -1, 0 or +1 along world x. */
export function laneDirection(left: boolean, right: boolean, yaw: number): number {
   const dx = (right ? 1 : 0) - (left ? 1 : 0);
   if (dx === 0) return 0;
   const c = Number.isFinite(yaw) ? Math.cos(yaw) : 1;
   if (Math.abs(c) >= 0.3) return Math.sign(c * dx);
   return dx;
}

/** One frame (dtMs = useRunFrame's dt · 1000). Returns run.events (the same object every step). */
export function step(run: DoorRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (whole <= 0) return ev;
   const h = run.hero;
   // the frame's presses act at its first ms
   if (input.jumpPressed || input.up) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   const dir = laneDirection(input.left, input.right, input.yaw);
   if (dir !== 0 && h.state === "play" && !h.locked && h.side === NONE) {
      const lane = Math.max(0, Math.min(run.course.lanes - 1, h.lane + dir));
      if (lane !== h.lane) {
         h.lane = lane;
         ev.laneChanged = true;
      }
   }
   if (input.down && h.state === "play") {
      if (h.grounded) startRoll(run, run.simMs + 1);
      else {
         h.rollPending = true;
         if (h.vy > -12) h.vy = -12;
      }
   }
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

function startRoll(run: DoorRun, ms: number): void {
   const h = run.hero;
   if (ms < h.rollUntil) return;
   h.rollUntil = ms + ROLL_MS;
   h.rollPending = false;
   run.events.rolled = true;
}

function tryPower(run: DoorRun, ms: number): void {
   const h = run.hero;
   const ev = run.events;
   // level 5: the red rush takes the button while it is charged
   if (run.rushReady) {
      run.rushReady = false;
      run.rushStreak = 0;
      h.rushUntil = ms + RUSH_MS;
      ev.rushFired = true;
      const b = run.boss;
      if (b && run.bossOn && bossVulnerable(run) && b.phase < 2) applyHit(run);
      return;
   }
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
      ev.dashed = true;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** Nami's second jump in the air (once per air). */
function airJump(run: DoorRun): boolean {
   const h = run.hero;
   if (h.grounded || !h.airJump || heroById(run.heroId).power !== "doubleJump") return false;
   h.airJump = false;
   h.vy = V_JUMP2;
   run.events.airJumped = true;
   run.events.jumped = true;
   return true;
}

function linkCombo(run: DoorRun, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

function stumble(run: DoorRun, ms: number): void {
   const h = run.hero;
   if (ms < h.shieldUntil) return;
   h.stumbleUntil = ms + STUMBLE.ms;
   h.surgeUntil = NONE;
   run.stumbles += 1;
   comboBreak(run.combo);
   run.events.stumbled = true;
}

function tick(run: DoorRun): void {
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
   if (h.state === "bounce") {
      h.timerMs -= 1;
      const into = BOUNCE_MS - h.timerMs;
      if (into <= BOUNCE_BACK_MS) h.z += BOUNCE_BACK / BOUNCE_BACK_MS;
      // the hall forgives: the true door opens, the hero hops over to it
      moveSideways(run, laneX(h.lane, c.lanes));
      h.v = 0;
      if (h.timerMs <= 0) {
         h.state = "play";
         run.pressMs = NONE;
      }
      run.actionMs = NONE;
      return;
   }
   if (run.actionMs !== NONE) {
      tryPower(run, ms);
      run.actionMs = NONE;
   }
   // jumping (a press buffered 130 ms), Nami's air jump, gravity, landing
   if (run.pressMs !== NONE) {
      if (h.grounded && ms >= h.rollUntil) {
         h.grounded = false;
         h.vy = V_JUMP;
         h.airJump = true;
         run.pressMs = NONE;
         ev.jumped = true;
      } else if (!h.grounded && airJump(run)) {
         run.pressMs = NONE;
         run.powerReadyAt = Math.max(run.powerReadyAt, ms + heroById(run.heroId).cooldownMs);
      }
   }
   if (!h.grounded) {
      h.vy -= G / 1000;
      h.y += h.vy / 1000;
      if (h.y <= 0) {
         h.y = 0;
         h.vy = 0;
         h.grounded = true;
         h.airJump = true;
         ev.landed = true;
         if (h.rollPending) startRoll(run, ms);
      }
   }
   // sideways: to the lane (or the side corridor)
   const sideDef = h.side !== NONE ? c.sides[h.side] : null;
   moveSideways(run, sideDef ? sideDef.x : laneX(h.lane, c.lanes));
   // forward: the z guard (the proof's one rule)
   const prevZ = h.z;
   const v = speedNow(run, ms);
   h.v = v;
   h.z -= v / 1000;
   // the side corridor: rejoin the hall at its end
   if (sideDef && h.z <= sideDef.z1) {
      h.side = NONE;
      h.lane = sideDef.lane;
      ev.sideLeft = true;
   }
   // level 5's arena: Flicker's walls spawn ahead while he is up
   if (run.bossOn) spawnArena(run);
   // the next wall: slide, lock, then the judgement at its plane
   if (run.nextWall < run.wallCount) {
      const w = run.nextWall;
      const gap = h.z - run.wallZ[w];
      const def = wallDef(run, w);
      if (def && def.slide && run.slid[w] === 0 && gap <= (v * SLIDE_MS) / 1000) slideWall(run, w);
      const lock = gap <= (v * LOCK_MS) / 1000;
      if (lock && !h.locked) ev.locked = true;
      h.locked = lock;
      if (prevZ > run.wallZ[w] && h.z <= run.wallZ[w]) meetWall(run, w, ms);
   } else h.locked = false;
   if (h.state !== "play") return;
   contacts(run, ms, prevZ);
   // the finish (level 5: once Flicker is down, at the gate)
   if (h.z <= run.finishGate && !bossAlive(run)) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function moveSideways(run: DoorRun, target: number): void {
   const h = run.hero;
   const d = target - h.x;
   const m = LANE_V / 1000;
   h.x += d > m ? m : d < -m ? -m : d;
}

function slideWall(run: DoorRun, w: number): void {
   const lanes = run.course.lanes;
   const base = w * lanes;
   const last = run.doors[base + lanes - 1];
   for (let l = lanes - 1; l > 0; l--) run.doors[base + l] = run.doors[base + l - 1];
   run.doors[base] = last;
   run.trueLane[w] = (run.trueLane[w] + 1) % lanes;
   run.slid[w] = 1;
   run.events.slid = w;
}

/** The hero meets wall w at its plane: the side corridor skips it, the upper row, then its door in the hero's lane. */
function meetWall(run: DoorRun, w: number, ms: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   run.nextWall = w + 1;
   h.locked = false;
   ev.wall = w;
   run.resultMs[w] = ms;
   const def = wallDef(run, w);
   if (h.side !== NONE) {
      run.result[w] = WALL.skipped;
      ev.wallResult = WALL.skipped;
      return;
   }
   if (run.result[w] === WALL.opened) {
      ev.wallResult = WALL.opened;
      return;
   }
   if (def && def.upper !== NONE && h.lane === def.upper && h.y >= UPPER_FEET) {
      passTrue(run, w, WALL.upper);
      return;
   }
   const door = doorAt(run, w, h.lane);
   if (door === DOOR_CRACKED && ms < h.dashUntil) {
      // Riko's dash smashes the fake door into the side corridor
      const s = c.sides.findIndex((q) => q.wall === w);
      run.result[w] = WALL.smashed;
      ev.wallResult = WALL.smashed;
      if (s >= 0) {
         h.side = s;
         ev.sideEntered = true;
      }
      return;
   }
   if (door === DOOR_GHOST && ms < h.phaseUntil) {
      passTrue(run, w, WALL.ghost);
      return;
   }
   if (door >= 0 && h.lane === run.trueLane[w]) {
      passTrue(run, w, WALL.truePass);
      return;
   }
   // wrong: Kiro's shield absorbs it, else the bounce
   if (ms < h.shieldUntil) {
      run.result[w] = WALL.absorbed;
      ev.wallResult = WALL.absorbed;
      run.absorbed += 1;
      return;
   }
   run.result[w] = WALL.wrong;
   ev.wallResult = WALL.wrong;
   run.wrong += 1;
   run.streak = 0;
   run.rushStreak = 0;
   comboBreak(run.combo);
   h.state = "bounce";
   h.timerMs = BOUNCE_MS;
   h.z = run.wallZ[w] + 0.6;
   h.lane = run.trueLane[w];
   h.surgeUntil = NONE;
   h.padUntil = NONE;
   h.dashUntil = NONE;
   h.rushUntil = NONE;
   h.rollUntil = NONE;
   h.grounded = true;
   h.y = 0;
   h.vy = 0;
}

function passTrue(run: DoorRun, w: number, kind: number): void {
   const h = run.hero;
   const ev = run.events;
   const ms = run.simMs;
   run.result[w] = kind;
   ev.wallResult = kind;
   run.trueDoors += 1;
   run.streak += 1;
   if (run.streak > run.bestStreak) run.bestStreak = run.streak;
   h.surgeUntil = ms + SURGE_MS;
   const arena = w >= run.course.walls.length;
   if (!arena) linkCombo(run, COMBO_BASE_MS.door);
   else {
      if (run.arenaLinks < ARENA_LINKS) {
         run.arenaLinks += 1;
         linkCombo(run, COMBO_BASE_MS.door);
      }
      // the red rush charges on true arena doors in a row (phases 1-2)
      const b = run.boss;
      if (b && bossAlive(run)) {
         if (b.phase < 2 && !run.rushReady) {
            run.rushStreak += 1;
            if (run.rushStreak >= RUSH_STREAK) {
               run.rushReady = true;
               ev.rushCharged = true;
            }
         }
         // phase 3: the flame behind the true door, while he is open
         if (b.phase === 2 && bossVulnerable(run)) applyHit(run);
      }
   }
}

function contacts(run: DoorRun, ms: number, prevZ: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const cy = h.y + ORB.centerY;
   const magnet = ms < h.magnetUntil;
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
   for (let i = 0; i < c.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = c.secrets[i];
      const dz = s.z - h.z;
      if (dz > SECRET_R || dz < -SECRET_R) continue;
      const dx = s.x - h.x;
      const dy = s.y - cy;
      if (dx * dx + dy * dy + dz * dz > SECRET_R * SECRET_R) continue;
      if (s.need === "ghost" && run.result[s.wall] !== WALL.ghost) continue;
      if (s.need === "upper" && run.result[s.wall] !== WALL.upper) continue;
      if (s.need === "side" && h.side === NONE) continue;
      if (collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
         ev.secretCount += 1;
      }
   }
   if (h.side !== NONE) return;
   // floor bars (jump them) and low beams (roll under them), across the hall
   for (let i = 0; i < c.bars.length; i++) {
      const b = c.bars[i];
      if (!(prevZ > b.z && h.z <= b.z)) continue;
      if (b.kind === "bar" ? h.y < BAR_CLEAR : !(ms < h.rollUntil && h.grounded)) stumble(run, ms);
   }
   // speed pads (grounded, in the pad's lane)
   for (let i = 0; i < c.pads.length; i++) {
      const p = c.pads[i];
      if (!(prevZ > p.z && h.z <= p.z)) continue;
      if (!h.grounded || Math.abs(h.x - laneX(p.lane, c.lanes)) > LANE_W * 0.45) continue;
      h.padUntil = ms + PAD_MS;
      ev.padded = true;
   }
   // Kiro's flame vents: a stumble without the shield (once per vent)
   for (let i = 0; i < c.vents.length; i++) {
      if (run.ventHit[i]) continue;
      const vt = c.vents[i];
      if (h.z > vt.z0 || h.z < vt.z1) continue;
      if (Math.abs(h.x - laneX(vt.lane, c.lanes)) > LANE_W * 0.42 || h.y > 1.1) continue;
      if (ms < h.shieldUntil) continue;
      run.ventHit[i] = 1;
      stumble(run, ms);
   }
   // Flicker's fire (level 5)
   const hz = run.hazard;
   if (hz.live && prevZ > hz.z && h.z <= hz.z) {
      hz.live = false;
      const hit = hz.kind === 0 ? h.y < BAR_CLEAR : hz.kind === 1 ? !(ms < h.rollUntil && h.grounded) : Math.abs(h.x - laneX(hz.lane, c.lanes)) < LANE_W * 0.45 && h.y < 1.2;
      if (hit) stumble(run, ms);
   }
}

/** Level 5: Flicker's arena walls, spawned ahead as the hero runs (rolled on the run's rng in the phase they spawn in). */
function spawnArena(run: DoorRun): void {
   const c = run.course;
   const b = run.boss!;
   while (run.arenaSpawned < ARENA_MAX && run.wallCount < run.wallZ.length) {
      const z = c.bossStartZ - ARENA.lead - run.arenaSpawned * ARENA.spacing;
      if (z < run.hero.z - 110) return;
      if (!bossAlive(run) && z <= run.finishGate + 8) return;
      const w = run.wallCount;
      run.wallZ[w] = z;
      const phase = bossAlive(run) ? b.phase : 0;
      // phases 1 and 3: match the flame; phase 2: the false cues (the sound rule, the lamp flickers)
      rollWall(run, w, phase === 1 ? MODE_CODE.sound : MODE_CODE.match, phase === 2 ? 3 : c.lanes - 1, NONE, NONE);
      run.slid[w] = phase === 2 ? 2 : 0;
      run.wallCount += 1;
      run.arenaSpawned += 1;
      run.events.arenaSpawned = true;
   }
}

/** Level 5: the boss's machine, its fire and its place, one ms (rules time). */
function bossMs(run: DoorRun): void {
   const b = run.boss!;
   const ev = run.bossEv;
   const h = run.hero;
   const c = run.course;
   const wasAlive = bossAlive(run);
   stepBoss(b, FLICKER, 1, ev);
   if (ev.telegraph) run.events.bossTelegraph = true;
   if (ev.attack) {
      run.events.bossAttack = true;
      // the fire comes 1.1 s ahead of the hero: a wave (jump), an arc (roll), a lane of fire (leave the lane)
      const hz = run.hazard;
      hz.kind = b.phase === 0 ? 0 : b.phase === 1 ? 1 : 2;
      hz.z = h.z - Math.max(8, (h.v || c.speed) * 1.1);
      hz.lane = h.lane;
      hz.live = true;
      // never on a wall's plane: the fire comes between two walls
      for (let w = run.nextWall; w < run.wallCount; w++) {
         const wz = run.wallZ[w];
         if (wz < hz.z - 8) break;
         if (Math.abs(hz.z - wz) < 6) hz.z = wz + 7 < h.z - 4 ? wz + 7 : wz - 7;
      }
   }
   if (wasAlive && !bossAlive(run)) {
      // the doors swing open: the finish gate comes up ahead (never past the static finish)
      run.finishGate = Math.min(c.finishZ, h.z - GATE_AHEAD);
      for (let w = run.nextWall; w < run.wallCount; w++) run.result[w] = WALL.opened;
      run.rushReady = false;
      run.hazard.live = false;
   }
   // Flicker races ahead; while he is open he drops back towards the hero
   const target = h.z - (b.step === "vulnerable" ? FLICK.open : FLICK.lead);
   const d = target - run.flick.z;
   const m = FLICK.chase / 1000;
   run.flick.z += d > m ? m : d < -m ? -m : d;
}

function applyHit(run: DoorRun): void {
   const before = run.boss!.phase;
   const r = hitBoss(run.boss!, FLICKER, 1, run.bossEv);
   if (r === "ignored") return;
   run.events.bossHit = true;
   // phase 3: each flame hit, faster
   if (before === 2) run.p3Hits = Math.min(3, run.p3Hits + 1);
   if (r === "phase") run.events.bossPhase = true;
   if (r === "defeated") run.events.bossDefeated = true;
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

/** The hall's floor and side walls near z (the camera stays inside the hall, over the floor). */
export function hallBoxes(course: Course, z: number, reach: number, out: SolidBox[]): number {
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
   put(-60, 60, -20, -0.05);
   // the side walls (4 m high): the camera stays inside the hall at eye height, and may rise over them
   put(course.half, course.half + 3, -20, 4);
   put(-course.half - 3, -course.half, -20, 4);
   return n;
}

// ---------- the store hand-off (README "Scoring") ----------

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   distance: "distance",
   finishMs: "finishMs",
   hero: "hero",
   power: "power",
   /** speed, tenths of m/s */
   speed: "speed",
   walls: "walls",
   wrong: "wrong",
   streak: "streak",
   rush: "rush",
   rushStreak: "rushStreak",
   /** the lamp in view: its colour (-1 none), 0 match / 1 sound (dimmed) / 2 NOT, 1 = an echo lamp */
   lampColor: "lampColor",
   lampMode: "lampMode",
   lampEcho: "lampEcho",
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

/** The run time a player sees and submits: play ms minus the orb bonus and the flow bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge of this game (the card): no wrong door. */
export function badgeHits(run: DoorRun): number {
   return run.wrong;
}

/**
 * The lamp a player can read now (the HUD's rule card copies it): the next wall's own lamp once it is
 * within LAMP_VIEW m (or passed). An echo wall's rule hung two walls early, so while the next wall is
 * an echo wall the card shows the echo lamp of the wall after it (marked "after next") once that one
 * is in view, and never the next wall's own rule (that one the player remembers).
 */
export const LAMP_VIEW = 48;
export function lampInView(run: DoorRun, out: { color: number; mode: number; echo: boolean; wall: number }): { color: number; mode: number; echo: boolean; wall: number } {
   const h = run.hero;
   const c = run.course;
   out.color = NONE;
   out.mode = 0;
   out.echo = false;
   out.wall = NONE;
   const w = run.nextWall;
   if (w >= run.wallCount || run.result[w] !== WALL.pending) return out;
   const lampZ = (q: number) => (q < c.walls.length ? c.lamps[q].z : run.wallZ[q] + 15);
   const isEcho = (q: number) => q < c.walls.length && c.lamps[q].echo;
   let show = NONE;
   if (!isEcho(w)) {
      if (h.z - lampZ(w) <= LAMP_VIEW) show = w;
   } else if (w + 1 < run.wallCount && isEcho(w + 1) && h.z - lampZ(w + 1) <= LAMP_VIEW) show = w + 1;
   if (show === NONE) return out;
   out.wall = show;
   out.color = cueColorAt(run, show, run.simMs);
   const def = wallDef(run, show);
   out.mode = run.wallMode[show] === MODE_CODE.not ? 2 : def && def.dim ? 1 : 0;
   out.echo = isEcho(show);
   return out;
}

/** The run's distance so far (m). */
export function distanceOf(run: DoorRun): number {
   return Math.max(0, run.course.startZ - run.hero.z);
}
