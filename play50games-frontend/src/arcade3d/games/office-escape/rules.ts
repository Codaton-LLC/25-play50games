// Office Escape rules: the integer clock, the speed schedule, lanes, the jump, input edges, the
// seeded obstacle rows and coins, collisions and scoring. Pure and deterministic: no three.js,
// React, DOM, Math.random or Date.now. Scene.tsx feeds it dt and input every frame; rules.test.ts
// drives it directly. Same seed = same track, at any frame rate.
//
// Units: whole millimetres and whole milliseconds, so a speed in mm/ms is the same number in m/s.
// README.md is the design and holds the fairness and scoring proofs; rules.test.ts checks them.
// No allocation after createRun(): rows and coins live in fixed pools that are rewritten in place,
// and step() returns the same events object every frame.
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import type { InputState } from "@/arcade3d/core/types";
import { officeEscapeMeta } from "./meta";

// ---------- tuning (README "Constants") ----------

/** Lane centres, mm (lane width 2 m). Lane indices 0..2, left to right. */
export const LANES: readonly number[] = [-2000, 0, 2000];
export const LANE_COUNT = 3;
/** The runner starts on the middle lane. */
export const START_LANE = 1;

/** Runner hitbox, mm: half-width, half-depth (around z = 0) and height from the feet. */
export const RUNNER = { halfWidth: 350, halfDepth: 250, height: 1300 } as const;

/** Speed in mm/ms (= m/s): 8 at the start, +1 every 20 s of simulation time, capped at stage 8. */
export const SPEED = { start: 8, stageMs: 20_000, maxStage: 8 } as const;
export const MAX_SPEED = SPEED.start + SPEED.maxStage;

/** Sideways speed, mm/ms: one lane (2 m) takes 200 ms. */
export const SLIDE_SPEED = 10;

/** Airtime of one jump (ms) and the apex of the feet (mm). */
export const JUMP_MS = 700;
export const JUMP_APEX = 1100;
/**
 * A jump pressed this many ms (or fewer) before landing starts on landing; an earlier one is dropped.
 * Known edge (not covered by README fairness step 5): a press buffered just before leaving a row,
 * with more than 135 ms of air left, keeps the runner up until up to 850 ms after leaving. A
 * minimum-gap row (extra 0, stage 5+) whose only passable lanes are boxes as its deepest obstacle
 * then needs take-off by 835 ms. Rare, and only after a double press; README follow-up.
 */
export const JUMP_BUFFER_MS = 150;

/** Largest simulation step, ms: useRunFrame's dt is at most 1/20 s. Longer steps are clamped. */
export const MAX_STEP_MS = 50;

/** Running time between leaving one row and entering the next, before the seeded extra. */
export const GAP_MIN_MS = 950;
/** The runner enters row 0 at this simulation time (40 m). */
export const FIRST_ROW_MS = 5000;
/** The runner's half-depth: a row is entered at s − hd − ROW_MARGIN and left after s + hd + ROW_MARGIN. */
export const ROW_MARGIN = RUNNER.halfDepth;
/** Rows are placed when their front edge is this far ahead, coins when their slot is. Rows first. */
export const ROW_LOOKAHEAD = 74_000;
export const COIN_LOOKAHEAD = 72_000;
/** Rows (back edge) and coins are recycled this far behind the runner. */
export const RECYCLE_BEHIND = 12_000;
/** Pool sizes. README "Pool bound": at most 7 rows and 9 coins are ever alive. */
export const ROW_SLOTS = 8;
export const COIN_SLOTS = 10;

/** Coin slot i sits at first + spacing · i. The coin box is a 0.7 m cube. */
export const COIN = { first: 20_000, spacing: 10_000, half: 350, groundY: 600, raisedY: 1900, points: 50 } as const;
/** Coin stream: runs of 3–6 consecutive slots in one lane, then 1–3 empty slots. */
export const COIN_RUN = { min: 3, max: 6 } as const;
export const COIN_GAP = { min: 1, max: 3 } as const;
/** The coin stream's seed is the run seed mixed with this, so coins never shift the rows. */
export const COIN_SEED_MIX = 0x9e3779b9;

/** The run ends with "win" at this simulation time (29:55), 5 s before the server's 30:00. */
export const RUN_LIMIT_MS = 1_795_000;

/** Seeded extras are multiples of this. */
export const EXTRA_STEP_MS = 50;

export interface StageRule {
   /** extra row gap range, ms (inclusive, EXTRA_STEP_MS steps), for gaps that start in this stage */
   extraMinMs: number;
   extraMaxMs: number;
   /** % of rows with 1 / 2 / 3 obstacles, for rows entered in this stage */
   mix: readonly [number, number, number];
}

const EASY: StageRule = { extraMinMs: 600, extraMaxMs: 1400, mix: [60, 40, 0] };
const MEDIUM: StageRule = { extraMinMs: 300, extraMaxMs: 1000, mix: [35, 50, 15] };
const HARD: StageRule = { extraMinMs: 0, extraMaxMs: 700, mix: [20, 55, 25] };

/** README stage table, index = stage (0..8). */
export const STAGES: readonly StageRule[] = [EASY, EASY, MEDIUM, MEDIUM, MEDIUM, HARD, HARD, HARD, HARD];

export type ObstacleRole = "jump" | "dodge";

export interface ObstacleType {
   name: "desk" | "printer" | "boxes" | "chair" | "coffeeCart" | "waterCooler";
   role: ObstacleRole;
   /** hitbox, mm: half-width, depth along the track (centred on the row), top above the floor */
   halfWidth: number;
   depth: number;
   top: number;
}

/** Obstacle type ids: indices into OBSTACLE_TYPES. Rows store these per lane. */
export const OBSTACLE = { desk: 0, printer: 1, boxes: 2, chair: 3, coffeeCart: 4, waterCooler: 5 } as const;
/** A lane without an obstacle. */
export const NO_OBSTACLE = -1;

/**
 * Hitboxes are floor boxes, a little smaller than the drawn props (README "Obstacles"). The role
 * follows from the numbers: every jump top is under the jump apex, every dodge top above it.
 */
export const OBSTACLE_TYPES: readonly ObstacleType[] = [
   { name: "desk", role: "jump", halfWidth: 700, depth: 700, top: 550 },
   { name: "printer", role: "jump", halfWidth: 450, depth: 700, top: 550 },
   { name: "boxes", role: "jump", halfWidth: 550, depth: 800, top: 600 },
   { name: "chair", role: "dodge", halfWidth: 400, depth: 700, top: 1300 },
   { name: "coffeeCart", role: "dodge", halfWidth: 550, depth: 1300, top: 1300 },
   { name: "waterCooler", role: "dodge", halfWidth: 300, depth: 500, top: 1500 },
];
const JUMP_TYPES: readonly number[] = [OBSTACLE.desk, OBSTACLE.printer, OBSTACLE.boxes];
const DODGE_TYPES: readonly number[] = [OBSTACLE.chair, OBSTACLE.coffeeCart, OBSTACLE.waterCooler];

/** Is a lane with this obstacle (or none) passable: empty or jumpable? */
export function isPassable(type: number): boolean {
   return type === NO_OBSTACLE || OBSTACLE_TYPES[type].role === "jump";
}

// ---------- clock, speed and distance ----------

/** Speed stage at simulation time `ms`: 0..8. */
export function stageAt(ms: number): number {
   if (!(ms > 0)) return 0;
   return Math.min(Math.floor(ms / SPEED.stageMs), SPEED.maxStage);
}

/** Speed at simulation time `ms`, mm/ms (= m/s). */
export function speedAt(ms: number): number {
   return SPEED.start + stageAt(ms);
}

/** Distance (mm) at the start of stage k. */
export function stageStartDistance(k: number): number {
   return SPEED.stageMs * (SPEED.start * k + (k * (k - 1)) / 2);
}

/** Distance in mm after `ms` whole ms of simulation time. Closed form, exact, never drifts. */
export function distanceAt(ms: number): number {
   if (!(ms > 0)) return 0;
   const k = stageAt(ms);
   return stageStartDistance(k) + (ms - k * SPEED.stageMs) * (SPEED.start + k);
}

/** The first whole ms at which distanceAt reaches `mm`: distanceAt(t) ≥ mm > distanceAt(t − 1). */
export function timeAt(mm: number): number {
   if (!(mm > 0)) return 0;
   let k = SPEED.maxStage;
   while (k > 0 && stageStartDistance(k) >= mm) k--;
   return k * SPEED.stageMs + Math.ceil((mm - stageStartDistance(k)) / (SPEED.start + k));
}

/** Feet height (mm) `j` ms after take-off: a parabola, 0 at 0 and JUMP_MS, JUMP_APEX at the middle. */
export function jumpHeight(j: number): number {
   if (!(j > 0) || j >= JUMP_MS) return 0;
   return Math.floor((4 * JUMP_APEX * j * (JUMP_MS - j)) / (JUMP_MS * JUMP_MS));
}

// ---------- track ----------

export interface Row {
   /** false = free pool slot */
   alive: boolean;
   /** row number k: 0 is the first row of the run */
   index: number;
   /** centre, mm of track */
   s: number;
   /** half of the row's band: half the deepest hitbox in the row */
   hd: number;
   /** sim ms at which the runner enters the band (distanceAt(inMs) = s − hd − ROW_MARGIN) */
   inMs: number;
   /** sim ms at which the runner reaches the band's back edge (timeAt(s + hd + ROW_MARGIN)) */
   outMs: number;
   /** obstacles in the row: 1..3 */
   count: number;
   /** obstacle type per lane (OBSTACLE ids), NO_OBSTACLE = empty lane. Always 3 long. */
   lanes: number[];
}

export type CoinKind = "ground" | "raised" | "removed";

export interface Coin {
   /** false = free pool slot */
   alive: boolean;
   /** coin slot i (track position COIN.first + COIN.spacing · i) */
   slot: number;
   /** centre, mm of track */
   s: number;
   lane: number;
   /**
    * "ground": y 0.6 m. "raised": y 1.9 m over a jumpable, collected only in the air.
    * "removed": would touch a dodge obstacle, so it is not there (never drawn, never collected).
    */
   kind: CoinKind;
   taken: boolean;
}

/** Front edge of a row's band, mm: the runner enters when distance ≥ this. */
export const rowFront = (row: Row): number => row.s - row.hd - ROW_MARGIN;
/** Back edge of a row's band, mm: the runner has left when distance > this. */
export const rowBack = (row: Row): number => row.s + row.hd + ROW_MARGIN;
/** Track position of coin slot i, mm. */
export const coinSlotS = (slot: number): number => COIN.first + COIN.spacing * slot;

// ---------- input ----------

export type LaneMove = -1 | 0 | 1;

/** One frame of game input, after edge detection (readInput). */
export interface StepInput {
   /** a lane event: -1 = one lane left, +1 = one lane right, 0 = none */
   lane: LaneMove;
   /** an optional second lane event in the same frame, applied after `lane` (readInput puts swipes here) */
   lane2?: LaneMove;
   /** a jump event: Space, W/Up (edge) or a swipe up */
   jumpPressed: boolean;
}

/** Edge-detector state for the held axes (one per run). */
export interface InputEdges {
   /** the moveX zone on the previous read: -1 (≤ −0.5), 0, +1 (≥ 0.5) */
   xZone: LaneMove;
   /** moveY was ≤ −0.5 (W/Up held) on the previous read */
   up: boolean;
}

/** Half-way on an axis: a held arrow crosses it, so does a keyboard diagonal (0.707). */
export const AXIS_EDGE = 0.5;

export function createStepInput(): StepInput {
   return { lane: 0, lane2: 0, jumpPressed: false };
}

/**
 * Turns this frame's core input into one-shot events (README "Edges, not holds"), writing `out`.
 * A lane event fires when moveX enters the left or right zone (|moveX| ≥ 0.5) it was not in on the
 * previous read: holding Left gives one event, Left + Right together (moveX 0) give none, and
 * releasing one of them re-arms. W/Up works the same on moveY ≤ −0.5 and gives a jump. Space is
 * core's jumpPressed. A swipe left/right is the second lane event, a swipe up a jump, down nothing.
 */
export function readInput(
   edges: InputEdges,
   input: Pick<InputState, "moveX" | "moveY" | "jumpPressed" | "swipe">,
   out: StepInput
): StepInput {
   const zone: LaneMove = input.moveX <= -AXIS_EDGE ? -1 : input.moveX >= AXIS_EDGE ? 1 : 0;
   out.lane = zone !== 0 && zone !== edges.xZone ? zone : 0;
   edges.xZone = zone;
   const up = input.moveY <= -AXIS_EDGE;
   out.jumpPressed = input.jumpPressed || (up && !edges.up) || input.swipe === "up";
   edges.up = up;
   out.lane2 = input.swipe === "left" ? -1 : input.swipe === "right" ? 1 : 0;
   return out;
}

// ---------- run state ----------

/** What happened in one step. The same object every step (reset at the start of each step). */
export interface RunEvents {
   /** a lane event moved the target lane */
   laneChanged: boolean;
   /** a lane event at an outer lane did nothing (the runner only wobbles) */
   laneBlocked: boolean;
   /** a jump took off (pressed on the ground, or buffered and started on landing) */
   jumped: boolean;
   /** a jump came down (also when a buffered jump starts on the same step) */
   landed: boolean;
   /** coins collected this step */
   coin: number;
   /** the runner hit an obstacle: the run is over ("lose") */
   hit: boolean;
   /** row index, lane and OBSTACLE id of the obstacle hit, -1 without a hit */
   hitRow: number;
   hitLane: number;
   hitType: number;
   /** the run ended this step: "lose" on a hit, "win" at the run limit */
   ended: "win" | "lose" | null;
   /** a new speed stage started (setLevel(stage + 1)) */
   stageChanged: boolean;
   /** run.score changed (setScore) */
   scoreChanged: boolean;
}

export interface OfficeRun {
   seed: number;
   coinSeed: number;

   // clock
   /** fraction of a ms carried to the next step, [0, 1) */
   carry: number;
   /** whole ms of the latest step, 0..MAX_STEP_MS */
   stepMs: number;
   /** simulation time, whole ms */
   simMs: number;
   /** distance run, mm: always distanceAt(simMs) */
   distance: number;
   /** speed stage, 0..8 (speed = 8 + stage) */
   stage: number;

   // runner
   /** target lane, 0..2 */
   lane: number;
   /** sideways position, mm */
   x: number;
   /** ms since take-off, -1 on the ground */
   jumpMs: number;
   /** a jump pressed in the last JUMP_BUFFER_MS of the air, started on landing */
   jumpBuffered: boolean;
   /** feet height, mm: jumpHeight(jumpMs) */
   feet: number;

   // scoring
   coins: number;
   /** floor(distance / 1000) + COIN.points · coins */
   score: number;
   over: boolean;
   endReason: "win" | "lose" | null;

   // track
   /** ROW_SLOTS fixed slots, rewritten in place */
   rows: Row[];
   /** COIN_SLOTS fixed slots, rewritten in place */
   coinPool: Coin[];
   /** the next row, fully drawn (index = rows placed so far), waiting for its front edge to be 74 m ahead */
   nextRow: Row;
   /** the next coin slot to write (= coin slots written so far) */
   nextCoinSlot: number;
   /** times a placement found its pool full and waited. README proves it stays 0. */
   poolFull: number;

   // generators
   rowRng: () => number;
   coinRng: () => number;
   coinLane: number;
   coinRunLeft: number;
   coinGapLeft: number;

   // per-frame scratch
   edges: InputEdges;
   input: StepInput;
   events: RunEvents;
   shuffle: number[];
}

function createRow(): Row {
   return { alive: false, index: -1, s: 0, hd: 0, inMs: 0, outMs: 0, count: 0, lanes: [NO_OBSTACLE, NO_OBSTACLE, NO_OBSTACLE] };
}

function createCoin(): Coin {
   return { alive: false, slot: -1, s: 0, lane: 0, kind: "ground", taken: false };
}

function createEvents(): RunEvents {
   return {
      laneChanged: false,
      laneBlocked: false,
      jumped: false,
      landed: false,
      coin: 0,
      hit: false,
      hitRow: -1,
      hitLane: -1,
      hitType: NO_OBSTACLE,
      ended: null,
      stageChanged: false,
      scoreChanged: false,
   };
}

function resetEvents(ev: RunEvents): void {
   ev.laneChanged = false;
   ev.laneBlocked = false;
   ev.jumped = false;
   ev.landed = false;
   ev.coin = 0;
   ev.hit = false;
   ev.hitRow = -1;
   ev.hitLane = -1;
   ev.hitType = NO_OBSTACLE;
   ev.ended = null;
   ev.stageChanged = false;
   ev.scoreChanged = false;
}

/** The coin stream's seed for a run seed. */
export const coinSeedFor = (seed: number): number => ((seed >>> 0) ^ COIN_SEED_MIX) >>> 0;

/**
 * A new run, standing on the start line. Allocates everything the run will ever use, then fills
 * the corridor the way every step does (rows up to 74 m, then coins up to 72 m), so the track is
 * there during the countdown. `coinSeed` is for tests only (changing it must leave the rows alone).
 */
export function createRun(seed: number, coinSeed: number = coinSeedFor(seed)): OfficeRun {
   const run: OfficeRun = {
      seed: seed >>> 0,
      coinSeed: coinSeed >>> 0,
      carry: 0,
      stepMs: 0,
      simMs: 0,
      distance: 0,
      stage: 0,
      lane: START_LANE,
      x: LANES[START_LANE],
      jumpMs: -1,
      jumpBuffered: false,
      feet: 0,
      coins: 0,
      score: 0,
      over: false,
      endReason: null,
      rows: Array.from({ length: ROW_SLOTS }, createRow),
      coinPool: Array.from({ length: COIN_SLOTS }, createCoin),
      nextRow: createRow(),
      nextCoinSlot: 0,
      poolFull: 0,
      rowRng: createRng(seed >>> 0),
      coinRng: createRng(coinSeed >>> 0),
      coinLane: 0,
      coinRunLeft: 0,
      coinGapLeft: 0,
      edges: { xZone: 0, up: false },
      input: createStepInput(),
      events: createEvents(),
      shuffle: [0, 1, 2],
   };
   drawRow(run, run.nextRow, 0, FIRST_ROW_MS);
   updateTrack(run);
   return run;
}

/**
 * Draws the composition of row `index`, entered at `inMs`, into `row`, then places it by time:
 * s = distanceAt(inMs) + ROW_MARGIN + hd, and outMs from s. Draw order per row: count, lane
 * shuffle (2 draws), then per obstacle the role and the type (2 draws each).
 */
function drawRow(run: OfficeRun, row: Row, index: number, inMs: number): void {
   const rng = run.rowRng;
   const mix = STAGES[stageAt(inMs)].mix;
   const roll = rng() * 100;
   const count = roll < mix[0] ? 1 : roll < mix[0] + mix[1] ? 2 : 3;

   const order = run.shuffle;
   order[0] = 0;
   order[1] = 1;
   order[2] = 2;
   for (let i = LANE_COUNT - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
   }

   const lanes = row.lanes;
   lanes[0] = NO_OBSTACLE;
   lanes[1] = NO_OBSTACLE;
   lanes[2] = NO_OBSTACLE;
   let dodges = 0;
   let hd = 0;
   for (let n = 0; n < count; n++) {
      let jump = rng() < 0.5;
      const pick = Math.floor(rng() * 3);
      // a row is never three dodges: the third of a 3-row after two dodges is a jumpable
      if (n === 2 && dodges === 2) jump = true;
      const type = jump ? JUMP_TYPES[pick] : DODGE_TYPES[pick];
      if (!jump) dodges += 1;
      lanes[order[n]] = type;
      hd = Math.max(hd, OBSTACLE_TYPES[type].depth / 2);
   }

   row.alive = false;
   row.index = index;
   row.count = count;
   row.hd = hd;
   row.inMs = inMs;
   row.s = distanceAt(inMs) + ROW_MARGIN + hd;
   row.outMs = timeAt(row.s + hd + ROW_MARGIN);
}

/** The seeded extra gap (ms) after a row the runner leaves at `outMs`. */
function drawExtra(run: OfficeRun, outMs: number): number {
   const rule = STAGES[stageAt(outMs)];
   const steps = (rule.extraMaxMs - rule.extraMinMs) / EXTRA_STEP_MS + 1;
   return rule.extraMinMs + EXTRA_STEP_MS * Math.floor(run.rowRng() * steps);
}

/** Next lane of the coin stream for the next slot (-1 = empty slot). One call per slot, in order. */
function nextCoinLane(run: OfficeRun): number {
   if (run.coinRunLeft === 0 && run.coinGapLeft === 0) {
      const rng = run.coinRng;
      run.coinLane = Math.floor(rng() * LANE_COUNT);
      run.coinRunLeft = COIN_RUN.min + Math.floor(rng() * (COIN_RUN.max - COIN_RUN.min + 1));
      run.coinGapLeft = COIN_GAP.min + Math.floor(rng() * (COIN_GAP.max - COIN_GAP.min + 1));
   }
   if (run.coinRunLeft > 0) {
      run.coinRunLeft -= 1;
      return run.coinLane;
   }
   run.coinGapLeft -= 1;
   return -1;
}

/**
 * Raise-or-remove check for a coin at `s` in `lane` against the rows in the pool: touching a dodge
 * obstacle in its lane removes it, touching a jumpable raises it (README "Coins").
 */
function coinKindAt(rows: readonly Row[], s: number, lane: number): CoinKind {
   let kind: CoinKind = "ground";
   for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.alive) continue;
      const type = row.lanes[lane];
      if (type === NO_OBSTACLE) continue;
      const o = OBSTACLE_TYPES[type];
      if (Math.abs(s - row.s) > o.depth / 2 + COIN.half) continue;
      if (o.role === "dodge") return "removed";
      kind = "raised";
   }
   return kind;
}

/**
 * Moves the track window to run.distance, in the README's fixed order: recycle rows and coins 12 m
 * behind, place rows up to 74 m ahead, then write coins up to 72 m ahead (rows first, so a coin's
 * check always sees every row that can touch it, whatever the frame timing).
 */
export function updateTrack(run: OfficeRun): void {
   const d = run.distance;
   const behind = d - RECYCLE_BEHIND;
   for (let i = 0; i < ROW_SLOTS; i++) {
      const row = run.rows[i];
      if (row.alive && rowBack(row) < behind) row.alive = false;
   }
   for (let i = 0; i < COIN_SLOTS; i++) {
      const coin = run.coinPool[i];
      if (coin.alive && coin.s < behind) coin.alive = false;
   }

   while (rowFront(run.nextRow) <= d + ROW_LOOKAHEAD) {
      let slot: Row | null = null;
      for (let i = 0; i < ROW_SLOTS; i++) {
         if (!run.rows[i].alive) {
            slot = run.rows[i];
            break;
         }
      }
      if (!slot) {
         run.poolFull += 1;
         break;
      }
      const next = run.nextRow;
      slot.alive = true;
      slot.index = next.index;
      slot.s = next.s;
      slot.hd = next.hd;
      slot.inMs = next.inMs;
      slot.outMs = next.outMs;
      slot.count = next.count;
      slot.lanes[0] = next.lanes[0];
      slot.lanes[1] = next.lanes[1];
      slot.lanes[2] = next.lanes[2];
      // row k+1 is entered GAP_MIN_MS + extra after the runner leaves row k (exact clock)
      const inMs = next.outMs + GAP_MIN_MS + drawExtra(run, next.outMs);
      drawRow(run, next, next.index + 1, inMs);
   }

   while (coinSlotS(run.nextCoinSlot) <= d + COIN_LOOKAHEAD) {
      let slot: Coin | null = null;
      for (let i = 0; i < COIN_SLOTS; i++) {
         if (!run.coinPool[i].alive) {
            slot = run.coinPool[i];
            break;
         }
      }
      if (!slot) {
         run.poolFull += 1;
         break;
      }
      const lane = nextCoinLane(run);
      const s = coinSlotS(run.nextCoinSlot);
      if (lane >= 0) {
         slot.alive = true;
         slot.slot = run.nextCoinSlot;
         slot.s = s;
         slot.lane = lane;
         slot.kind = coinKindAt(run.rows, s, lane);
         slot.taken = false;
      }
      run.nextCoinSlot += 1;
   }
}

// ---------- collisions ----------

/**
 * Does the runner (at track `distance`, sideways `x`, feet `feet`) overlap obstacle `type` standing
 * in `lane` at track position `s`? Depth and sideways as floor boxes, height: feet below the top.
 */
export function overlapsObstacle(type: number, lane: number, s: number, distance: number, x: number, feet: number): boolean {
   const o = OBSTACLE_TYPES[type];
   return (
      Math.abs(distance - s) <= o.depth / 2 + RUNNER.halfDepth &&
      Math.abs(x - LANES[lane]) < o.halfWidth + RUNNER.halfWidth &&
      feet < o.top
   );
}

/**
 * Does the runner overlap a coin box (`kind` ground or raised)? Depth |s − distance| < 0.6 m,
 * sideways |x − lane| < 0.7 m, heights overlap strictly: a ground coin needs feet < 0.95 m, a
 * raised one feet > 0.25 m (in the air).
 */
export function touchesCoin(lane: number, s: number, kind: CoinKind, distance: number, x: number, feet: number): boolean {
   if (kind === "removed") return false;
   if (Math.abs(s - distance) >= COIN.half + RUNNER.halfDepth) return false;
   if (Math.abs(x - LANES[lane]) >= COIN.half + RUNNER.halfWidth) return false;
   const y = kind === "raised" ? COIN.raisedY : COIN.groundY;
   return feet < y + COIN.half && feet + RUNNER.height > y - COIN.half;
}

// ---------- scoring ----------

/** 1 point per full metre run plus 50 per coin. */
export function scoreFor(distanceMm: number, coins: number): number {
   return Math.floor(distanceMm / 1000) + COIN.points * coins;
}

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, officeEscapeMeta.scoring);
}

/**
 * Safety net only (core/limits.ts capScore with meta.ts limits): README "Server limits" shows real
 * runs never reach the cap, and rules.test.ts checks it stays a no-op.
 */
export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, officeEscapeMeta.scoring);
}

// ---------- the step ----------

function applyLane(run: OfficeRun, move: LaneMove): void {
   if (move === 0) return;
   const target = run.lane + move;
   if (target < 0 || target >= LANE_COUNT) {
      run.events.laneBlocked = true;
      return;
   }
   run.lane = target;
   run.events.laneChanged = true;
}

function pressJump(run: OfficeRun): void {
   if (run.jumpMs < 0) {
      // phase counts from this frame's start: after the clock it equals the step length
      run.jumpMs = 0;
      run.events.jumped = true;
   } else if (JUMP_MS - run.jumpMs <= JUMP_BUFFER_MS) {
      run.jumpBuffered = true;
   }
}

/**
 * Advances the integer clock by `dtMs` (clamped to MAX_STEP_MS) with the carried remainder:
 * simMs, distance and stage. Returns the whole-ms step. The sum of the steps never runs ahead of
 * the sum of the dts and lags it by less than 1 ms.
 */
export function advanceClock(run: OfficeRun, dtMs: number): number {
   if (!(dtMs > 0)) {
      run.stepMs = 0;
      return 0;
   }
   run.carry += Math.min(dtMs, MAX_STEP_MS);
   const stepMs = Math.floor(run.carry);
   run.carry -= stepMs;
   run.stepMs = stepMs;
   run.simMs += stepMs;
   run.distance = distanceAt(run.simMs);
   const stage = stageAt(run.simMs);
   if (stage !== run.stage) {
      run.stage = stage;
      run.events.stageChanged = true;
   }
   return stepMs;
}

/** Slide towards the target lane and advance the jump by the latest step. */
function moveRunner(run: OfficeRun): void {
   const stepMs = run.stepMs;
   const dx = LANES[run.lane] - run.x;
   const max = SLIDE_SPEED * stepMs;
   run.x += dx > max ? max : dx < -max ? -max : dx;

   if (run.jumpMs >= 0) {
      run.jumpMs += stepMs;
      if (run.jumpMs >= JUMP_MS) {
         run.events.landed = true;
         if (run.jumpBuffered) {
            // the buffered jump takes off at the landing moment itself
            run.jumpBuffered = false;
            run.jumpMs -= JUMP_MS;
            run.events.jumped = true;
         } else {
            run.jumpMs = -1;
         }
      }
   }
   run.feet = run.jumpMs > 0 ? jumpHeight(run.jumpMs) : 0;
}

function hitObstacle(run: OfficeRun): boolean {
   const d = run.distance;
   for (let i = 0; i < ROW_SLOTS; i++) {
      const row = run.rows[i];
      if (!row.alive || Math.abs(d - row.s) > row.hd + ROW_MARGIN) continue;
      for (let lane = 0; lane < LANE_COUNT; lane++) {
         const type = row.lanes[lane];
         if (type === NO_OBSTACLE) continue;
         if (overlapsObstacle(type, lane, row.s, d, run.x, run.feet)) {
            run.events.hit = true;
            run.events.hitRow = row.index;
            run.events.hitLane = lane;
            run.events.hitType = type;
            return true;
         }
      }
   }
   return false;
}

function collectCoins(run: OfficeRun): void {
   for (let i = 0; i < COIN_SLOTS; i++) {
      const coin = run.coinPool[i];
      if (!coin.alive || coin.taken) continue;
      if (touchesCoin(coin.lane, coin.s, coin.kind, run.distance, run.x, run.feet)) {
         coin.taken = true;
         run.coins += 1;
         run.events.coin += 1;
      }
   }
}

function updateScore(run: OfficeRun): void {
   const score = scoreFor(run.distance, run.coins);
   if (score !== run.score) {
      run.score = score;
      run.events.scoreChanged = true;
   }
}

function finish(run: OfficeRun, reason: "win" | "lose"): void {
   run.over = true;
   run.endReason = reason;
   run.events.ended = reason;
}

/**
 * One simulation step: `dtMs` is useRunFrame's dt · 1000 (> 0, at most 50; longer is clamped,
 * dt ≤ 0 or NaN does nothing). Order (README "Collisions"): input events (lane, lane2, then the
 * jump) → clock, slide, jump phase → track recycle and spawn → obstacles → coins → score → run
 * limit. A hit ends the step at once (no coin on that frame) and wins over the run limit. Returns
 * run.events, the same object every step. Allocates nothing.
 */
export function step(run: OfficeRun, dtMs: number, input: StepInput): RunEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.over || !(dtMs > 0)) return ev;

   applyLane(run, input.lane);
   applyLane(run, input.lane2 ?? 0);
   if (input.jumpPressed) pressJump(run);

   advanceClock(run, dtMs);
   moveRunner(run);
   updateTrack(run);

   if (hitObstacle(run)) {
      updateScore(run);
      finish(run, "lose");
      return ev;
   }
   collectCoins(run);
   updateScore(run);
   if (run.simMs >= RUN_LIMIT_MS) finish(run, "win");
   return ev;
}
