// Temple Coin Rush rules (the design card's COLLECT AND PAY): a three-lane auto-run along -z through a
// collapsing temple with a rolling boulder at your heels. Coins go into a purse that lasts only for
// the run. Every 12-18 s a toll gate splits the path: run through a toll lane with enough coins and
// they are spent (the gate opens onto a short, clean, coin-rich fast lane with a run boost); without
// enough the gate stays shut and pushes you into a slow lane (longer, with traps, and the boulder
// gains 1.5 m). Unspent coins at the finish score double, so every gate is a choice: buy speed or bank
// points. The boulder chases at a 6 m gap that shrinks with every stumble and grows with every perfect
// lane; when it catches you it costs a life (3 lives). Hero gates: Riko's cracked side walls (a free
// toll), Nami's ledge coins (double jump), Kiro's shield (fire-jet pillars, knocks), Zuno's hidden coin
// veins (magnet), Vexa's ghost gate (phase). Level 2 spike tiles, level 3 broken tiles that fall
// behind the boulder's rumble wave, level 4 side-ramp boulders and price surges, level 5 Coilstone,
// the Temple Serpent (menu2/boss), paid with bells and offering bowls.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
//
// Clock: whole ms, the fraction carried, stepped 1 ms at a time: the same run at 30, 60 or 144 fps.
// No allocation after createRun(). README "Rules" and "Server limits" explain the proof.
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboTick, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, heroById, type HeroId } from "./heroes";
import { LEVELS, type TempleLevel } from "./levels";
import { COIN, HALF, HAZ, LANES, LANE_W, NONE, TIER, buildTemple, laneX, type CoinDef, type CrossDef, type GateDef, type HazardDef, type LaneRoute, type OrbDef, type SecretSpot } from "./temples";
import { COILSTONE, COMBO, COMBO_BASE_PER_COIN, SECRETS } from "./progression";

export { NONE };
export type { CoinDef, CrossDef, GateDef, HazardDef, LaneRoute, OrbDef, SecretSpot };

// ---------- tuning (1 unit = 1 m, the run goes along -z, up is +y) ----------

export const MAX_STEP_MS = 50;
export const HERO = { height: 1.3, rollHeight: 0.7 } as const;
/** every boost on top of the level's run speed is capped at this (m/s): V_MAX = speed + BOOST_CAP */
export const BOOST_CAP = 6;
/** a slow lane is the longer way round: this share of the run speed */
export const SLOW_FACTOR = 0.9;
/** a stumble (a block, a beam, a jet, a spike, a side boulder, a coil): this share of the speed for this long */
export const STUMBLE = { factor: 0.45, ms: 700 } as const;
/** sideways (m/s): a lane change of 2.4 m takes about 0.17 s */
export const LANE_V = 14;
/** a jump (apex about 1.29 m, 0.61 s), Nami's second jump (apex about 1.61 m more) */
export const V_JUMP = 8.5;
export const V_JUMP2 = 9.5;
export const G = 28;
export const JUMP_BUFFER_MS = 130;
export const ROLL_MS = 700;
/** a stone block is cleared with the feet this high */
export const BLOCK_CLEAR = 0.85;
/** coins and relic orbs: pickup radius round the hero's middle, the middle's height over the feet */
export const PICKUP = { r: 1.0, centerY: 0.6 } as const;
export const SECRET_R = 1.4;
/**
 * The boulder (level 5: Coilstone's head): the gap (m) behind the hero. It starts at `base`, shrinks by
 * `stumble` on a stumble, by `slow` over a slow lane's section and by `lunge` on a serpent lunge, grows
 * by `perfect` on a perfect lane (no stumble, every low coin) and creeps back to `base` at `regen` m/s
 * once 2 s pass without a stumble. At `catch` or less it catches you: a life, and it falls back to `base`.
 */
export const GAP = { base: 6, max: 9, catch: 0.8, stumble: 1.6, slow: 1.5, perfect: 1, lunge: 3, regen: 0.12, regenAfterMs: 2000 } as const;
export const LIVES = 3;
/** after a catch or a fall: no stumble and no catch for this long */
export const RECOVER_MS = 1500;
/** a toll gate's approach (m): its price shows from here (and level 4's surge counts here) */
export const APPROACH = 40;
/** level 4: the price rises by 1 for every this many ms of the approach spent outside a toll lane */
export const SURGE_MS = 2000;
/** spike tiles: up for `up` ms of every `cycle` ms */
export const SPIKE = { cycle: 1500, up: 600, half: 0.9 } as const;
/** broken tiles fall this long after the boulder's rumble wave passes them; the tile's half length */
export const BROKEN = { fallMs: 500, half: 0.95 } as const;
/** the boulder's rumble wave (level 3+): one every `everyMs`, rolling `ahead` m/s faster than the run, for `reach` m */
export const RUMBLE = { everyMs: 3500, ahead: 12, reach: 26, max: 4 } as const;
/** level 4's side-ramp boulders: they roll out once the hero is `lead` m away, across at `vx` m/s; hit within `r` */
export const CROSS = { lead: 13, vx: 7, r: 1.3, start: HALF + 1.2 } as const;
/** a fire jet's flame: across this much of its lane (m), this high */
export const JET = { half: 1.0, height: 2.4 } as const;

/** Level 5's arena: a section every `spacing` m from `lead` m past the boss start, at most `max` of them. */
export const ARENA = { lead: 40, spacing: 40, max: 60, coins: 10, bell: [20, 30], bowl: 10 } as const;
/** level 5: at most this many arena coins link the combo (the arena keeps coming while Coilstone is up) */
export const ARENA_LINKS = 60;
/** level 5: banked coins count up to the static bound plus this many (the arena's coins are for paying) */
export const ARENA_BANK = 0;
/** after the defeat the finish gate stands this far ahead */
export const GATE_AHEAD = 45;

/** What happened at a gate (run.gateResult), for the visuals. */
export const GATE = { pending: 0, paid: 1, free: 2, ghost: 3, slow: 4, shut: 5 } as const;

// ---------- the course ----------

export interface Course {
   level: LevelId;
   speed: number;
   vMax: number;
   durationMs: number;
   parMs: number;
   finishBonus: number;
   boss: boolean;
   gates: GateDef[];
   coins: CoinDef[];
   orbs: OrbDef[];
   hazards: HazardDef[];
   crosses: CrossDef[];
   /** the level's secrets (progression.ts SECRETS order) */
   secrets: SecretSpot[];
   /** per gate and lane (gate * LANES + lane): the section's low coins (a perfect lane takes them all) */
   laneCoins: number[][];
   half: number;
   startZ: number;
   finishZ: number;
   bossStartZ: number;
   /** the most coins any run can bank (the score's cap; level 5: the static bound plus ARENA_BANK) */
   bankCap: number;
}

export function buildCourse(level: TempleLevel = LEVELS[1]): Course {
   const d = buildTemple(level);
   const secrets = SECRETS[level.id].map((s) => {
      const p = d.secrets[s.id];
      if (!p) throw new Error(`temple-coin-rush L${level.id}: secret ${s.id} is not placed`);
      return p;
   });
   const laneCoins: number[][] = [];
   for (let g = 0; g < d.gates.length * LANES; g++) laneCoins.push([]);
   d.coins.forEach((c, i) => {
      if (c.gate !== NONE && c.need === 0 && c.y < 2) laneCoins[c.gate * LANES + c.lane].push(i);
   });
   const course: Course = {
      level: level.id,
      speed: level.speed,
      vMax: level.speed + BOOST_CAP,
      durationMs: level.durationMs,
      parMs: level.parMs,
      finishBonus: level.finishBonus,
      boss: level.boss,
      gates: d.gates,
      coins: d.coins,
      orbs: d.orbs,
      hazards: d.hazards,
      crosses: d.crosses,
      secrets,
      laneCoins,
      half: HALF,
      startZ: d.startZ,
      finishZ: d.finishZ,
      bossStartZ: d.bossStartZ,
      bankCap: 0,
   };
   course.bankCap = staticBankBound(course) + (level.boss ? ARENA_BANK : 0);
   return course;
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

// ---------- the bounds (README "Server limits and why they hold") ----------

const ALL_HEROES: readonly HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/**
 * The most coins one hero can hold at the finish of the static course, ignoring whether it could afford
 * each toll (an over-estimate): every common coin it can reach (Zuno's veins only with the magnet), and
 * at each gate the best of its lanes: a slow lane's coins (its ledge coins too, and the ghost passage's
 * for Vexa), a toll lane's coins less the price, or (Riko, at a cracked wall) a toll lane's coins free.
 */
export function heroBankBound(course: Course, hero: HeroId): number {
   const zuno = hero === "zuno";
   let total = 0;
   const nami = hero === "nami";
   for (const c of course.coins) if (c.gate === NONE && (c.need === 0 || (c.need === 1 && zuno))) total += c.value;
   for (const g of course.gates) {
      const laneSum = (l: number, ghost: boolean) => {
         let s = 0;
         for (const c of course.coins) if (c.gate === g.index && c.lane === l && ((c.need === 0 && (c.y < 2 || nami)) || (c.need === 2 && ghost))) s += c.value;
         return s;
      };
      let best = -Infinity;
      for (let l = 0; l < LANES; l++) {
         const r = g.lanes[l];
         if (r.tier === TIER.slow) best = Math.max(best, laneSum(l, false));
         else {
            best = Math.max(best, laneSum(l, false) - r.price);
            if (hero === "riko" && g.cracked !== NONE) best = Math.max(best, laneSum(l, false));
         }
         if (hero === "vexa" && l === g.ghost) best = Math.max(best, laneSum(l, true));
      }
      total += Math.max(0, best);
   }
   return total;
}

export function staticBankBound(course: Course): number {
   let best = 0;
   for (const h of ALL_HEROES) best = Math.max(best, heroBankBound(course, h));
   return best;
}

/**
 * The least ms to run from the start to z by the speed guard: speedNow never exceeds the level's speed
 * plus, inside a gate's section, that gate's biggest toll boost (a slow lane, a stumble only slow it;
 * nothing else adds speed), so every metre takes at least 1 / that speed. Less 4 ms for a step that
 * started before the line.
 */
export function runFloorMs(course: Course, z: number): number {
   let len = course.startZ - z;
   let ms = 0;
   for (const g of course.gates) {
      const a = Math.min(g.z, course.startZ);
      const b = Math.max(g.z1, z);
      if (a <= b) continue;
      let boost = 0;
      for (const r of g.lanes) boost = Math.max(boost, r.boost);
      len -= a - b;
      ms += ((a - b) * 1000) / (course.speed + boost);
   }
   return Math.max(0, ms + (len * 1000) / course.speed - 4);
}

export function progressFloorMs(course: Course): number {
   return runFloorMs(course, course.finishZ);
}

/** The earliest rules ms Coilstone can be down: every open window hit at its first ms (menu2/boss). */
export function bossMinMs(): number {
   const s = createBoss(COILSTONE);
   const ev = createBossEvents();
   for (let ms = 1; ms < 900_000; ms++) {
      stepBoss(s, COILSTONE, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, COILSTONE, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/**
 * Level 5's floor, the larger of two: the boss machine's own least time after the boss start, and the
 * coins: every hit needs its own paid arena section (a bell or a bowl row, one payment per plane), so
 * the last of COILSTONE.maxHp payments is at section maxHp - 1's plane at the earliest; the defeat comes
 * no earlier, and the finish gate then stands GATE_AHEAD m further on.
 */
export function bossFloorMs(course: Course): number {
   if (!course.boss) return 0;
   const lastPay = course.bossStartZ - ARENA.lead - (COILSTONE.maxHp - 1) * ARENA.spacing;
   return Math.max(runFloorMs(course, course.bossStartZ) + BOSS_MIN_MS - 2, runFloorMs(course, lastPay - GATE_AHEAD));
}

export function minFinishMs(course: Course): number {
   const z = progressFloorMs(course);
   return course.boss ? Math.max(z, bossFloorMs(course)) : z;
}

/** The time bonus (points): one per whole 0.1 s under the par time. */
export function timeBonus(course: Course, finishMs: number): number {
   return Math.max(0, Math.floor((course.parMs - finishMs) / 100));
}

/** The most points any run of this level can score: the finish bonus, the bank x2 at its cap, the best time bonus. */
export function maxScoreBound(course: Course): number {
   return course.finishBonus + 2 * course.bankCap + timeBonus(course, minFinishMs(course));
}

/**
 * The most a run that ends at `t` ms can score: a win only from minFinishMs on (maxScoreBound); before
 * that a lost run scores its bank x2, and by `t` the hero has reached at most the coins within
 * vMax t m of the start (plus the magnet's reach).
 */
export function scoreBoundAt(course: Course, t: number): number {
   if (t >= minFinishMs(course)) return maxScoreBound(course);
   const zReach = course.startZ - (course.vMax * t) / 1000 - MAGNET_REACH;
   let units = 0;
   for (const c of course.coins) if (c.z >= zReach) units += c.value;
   return 2 * Math.min(course.bankCap, units);
}

export interface LevelLimits {
   kind: "points";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   base: number;
   maxPointsPerSec: number;
}

/**
 * maxScore = the bound plus 3 % (rounded up to 10); base + maxPointsPerSec x s covers scoreBoundAt at
 * every ms (base: the bound at 4 s); the duration window is 1 s to the level's clock.
 */
export function proposeLimits(course: Course): LevelLimits {
   const maxScore = Math.ceil((maxScoreBound(course) * 1.03) / 10) * 10;
   const base = Math.ceil(scoreBoundAt(course, 4000) * 1.03);
   let pps = 0;
   for (let t = 1000; t <= course.durationMs; t += 250) pps = Math.max(pps, (scoreBoundAt(course, t) - base) / (t / 1000));
   return { kind: "points", maxScore, minDurationMs: 1000, maxDurationMs: course.durationMs, base, maxPointsPerSec: Math.ceil(pps * 1.03) };
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
   lane: number;
   grounded: boolean;
   airJump: boolean;
   rollUntil: number;
   rollPending: boolean;
   dashUntil: number;
   stumbleUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   recoverUntil: number;
   /** the gate whose section it runs in (NONE between sections), and how it entered (GATE.*) */
   route: number;
   routeKind: number;
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
   /** the hero power (E / Enter / the Power button) */
   actionPressed: boolean;
   /** the camera's yaw (rad): the orbit camera's viewYaw; left / right are turned camera-relative */
   yaw: number;
}

export function createStepInput(): StepInput {
   return { left: false, right: false, up: false, down: false, jumpPressed: false, actionPressed: false, yaw: 0 };
}

export interface StepEvents {
   laneChanged: boolean;
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   rolled: boolean;
   /** a gate met this step (index; NONE), and how (GATE.*), the coins paid */
   gate: number;
   gateResult: number;
   paid: number;
   /** a section ended this step: its gate, and whether it was a perfect lane */
   sectionEnd: number;
   perfect: boolean;
   stumbled: boolean;
   caught: boolean;
   fell: boolean;
   lifeLost: boolean;
   coinCount: number;
   /** coin indices (static coins; arena coins are -1 - (section * ARENA.coins + k)) */
   coinList: number[];
   orbCount: number;
   orbList: number[];
   powered: boolean;
   dashed: boolean;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   rumble: boolean;
   tileFell: number;
   crossStarted: number;
   finished: boolean;
   lost: boolean;
   timeup: boolean;
   /** level 5 */
   bellPaid: boolean;
   bowlPaid: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   lunged: boolean;
}

function createEvents(): StepEvents {
   return {
      laneChanged: false,
      jumped: false,
      airJumped: false,
      landed: false,
      rolled: false,
      gate: NONE,
      gateResult: 0,
      paid: 0,
      sectionEnd: NONE,
      perfect: false,
      stumbled: false,
      caught: false,
      fell: false,
      lifeLost: false,
      coinCount: 0,
      coinList: new Array<number>(48).fill(0),
      orbCount: 0,
      orbList: [0, 0, 0, 0],
      powered: false,
      dashed: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      rumble: false,
      tileFell: NONE,
      crossStarted: NONE,
      finished: false,
      lost: false,
      timeup: false,
      bellPaid: false,
      bowlPaid: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      lunged: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.laneChanged = false;
   ev.jumped = false;
   ev.airJumped = false;
   ev.landed = false;
   ev.rolled = false;
   ev.gate = NONE;
   ev.gateResult = 0;
   ev.paid = 0;
   ev.sectionEnd = NONE;
   ev.perfect = false;
   ev.stumbled = false;
   ev.caught = false;
   ev.fell = false;
   ev.lifeLost = false;
   ev.coinCount = 0;
   ev.orbCount = 0;
   ev.powered = false;
   ev.dashed = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.rumble = false;
   ev.tileFell = NONE;
   ev.crossStarted = NONE;
   ev.finished = false;
   ev.lost = false;
   ev.timeup = false;
   ev.bellPaid = false;
   ev.bowlPaid = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
   ev.lunged = false;
}

/** The coin purse: a run's own, or (co-op) one shared by the team. */
export interface Purse {
   coins: number;
}

/** Coilstone's live attack (level 5): 0 a lunge at a lane, 1 a low coil to jump, 2 a high coil to roll under. */
export interface BossHazard {
   kind: number;
   z: number;
   lane: number;
   live: boolean;
}

export interface TempleRun {
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
   purse: Purse;
   /** coin units taken, paid (static tolls plus bells and bowls), static tolls paid */
   taken: number;
   spent: number;
   tolls: number;
   lives: number;
   gap: number;
   /** the boulder's (or the serpent's head) z: hero z + gap */
   lastStumble: number;
   stumbles: number;
   catches: number;
   /** the next gate to meet, each gate's result and its live price */
   nextGate: number;
   gateResult: Int8Array;
   gatePrice: Int16Array;
   gateMs: Float64Array;
   /** ms of the approach spent outside a toll lane (level 4's surge) */
   hesitation: Float64Array;
   /** versus (multiplayer.ts): a toll lane another hero just paid stays open until this ms (gate * LANES + lane) */
   openUntil: Float64Array;
   /** the section's stumbles (a perfect lane has none) */
   sectionStumbles: number;
   perfects: number;
   collected: Uint8Array;
   /** relic orbs: a bit per orb, and how many */
   orbMask: number;
   orbs: number;
   hazardHit: Uint8Array;
   /** broken tiles: the ms each one falls (Infinity: still standing) */
   tileFall: Float64Array;
   waveZ: Float64Array;
   waveFrom: Float64Array;
   waveLive: Uint8Array;
   nextWaveMs: number;
   crossStart: Float64Array;
   crossHit: Uint8Array;
   combo: ComboState;
   arenaLinks: number;
   secrets: SecretTracker;
   finishMs: number;
   finishGate: number;
   ended: "win" | "lose" | "timeup" | null;
   events: StepEvents;
   /** level 5 */
   boss: BossState | null;
   bossEv: BossEvents;
   bossOn: boolean;
   pendingHits: number;
   hazard: BossHazard;
   coilCount: number;
   arenaSpawned: number;
   arenaZ: Float64Array;
   arenaPhase: Int8Array;
   /** per section: its coins taken (a bit per coin), whether its toll was paid */
   arenaTaken: Uint16Array;
   arenaPaid: Uint8Array;
   arenaMet: number;
}

function freshHero(course: Course): Hero {
   return {
      x: laneX(1),
      y: 0,
      z: course.startZ,
      vy: 0,
      lane: 1,
      grounded: true,
      airJump: true,
      rollUntil: NONE,
      rollPending: false,
      dashUntil: NONE,
      stumbleUntil: NONE,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      recoverUntil: NONE,
      route: NONE,
      routeKind: GATE.pending,
      v: course.speed,
   };
}

export interface RunOptions {
   /** co-op: the team's shared purse */
   purse?: Purse;
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, options: RunOptions = {}): TempleRun {
   const course = courseFor(level);
   const g = course.gates.length;
   const run: TempleRun = {
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
      powerReadyAt: 0,
      purse: options.purse ?? { coins: 0 },
      taken: 0,
      spent: 0,
      tolls: 0,
      lives: LIVES,
      gap: GAP.base,
      lastStumble: -1e9,
      stumbles: 0,
      catches: 0,
      nextGate: 0,
      gateResult: new Int8Array(g),
      gatePrice: Int16Array.from(course.gates.map((q) => Math.max(0, ...q.lanes.map((r) => r.price)))),
      gateMs: new Float64Array(g).fill(-1e9),
      hesitation: new Float64Array(g),
      openUntil: new Float64Array(g * LANES).fill(-1),
      sectionStumbles: 0,
      perfects: 0,
      collected: new Uint8Array(course.coins.length),
      orbMask: 0,
      orbs: 0,
      hazardHit: new Uint8Array(course.hazards.length),
      tileFall: new Float64Array(course.hazards.length).fill(Infinity),
      waveZ: new Float64Array(RUMBLE.max),
      waveFrom: new Float64Array(RUMBLE.max),
      waveLive: new Uint8Array(RUMBLE.max),
      nextWaveMs: RUMBLE.everyMs,
      crossStart: new Float64Array(course.crosses.length).fill(NONE),
      crossHit: new Uint8Array(course.crosses.length),
      combo: createCombo(),
      arenaLinks: 0,
      secrets: createSecretTracker(SECRETS[level]),
      finishMs: 0,
      finishGate: course.finishZ,
      ended: null,
      events: createEvents(),
      boss: course.boss ? createBoss(COILSTONE) : null,
      bossEv: createBossEvents(),
      bossOn: false,
      pendingHits: 0,
      hazard: { kind: 0, z: 0, lane: 0, live: false },
      coilCount: 0,
      arenaSpawned: 0,
      arenaZ: new Float64Array(course.boss ? ARENA.max : 0),
      arenaPhase: new Int8Array(course.boss ? ARENA.max : 0),
      arenaTaken: new Uint16Array(course.boss ? ARENA.max : 0),
      arenaPaid: new Uint8Array(course.boss ? ARENA.max : 0),
      arenaMet: 0,
   };
   return run;
}

// ---------- reads (HUD, visuals, bots) ----------

/** A gate's live price in a lane (0 for a slow lane): level 4's surge adds to every toll. */
export function priceOf(run: TempleRun, g: number, lane: number): number {
   const gate = run.course.gates[g];
   const r = gate.lanes[lane];
   if (r.tier === TIER.slow) return 0;
   return r.price + (gate.surge ? Math.floor(run.hesitation[g] / SURGE_MS) : 0);
}

export function bossAlive(run: Pick<TempleRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step !== "defeat" && b.step !== "done";
}

export function bossVulnerable(run: Pick<TempleRun, "boss">): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

/** The boulder's (level 5: the serpent's head) z. */
export function chaserZ(run: TempleRun): number {
   return run.hero.z + run.gap;
}

/** A spike tile is up at ms. */
export function spikeUp(hz: HazardDef, ms: number): boolean {
   return (ms + hz.phase) % SPIKE.cycle < SPIKE.up;
}

/** A broken tile is a pit at ms (it has fallen). */
export function tileDown(run: TempleRun, i: number, ms = run.simMs): boolean {
   return ms >= run.tileFall[i];
}

/** A side-ramp boulder's x at ms (NaN before it rolls and after it has crossed). */
export function crossX(run: TempleRun, i: number, ms = run.simMs): number {
   const t0 = run.crossStart[i];
   if (t0 < 0) return Number.NaN;
   const c = run.course.crosses[i];
   const x = c.side * CROSS.start - (c.side * CROSS.vx * (ms - t0)) / 1000;
   return Math.abs(x) > CROSS.start + 0.01 ? Number.NaN : x;
}

/** The arena section's coin k: its position (level 5). */
export function arenaCoin(run: TempleRun, s: number, k: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = laneX(s % LANES);
   out.y = COIN.y;
   out.z = run.arenaZ[s] + 32 - k * COIN.spacing;
   return out;
}

/** The arena section's toll: a bell gate in the middle lane (phases 1-2) or a row of offering bowls (phase 3). */
export function arenaToll(run: TempleRun, s: number): { bowls: boolean; price: number } {
   const p = run.arenaPhase[s];
   return p >= 2 ? { bowls: true, price: ARENA.bowl } : { bowls: false, price: ARENA.bell[p] };
}

export function baseSpeed(run: TempleRun): number {
   return run.course.speed;
}

/** The speed this ms: the base (a slow lane and a stumble slow it), plus a toll lane's boost in its section, never past vMax. */
export function speedNow(run: TempleRun, ms: number): number {
   const h = run.hero;
   let v = baseSpeed(run);
   let boost = 0;
   if (h.route !== NONE) {
      const g = run.course.gates[h.route];
      if (h.routeKind === GATE.slow || h.routeKind === GATE.shut || h.routeKind === GATE.ghost) v *= SLOW_FACTOR;
      else boost = g.lanes[h.lane].boost;
   }
   if (ms < h.stumbleUntil) v *= STUMBLE.factor;
   v += boost;
   return v > run.course.vMax ? run.course.vMax : v;
}

/** How far the next gate is (m), Infinity when none is left. */
export function nextGateGap(run: TempleRun): number {
   if (run.nextGate >= run.course.gates.length) return Infinity;
   return run.hero.z - run.course.gates[run.nextGate].z;
}

/** The run's distance so far (m). */
export function distanceOf(run: TempleRun): number {
   return Math.max(0, run.course.startZ - run.hero.z);
}

/** The banked coins the score counts (capped at the level's bound). */
export function bankOf(run: TempleRun): number {
   return Math.min(run.course.bankCap, run.purse.coins);
}

/** The run's score (the card's board): the bank x2, and on a win the finish bonus and the time bonus. The coin combo is juice. */
export function scoreOf(run: TempleRun): number {
   const base = 2 * bankOf(run);
   if (run.ended !== "win") return base;
   return base + run.course.finishBonus + timeBonus(run.course, run.finishMs);
}

// ---------- the step ----------

export function advanceClock(run: TempleRun, dtMs: number): number {
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
export function step(run: TempleRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (whole <= 0) return ev;
   const h = run.hero;
   if (input.jumpPressed || input.up) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   // lanes: free between sections; inside a section the dividers keep the hero in its channel
   const dir = laneDirection(input.left, input.right, input.yaw);
   if (dir !== 0 && h.route === NONE) {
      const lane = Math.max(0, Math.min(LANES - 1, h.lane + dir));
      if (lane !== h.lane) {
         h.lane = lane;
         ev.laneChanged = true;
      }
   }
   if (input.down) {
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

function startRoll(run: TempleRun, ms: number): void {
   const h = run.hero;
   if (ms < h.rollUntil) return;
   h.rollUntil = ms + ROLL_MS;
   h.rollPending = false;
   run.events.rolled = true;
}

function tryPower(run: TempleRun, ms: number): void {
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
      ev.dashed = true;
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** Nami's second jump in the air (once per air). */
function airJump(run: TempleRun): boolean {
   const h = run.hero;
   if (h.grounded || !h.airJump || heroById(run.heroId).power !== "doubleJump") return false;
   h.airJump = false;
   h.vy = V_JUMP2;
   run.events.airJumped = true;
   run.events.jumped = true;
   return true;
}

function linkCombo(run: TempleRun, value: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, COMBO_BASE_PER_COIN * value);
   run.events.comboBonus += bonus;
   run.events.comboLinked = true;
}

/** A knock (Kiro's shield and the recovery after a catch ignore it): slowed, the chain broken, the boulder closer. */
function stumble(run: TempleRun, ms: number, gapLoss: number = GAP.stumble): void {
   const h = run.hero;
   if (ms < h.shieldUntil || ms < h.recoverUntil) return;
   h.stumbleUntil = ms + STUMBLE.ms;
   run.stumbles += 1;
   run.sectionStumbles += 1;
   run.lastStumble = ms;
   run.gap -= gapLoss;
   comboBreak(run.combo);
   run.events.stumbled = true;
}

/** A life lost (the boulder caught you, or a fall): at 0 the run is over. */
function loseLife(run: TempleRun, ms: number): void {
   const h = run.hero;
   run.lives -= 1;
   run.events.lifeLost = true;
   comboBreak(run.combo);
   if (run.lives <= 0) {
      run.ended = "lose";
      run.events.lost = true;
      return;
   }
   run.gap = GAP.base;
   h.recoverUntil = ms + RECOVER_MS;
   h.stumbleUntil = ms + STUMBLE.ms;
}

function tick(run: TempleRun): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   const ev = run.events;
   if (run.boss) {
      if (!run.bossOn && h.z <= c.bossStartZ) {
         run.bossOn = true;
         run.gap = GAP.base;
      }
      if (run.bossOn) bossMs(run);
   }
   comboTick(run.combo, COMBO, ms);
   if (run.pressMs !== NONE && ms - run.pressMs > JUMP_BUFFER_MS) run.pressMs = NONE;
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
   // sideways: to the lane
   const tx = laneX(h.lane);
   const d = tx - h.x;
   const m = LANE_V / 1000;
   h.x += d > m ? m : d < -m ? -m : d;
   // forward: the z guard (the proof's one rule)
   const prevZ = h.z;
   const v = speedNow(run, ms);
   h.v = v;
   h.z -= v / 1000;
   if (run.bossOn) spawnArena(run);
   // the next gate: the approach (the surge), then the gate's plane
   if (run.nextGate < c.gates.length) {
      const g = c.gates[run.nextGate];
      const gap = h.z - g.z;
      if (g.surge && gap > 0 && gap <= APPROACH && g.lanes[h.lane].tier === TIER.slow) run.hesitation[run.nextGate] += 1;
      if (prevZ > g.z && h.z <= g.z) meetGate(run, run.nextGate, ms);
   }
   // the section's end: the lanes rejoin (a perfect lane pushes the boulder back)
   if (h.route !== NONE && h.z <= c.gates[h.route].z1) endSection(run);
   if (run.bossOn) arenaContacts(run, prevZ);
   contacts(run, ms, prevZ);
   if (run.ended !== null) return;
   chaser(run, ms);
   if (run.ended !== null) return;
   // the finish (level 5: once Coilstone is down, at the gate)
   if (h.z <= run.finishGate && !bossAlive(run)) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
      if (run.tolls === 0) foundSecret(run, "pauper");
   }
}

function foundSecret(run: TempleRun, id: string): void {
   const i = SECRETS[run.level].findIndex((s) => s.id === id);
   if (i < 0) return;
   if (collectSecret(run.secrets, i)) {
      const ev = run.events;
      if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
      ev.secretCount += 1;
   }
}

/** The hero meets gate g at its plane: Vexa's ghost gate, Riko's cracked wall, a slow lane, or a toll (paid, or shut and pushed). */
function meetGate(run: TempleRun, g: number, ms: number): void {
   const h = run.hero;
   const gate = run.course.gates[g];
   const ev = run.events;
   run.nextGate = g + 1;
   run.gateMs[g] = ms;
   run.sectionStumbles = 0;
   ev.gate = g;
   const lane = h.lane;
   let result: number;
   if (lane === gate.ghost && ms < h.phaseUntil) result = GATE.ghost;
   else if (lane === gate.cracked && ms < h.dashUntil && gate.freeTo !== NONE) {
      result = GATE.free;
      h.lane = gate.freeTo;
   } else if (gate.lanes[lane].tier === TIER.slow) result = GATE.slow;
   else if (ms <= run.openUntil[g * LANES + lane]) result = GATE.free;
   else {
      const price = priceOf(run, g, lane);
      run.gatePrice[g] = price;
      if (run.purse.coins >= price) {
         run.purse.coins -= price;
         run.spent += price;
         run.tolls += 1;
         ev.paid = price;
         result = GATE.paid;
      } else {
         // shut: pushed to the nearest slow lane
         result = GATE.shut;
         let best = NONE;
         for (let l = 0; l < LANES; l++) if (gate.lanes[l].tier === TIER.slow && (best === NONE || Math.abs(l - lane) < Math.abs(best - lane))) best = l;
         h.lane = best;
      }
   }
   run.gateResult[g] = result;
   ev.gateResult = result;
   h.route = g;
   h.routeKind = result;
}

function endSection(run: TempleRun): void {
   const h = run.hero;
   const g = h.route;
   const ev = run.events;
   ev.sectionEnd = g;
   let all = true;
   for (const i of run.course.laneCoins[g * LANES + h.lane]) if (!run.collected[i]) all = false;
   if (all && run.sectionStumbles === 0) {
      ev.perfect = true;
      run.perfects += 1;
      run.gap = Math.min(GAP.max, run.gap + GAP.perfect);
   }
   h.route = NONE;
   h.routeKind = GATE.pending;
}

function takeCoin(run: TempleRun, value: number, id: number): void {
   run.purse.coins += value;
   run.taken += value;
   const ev = run.events;
   if (ev.coinCount < ev.coinList.length) ev.coinList[ev.coinCount] = id;
   ev.coinCount += 1;
}

function contacts(run: TempleRun, ms: number, prevZ: number): void {
   const h = run.hero;
   const c = run.course;
   const ev = run.events;
   const cy = h.y + PICKUP.centerY;
   const magnet = ms < h.magnetUntil;
   const reach = magnet ? MAGNET_REACH : PICKUP.r;
   const coins = c.coins;
   for (let i = 0; i < coins.length; i++) {
      if (run.collected[i]) continue;
      const o = coins[i];
      const dz = o.z - h.z;
      if (dz > reach || dz < -reach) continue;
      if (o.need === 1 && !magnet) continue;
      if (o.need === 2 && !(h.route === o.gate && h.routeKind === GATE.ghost)) continue;
      // a section's coin is only reached from its own channel
      if (o.gate !== NONE && o.need !== 2 && !(h.route === o.gate && h.lane === o.lane)) continue;
      const dx = o.x - h.x;
      const dy = o.y - cy;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      takeCoin(run, o.value, i);
      linkCombo(run, o.value);
   }
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.orbMask & (1 << i)) continue;
      const o = c.orbs[i];
      const dz = o.z - h.z;
      if (dz > PICKUP.r || dz < -PICKUP.r) continue;
      if (o.gate !== NONE && h.route !== o.gate) continue;
      const dx = o.x - h.x;
      const dy = o.y - cy;
      if (dx * dx + dy * dy + dz * dz > PICKUP.r * PICKUP.r) continue;
      run.orbMask |= 1 << i;
      run.orbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount] = i;
      ev.orbCount += 1;
   }
   for (let i = 0; i < c.secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const s = c.secrets[i];
      if (s.need === "pauper") continue;
      const dz = s.z - h.z;
      if (dz > SECRET_R || dz < -SECRET_R) continue;
      const dx = s.x - h.x;
      const dy = s.y - cy;
      if (dx * dx + dy * dy + dz * dz > SECRET_R * SECRET_R) continue;
      if (s.need === "ghost" && !(h.route === s.gate && h.routeKind === GATE.ghost)) continue;
      if (s.need === "jackpot" && !(h.route === s.gate && h.routeKind === GATE.paid)) continue;
      if (collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
         ev.secretCount += 1;
      }
   }
   // the rumble waves (level 3+): one rolls out of the boulder every RUMBLE.everyMs
   if (ms >= run.nextWaveMs && hasBroken(c)) {
      run.nextWaveMs = ms + RUMBLE.everyMs;
      for (let k = 0; k < RUMBLE.max; k++) {
         if (run.waveLive[k]) continue;
         run.waveLive[k] = 1;
         run.waveZ[k] = chaserZ(run);
         run.waveFrom[k] = run.waveZ[k];
         ev.rumble = true;
         break;
      }
   }
   for (let k = 0; k < RUMBLE.max; k++) {
      if (!run.waveLive[k]) continue;
      const wz0 = run.waveZ[k];
      run.waveZ[k] -= (baseSpeed(run) + RUMBLE.ahead) / 1000;
      const wz1 = run.waveZ[k];
      for (let i = 0; i < c.hazards.length; i++) {
         const hz = c.hazards[i];
         if (hz.kind !== HAZ.broken || run.tileFall[i] !== Infinity) continue;
         if (wz0 > hz.z && wz1 <= hz.z) run.tileFall[i] = ms + BROKEN.fallMs;
      }
      if (run.waveFrom[k] - wz1 > RUMBLE.reach) run.waveLive[k] = 0;
   }
   // the hazards
   const rolling = ms < h.rollUntil && h.grounded;
   for (let i = 0; i < c.hazards.length; i++) {
      const hz = c.hazards[i];
      if (hz.kind === HAZ.broken && run.tileFall[i] !== Infinity && ms === run.tileFall[i]) ev.tileFell = i;
      if (run.hazardHit[i]) continue;
      const dz = h.z - hz.z;
      if (dz > 2 || dz < -2) continue;
      // a section's trap belongs to its channel; the ghost passage skips them
      if (hz.gate !== NONE && h.route === hz.gate && h.routeKind === GATE.ghost) continue;
      const inLane = hz.lane === NONE || Math.abs(h.x - laneX(hz.lane)) < LANE_W * 0.42;
      if (!inLane) continue;
      switch (hz.kind) {
         case HAZ.block:
            if (prevZ > hz.z && h.z <= hz.z && h.y < BLOCK_CLEAR) {
               run.hazardHit[i] = 1;
               stumble(run, ms);
            }
            break;
         case HAZ.beam:
            if (prevZ > hz.z && h.z <= hz.z && !rolling) {
               run.hazardHit[i] = 1;
               stumble(run, ms);
            }
            break;
         case HAZ.jet:
            if (Math.abs(dz) <= JET.half && h.y < JET.height && !(ms < h.shieldUntil)) {
               run.hazardHit[i] = 1;
               stumble(run, ms);
            }
            break;
         case HAZ.spike:
            if (Math.abs(dz) <= SPIKE.half && h.grounded && spikeUp(hz, ms)) {
               run.hazardHit[i] = 1;
               stumble(run, ms);
            }
            break;
         case HAZ.broken:
            if (Math.abs(dz) <= BROKEN.half && h.grounded && ms >= run.tileFall[i] && !(ms < h.recoverUntil)) {
               // a fall: it costs a life (the hero climbs out on the far side)
               run.hazardHit[i] = 1;
               ev.fell = true;
               run.stumbles += 1;
               run.sectionStumbles += 1;
               run.lastStumble = ms;
               loseLife(run, ms);
               if (run.ended !== null) return;
            }
            break;
      }
   }
   // level 4's side-ramp boulders
   for (let i = 0; i < c.crosses.length; i++) {
      const cr = c.crosses[i];
      if (run.crossStart[i] < 0 && h.z - cr.z <= CROSS.lead) {
         run.crossStart[i] = ms;
         ev.crossStarted = i;
      }
      if (run.crossHit[i] || !(prevZ > cr.z && h.z <= cr.z)) continue;
      const bx = crossX(run, i, ms);
      if (Number.isFinite(bx) && Math.abs(bx - h.x) < CROSS.r && h.y < 1.6) {
         run.crossHit[i] = 1;
         stumble(run, ms);
      }
   }
   // Coilstone's coils (level 5)
   const bh = run.hazard;
   if (bh.live && bh.kind !== 0 && prevZ > bh.z && h.z <= bh.z) {
      bh.live = false;
      const hit = bh.kind === 1 ? h.y < BLOCK_CLEAR : !rolling;
      if (hit) stumble(run, ms);
   }
}

const BROKEN_CACHE = new WeakMap<Course, boolean>();
function hasBroken(c: Course): boolean {
   let v = BROKEN_CACHE.get(c);
   if (v === undefined) {
      v = c.hazards.some((q) => q.kind === HAZ.broken);
      BROKEN_CACHE.set(c, v);
   }
   return v;
}

/** The boulder (or the serpent): it creeps back to its base gap, and a gap at `catch` costs a life. */
function chaser(run: TempleRun, ms: number): void {
   if (ms - run.lastStumble > GAP.regenAfterMs && run.gap < GAP.base) run.gap = Math.min(GAP.base, run.gap + GAP.regen / 1000);
   // a slow lane's section: the boulder gains GAP.slow over it
   const h = run.hero;
   if (h.route !== NONE && (h.routeKind === GATE.slow || h.routeKind === GATE.shut)) {
      const g = run.course.gates[h.route];
      run.gap -= (GAP.slow * (h.v / 1000)) / (g.z - g.z1);
   }
   if (run.gap <= GAP.catch && !(ms < h.recoverUntil)) {
      run.catches += 1;
      run.events.caught = true;
      loseLife(run, ms);
   } else if (run.gap < GAP.catch) run.gap = GAP.catch;
}

// ---------- level 5: Coilstone ----------

/** The arena's sections, spawned ahead as the hero runs (each in the phase it spawns in). */
function spawnArena(run: TempleRun): void {
   const c = run.course;
   const b = run.boss!;
   while (run.arenaSpawned < ARENA.max) {
      const z = c.bossStartZ - ARENA.lead - run.arenaSpawned * ARENA.spacing;
      if (z < run.hero.z - 110) return;
      if (!bossAlive(run)) return;
      const s = run.arenaSpawned;
      run.arenaZ[s] = z;
      run.arenaPhase[s] = b.phase;
      run.arenaSpawned += 1;
   }
}

function arenaContacts(run: TempleRun, prevZ: number): void {
   const h = run.hero;
   const cy = h.y + PICKUP.centerY;
   const magnet = run.simMs < h.magnetUntil;
   const reach = magnet ? MAGNET_REACH : PICKUP.r;
   const p = SCRATCH_P;
   for (let s = run.arenaMet; s < run.arenaSpawned; s++) {
      const z = run.arenaZ[s];
      if (z > h.z + 40) continue;
      if (z < h.z - 40) break;
      for (let k = 0; k < ARENA.coins; k++) {
         if (run.arenaTaken[s] & (1 << k)) continue;
         arenaCoin(run, s, k, p);
         const dx = p.x - h.x;
         const dy = p.y - cy;
         const dz = p.z - h.z;
         if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
         run.arenaTaken[s] |= 1 << k;
         takeCoin(run, 1, -1 - (s * ARENA.coins + k));
         if (run.arenaLinks < ARENA_LINKS) {
            run.arenaLinks += 1;
            linkCombo(run, 1);
         }
      }
      // the toll at the section's plane
      if (prevZ > z && h.z <= z) {
         run.arenaMet = s + 1;
         if (!bossAlive(run)) continue;
         const t = arenaToll(run, s);
         if ((t.bowls || h.lane === 1) && run.purse.coins >= t.price) {
            run.purse.coins -= t.price;
            run.spent += t.price;
            run.arenaPaid[s] = 1;
            run.pendingHits += 1;
            run.events.paid = t.price;
            if (t.bowls) run.events.bowlPaid = true;
            else run.events.bellPaid = true;
         }
      }
   }
}

const SCRATCH_P = { x: 0, y: 0, z: 0 };

function bossMs(run: TempleRun): void {
   const b = run.boss!;
   const ev = run.bossEv;
   const h = run.hero;
   const c = run.course;
   const wasAlive = bossAlive(run);
   stepBoss(b, COILSTONE, 1, ev);
   if (ev.telegraph) {
      run.events.bossTelegraph = true;
      // phase 1: the hiss marks the lane it will lunge at
      if (b.phase === 0) {
         const hz = run.hazard;
         hz.kind = 0;
         hz.lane = h.lane;
         hz.z = h.z;
         hz.live = true;
      }
   }
   if (ev.attack) {
      run.events.bossAttack = true;
      const hz = run.hazard;
      if (b.phase === 0) {
         // the lunge: whoever is still in the marked lane is struck
         hz.live = false;
         run.events.lunged = true;
         if (Math.abs(h.x - laneX(hz.lane)) < LANE_W * 0.5 && !(run.simMs < h.shieldUntil) && !(run.simMs < h.recoverUntil)) stumble(run, run.simMs, GAP.lunge);
      } else if (b.phase === 1) {
         // a coil across the lanes 1.1 s ahead: low (jump) or high (roll under), in turn
         hz.kind = run.coilCount % 2 === 0 ? 1 : 2;
         run.coilCount += 1;
         hz.z = h.z - Math.max(8, (h.v || c.speed) * 1.1);
         hz.lane = NONE;
         hz.live = true;
         // never on an arena toll's plane
         for (let s = run.arenaMet; s < run.arenaSpawned; s++) {
            const tz = run.arenaZ[s];
            if (tz < hz.z - 8) break;
            if (Math.abs(hz.z - tz) < 5) hz.z = tz + 6 < h.z - 4 ? tz + 6 : tz - 6;
         }
      }
   }
   // a paid bell (or bowl) lands while it is open
   if (run.pendingHits > 0 && bossVulnerable(run)) {
      const r = hitBoss(b, COILSTONE, 1, ev);
      if (r !== "ignored") {
         run.pendingHits -= 1;
         run.events.bossHit = true;
         if (r === "phase") run.events.bossPhase = true;
         if (r === "defeated") run.events.bossDefeated = true;
      }
   }
   if (wasAlive && !bossAlive(run)) {
      run.finishGate = Math.min(c.finishZ, h.z - GATE_AHEAD);
      run.hazard.live = false;
      run.pendingHits = 0;
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
   put(course.half, course.half + 3, -20, 4.5);
   put(-course.half - 3, -course.half, -20, 4.5);
   return n;
}

// ---------- the store hand-off (README "Scoring") ----------

export const STAT = {
   coins: "coins",
   orbs: "orbs",
   distance: "distance",
   finishMs: "finishMs",
   hero: "hero",
   power: "power",
   /** speed, tenths of m/s */
   speed: "speed",
   lives: "lives",
   /** the boulder's gap, tenths of m */
   gap: "gap",
   /** the next gate in view: its index (-1 none), the cheap and dear prices (-1: no such lane), the metres to it */
   gateNext: "gateNext",
   gateCheap: "gateCheap",
   gateDear: "gateDear",
   gateDist: "gateDist",
   tolls: "tolls",
   spent: "spent",
   perfects: "perfects",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   comboPts: "comboPts",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossOn: "bossOn",
   bells: "bells",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The submitted score is the store's score (the Scene keeps it at scoreOf(run)); the duration is the played time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-stumble badge of this game (the card). */
export function badgeHits(run: TempleRun): number {
   return run.stumbles;
}

/** The next gate the HUD shows (once within APPROACH + 15 m): -1 for none. */
export function gateInView(run: TempleRun): number {
   const g = run.nextGate;
   if (g >= run.course.gates.length) return NONE;
   return run.hero.z - run.course.gates[g].z <= APPROACH + 15 ? g : NONE;
}

export { LANES, LANE_W, laneX, HALF, TIER, HAZ, COIN };
