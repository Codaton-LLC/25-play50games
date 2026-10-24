// Tower Climb: seeded data at mount, fixed pools, analytic x/y tops and a counted integer-ms clock.
// Scene alone draws the seed. All live motion/deadlines come from step's dtMs; no renderer clock.
import type { InputState, RunPhase } from "@/arcade3d/core/types";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { rngNext } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type TowerLevel } from "./levels";
import { towerClimbMeta } from "./meta";

export const NONE = -1;
export const STATIC = 0, MOVING = 1, CHECKPOINT = 2;
export const INTACT = 0, WARNING = 1, FALLING = 2;
export const G = 10, V_JUMP = 4, V_RUN = 3;
export const MIN_LAUNCH_MS = 400, COYOTE_MS = 100, BUFFER_MS = 120;
export const HOLD_MS = 350, MIN_LOSS_MS = 3000, MAX_STEP_MS = 50, DURATION_MS = 1800000;
export const BLOCKS = 451, REWARD_BANDS = 450, STEPS_PER_BLOCK = 16, BLOCK_MM = 8000;
/** README proof (f): at most 1397 whole metres by 30 minutes, 13970 + 25 · 174 coins. */
export const MAX_THEORETICAL_SCORE = 18320;
export const HEIGHT_POINTS = 10, COIN_POINTS = 25, X_BOUND = 1.98;
export const RUNNER = { halfWidth: 0.22, height: 0.55, depth: 0.4 } as const;
export const SLAB = { width: 1.4, depth: 0.6, thickness: 0.16 } as const;
export const MOVING_SLAB = { travel: 0.2, periodMs: 2000, speed: 0.4 } as const;
export const SPUR = { width: 0.8, offset: 1.2, warningMs: 800, halfGuard: 1.1, gravity: 6, maxSpeed: 6 } as const;
export const COIN = { radius: 0.3, lift: 0.3, pickupReach: 0.52, playerLift: 0.275 } as const;
export const FLAG = { height: 0.8, halfWidth: 0.2 } as const;
export const POOLS = { slabs: 32, spurs: 16, coins: 4, flags: 4, sections: 8 } as const;
export const WEIGHTS = { static: 8, moving: 2, absent: 1, present: 1 } as const;
/**
 * A spring pad. Apex is 3 m (`vy = sqrt(2 g h)`), so a normal 0.8 m jump is unchanged.
 * Pads sit on ordinary static slabs from level 3, at least `minHeight` up and `gap` apart,
 * and only where a required platform is inside the descending arc and above the loss line
 * (apex − 2 m). `half` is the pad's half-width: the slab's edges still hold a normal landing.
 */
export const SPRING = { apex: 3, half: 0.26, minRise: 1.2, maxRise: 2.8, minHeight: 16, gap: 12 } as const;
export const V_SPRING = Math.sqrt(2 * G * SPRING.apex);
/**
 * A rocket pickup, level 4+. `gain` is the powered climb (4 m/s × 1.6 s). The pickup floats
 * `lift` above a static slab, so the scored rise from that slab is lift + gain.
 * `landLow` / `landHigh` are heights above the slab where a static or checkpoint landing
 * stays above the loss line (burnout − 2 m) and below the burnout.
 */
export const ROCKET = {
   lift: 0.7, speed: 4, durationMs: 1600, gain: 6.4, reach: 0.42,
   minHeight: 32, gap: 18, landLow: 5.25, landHigh: 6.95,
} as const;
/** Side gusts, level 5. The route's centres stay inside ±(1 + travel) = 1.4, outside `xInner`. */
export const WIND = { xInner: 1.62, speed: 1.5, y0: 36, gap: 26, band: 8 } as const;
export const SPRING_CAP = 16, ROCKET_CAP = 8, WIND_CAP = 6;
const DESCRIPTORS = BLOCKS * STEPS_PER_BLOCK + 1;
const SPUR_CAP = BLOCKS * 8;
const RULES = towerClimbMeta.scoring;
const NO_I16 = new Int16Array(0);
const NO_U8 = new Uint8Array(0);

/**
 * Per-level server limits. Level 1 equals `meta.scoring` (19000 / 11 pts/s).
 * Levels 2–5: README "Levels". Claude copies these into arcade-games.json.
 * L2 matches L1: nothing raises the climb rate. L3–L5 cover the spring and rocket envelope
 * (rules.test levels: the steepest prefix plus about 5%, the 30-minute ceiling plus about 4%).
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: today's proof. Steepest 10.421 pts/s, 30-minute ceiling 18320. */
   1: { kind: "points", maxScore: 19000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 11, unitLabel: "pts", display: "int" },
   /** L2: same jumps. Wider and faster slabs do not add height. */
   2: { kind: "points", maxScore: 19000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 11, unitLabel: "pts", display: "int" },
   /** L3: 8 springs, first at 16 m, 12 m apart, +3 m in 0.775 s. Envelope peak 12.43 pts/s; ceiling 18585. */
   3: { kind: "points", maxScore: 19350, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 13, unitLabel: "pts", display: "int" },
   /** L4: 12 springs and 5 rockets (+7.1 m from the slab in 1.86 s). Envelope peak 17.53 pts/s; ceiling 19065. */
   4: { kind: "points", maxScore: 19850, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 19, unitLabel: "pts", display: "int" },
   /** L5: 16 springs, 8 rockets, wind (no extra height). Envelope peak 17.85 pts/s; ceiling 19390. */
   5: { kind: "points", maxScore: 20200, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 19, unitLabel: "pts", display: "int" },
};

/** Millimetre tables are immutable except for each spur/reward's one-way lifecycle. */
export interface Tower {
   seed: number;
   heights: Int32Array;
   xs: Int16Array;
   kinds: Uint8Array;
   phases: Uint16Array;
   spurForParent: Int16Array;
   spurParents: Uint16Array;
   spurXs: Int16Array;
   spurCount: number;
   warnStarts: Int32Array;
   collapseTimes: Int32Array;
   coinXs: Int16Array;
   flagXs: Int16Array;
   /** 0 available, 1 collected, 2 missed below the column. */
   coinTaken: Uint8Array;
   flagSeen: Uint8Array;
   decoration: Uint32Array;
}

/** Core mulberry32 only: pair rise, x, kind, moving phase; then optional spurs, then prop sides. */
export function generateTower(seed: number): Tower {
   const rng = { s: seed >>> 0 }, deco = { s: (seed ^ 0x9e3779b9) >>> 0 };
   const data: Tower = {
      seed: seed >>> 0, heights: new Int32Array(DESCRIPTORS), xs: new Int16Array(DESCRIPTORS),
      kinds: new Uint8Array(DESCRIPTORS), phases: new Uint16Array(DESCRIPTORS),
      spurForParent: new Int16Array(DESCRIPTORS).fill(NONE), spurParents: new Uint16Array(SPUR_CAP),
      spurXs: new Int16Array(SPUR_CAP), spurCount: 0, warnStarts: new Int32Array(SPUR_CAP).fill(NONE),
      collapseTimes: new Int32Array(SPUR_CAP).fill(NONE), coinXs: new Int16Array(REWARD_BANDS + 1),
      flagXs: new Int16Array(REWARD_BANDS + 1), coinTaken: new Uint8Array(REWARD_BANDS + 1),
      flagSeen: new Uint8Array(REWARD_BANDS + 1), decoration: new Uint32Array(BLOCKS),
   };
   data.kinds[0] = CHECKPOINT;
   let height = 0, previousX = 0;
   for (let pair = 0; pair < BLOCKS * 8; pair++) {
      const choice = Math.floor(rngNext(rng) * 3), firstRise = 450 + choice * 50;
      for (let half = 0; half < 2; half++) {
         const index = pair * 2 + half + 1;
         height += half === 0 ? firstRise : 1000 - firstRise;
         const checkpoint = index % STEPS_PER_BLOCK === 0;
         const low = Math.max(-1000, previousX - 1000), high = Math.min(1000, previousX + 1000);
         const x = checkpoint ? 0 : low + 100 * Math.floor(rngNext(rng) * ((high - low) / 100 + 1));
         const kind = index <= 2 || checkpoint ? STATIC : Math.floor(rngNext(rng) * 10) < WEIGHTS.static ? STATIC : MOVING;
         data.heights[index] = height; data.xs[index] = x;
         data.kinds[index] = checkpoint ? CHECKPOINT : kind;
         data.phases[index] = kind === MOVING ? Math.floor(rngNext(rng) * MOVING_SLAB.periodMs) : 0;
         previousX = x;
      }
   }
   // One presence draw per pair. Use its first ordinary static parent, or its second if needed.
   for (let first = 1; first < DESCRIPTORS; first += 2) {
      const present = Math.floor(rngNext(rng) * 2) === WEIGHTS.present;
      const parent = data.kinds[first] === STATIC ? first : data.kinds[first + 1] === STATIC ? first + 1 : NONE;
      if (!present || parent === NONE) continue;
      const px = data.xs[parent], side = px === 0 ? (Math.floor(rngNext(rng) * 2) === 0 ? -1 : 1) : -Math.sign(px);
      const x = px + side * 1200;
      if (Math.abs(x) > 700 || Math.abs(x - data.xs[parent + 1]) > 1000) continue;
      const id = data.spurCount++;
      data.spurForParent[parent] = id; data.spurParents[id] = parent; data.spurXs[id] = x;
   }
   for (let band = 1; band <= REWARD_BANDS; band++) {
      const nextX = data.xs[band * STEPS_PER_BLOCK + 1];
      const side = nextX === 0 ? (Math.floor(rngNext(rng) * 2) === 0 ? -1 : 1) : -Math.sign(nextX);
      data.coinXs[band] = side * 1500; data.flagXs[band] = side * 1900;
   }
   for (let block = 0; block < BLOCKS; block++) data.decoration[block] = Math.floor(rngNext(deco) * 0x100000000);
   return data;
}

/**
 * Levels 2–5. The same draws as `generateTower` (so heights, xs and kinds match level 1);
 * only the moving period and the spur weight change. Springs and rockets are a third stream,
 * applied in `placeFeatures`, so they never move a slab, a coin or a spur.
 */
function generateLevelTower(seed: number, level: TowerLevel): Tower {
   const rng = { s: seed >>> 0 }, deco = { s: (seed ^ 0x9e3779b9) >>> 0 };
   const data: Tower = {
      seed: seed >>> 0, heights: new Int32Array(DESCRIPTORS), xs: new Int16Array(DESCRIPTORS),
      kinds: new Uint8Array(DESCRIPTORS), phases: new Uint16Array(DESCRIPTORS),
      spurForParent: new Int16Array(DESCRIPTORS).fill(NONE), spurParents: new Uint16Array(SPUR_CAP),
      spurXs: new Int16Array(SPUR_CAP), spurCount: 0, warnStarts: new Int32Array(SPUR_CAP).fill(NONE),
      collapseTimes: new Int32Array(SPUR_CAP).fill(NONE), coinXs: new Int16Array(REWARD_BANDS + 1),
      flagXs: new Int16Array(REWARD_BANDS + 1), coinTaken: new Uint8Array(REWARD_BANDS + 1),
      flagSeen: new Uint8Array(REWARD_BANDS + 1), decoration: new Uint32Array(BLOCKS),
   };
   data.kinds[0] = CHECKPOINT;
   let height = 0, previousX = 0;
   for (let pair = 0; pair < BLOCKS * 8; pair++) {
      const choice = Math.floor(rngNext(rng) * 3), firstRise = 450 + choice * 50;
      for (let half = 0; half < 2; half++) {
         const index = pair * 2 + half + 1;
         height += half === 0 ? firstRise : 1000 - firstRise;
         const checkpoint = index % STEPS_PER_BLOCK === 0;
         const low = Math.max(-1000, previousX - 1000), high = Math.min(1000, previousX + 1000);
         const x = checkpoint ? 0 : low + 100 * Math.floor(rngNext(rng) * ((high - low) / 100 + 1));
         const kind = index <= 2 || checkpoint ? STATIC : Math.floor(rngNext(rng) * 10) < WEIGHTS.static ? STATIC : MOVING;
         data.heights[index] = height; data.xs[index] = x;
         data.kinds[index] = checkpoint ? CHECKPOINT : kind;
         data.phases[index] = kind === MOVING ? Math.floor(rngNext(rng) * level.periodMs) : 0;
         previousX = x;
      }
   }
   for (let first = 1; first < DESCRIPTORS; first += 2) {
      const present = Math.floor(rngNext(rng) * level.spurTotal) < level.spurPresent;
      const parent = data.kinds[first] === STATIC ? first : data.kinds[first + 1] === STATIC ? first + 1 : NONE;
      if (!present || parent === NONE) continue;
      const px = data.xs[parent], side = px === 0 ? (Math.floor(rngNext(rng) * 2) === 0 ? -1 : 1) : -Math.sign(px);
      const x = px + side * 1200;
      if (Math.abs(x) > 700 || Math.abs(x - data.xs[parent + 1]) > 1000) continue;
      const id = data.spurCount++;
      data.spurForParent[parent] = id; data.spurParents[id] = parent; data.spurXs[id] = x;
   }
   for (let band = 1; band <= REWARD_BANDS; band++) {
      const nextX = data.xs[band * STEPS_PER_BLOCK + 1];
      const side = nextX === 0 ? (Math.floor(rngNext(rng) * 2) === 0 ? -1 : 1) : -Math.sign(nextX);
      data.coinXs[band] = side * 1500; data.flagXs[band] = side * 1900;
   }
   for (let block = 0; block < BLOCKS; block++) data.decoration[block] = Math.floor(rngNext(deco) * 0x100000000);
   return data;
}

/** The construction contract, including full visible prop extents and every permanent link. */
export function validateTower(data: Tower): boolean {
   if (data.heights.length !== DESCRIPTORS || data.spurCount > SPUR_CAP || data.kinds[0] !== CHECKPOINT) return false;
   for (let i = 1; i < DESCRIPTORS; i++) {
      const rise = data.heights[i] - data.heights[i - 1], x = data.xs[i];
      if ((rise !== 450 && rise !== 500 && rise !== 550) || Math.abs(x) > 1000 || x % 100 !== 0
         || Math.abs(x - data.xs[i - 1]) > 1000 || data.kinds[i] > CHECKPOINT) return false;
      if (i % 2 === 0 && data.heights[i] - data.heights[i - 2] !== 1000) return false;
      if (i % 16 === 0 && (x !== 0 || data.kinds[i] !== CHECKPOINT || data.heights[i] !== i / 16 * 8000)) return false;
      if (i % 16 !== 0 && data.kinds[i] === CHECKPOINT) return false;
      if (i <= 2 && data.kinds[i] !== STATIC) return false;
      if (data.phases[i] >= 2000 || (data.kinds[i] !== MOVING && data.phases[i] !== 0)) return false;
   }
   let lastPair = NONE;
   for (let i = 0; i < data.spurCount; i++) {
      const p = data.spurParents[i], x = data.spurXs[i], px = data.xs[p], pair = Math.floor((p - 1) / 2);
      if (p < 1 || p + 1 >= DESCRIPTORS || data.kinds[p] !== STATIC || data.spurForParent[p] !== i
         || pair <= lastPair || Math.abs(x - px) !== 1200 || Math.abs(x) > 700
         || Math.abs(x - data.xs[p + 1]) > 1000 || (px !== 0 && Math.sign(x - px) !== -Math.sign(px))) return false;
      lastPair = pair;
   }
   for (let k = 1; k <= REWARD_BANDS; k++) {
      const next = data.xs[k * 16 + 1] / 1000, coin = data.coinXs[k] / 1000, flag = data.flagXs[k] / 1000;
      if (Math.abs(coin) !== 1.5 || Math.abs(flag) !== 1.9 || Math.sign(coin) !== Math.sign(flag)
         || (next !== 0 && Math.sign(coin) !== -Math.sign(next))
         || Math.abs(coin - next) - 0.3 - 0.9 < 0.3 - 1e-12
         || Math.abs(flag - next) - 0.2 - 0.9 < 0.8 - 1e-12) return false;
   }
   return true;
}

export interface SlabSlot {
   id: number; index: number; baseX: number; y: number; width: number; kind: number;
   phaseMs: number; active: boolean; frozenAtMs: number;
   /** 0 or omitted on level 1: slabX uses MOVING_SLAB. Set for levels 2–5. */
   travel?: number; periodMs?: number;
}
export interface SpurSlot extends SlabSlot {
   spurIndex: number; parentIndex: number; state: number; warnStartMs: number; deadlineMs: number; collapseMs: number;
}
export interface CoinSlot { id: number; x: number; y: number; active: boolean; collected: boolean }
export interface FlagSlot { id: number; x: number; y: number; active: boolean; visited: boolean }
export interface SectionSlot { id: number; y: number; seed: number; active: boolean }
export interface StepInput { moveX: number; jumpEdge: boolean }
export interface Loss { atMs: number; x: number; footY: number; vy: number }
export interface StepEvents {
   jumped: boolean; landed: number; coin: number; checkpoint: number; warned: number; collapsed: number;
   hit: boolean; delta: number; height: number; ended: "lose" | "timeup" | null;
   /** Platform index of a spring launch, or NONE. */
   sprung: number;
   /** Rocket slot that was picked up this step, or NONE. */
   rocket: number;
}
export interface TowerRun {
   seed: number; tower: Tower;
   slabs: SlabSlot[]; spurs: SpurSlot[]; coins: CoinSlot[]; flags: FlagSlot[]; sections: SectionSlot[];
   timeMs: number; remainder: number; stepMs: number; holdUnlocked: boolean;
   player: { x: number; y: number; vx: number; vy: number; grounded: boolean; groundIndex: number };
   flight: { atMs: number; y: number; vy: number };
   contactA: number; contactB: number; permission: boolean; coyoteUntilMs: number; bufferUntilMs: number;
   lastJumpMs: number; launches: number;
   maxHeight: number; viewBottomY: number; cameraTarget: { x: number; y: number; z: number };
   metres: number; collectedCoins: number; rawScore: number; score: number;
   loss: Loss; pendingLose: boolean; ended: "lose" | "timeup" | null; ranked: boolean;
   firstSlab: number; nextSlab: number; firstSpur: number; nextSpur: number; nextCoin: number;
   events: StepEvents;
   scratch: { landing: number; landingMs: number; pendingA: number; pendingB: number };
   /** Level 1 keeps today's motion and the live scoring object (`RULES`). */
   warningMs: number; motionTravel: number; motionPeriod: number; fireworks: boolean;
   limits: ScoringRules; windCount: number;
   springCount: number; springParent: Int16Array; springTarget: Int16Array;
   springMs: number; springPad: number;
   rocketCount: number; rocketParent: Int16Array; rocketTarget: Int16Array; rocketTaken: Uint8Array;
   boostUntilMs: number; boostAim: number;
   rocketDropMs: number; rocketDropX: number; rocketDropY: number;
}

export function createStepInput(): StepInput { return { moveX: 0, jumpEdge: false }; }

export function readStepInput(input: InputState, out: StepInput): StepInput {
   let x = Number.isFinite(input.moveX) ? Math.max(-1, Math.min(1, input.moveX)) : 0;
   if (x === 0 && input.pressed.left !== input.pressed.right) x = input.pressed.left ? -1 : 1;
   out.moveX = x; out.jumpEdge = input.jumpPressed || input.pressed.up;
   return out;
}

function platformTravel(level: TowerLevel, index: number, kind: number): number {
   if (kind !== MOVING) return 0;
   return index % 16 === 1 ? MOVING_SLAB.travel : level.movingTravel;
}

/** Highest required platform a 3 m spring can land on without dropping through the loss line. */
function springLanding(data: Tower, index: number, level: TowerLevel): number {
   const y = data.heights[index] / 1000, x = data.xs[index] / 1000;
   let best = NONE;
   for (let j = index + 1; j < DESCRIPTORS; j++) {
      const rise = data.heights[j] / 1000 - y;
      if (rise < SPRING.minRise) continue;
      if (rise > SPRING.maxRise) break;
      const dx = Math.abs(data.xs[j] / 1000 - x) + platformTravel(level, j, data.kinds[j]);
      const t = landingTime(rise, V_SPRING);
      if (!(V_RUN * t >= dx + 0.05)) continue;
      best = j;
   }
   return best;
}

/** A static slab or checkpoint in the rocket's safe window, within 1.2 m of the launch x. */
function rocketLanding(data: Tower, index: number): number {
   const y = data.heights[index] / 1000, x = data.xs[index] / 1000;
   const low = y + ROCKET.landLow, high = y + ROCKET.landHigh;
   let best = NONE;
   for (let j = index + 1; j < DESCRIPTORS; j++) {
      const py = data.heights[j] / 1000;
      if (py < low) continue;
      if (py > high) break;
      if (data.kinds[j] === MOVING) continue;
      if (Math.abs(data.xs[j] / 1000 - x) > 1.2) continue;
      best = j;
   }
   return best;
}

/** Seeded pads and pickups on the third rng stream. Level 1 places nothing and allocates nothing. */
function placeFeatures(run: TowerRun, level: TowerLevel): void {
   run.springCount = 0; run.rocketCount = 0; run.windCount = level.winds;
   if (level.springs === 0 && level.rockets === 0) return;
   const data = run.tower, rng = { s: (data.seed ^ 0x51ed5eed) >>> 0 };
   const springParent = new Int16Array(SPRING_CAP), springTarget = new Int16Array(SPRING_CAP);
   const rocketParent = new Int16Array(ROCKET_CAP), rocketTarget = new Int16Array(ROCKET_CAP);
   const rocketTaken = new Uint8Array(ROCKET_CAP);
   let springs = 0, rockets = 0, lastSpring = -1000, lastRocket = -1000;
   for (let index = 3; index < DESCRIPTORS && (springs < level.springs || rockets < level.rockets); index++) {
      if (data.kinds[index] !== STATIC || data.spurForParent[index] !== NONE) continue;
      const y = data.heights[index] / 1000;
      let placed = false;
      if (springs < level.springs && y >= SPRING.minHeight && y >= lastSpring + SPRING.gap && Math.floor(rngNext(rng) * 2) === 0) {
         const target = springLanding(data, index, level);
         if (target >= 0) {
            springParent[springs] = index; springTarget[springs] = target; springs++; lastSpring = y; placed = true;
         }
      }
      if (!placed && rockets < level.rockets && y >= ROCKET.minHeight && y >= lastRocket + ROCKET.gap && Math.floor(rngNext(rng) * 2) === 0) {
         const target = rocketLanding(data, index);
         if (target >= 0) {
            rocketParent[rockets] = index; rocketTarget[rockets] = target; rockets++; lastRocket = y;
         }
      }
   }
   run.springParent = springParent; run.springTarget = springTarget; run.springCount = springs;
   run.rocketParent = rocketParent; run.rocketTarget = rocketTarget; run.rocketTaken = rocketTaken; run.rocketCount = rockets;
}

function emptySlab(): SlabSlot {
   return { id: NONE, index: NONE, baseX: 0, y: 0, width: 1.4, kind: STATIC, phaseMs: 0, active: false, frozenAtMs: NONE, travel: 0, periodMs: 0 };
}

export function createRun(seed: number, level: TowerLevel = LEVELS[1]): TowerRun {
   const data = level.id === 1 ? generateTower(seed) : generateLevelTower(seed, level);
   const run: TowerRun = {
      seed: seed >>> 0, tower: data, slabs: Array.from({ length: 32 }, emptySlab),
      spurs: Array.from({ length: 16 }, () => ({ ...emptySlab(), width: 0.8, spurIndex: NONE, parentIndex: NONE,
         state: INTACT, warnStartMs: NONE, deadlineMs: NONE, collapseMs: NONE })),
      coins: Array.from({ length: 4 }, () => ({ id: NONE, x: 0, y: 0, active: false, collected: false })),
      flags: Array.from({ length: 4 }, () => ({ id: NONE, x: 0, y: 0, active: false, visited: false })),
      sections: Array.from({ length: 8 }, () => ({ id: NONE, y: 0, seed: 0, active: false })),
      timeMs: 0, remainder: 0, stepMs: 0, holdUnlocked: false,
      player: { x: 0, y: 0, vx: 0, vy: 0, grounded: true, groundIndex: 0 }, flight: { atMs: 0, y: 0, vy: 0 },
      contactA: 0, contactB: NONE, permission: true, coyoteUntilMs: NONE, bufferUntilMs: NONE,
      lastJumpMs: NONE, launches: 0, maxHeight: 0, viewBottomY: -2, cameraTarget: { x: 0, y: 1, z: 0 },
      metres: 0, collectedCoins: 0, rawScore: 0, score: 0,
      loss: { atMs: NONE, x: 0, footY: 0, vy: 0 }, pendingLose: false, ended: null, ranked: false,
      firstSlab: 0, nextSlab: 0, firstSpur: 0, nextSpur: 0, nextCoin: 1,
      events: { jumped: false, landed: NONE, coin: NONE, checkpoint: NONE, warned: NONE, collapsed: NONE,
         hit: false, delta: 0, height: NONE, ended: null, sprung: NONE, rocket: NONE },
      scratch: { landing: NONE, landingMs: Infinity, pendingA: NONE, pendingB: NONE },
      warningMs: level.warningMs, motionTravel: level.movingTravel, motionPeriod: level.periodMs,
      fireworks: level.fireworks, limits: level.id === 1 ? RULES : PROPOSED_LEVEL_LIMITS[level.id],
      windCount: level.winds, springCount: 0, springParent: NO_I16, springTarget: NO_I16,
      springMs: NONE, springPad: NONE, rocketCount: 0, rocketParent: NO_I16, rocketTarget: NO_I16,
      rocketTaken: NO_U8, boostUntilMs: NONE, boostAim: NONE, rocketDropMs: NONE, rocketDropX: 0, rocketDropY: 0,
   };
   placeFeatures(run, level);
   fillPools(run);
   return run;
}

function protectedId(run: TowerRun, id: number): boolean {
   return id === run.contactA || id === run.contactB || id === run.scratch.pendingA || id === run.scratch.pendingB;
}

/** Monotone cursors write existing ring records; no live RNG, arrays, closures or vector objects. */
export function fillPools(run: TowerRun): boolean {
   const data = run.tower, low = run.maxHeight - 4, high = run.maxHeight + 6;
   while (run.firstSlab < run.nextSlab && data.heights[run.firstSlab] / 1000 < low) {
      const slot = run.slabs[run.firstSlab % 32];
      if (protectedId(run, slot.id)) break;
      slot.active = false; run.firstSlab++;
   }
   while (run.nextSlab < DESCRIPTORS && data.heights[run.nextSlab] / 1000 <= high) {
      const index = run.nextSlab, slot = run.slabs[index % 32];
      if (slot.active && protectedId(run, slot.id)) return false;
      slot.id = index * 2; slot.index = index; slot.baseX = data.xs[index] / 1000;
      slot.y = data.heights[index] / 1000; slot.width = data.kinds[index] === CHECKPOINT ? 4.4 : 1.4;
      slot.kind = data.kinds[index]; slot.phaseMs = data.phases[index]; slot.frozenAtMs = NONE; slot.active = true;
      slot.travel = 0; slot.periodMs = 0;
      if (run.motionTravel !== MOVING_SLAB.travel || run.motionPeriod !== MOVING_SLAB.periodMs) {
         if (data.kinds[index] === MOVING) {
            slot.periodMs = run.motionPeriod;
            // The slab just above a checkpoint keeps ±0.20 m so coin and flag clearance stays the level-1 proof.
            slot.travel = index % 16 === 1 ? MOVING_SLAB.travel : run.motionTravel;
         }
      }
      run.nextSlab++;
   }
   while (run.firstSpur < run.nextSpur && data.heights[data.spurParents[run.firstSpur]] / 1000 < low) {
      const slot = run.spurs[run.firstSpur % 16];
      if (protectedId(run, slot.id)) break;
      slot.active = false; run.firstSpur++;
   }
   while (run.nextSpur < data.spurCount && data.heights[data.spurParents[run.nextSpur]] / 1000 <= high) {
      const index = run.nextSpur, slot = run.spurs[index % 16], parent = data.spurParents[index];
      if (slot.active && protectedId(run, slot.id)) return false;
      slot.id = parent * 2 + 1; slot.index = parent; slot.spurIndex = index; slot.parentIndex = parent;
      slot.baseX = data.spurXs[index] / 1000; slot.y = data.heights[parent] / 1000;
      slot.phaseMs = 0; slot.frozenAtMs = NONE; slot.active = true;
      slot.warnStartMs = data.warnStarts[index]; slot.deadlineMs = slot.warnStartMs < 0 ? NONE : slot.warnStartMs + run.warningMs;
      slot.collapseMs = data.collapseTimes[index]; slot.state = slot.collapseMs >= 0 ? FALLING : slot.warnStartMs >= 0 ? WARNING : INTACT;
      run.nextSpur++;
   }
   for (let i = 0; i < 4; i++) {
      const coin = run.coins[i], flag = run.flags[i];
      if (coin.active && (coin.id * 8 < run.viewBottomY || coin.id * 8 < low)) {
         data.coinTaken[coin.id] = 2; coin.active = false;
      }
      if (flag.active && flag.y < low) flag.active = false;
   }
   while (run.nextCoin <= REWARD_BANDS && run.nextCoin * 8 <= high) {
      const band = run.nextCoin++, coin = run.coins[band % 4], flag = run.flags[band % 4];
      coin.id = band; coin.x = data.coinXs[band] / 1000; coin.y = band * 8 + 0.3;
      coin.collected = data.coinTaken[band] === 1; coin.active = data.coinTaken[band] === 0 && band * 8 >= run.viewBottomY;
      if (!coin.active && data.coinTaken[band] === 0) data.coinTaken[band] = 2;
      flag.id = band; flag.x = data.flagXs[band] / 1000; flag.y = band * 8;
      flag.active = flag.y >= low; flag.visited = data.flagSeen[band] === 1;
   }
   // Decorations follow the same 8 m block IDs; their appearance is the independent stream.
   for (let i = 0; i < 8; i++) run.sections[i].active = false;
   const first = Math.max(0, Math.floor(low / 8)), last = Math.min(BLOCKS - 1, Math.floor(high / 8));
   for (let block = first; block <= last; block++) {
      const slot = run.sections[block % 8]; slot.id = block; slot.y = block * 8;
      slot.seed = data.decoration[block]; slot.active = true;
   }
   return true;
}

const MOVE_HALF_MS = MOVING_SLAB.periodMs / 2, MOVE_SPAN = 2 * MOVING_SLAB.travel;

/** Triangular horizontal motion (±travel, one period), and the frozen collision pose after a loss/time-up. */
export function slabX(slab: SlabSlot, ms: number): number {
   if (slab.kind !== MOVING) return slab.baseX;
   const t = slab.frozenAtMs >= 0 ? slab.frozenAtMs : ms;
   // Level 1 leaves travel/period at 0: the original formula, same operations.
   if (!(slab.periodMs > 0) || !(slab.travel > 0)) {
      const phase = ((t + slab.phaseMs) % MOVING_SLAB.periodMs) / MOVE_HALF_MS;
      return slab.baseX + (phase <= 1 ? MOVE_SPAN * phase - MOVING_SLAB.travel : MOVING_SLAB.travel - MOVE_SPAN * (phase - 1));
   }
   const half = slab.periodMs / 2, span = 2 * slab.travel;
   const phase = ((t + slab.phaseMs) % slab.periodMs) / half;
   return slab.baseX + (phase <= 1 ? span * phase - slab.travel : slab.travel - span * (phase - 1));
}

export function landingTime(rise: number, vy = V_JUMP): number {
   const discriminant = vy * vy - 2 * G * rise;
   return discriminant < 0 ? NaN : (vy + Math.sqrt(discriminant)) / G;
}

/** Strict expanded edges: a zero-width touching footprint never becomes a contact. */
function overlaps(x: number, slot: SlabSlot, ms: number): boolean {
   const centre = slabX(slot, ms), reach = slot.width / 2 + RUNNER.halfWidth;
   return x > centre - reach && x < centre + reach;
}

function collidable(spur: SpurSlot, ms: number): boolean {
   return spur.active && spur.state !== FALLING && (spur.deadlineMs < 0 || ms < spur.deadlineMs);
}

function warnContact(run: TowerRun, slot: SpurSlot, ms: number): void {
   if (slot.state !== INTACT) return;
   slot.state = WARNING; slot.warnStartMs = ms; slot.deadlineMs = ms + run.warningMs;
   run.tower.warnStarts[slot.spurIndex] = ms;
   run.events.warned = slot.id;
}

function leaveSupport(run: TowerRun, ms: number): void {
   run.player.grounded = false; run.contactA = run.contactB = NONE;
   run.coyoteUntilMs = run.permission ? ms + COYOTE_MS : NONE;
   run.flight.atMs = ms; run.flight.y = run.player.y; run.flight.vy = 0; run.player.vy = 0;
}

/** Required ID precedes its spur ID. A straddle remains grounded when either contact disappears. */
function updateContacts(run: TowerRun, ms: number, warn: boolean, warningMs = ms): void {
   const p = run.player;
   if (!p.grounded) return;
   const index = p.groundIndex, required = run.slabs[index % 32];
   const parent = required.active && required.index === index && required.y === p.y && overlaps(p.x, required, ms);
   const spurIndex = run.tower.spurForParent[index], spur = spurIndex >= 0 ? run.spurs[spurIndex % 16] : null;
   const side = spur !== null && spur.spurIndex === spurIndex && collidable(spur, ms) && spur.y === p.y && overlaps(p.x, spur, ms);
   run.contactA = parent ? required.id : side ? spur!.id : NONE;
   run.contactB = parent && side ? spur!.id : NONE;
   if (side && warn) warnContact(run, spur!, warningMs);
   if (run.contactA === NONE) leaveSupport(run, ms);
}

function expireSpurs(run: TowerRun, ms: number): void {
   for (let i = 0; i < 16; i++) {
      const spur = run.spurs[i];
      if (!spur.active || spur.state !== WARNING || ms < spur.deadlineMs) continue;
      spur.state = FALLING; spur.collapseMs = spur.deadlineMs;
      run.tower.collapseTimes[spur.spurIndex] = spur.collapseMs; run.events.collapsed = spur.id;
   }
}

function boundary(run: TowerRun): void {
   if (!run.holdUnlocked && run.timeMs >= HOLD_MS) { run.holdUnlocked = true; run.bufferUntilMs = NONE; }
   expireSpurs(run, run.timeMs);
   updateContacts(run, run.timeMs, false);
   if (!run.player.grounded && run.timeMs > run.coyoteUntilMs) run.permission = false;
}

function tryJump(run: TowerRun): void {
   if (!run.holdUnlocked || run.bufferUntilMs < run.timeMs || !run.permission
      || (!run.player.grounded && run.timeMs > run.coyoteUntilMs)
      || (run.lastJumpMs !== NONE && run.timeMs - run.lastJumpMs < MIN_LAUNCH_MS)) return;
   run.bufferUntilMs = NONE; run.coyoteUntilMs = NONE; run.permission = false;
   run.player.grounded = false; run.contactA = run.contactB = NONE;
   run.player.vy = V_JUMP; run.flight.atMs = run.timeMs; run.flight.y = run.player.y; run.flight.vy = V_JUMP;
   run.lastJumpMs = run.timeMs; run.launches++; run.events.jumped = true;
}

function arcY(run: TowerRun, ms: number): number {
   const t = (ms - run.flight.atMs) / 1000;
   return run.flight.y + run.flight.vy * t - G * t * t / 2;
}

function crossingMs(run: TowerRun, top: number): number {
   return run.flight.atMs + 1000 * landingTime(top - run.flight.y, run.flight.vy);
}

function topAtOrBelow(data: Tower, y: number): number {
   let low = 0, high = DESCRIPTORS;
   while (low < high) {
      const mid = (low + high) >>> 1;
      if (data.heights[mid] / 1000 <= y + 1e-12) low = mid + 1; else high = mid;
   }
   return low - 1;
}

function clampX(x: number): number { return Math.max(-X_BOUND, Math.min(X_BOUND, x)); }

/** Highest crossed top is the earliest descending collision; a failed x overlap may reach a lower top. */
function findLanding(run: TowerRun, from: number, to: number, startX: number, endY: number, peak: number): void {
   const scratch = run.scratch; scratch.landing = NONE; scratch.landingMs = Infinity;
   for (let index = topAtOrBelow(run.tower, peak); index >= 0 && run.tower.heights[index] / 1000 >= endY - 1e-12; index--) {
      const top = run.tower.heights[index] / 1000, ms = crossingMs(run, top);
      if (!Number.isFinite(ms) || ms < from - 1e-8 || ms > to + 1e-8) continue;
      const at = Math.max(from, Math.min(to, ms));
      const vx = run.windCount > 0 ? run.player.vx + windVx(run) : run.player.vx;
      const x = clampX(startX + vx * (at - from) / 1000);
      const required = run.slabs[index % 32], spurIndex = run.tower.spurForParent[index];
      const spur = spurIndex >= 0 ? run.spurs[spurIndex % 16] : null;
      const a = required.active && required.index === index && overlaps(x, required, at);
      const b = spur !== null && spur.spurIndex === spurIndex && collidable(spur, at) && overlaps(x, spur, at);
      if (!a && !b) continue;
      scratch.landing = index; scratch.landingMs = at;
      scratch.pendingA = a ? required.id : spur!.id; scratch.pendingB = a && b ? spur!.id : NONE;
      return;
   }
}

function carry(run: TowerRun, from: number, to: number): number {
   if (run.contactA < 0 || run.contactB >= 0 || run.contactA % 2 !== 0) return 0;
   const slot = run.slabs[(run.contactA / 2) % 32];
   return slabX(slot, to) - slabX(slot, from);
}

function freezeSlabs(run: TowerRun, ms: number): void {
   for (let i = 0; i < 32; i++) run.slabs[i].frozenAtMs = ms;
   for (let i = 0; i < 16; i++) run.spurs[i].frozenAtMs = ms;
}

function latchLoss(run: TowerRun, ms: number): void {
   run.loss.atMs = ms; run.loss.x = run.player.x; run.loss.footY = run.player.y; run.loss.vy = run.player.vy;
   run.pendingLose = true; run.events.hit = true;
   run.player.grounded = false; run.contactA = run.contactB = NONE;
   run.permission = false; run.bufferUntilMs = run.coyoteUntilMs = NONE;
   freezeSlabs(run, ms);
}

function finish(run: TowerRun, reason: "lose" | "timeup"): void {
   run.ended = reason; run.events.ended = reason;
   run.ranked = run.limits === RULES
      ? withinServerLimits(run.score, run.timeMs, RULES)
      : withinServerLimits(run.score, run.timeMs, run.limits);
}

function checkpoint(run: TowerRun, index: number): void {
   if (index === 0 || index % 16 !== 0) return;
   const band = index / 16;
   if (band > REWARD_BANDS || run.tower.flagSeen[band]) return;
   run.tower.flagSeen[band] = 1; run.events.checkpoint = band;
   const slot = run.flags[band % 4]; if (slot.id === band) slot.visited = true;
}

function awards(run: TowerRun, ms: number): void {
   const metres = Math.floor(run.maxHeight);
   if (metres > run.metres) { run.metres = metres; run.events.height = metres; }
   for (let i = 0; i < 4; i++) {
      const coin = run.coins[i], bandY = coin.id * 8;
      if (!coin.active || run.tower.coinTaken[coin.id] !== 0 || run.player.y < bandY || run.maxHeight < bandY) continue;
      const dx = run.player.x - coin.x, dy = run.player.y + COIN.playerLift - coin.y;
      if (dx * dx + dy * dy > COIN.pickupReach * COIN.pickupReach) continue;
      coin.active = false; coin.collected = true; run.tower.coinTaken[coin.id] = 1;
      run.collectedCoins++; run.events.coin = coin.id;
   }
   run.rawScore = run.metres * HEIGHT_POINTS + run.collectedCoins * COIN_POINTS;
   const next = run.limits === RULES ? capScore(run.rawScore, ms, RULES) : capScore(run.rawScore, ms, run.limits);
   run.events.delta += next - run.score; run.score = next;
}

function windVx(run: TowerRun): number {
   const n = run.windCount;
   if (n === 0) return 0;
   const x = run.player.x, y = run.player.y;
   for (let i = 0; i < n; i++) {
      const y0 = WIND.y0 + i * WIND.gap;
      if (y < y0 || y >= y0 + WIND.band) continue;
      const side = i % 2 === 0 ? 1 : -1;
      if (side > 0) { if (x > WIND.xInner && x < X_BOUND) return WIND.speed; }
      else if (x < -WIND.xInner && x > -X_BOUND) return -WIND.speed;
   }
   return 0;
}

function stepVx(run: TowerRun): number {
   return run.windCount > 0 ? run.player.vx + windVx(run) : run.player.vx;
}

function springAt(run: TowerRun, index: number): number {
   const n = run.springCount;
   for (let i = 0; i < n; i++) if (run.springParent[i] === index) return i;
   return NONE;
}

function onSpring(run: TowerRun, index: number, x: number): boolean {
   if (springAt(run, index) < 0) return false;
   const pad = run.tower.xs[index] / 1000, reach = SPRING.half + RUNNER.halfWidth;
   return x > pad - reach && x < pad + reach;
}

/** Descending landing on a pad: the same arc, launched at V_SPRING from the pad top. */
function launchSpring(run: TowerRun, index: number, at: number, to: number): void {
   const p = run.player, rest = (to - at) / 1000, vx = stepVx(run);
   p.vy = V_SPRING; p.grounded = false; p.groundIndex = index;
   p.contactA = p.contactB = NONE; p.permission = false; run.coyoteUntilMs = NONE;
   run.flight.atMs = at; run.flight.y = p.y; run.flight.vy = V_SPRING;
   run.events.sprung = index; run.springMs = to; run.springPad = index;
   p.x = clampX(p.x + vx * rest);
   p.y = p.y + V_SPRING * rest - G * rest * rest / 2;
   p.vy = V_SPRING - G * rest;
}

/** Constant 4 m/s up until boostUntilMs, then a normal fall (vy 0) from the burnout point. */
function flyBoost(run: TowerRun, from: number, to: number, startX: number): void {
   const p = run.player, until = run.boostUntilMs, end = to < until ? to : until;
   const dur = (end - from) / 1000, vx = stepVx(run);
   p.x = clampX(startX + vx * dur);
   p.y = p.y + ROCKET.speed * dur;
   p.grounded = false; p.contactA = p.contactB = NONE; p.permission = false;
   if (to < until) {
      p.vy = ROCKET.speed; run.flight.atMs = to; run.flight.y = p.y; run.flight.vy = ROCKET.speed;
      return;
   }
   p.vy = 0; run.flight.atMs = end; run.flight.y = p.y; run.flight.vy = 0;
   run.boostUntilMs = NONE; run.rocketDropMs = end; run.rocketDropX = p.x; run.rocketDropY = p.y;
}

function tryRocket(run: TowerRun, ms: number): void {
   const p = run.player, n = run.rocketCount;
   for (let i = 0; i < n; i++) {
      if (run.rocketTaken[i] !== 0) continue;
      const parent = run.rocketParent[i];
      const ry = run.tower.heights[parent] / 1000 + ROCKET.lift, rx = run.tower.xs[parent] / 1000;
      const dx = p.x - rx, dy = p.y + COIN.playerLift - ry;
      if (dx * dx + dy * dy > ROCKET.reach * ROCKET.reach) continue;
      run.rocketTaken[i] = 1; run.boostUntilMs = ms + ROCKET.durationMs; run.boostAim = run.rocketTarget[i];
      run.events.rocket = i; p.vy = ROCKET.speed; p.grounded = false; p.contactA = p.contactB = NONE;
      return;
   }
}

function finishMs(run: TowerRun, to: number): void {
   const p = run.player;
   if (p.y > run.maxHeight) run.maxHeight = p.y;
   run.viewBottomY = run.maxHeight - 2; run.cameraTarget.y = run.maxHeight + 1;
   fillPools(run);
   if (run.rocketCount > 0 && !p.grounded && run.boostUntilMs < 0 && !run.pendingLose) tryRocket(run, to);
   awards(run, to);
}

/** One analytic ms, including the exact landing/loss and its remaining grounded motion once. */
function integrate(run: TowerRun): void {
   const p = run.player, from = run.timeMs, to = from + 1, startX = p.x;
   if (!run.holdUnlocked) { p.x = clampX(startX + stepVx(run) / 1000); return; }
   if (run.boostUntilMs >= 0 && from < run.boostUntilMs) { flyBoost(run, from, to, startX); finishMs(run, to); return; }
   const vx = stepVx(run);
   if (p.grounded) {
      p.x = clampX(startX + vx / 1000 + carry(run, from, to));
      updateContacts(run, to, true);
   } else {
      const endY = arcY(run, to), apexMs = run.flight.atMs + run.flight.vy / G * 1000;
      let peak = Math.max(p.y, endY);
      if (apexMs >= from && apexMs <= to) peak = Math.max(peak, arcY(run, apexMs));
      if (peak > run.maxHeight) run.maxHeight = peak;
      run.viewBottomY = run.maxHeight - 2; run.cameraTarget.y = run.maxHeight + 1;
      const endVy = run.flight.vy - G * (to - run.flight.atMs) / 1000;
      run.scratch.pendingA = run.scratch.pendingB = NONE;
      if (endVy <= 0) findLanding(run, from, to, startX, endY, peak);
      else { run.scratch.landing = NONE; run.scratch.landingMs = Infinity; }
      const lossMs = endY < run.viewBottomY ? crossingMs(run, run.viewBottomY) : Infinity;
      if (Number.isFinite(lossMs) && lossMs >= from - 1e-8 && lossMs <= to && lossMs < run.scratch.landingMs) {
         const at = Math.max(from, lossMs);
         p.x = clampX(startX + vx * (at - from) / 1000); p.y = run.viewBottomY;
         p.vy = run.flight.vy - G * (at - run.flight.atMs) / 1000;
         awards(run, at); latchLoss(run, at);
         run.scratch.pendingA = run.scratch.pendingB = NONE;
         return;
      }
      if (run.scratch.landing !== NONE) {
         const index = run.scratch.landing, at = run.scratch.landingMs;
         p.x = clampX(startX + vx * (at - from) / 1000); p.y = run.tower.heights[index] / 1000;
         if (run.springCount > 0 && onSpring(run, index, p.x)) launchSpring(run, index, at, to);
         else {
            p.vy = 0; p.grounded = true; p.groundIndex = index; run.permission = true; run.coyoteUntilMs = NONE;
            // Geometry uses the exact crossing; notifications use its containing slice's integer end.
            updateContacts(run, at, true, to);
            run.events.landed = run.contactA; checkpoint(run, index);
            p.x = clampX(p.x + vx * (to - at) / 1000 + carry(run, at, to));
            updateContacts(run, to, true);
         }
      } else {
         p.x = clampX(startX + vx / 1000); p.y = endY; p.vy = endVy;
      }
      run.scratch.pendingA = run.scratch.pendingB = NONE;
   }
   finishMs(run, to);
}

function resetEvents(events: StepEvents): void {
   events.jumped = events.hit = false;
   events.landed = events.coin = events.checkpoint = events.warned = events.collapsed = events.height = NONE;
   events.sprung = events.rocket = NONE;
   events.delta = 0; events.ended = null;
}

/** dtMs, not seconds. One edge per frame, then chronological integer-ms boundaries. */
export function step(run: TowerRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events; resetEvents(ev); run.stepMs = 0;
   if (run.ended || !Number.isFinite(dtMs) || !(dtMs > 0)) return ev;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder); run.remainder -= whole;
   const target = run.timeMs + whole;
   // Like RunClock, the frame reaching the cap moves/awards nothing, even if a fall would occur.
   if (target >= DURATION_MS) {
      freezeSlabs(run, run.timeMs); run.stepMs = DURATION_MS - run.timeMs;
      run.timeMs = DURATION_MS; run.remainder = 0; finish(run, "timeup"); return ev;
   }
   if (!run.pendingLose) {
      boundary(run);
      if (input.jumpEdge) run.bufferUntilMs = run.timeMs + BUFFER_MS;
      run.player.vx = Number.isFinite(input.moveX) ? V_RUN * Math.max(-1, Math.min(1, input.moveX)) : 0;
      tryJump(run);
   }
   while (run.timeMs < target && !run.ended) {
      if (run.pendingLose) {
         const at = Math.min(target, MIN_LOSS_MS); run.stepMs += at - run.timeMs; run.timeMs = at;
         if (run.timeMs >= MIN_LOSS_MS) finish(run, "lose");
         continue;
      }
      integrate(run);
      if (run.pendingLose && run.timeMs >= MIN_LOSS_MS) { finish(run, "lose"); break; }
      run.timeMs++; run.stepMs++;
      if (run.pendingLose) {
         if (run.timeMs >= MIN_LOSS_MS) finish(run, "lose");
      } else { boundary(run); tryJump(run); }
   }
   return ev;
}

/** Drawn only: acceleration 6 m/s², then constant 6 m/s after one second. */
export function debrisDrop(ageMs: number): number {
   const t = Math.max(0, ageMs) / 1000;
   return t <= 1 ? 3 * t * t : 3 + 6 * (t - 1);
}

/** Drawn only: no horizontal drift/collisions, continuous from the recorded loss crossing. */
export function lossFall(loss: Loss, ms: number): number {
   const t = Math.max(0, ms - loss.atMs) / 1000;
   return loss.footY + loss.vy * t - 5 * t * t;
}

export interface PoseClock { endNow: number }
export function createPoseClock(): PoseClock { return { endNow: NONE }; }
export function posedMs(run: TowerRun, visual: PoseClock, phase: RunPhase, now: number): number {
   if (phase !== "over") return run.timeMs;
   if (visual.endNow === NONE) visual.endNow = now;
   return run.timeMs + 1000 * Math.max(0, now - visual.endNow);
}
