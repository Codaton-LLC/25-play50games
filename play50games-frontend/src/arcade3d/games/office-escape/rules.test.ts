import { describe, expect, it } from "vitest";
import { FRAME_PRIORITY, MAX_FRAME_DT, advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import type { InputState } from "@/arcade3d/core/types";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { officeEscapeMeta } from "./meta";
import {
   AXIS_EDGE,
   COIN,
   COIN_GAP,
   COIN_LOOKAHEAD,
   COIN_RUN,
   COIN_SEED_MIX,
   COIN_SLOTS,
   EXTRA_STEP_MS,
   FIRST_ROW_MS,
   GAP_MIN_MS,
   JUMP_APEX,
   JUMP_BUFFER_MS,
   JUMP_MS,
   LANES,
   LANE_COUNT,
   MAX_SPEED,
   MAX_STEP_MS,
   NO_OBSTACLE,
   OBSTACLE,
   OBSTACLE_TYPES,
   RECYCLE_BEHIND,
   ROW_LOOKAHEAD,
   ROW_MARGIN,
   ROW_SLOTS,
   RUNNER,
   RUN_LIMIT_MS,
   SLIDE_SPEED,
   SPEED,
   STAGES,
   START_LANE,
   advanceClock,
   capScore,
   coinSeedFor,
   coinSlotS,
   createRun,
   createStepInput,
   distanceAt,
   isPassable,
   jumpHeight,
   overlapsObstacle,
   readInput,
   rowBack,
   rowFront,
   scoreFor,
   speedAt,
   stageAt,
   stageStartDistance,
   step,
   timeAt,
   touchesCoin,
   updateTrack,
   withinServerLimits,
   type CoinKind,
   type InputEdges,
   type OfficeRun,
   type Row,
   type StepInput,
} from "./rules";

// ---------- frame patterns ----------

type DtSource = () => number;

interface Pattern {
   name: string;
   /** a fresh dt source (ms per frame) for one run; `seed` only matters for random patterns */
   make: (seed: number) => DtSource;
}

const steady = (name: string, ms: number): Pattern => ({ name, make: () => () => ms });
const jittery = (name: string, min: number, max: number): Pattern => ({
   name,
   make: (seed) => {
      const rng = createRng((seed ^ 0x5eed5eed) >>> 0);
      return () => min + rng() * (max - min);
   },
});

const FPS_144 = steady("144 fps", 1000 / 144);
const MS_8_3 = steady("8.3 ms", 8.3);
const FPS_60 = steady("60 fps", 1000 / 60);
const MS_16_7 = steady("16.7 ms", 16.7);
const FPS_30 = steady("30 fps", 1000 / 30);
const FPS_20 = steady("20 fps (50 ms)", 50);
const MS_1 = steady("1 ms", 1);
const RANDOM = jittery("random 1-50 ms", 1, 50);
/** The rates the fairness bot plays at (README test plan). */
const BOT_RATES = [FPS_144, FPS_60, FPS_30, FPS_20];

/** First jump phase (ms) at which the feet are at or above `top`. */
const firstClearPhase = (top: number) => {
   let j = 0;
   while (jumpHeight(j) < top) j++;
   return j;
};
const JUMPABLE_TOPS = OBSTACLE_TYPES.filter((o) => o.role === "jump").map((o) => o.top);
/** README fairness step 4: the bot takes off this long before entering a row (115 ms). */
const JUMP_LEAD = firstClearPhase(Math.max(...JUMPABLE_TOPS));

const DODGES = [OBSTACLE.chair, OBSTACLE.coffeeCart, OBSTACLE.waterCooler];
const JUMPABLES = [OBSTACLE.desk, OBSTACLE.printer, OBSTACLE.boxes];

// ---------- track log (what the pools received, in order) ----------

interface RowRecord {
   index: number;
   s: number;
   hd: number;
   inMs: number;
   outMs: number;
   count: number;
   lanes: number[];
}

interface CoinRecord {
   slot: number;
   lane: number;
   kind: CoinKind;
}

interface TrackLog {
   rows: RowRecord[];
   /** by slot; empty slots stay undefined */
   coins: Array<CoinRecord | undefined>;
   rowsSeen: number;
   slotsSeen: number;
   maxRows: number;
   maxCoins: number;
}

const newLog = (): TrackLog => ({ rows: [], coins: [], rowsSeen: -1, slotsSeen: -1, maxRows: 0, maxCoins: 0 });

/**
 * Records every row and coin when it is written into its pool slot, and the most slots ever alive.
 * Call after createRun and after every step. Alive counts only grow when something is placed, so
 * scanning only then sees every maximum.
 */
function capture(run: OfficeRun, log: TrackLog): void {
   if (run.nextRow.index === log.rowsSeen && run.nextCoinSlot === log.slotsSeen) return;
   log.rowsSeen = run.nextRow.index;
   log.slotsSeen = run.nextCoinSlot;
   let rows = 0;
   for (const r of run.rows) {
      if (!r.alive) continue;
      rows += 1;
      if (!log.rows[r.index]) {
         log.rows[r.index] = { index: r.index, s: r.s, hd: r.hd, inMs: r.inMs, outMs: r.outMs, count: r.count, lanes: [...r.lanes] };
      }
   }
   let coins = 0;
   for (const c of run.coinPool) {
      if (!c.alive) continue;
      coins += 1;
      if (!log.coins[c.slot]) log.coins[c.slot] = { slot: c.slot, lane: c.lane, kind: c.kind };
   }
   log.maxRows = Math.max(log.maxRows, rows);
   log.maxCoins = Math.max(log.maxCoins, coins);
}

/**
 * The part of a log every run that reached `untilMs` must have placed: rows whose front edge is
 * within 74 m of distanceAt(untilMs), coin slots within 72 m. Serialised for comparisons.
 */
function placedBy(log: TrackLog, untilMs: number): string {
   const d = distanceAt(untilMs);
   const rows = log.rows.filter((r) => r.s - r.hd - ROW_MARGIN <= d + ROW_LOOKAHEAD);
   const coins = log.coins.filter((c): c is CoinRecord => !!c && coinSlotS(c.slot) <= d + COIN_LOOKAHEAD);
   return JSON.stringify({ rows, coins });
}

/** The track alone (no runner, no collisions): the clock and updateTrack, exactly as step runs them. */
function driveTrack(seed: number, dt: DtSource, untilMs: number, coinSeed?: number): { run: OfficeRun; log: TrackLog } {
   const run = coinSeed === undefined ? createRun(seed) : createRun(seed, coinSeed);
   const log = newLog();
   capture(run, log);
   while (run.simMs < untilMs) {
      advanceClock(run, dt());
      updateTrack(run);
      capture(run, log);
   }
   return { run, log };
}

/** README "Coins": the raise-or-remove rule, checked against every row of the run. */
function referenceKind(rows: RowRecord[], s: number, lane: number): CoinKind {
   let kind: CoinKind = "ground";
   for (const row of rows) {
      const type = row.lanes[lane];
      if (type === NO_OBSTACLE || Math.abs(s - row.s) > OBSTACLE_TYPES[type].depth / 2 + COIN.half) continue;
      if (OBSTACLE_TYPES[type].role === "dodge") return "removed";
      kind = "raised";
   }
   return kind;
}

interface TrackStats {
   rows: number;
   coins: number;
   rowsPerStage: number[];
   countsPerStage: number[][];
   minGapMs: number;
   minSpacing: number;
   raised: number;
   removed: number;
   types: Set<number>;
}

const newStats = (): TrackStats => ({
   rows: 0,
   coins: 0,
   rowsPerStage: Array(9).fill(0),
   countsPerStage: Array.from({ length: 9 }, () => [0, 0, 0, 0]),
   minGapMs: Infinity,
   minSpacing: Infinity,
   raised: 0,
   removed: 0,
   types: new Set(),
});

/**
 * Every rule the README states about the track, for one run's log. Returns the broken ones
 * (empty = all hold) so a sweep over many seeds reports instead of stopping at the first.
 */
function trackProblems(log: TrackLog, stats: TrackStats, label: string): string[] {
   const problems: string[] = [];
   const bad = (msg: string) => problems.length < 20 && problems.push(`${label}: ${msg}`);
   const { rows } = log;
   if (rows.length === 0 || rows[0].inMs !== FIRST_ROW_MS) bad("row 0 is not entered at 5000 ms");
   for (let k = 0; k < rows.length; k++) {
      const r = rows[k];
      if (!r || r.index !== k) {
         bad(`row ${k} missing`);
         continue;
      }
      const stage = stageAt(r.inMs);
      const filled = r.lanes.filter((t) => t !== NO_OBSTACLE);
      const dodges = filled.filter((t) => OBSTACLE_TYPES[t].role === "dodge").length;
      const hd = Math.max(...filled.map((t) => OBSTACLE_TYPES[t].depth / 2));
      if (r.lanes.length !== LANE_COUNT || filled.length !== r.count || r.count < 1 || r.count > 3) bad(`row ${k} has ${r.count} obstacles`);
      if (STAGES[stage].mix[r.count - 1] === 0) bad(`row ${k}: ${r.count} obstacles not allowed in stage ${stage}`);
      if (!r.lanes.some(isPassable)) bad(`row ${k} has no passable lane`);
      if (dodges === 3) bad(`row ${k} is three dodges`);
      if (r.hd !== hd) bad(`row ${k} band ${r.hd} != ${hd}`);
      if (r.s !== distanceAt(r.inMs) + ROW_MARGIN + hd) bad(`row ${k} is not placed by its time`);
      if (r.outMs !== timeAt(r.s + r.hd + ROW_MARGIN)) bad(`row ${k} out time`);
      if (k > 0) {
         const prev = rows[k - 1];
         const gap = r.inMs - prev.outMs;
         const rule = STAGES[stageAt(prev.outMs)];
         const extra = gap - GAP_MIN_MS;
         if (gap < GAP_MIN_MS) bad(`gap ${k - 1}->${k} is ${gap} ms`);
         if (extra < rule.extraMinMs || extra > rule.extraMaxMs || extra % EXTRA_STEP_MS !== 0) bad(`row ${k} extra ${extra}`);
         stats.minGapMs = Math.min(stats.minGapMs, gap);
         stats.minSpacing = Math.min(stats.minSpacing, r.s - prev.s);
      }
      stats.rows += 1;
      stats.rowsPerStage[stage] += 1;
      stats.countsPerStage[stage][r.count] += 1;
      for (const t of filled) stats.types.add(t);
   }

   // coins: slots, lanes, the stream's runs and gaps, and the raise-or-remove rule against ALL rows
   let first = 0;
   let blockStart = -1;
   let blockLane = -1;
   const coins = log.coins;
   for (let i = 0; i <= coins.length; i++) {
      const c = coins[i];
      if (c) {
         if (c.slot !== i || c.lane < 0 || c.lane >= LANE_COUNT) bad(`coin slot ${i}`);
         const s = coinSlotS(i);
         // rows sorted by s: only rows within 1 m can touch
         while (first < rows.length && rows[first].s < s - 1000) first++;
         let last = first;
         while (last < rows.length && rows[last].s <= s + 1000) last++;
         const expected = referenceKind(rows.slice(first, last), s, c.lane);
         if (c.kind !== expected) bad(`coin ${i} is ${c.kind}, the full row list says ${expected}`);
         if (c.kind === "raised") stats.raised += 1;
         if (c.kind === "removed") stats.removed += 1;
         stats.coins += 1;
         if (blockStart < 0) {
            if (i > 0) {
               // the empty stretch before this run
               let gapStart = i - 1;
               while (gapStart > 0 && !coins[gapStart - 1]) gapStart--;
               const empty = i - gapStart;
               if (gapStart > 0 && (empty < COIN_GAP.min || empty > COIN_GAP.max)) bad(`coin gap of ${empty} before slot ${i}`);
            }
            blockStart = i;
            blockLane = c.lane;
         } else if (c.lane !== blockLane) {
            bad(`coin run changes lane at slot ${i}`);
         }
      } else if (blockStart >= 0) {
         const length = i - blockStart;
         // the log's last run may be cut off by the end of the drive
         if (i < coins.length && (length < COIN_RUN.min || length > COIN_RUN.max)) bad(`coin run of ${length} at slot ${blockStart}`);
         blockStart = -1;
      }
   }
   if (!coins[0]) bad("the coin stream does not start with a run at slot 0");
   if (log.maxRows > 7) bad(`${log.maxRows} rows alive`);
   if (log.maxCoins > 9) bad(`${log.maxCoins} coins alive`);
   return problems;
}

// ---------- bots ----------

type Bot = (run: OfficeRun, stepMs: number, out: StepInput) => void;

/** The row the runner has not left yet with the lowest index (the next one to pass), or null. */
function rowAhead(run: OfficeRun): Row | null {
   let best: Row | null = null;
   for (const r of run.rows) {
      if (!r.alive || run.distance > rowBack(r)) continue;
      if (!best || r.index < best.index) best = r;
   }
   return best;
}

/** Nearest passable lane to `from` (empty before jumpable on a tie, then the left one). */
function pickLane(row: Row, from: number): number {
   let best = -1;
   let bestCost = Infinity;
   for (let lane = 0; lane < LANE_COUNT; lane++) {
      const type = row.lanes[lane];
      if (!isPassable(type)) continue;
      const cost = 2 * Math.abs(lane - from) + (type === NO_OBSTACLE ? 0 : 1);
      if (cost < bestCost) {
         bestCost = cost;
         best = lane;
      }
   }
   return best;
}

/**
 * README fairness strategy: hold the lane inside a row; after leaving it, steer to a passable lane
 * of the next row; for a jumpable, take off on the last frame that starts at or before in − 115.
 * `sloppy` adds a pointless jump on the first frame after every row. `greedy` chases ground coins
 * in the gaps while there is time to get back. The bot knows this frame's whole-ms step (as the
 * test knows the dt it is about to pass).
 */
function proofBot(opts: { sloppy?: boolean; greedy?: boolean } = {}): Bot {
   let ahead = -1;
   return (run, stepMs, out) => {
      out.lane = 0;
      out.lane2 = 0;
      out.jumpPressed = false;
      const row = rowAhead(run);
      const index = row ? row.index : -1;
      if (opts.sloppy && ahead >= 0 && index !== ahead) out.jumpPressed = true;
      ahead = index;
      if (!row || run.distance >= rowFront(row)) return;
      const pass = pickLane(row, run.lane);
      let target = pass;
      if (opts.greedy) {
         let coinLane = -1;
         let coinS = Infinity;
         for (const c of run.coinPool) {
            if (!c.alive || c.taken || c.kind !== "ground" || c.s + 600 <= run.distance || c.s >= rowFront(row) || c.s >= coinS) continue;
            if (timeAt(c.s + 600) + 500 > row.inMs) continue;
            coinS = c.s;
            coinLane = c.lane;
         }
         if (coinLane >= 0) target = coinLane;
      }
      if (target !== run.lane) out.lane = target > run.lane ? 1 : -1;
      if (row.lanes[pass] !== NO_OBSTACLE) {
         const press = row.inMs - JUMP_LEAD;
         if (run.simMs <= press && run.simMs + stepMs > press) out.jumpPressed = true;
      }
   };
}

/** Random lane events and jumps (mashing, swipes on top of keys): an adversary for the score bound. */
function randomBot(seed: number, laneRate: number, jumpRate: number): Bot {
   const rng = createRng((seed ^ 0xbadb07) >>> 0);
   const move = (): -1 | 0 | 1 => (rng() < laneRate ? (rng() < 0.5 ? -1 : 1) : 0);
   return (_run, _stepMs, out) => {
      out.lane = move();
      out.lane2 = rng() < 0.1 ? move() : 0;
      out.jumpPressed = rng() < jumpRate;
   };
}

const idleBot: Bot = (_run, _stepMs, out) => {
   out.lane = 0;
   out.lane2 = 0;
   out.jumpPressed = false;
};

/** The whole-ms step the next step() will take with `dtMs` (the carry, as advanceClock does it). */
const nextStepMs = (run: OfficeRun, dtMs: number) => Math.floor(run.carry + Math.min(dtMs, MAX_STEP_MS));

/** The most coin slots a runner at distance `d` (mm) can have touched (|s − d| < 0.6 m reached). */
const slotsReached = (d: number) => (d + 600 > COIN.first ? Math.ceil((d + 600 - COIN.first) / COIN.spacing) : 0);

interface Played {
   run: OfficeRun;
   log: TrackLog | null;
   frames: number;
   /** the sum of the dts: the store's elapsedMs for these frames */
   elapsedMs: number;
   /** frames where capScore would have changed the score (the server's rate check failing) */
   capped: number;
   /** frames where run.score != floor(distance / 1000) + 50 · coins */
   formulaMisses: number;
   /** frames with more coins than coin slots the runner has reached */
   coinOverruns: number;
   jumps: number;
   laneChanges: number;
}

/** Plays one run through step() with `bot`, frame by frame. */
function play(seed: number, dt: DtSource, bot: Bot, { log = false, untilMs = Infinity } = {}): Played {
   const run = createRun(seed);
   const input = createStepInput();
   const track = log ? newLog() : null;
   if (track) capture(run, track);
   const result: Played = { run, log: track, frames: 0, elapsedMs: 0, capped: 0, formulaMisses: 0, coinOverruns: 0, jumps: 0, laneChanges: 0 };
   while (!run.over && run.simMs < untilMs) {
      const dtMs = dt();
      bot(run, nextStepMs(run, dtMs), input);
      const ev = step(run, dtMs, input);
      result.elapsedMs += dtMs;
      result.frames += 1;
      if (ev.jumped) result.jumps += 1;
      if (ev.laneChanged) result.laneChanges += 1;
      if (capScore(run.score, result.elapsedMs) !== run.score) result.capped += 1;
      if (run.score !== scoreFor(run.distance, run.coins)) result.formulaMisses += 1;
      if (run.coins > slotsReached(run.distance)) result.coinOverruns += 1;
      if (track) capture(run, track);
   }
   return result;
}

function describeEnd(res: Played): string {
   const { run } = res;
   const ev = run.events;
   if (run.endReason !== "lose") return `${run.endReason ?? "still running"} at ${run.simMs} ms`;
   return `hit ${OBSTACLE_TYPES[ev.hitType].name} (row ${ev.hitRow}, lane ${ev.hitLane}) at ${run.simMs} ms, frame ${res.frames}, x ${run.x}, feet ${run.feet}`;
}

/** Empties both pools and parks the generators far away, for hand-built scenes. */
function isolate(run: OfficeRun): void {
   for (const r of run.rows) r.alive = false;
   for (const c of run.coinPool) c.alive = false;
   run.nextRow.s = 1e12;
   run.nextRow.hd = 0;
   run.nextCoinSlot = 1e8;
}

/** Writes a row into slot 0 of an isolated run, placed by time like the generator does it. */
function placeRow(run: OfficeRun, index: number, inMs: number, lanes: number[], slot = 0): Row {
   const row = run.rows[slot];
   const hd = Math.max(...lanes.filter((t) => t !== NO_OBSTACLE).map((t) => OBSTACLE_TYPES[t].depth / 2));
   row.alive = true;
   row.index = index;
   row.lanes.splice(0, 3, ...lanes);
   row.count = lanes.filter((t) => t !== NO_OBSTACLE).length;
   row.hd = hd;
   row.inMs = inMs;
   row.s = distanceAt(inMs) + ROW_MARGIN + hd;
   row.outMs = timeAt(row.s + hd + ROW_MARGIN);
   return row;
}

/** Moves an isolated run's clock to `simMs` (the runner keeps its lane and jump). */
function setClock(run: OfficeRun, simMs: number): void {
   run.simMs = simMs;
   run.distance = distanceAt(simMs);
   run.stage = stageAt(simMs);
   run.carry = 0;
   run.score = scoreFor(run.distance, run.coins);
}

const frameInput = (moveX = 0, moveY = 0, jumpPressed = false, swipe: InputState["swipe"] = null) => ({ moveX, moveY, jumpPressed, swipe });
const press = (lane: -1 | 0 | 1, jumpPressed = false, lane2: -1 | 0 | 1 = 0): StepInput => ({ lane, lane2, jumpPressed });
const NONE = press(0);

// ---------- tests ----------

describe("office-escape constants (golden)", () => {
   it("pins every tuning number of the README", () => {
      expect({
         LANES, LANE_COUNT, START_LANE, RUNNER, SPEED, MAX_SPEED, SLIDE_SPEED, JUMP_MS, JUMP_APEX, JUMP_BUFFER_MS,
         MAX_STEP_MS, GAP_MIN_MS, FIRST_ROW_MS, ROW_MARGIN, ROW_LOOKAHEAD, COIN_LOOKAHEAD, RECYCLE_BEHIND,
         ROW_SLOTS, COIN_SLOTS, COIN, COIN_RUN, COIN_GAP, COIN_SEED_MIX, RUN_LIMIT_MS, EXTRA_STEP_MS, AXIS_EDGE,
      }).toEqual({
         LANES: [-2000, 0, 2000],
         LANE_COUNT: 3,
         START_LANE: 1,
         RUNNER: { halfWidth: 350, halfDepth: 250, height: 1300 },
         SPEED: { start: 8, stageMs: 20_000, maxStage: 8 },
         MAX_SPEED: 16,
         SLIDE_SPEED: 10,
         JUMP_MS: 700,
         JUMP_APEX: 1100,
         JUMP_BUFFER_MS: 135,
         MAX_STEP_MS: 50,
         GAP_MIN_MS: 950,
         FIRST_ROW_MS: 5000,
         ROW_MARGIN: 250,
         ROW_LOOKAHEAD: 74_000,
         COIN_LOOKAHEAD: 72_000,
         RECYCLE_BEHIND: 12_000,
         ROW_SLOTS: 8,
         COIN_SLOTS: 10,
         COIN: { first: 20_000, spacing: 10_000, half: 350, groundY: 600, raisedY: 1900, points: 50 },
         COIN_RUN: { min: 3, max: 6 },
         COIN_GAP: { min: 1, max: 3 },
         COIN_SEED_MIX: 0x9e3779b9,
         RUN_LIMIT_MS: 1_795_000,
         EXTRA_STEP_MS: 50,
         AXIS_EDGE: 0.5,
      });
      expect(coinSeedFor(1)).toBe(0x9e3779b8);
      expect(MAX_STEP_MS).toBe(MAX_FRAME_DT * 1000);
   });

   it("pins the obstacle table and the stage table", () => {
      expect(OBSTACLE).toEqual({ desk: 0, printer: 1, boxes: 2, chair: 3, coffeeCart: 4, waterCooler: 5 });
      expect(OBSTACLE_TYPES.map((o) => [o.name, o.role, o.halfWidth, o.depth, o.top])).toEqual([
         ["desk", "jump", 700, 700, 550],
         ["printer", "jump", 450, 700, 550],
         ["boxes", "jump", 550, 800, 600],
         ["chair", "dodge", 400, 700, 1300],
         ["coffeeCart", "dodge", 550, 1300, 1300],
         ["waterCooler", "dodge", 300, 500, 1500],
      ]);
      expect(STAGES.map((s) => [s.extraMinMs, s.extraMaxMs, ...s.mix])).toEqual([
         [600, 1400, 60, 40, 0],
         [600, 1400, 60, 40, 0],
         [300, 1000, 35, 50, 15],
         [300, 1000, 35, 50, 15],
         [300, 1000, 35, 50, 15],
         [0, 700, 20, 55, 25],
         [0, 700, 20, 55, 25],
         [0, 700, 20, 55, 25],
         [0, 700, 20, 55, 25],
      ]);
      for (const s of STAGES) expect(s.mix[0] + s.mix[1] + s.mix[2]).toBe(100);
   });

   it("the scoring limits are the ones in meta.ts and arcade-games.json", () => {
      expect(officeEscapeMeta.scoring).toEqual({
         kind: "points",
         maxScore: 200000,
         minDurationMs: 3000,
         maxDurationMs: 1800000,
         base: 0,
         maxPointsPerSec: 100,
         unitLabel: "pts",
         display: "int",
      });
   });

   it("jump means jump and dodge means dodge, by geometry", () => {
      let apex = 0;
      for (let j = 0; j <= JUMP_MS; j++) apex = Math.max(apex, jumpHeight(j));
      expect(apex).toBe(JUMP_APEX);
      for (const o of OBSTACLE_TYPES) {
         // the role column follows from the numbers: some phase clears a jumpable, none a dodge
         expect(o.role).toBe(o.top <= apex ? "jump" : "dodge");
         let clearMs = 0;
         for (let j = 0; j < JUMP_MS; j++) if (jumpHeight(j) >= o.top) clearMs += 1;
         if (o.role === "jump") expect(clearMs).toBeGreaterThanOrEqual(470);
         else expect(clearMs).toBe(0);
      }
      // the lowest dodge top is above the apex, the highest jump top well below it
      expect(Math.min(...DODGES.map((t) => OBSTACLE_TYPES[t].top))).toBe(1300);
      expect(Math.max(...JUMPABLE_TOPS)).toBe(600);
   });

   it("lane clearance is 0.95 m and one frame can never tunnel through anything", () => {
      const widest = Math.max(...OBSTACLE_TYPES.map((o) => o.halfWidth));
      expect(LANES[1] - LANES[0] - RUNNER.halfWidth - widest).toBe(950);
      // forward: 16 m/s x 50 ms = 0.8 m < the shortest overlap (water cooler 0.5 + 0.5 m) and a coin's 1.2 m
      const forward = MAX_SPEED * MAX_STEP_MS;
      expect(forward).toBe(800);
      expect(Math.min(...OBSTACLE_TYPES.map((o) => o.depth + 2 * RUNNER.halfDepth))).toBe(1000);
      expect(2 * (COIN.half + RUNNER.halfDepth)).toBe(1200);
      // sideways: 10 m/s x 50 ms = 0.5 m < the narrowest sideways overlap 2 x (0.35 + 0.30) = 1.3 m
      expect(SLIDE_SPEED * MAX_STEP_MS).toBe(500);
      expect(Math.min(...OBSTACLE_TYPES.map((o) => 2 * (o.halfWidth + RUNNER.halfWidth)))).toBe(1300);
   });
});

describe("office-escape clock, speed and distance", () => {
   it("the carry turns 1000 frames of 1/60 s into 16,666 ms, never more", () => {
      const run = createRun(1);
      isolate(run);
      const steps = new Set<number>();
      for (let i = 0; i < 1000; i++) {
         step(run, (1 / 60) * 1000, NONE);
         steps.add(run.stepMs);
         expect(run.carry).toBeGreaterThanOrEqual(0);
         expect(run.carry).toBeLessThan(1);
      }
      expect(run.simMs).toBe(16_666);
      expect([...steps].sort()).toEqual([16, 17]);
      expect(run.distance).toBe(distanceAt(16_666));
   });

   it("whole-ms steps are 0..50, sum to the floor of the dts and never run ahead of them", () => {
      const run = createRun(2);
      isolate(run);
      const rng = createRng(3);
      let total = 0;
      for (let i = 0; i < 20_000; i++) {
         const dtMs = rng() < 0.2 ? rng() * 0.9 : rng() * 50;
         if (!(dtMs > 0)) continue;
         total += dtMs;
         const before = run.simMs;
         advanceClock(run, dtMs);
         expect(run.simMs - before).toBe(run.stepMs);
         expect(run.stepMs).toBeGreaterThanOrEqual(0);
         expect(run.stepMs).toBeLessThanOrEqual(MAX_STEP_MS);
      }
      expect(run.simMs).toBeLessThanOrEqual(total + 1e-6);
      expect(run.simMs).toBeGreaterThan(total - 1 - 1e-6);
      // a long frame is clamped to 50 ms; dt <= 0 or NaN does nothing at all
      const clamp = createRun(4);
      step(clamp, 300, NONE);
      // clamped before the carry: the 250 ms cut off is dropped, never replayed on later frames
      expect([clamp.simMs, clamp.carry]).toEqual([50, 0]);
      step(clamp, 1, NONE);
      expect([clamp.simMs, clamp.stepMs]).toEqual([51, 1]);
      const before = JSON.stringify(clamp);
      for (const dt of [0, -5, Number.NaN, Number.NEGATIVE_INFINITY]) {
         const ev = step(clamp, dt, press(1, true));
         expect(ev.laneChanged || ev.jumped).toBe(false);
      }
      expect(JSON.stringify(clamp)).toBe(before);
   });

   it("speed is 8 m/s, +1 every 20 s, 16 from 160 s, never more", () => {
      expect(speedAt(0)).toBe(8);
      expect(speedAt(19_999)).toBe(8);
      expect(speedAt(20_000)).toBe(9);
      expect(speedAt(159_999)).toBe(15);
      expect(speedAt(160_000)).toBe(16);
      expect(speedAt(RUN_LIMIT_MS)).toBe(16);
      expect(speedAt(1e9)).toBe(16);
      for (let t = 0; t <= RUN_LIMIT_MS + 50; t += 997) expect(distanceAt(t + 1) - distanceAt(t)).toBeLessThanOrEqual(MAX_SPEED);
   });

   it("distance matches the stage table and reaches 28,000 m exactly at the run limit", () => {
      const starts = Array.from({ length: 9 }, (_v, k) => distanceAt(k * SPEED.stageMs));
      expect(starts).toEqual([0, 160_000, 340_000, 540_000, 760_000, 1_000_000, 1_260_000, 1_540_000, 1_840_000]);
      expect(starts).toEqual(starts.map((_d, k) => stageStartDistance(k)));
      expect(distanceAt(RUN_LIMIT_MS)).toBe(28_000_000);
      expect(distanceAt(45_000)).toBe(390_000);
      expect(distanceAt(5000)).toBe(40_000);
      expect(distanceAt(0)).toBe(0);
      expect(distanceAt(-10)).toBe(0);
   });

   it("timeAt is the exact inverse of distanceAt", () => {
      const rng = createRng(5);
      const check = (mm: number) => {
         const t = timeAt(mm);
         expect(distanceAt(t)).toBeGreaterThanOrEqual(mm);
         if (mm > 0) expect(distanceAt(t - 1)).toBeLessThan(mm);
      };
      for (let k = 0; k <= 8; k++) for (const d of [-1, 0, 1, 7, 8, 9]) check(stageStartDistance(k) + d);
      for (let i = 0; i < 20_000; i++) check(Math.floor(rng() * 28_100_000));
      expect(timeAt(0)).toBe(0);
      expect(timeAt(28_000_000)).toBe(RUN_LIMIT_MS);
   });

   it("a new stage raises the stageChanged event once", () => {
      const run = createRun(6);
      isolate(run);
      setClock(run, 19_990);
      expect(step(run, 5, NONE).stageChanged).toBe(false);
      expect(step(run, 10, NONE).stageChanged).toBe(true);
      expect(run.stage).toBe(1);
      expect(step(run, 10, NONE).stageChanged).toBe(false);
   });
});

describe("office-escape jump", () => {
   it("follows the integer arc: 0 at 0 and 700 ms, 1100 mm at 350 ms", () => {
      expect([0, 1, 100, 103, 115, 350, 585, 597, 699, 700, 701, -5].map(jumpHeight)).toEqual([
         0, 6, 538, 552, 604, 1100, 604, 552, 6, 0, 0, 0,
      ]);
      // README: feet >= 550 mm exactly for j in [103, 597], >= 600 mm exactly for j in [115, 585]
      const above = (top: number) => Array.from({ length: JUMP_MS + 1 }, (_v, j) => j).filter((j) => jumpHeight(j) >= top);
      expect([above(550)[0], above(550).at(-1), above(550).length]).toEqual([103, 597, 495]);
      expect([above(600)[0], above(600).at(-1), above(600).length]).toEqual([115, 585, 471]);
      expect(JUMP_LEAD).toBe(115);
   });

   it("starts on the frame of the press: after the step the phase equals the step length", () => {
      const run = createRun(7);
      const ev = step(run, 16, press(0, true));
      expect(ev.jumped).toBe(true);
      expect(run.jumpMs).toBe(16);
      expect(run.feet).toBe(jumpHeight(16));
      let landedAt = -1;
      while (landedAt < 0) {
         if (step(run, 16, NONE).landed) landedAt = run.simMs;
      }
      // 700 ms after take-off, on the frame that crosses it
      expect(landedAt).toBe(16 * Math.ceil(700 / 16));
      expect([run.jumpMs, run.feet]).toEqual([-1, 0]);
   });

   it("a press in the air is kept only in the last 135 ms and starts at the landing moment", () => {
      // 30 ms frames: phases 30, 60, ..., 690, 720 -> lands with 20 ms of overflow
      const buffered = createRun(8);
      step(buffered, 30, press(0, true));
      while (buffered.jumpMs < JUMP_MS - JUMP_BUFFER_MS) step(buffered, 30, NONE);
      expect(buffered.jumpMs).toBe(570);
      step(buffered, 30, press(0, true));
      expect(buffered.jumpBuffered).toBe(true);
      while (!buffered.events.landed) step(buffered, 30, NONE);
      expect(buffered.events.jumped).toBe(true);
      expect(buffered.jumpMs).toBe(20);
      expect(buffered.jumpBuffered).toBe(false);

      // exactly 135 ms before landing still counts; 136 ms does not
      const edge = createRun(8);
      step(edge, 1, press(0, true));
      while (edge.jumpMs < 565) step(edge, 1, NONE);
      expect(edge.jumpMs).toBe(565);
      step(edge, 1, press(0, true));
      expect(edge.jumpBuffered).toBe(true);
      const early = createRun(8);
      step(early, 1, press(0, true));
      while (early.jumpMs < 564) step(early, 1, NONE);
      expect(early.jumpMs).toBe(564);
      step(early, 1, press(0, true));
      expect(early.jumpBuffered).toBe(false);
      while (!early.events.landed) step(early, 10, NONE);
      expect(early.events.jumped).toBe(false);
      expect(early.jumpMs).toBe(-1);
   });

   it("lane changes work in the air", () => {
      const run = createRun(9);
      step(run, 10, press(0, true));
      step(run, 10, press(-1));
      for (let i = 0; i < 20; i++) step(run, 10, NONE);
      expect(run.jumpMs).toBeGreaterThan(0);
      expect(run.x).toBe(LANES[0]);
   });
});

describe("office-escape input", () => {
   const read = (edges: InputEdges, ...frames: ReturnType<typeof frameInput>[]) =>
      frames.map((f) => {
         const out = readInput(edges, f, createStepInput());
         return [out.lane, out.lane2, out.jumpPressed];
      });

   it("held axes give one event per press (edges, not holds)", () => {
      const L = frameInput(-1);
      const R = frameInput(1);
      const both = frameInput(0);
      const idle = frameInput();
      // held Left: one change; release and press again: another
      expect(read({ xZone: 0, up: false }, L, L, L, idle, L).map((f) => f[0])).toEqual([-1, 0, 0, 0, -1]);
      // Left and Right together: moveX 0, no event; releasing Left while Right is held re-arms it
      expect(read({ xZone: 0, up: false }, both, L, both, R, R).map((f) => f[0])).toEqual([0, -1, 0, 1, 0]);
      // a switch straight from Left to Right between two frames still gives the Right
      expect(read({ xZone: 0, up: false }, L, R).map((f) => f[0])).toEqual([-1, 1]);
      // the threshold is half-way: a keyboard diagonal (0.707) counts, 0.49 does not
      expect(read({ xZone: 0, up: false }, frameInput(0.49), frameInput(AXIS_EDGE)).map((f) => f[0])).toEqual([0, 1]);
      expect(read({ xZone: 0, up: false }, frameInput(-Math.SQRT1_2, -Math.SQRT1_2))).toEqual([[-1, 0, true]]);
      // W/Up is an edge too; Space is core's jumpPressed; holding Space alone does nothing more
      const up = frameInput(0, -1);
      expect(read({ xZone: 0, up: false }, up, up, idle, up).map((f) => f[2])).toEqual([true, false, false, true]);
      expect(read({ xZone: 0, up: false }, frameInput(0, 0, true), idle).map((f) => f[2])).toEqual([true, false]);
      // moving down does nothing
      expect(read({ xZone: 0, up: false }, frameInput(0, 1))).toEqual([[0, 0, false]]);
   });

   it("swipes: left/right are lane events after the keys, up jumps, down does nothing", () => {
      expect(read({ xZone: 0, up: false }, frameInput(0, 0, false, "left"))).toEqual([[0, -1, false]]);
      expect(read({ xZone: 0, up: false }, frameInput(0, 0, false, "right"))).toEqual([[0, 1, false]]);
      expect(read({ xZone: 0, up: false }, frameInput(0, 0, false, "up"))).toEqual([[0, 0, true]]);
      expect(read({ xZone: 0, up: false }, frameInput(0, 0, false, "down"))).toEqual([[0, 0, false]]);
      // a key and a swipe in the same frame both apply, keyboard first
      expect(read({ xZone: 0, up: false }, frameInput(-1, 0, false, "right"))).toEqual([[-1, 1, false]]);
      const run = createRun(10);
      run.lane = 0;
      run.x = LANES[0];
      // at the left edge: the key Left is blocked (wobble), then the swipe Right applies
      const ev = step(run, 10, press(-1, false, 1));
      expect([ev.laneBlocked, ev.laneChanged, run.lane]).toEqual([true, true, 1]);
   });

   it("lane events retarget at once and clamp at the outer lanes", () => {
      const run = createRun(11);
      expect(run.lane).toBe(START_LANE);
      expect(step(run, 10, press(1)).laneChanged).toBe(true);
      expect(run.lane).toBe(2);
      const blocked = step(run, 10, press(1));
      expect([blocked.laneChanged, blocked.laneBlocked, run.lane]).toEqual([false, true, 2]);
      // mid-slide: a Left turns back at once, a second Left continues to the far lane
      expect(run.x).toBe(200);
      step(run, 10, press(-1));
      expect(run.x).toBe(100);
      step(run, 10, press(-1));
      expect(run.lane).toBe(0);
      for (let i = 0; i < 30; i++) step(run, 10, NONE);
      expect(run.x).toBe(LANES[0]);
      expect(step(run, 10, press(-1)).laneBlocked).toBe(true);
   });

   it("one lane takes exactly 200 ms of simulation time at any frame rate", () => {
      for (const pattern of [MS_1, FPS_144, MS_8_3, FPS_60, FPS_30, FPS_20, RANDOM]) {
         const run = createRun(12);
         const dt = pattern.make(12);
         let first = true;
         const from = run.simMs;
         while (run.simMs - from < 600) {
            step(run, dt(), first ? press(-1) : NONE);
            first = false;
            // the slide counts from the start of the frame of the event
            expect(run.x).toBe(-Math.min(2000, SLIDE_SPEED * (run.simMs - from)));
         }
      }
   });

   it("readInput + step: a held Left changes exactly one lane", () => {
      const run = createRun(13);
      for (let i = 0; i < 60; i++) step(run, 16, readInput(run.edges, frameInput(-1), run.input));
      expect(run.lane).toBe(0);
      for (let i = 0; i < 5; i++) step(run, 16, readInput(run.edges, frameInput(), run.input));
      for (let i = 0; i < 60; i++) step(run, 16, readInput(run.edges, frameInput(1), run.input));
      expect(run.lane).toBe(1);
   });
});

describe("office-escape track", () => {
   const golden = (seed: number, rowCount: number, slotCount: number) => {
      const { log } = driveTrack(seed, () => 16, 60_000);
      return {
         rows: log.rows.slice(0, rowCount).map((r) => [r.index, r.s, r.hd, r.inMs, r.outMs, r.lanes]),
         coins: log.coins.slice(0, slotCount).filter((c): c is CoinRecord => !!c).map((c) => [c.slot, c.lane, c.kind]),
      };
   };

   it("is pinned for two seeds (the draw order of rows and coins)", () => {
      expect(golden(1, 12, 30)).toEqual({
         rows: [
            [0, 40600, 350, 5000, 5150, [-1, 1, 5]],
            [1, 59000, 350, 7300, 7450, [-1, 0, -1]],
            [2, 75000, 350, 9300, 9450, [-1, 1, -1]],
            [3, 93800, 350, 11650, 11800, [-1, 1, -1]],
            [4, 112500, 250, 14000, 14125, [-1, -1, 5]],
            [5, 127200, 350, 15825, 15975, [3, -1, 3]],
            [6, 143100, 650, 17775, 18000, [-1, 4, -1]],
            [7, 157800, 350, 19650, 19800, [-1, -1, 3]],
            [8, 179850, 250, 22150, 22262, [5, -1, 5]],
            [9, 201708, 400, 24562, 24707, [2, 2, -1]],
            [10, 220563, 400, 26657, 26802, [2, 5, -1]],
            [11, 236668, 350, 28452, 28586, [-1, 1, -1]],
         ],
         coins: [
            [0, 0, "ground"], [1, 0, "ground"], [2, 0, "ground"], [3, 0, "ground"],
            [7, 1, "ground"], [8, 1, "ground"], [9, 1, "ground"], [10, 1, "ground"], [11, 1, "ground"], [12, 1, "ground"],
            [16, 2, "removed"], [17, 2, "ground"], [18, 2, "ground"], [19, 2, "ground"], [20, 2, "ground"],
            [23, 1, "ground"], [24, 1, "ground"], [25, 1, "ground"], [26, 1, "ground"], [27, 1, "raised"],
         ],
      });
      expect(golden(3141592653, 6, 12)).toEqual({
         rows: [
            [0, 40600, 350, 5000, 5150, [-1, 1, -1]],
            [1, 55000, 350, 6800, 6950, [-1, -1, 3]],
            [2, 69700, 250, 8650, 8775, [5, -1, 5]],
            [3, 83200, 350, 10325, 10475, [0, -1, -1]],
            [4, 97250, 400, 12075, 12238, [0, 2, -1]],
            [5, 114154, 400, 14188, 14351, [-1, 3, 2]],
         ],
         coins: [
            [0, 1, "ground"], [1, 1, "ground"], [2, 1, "raised"], [4, 0, "ground"], [5, 0, "removed"],
            [6, 0, "ground"], [7, 0, "ground"], [8, 0, "ground"], [9, 0, "ground"],
         ],
      });
   });

   it("pins every draw of the 300 s track for three seeds (FNV-1a of the placed rows and coins)", () => {
      const fnv = (text: string) => {
         let h = 0x811c9dc5;
         for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
         return h.toString(16).padStart(8, "0");
      };
      const hashes = [1, 2, 3].map((seed) => fnv(placedBy(driveTrack(seed, () => 16, 300_000).log, 300_000)));
      expect(hashes).toEqual(["acf0e445", "fab50410", "3f4faa0b"]);
   });

   it("follows the stage table: obstacle mix per stage, 50/50 roles, no 3-row before 40 s (1000 seeds x 300 s)", () => {
      const counts = Array.from({ length: 9 }, () => [0, 0, 0]);
      let jumps = 0;
      let freeObstacles = 0;
      let firstTriple = Infinity;
      for (let seed = 0; seed < 1000; seed++) {
         const { log } = driveTrack(seed, () => MAX_STEP_MS, 300_000);
         for (const r of log.rows) {
            counts[stageAt(r.inMs)][r.count - 1] += 1;
            if (r.count === 3) firstTriple = Math.min(firstTriple, r.inMs);
            // 1- and 2-obstacle rows: the role is never forced
            if (r.count < 3) {
               for (const t of r.lanes) {
                  if (t === NO_OBSTACLE) continue;
                  freeObstacles += 1;
                  if (OBSTACLE_TYPES[t].role === "jump") jumps += 1;
               }
            }
         }
      }
      const problems: string[] = [];
      for (let k = 0; k <= 8; k++) {
         const total = counts[k][0] + counts[k][1] + counts[k][2];
         if (total < 5000) problems.push(`stage ${k}: only ${total} rows`);
         for (let n = 0; n < 3; n++) {
            const share = (100 * counts[k][n]) / total;
            if (Math.abs(share - STAGES[k].mix[n]) > 2.5) problems.push(`stage ${k}: ${n + 1}-rows ${share.toFixed(2)} %, table ${STAGES[k].mix[n]} %`);
         }
      }
      expect(problems).toEqual([]);
      expect(Math.abs((100 * jumps) / freeObstacles - 50)).toBeLessThanOrEqual(1);
      // stage 2 starts at 40 s: the first 3-row of any run is entered right after it
      expect(firstTriple).toBeGreaterThanOrEqual(2 * SPEED.stageMs);
      expect(firstTriple).toBeLessThan(2 * SPEED.stageMs + 100);
   }, 120_000);

   it("recycles rows (back edge) and coins exactly 12 m behind the runner, never earlier", () => {
      const problems: string[] = [];
      let rowsFreed = 0;
      let coinsFreed = 0;
      for (const pattern of [FPS_60, FPS_20, RANDOM]) {
         const run = createRun(77);
         const dt = pattern.make(77);
         // what each slot held before the step: freed (or rewritten) slots are checked against it
         const rowWas = run.rows.map((r) => ({ alive: r.alive, index: r.index, back: rowBack(r) }));
         const coinWas = run.coinPool.map((c) => ({ alive: c.alive, slot: c.slot, s: c.s }));
         while (run.simMs < 200_000) {
            step(run, dt(), NONE);
            // the idle runner hits a row now and then: keep it running through the obstacles
            run.over = false;
            const behind = run.distance - RECYCLE_BEHIND;
            run.rows.forEach((r, i) => {
               const was = rowWas[i];
               if (was.alive && (!r.alive || r.index !== was.index)) {
                  rowsFreed += 1;
                  if (was.back >= behind) problems.push(`${pattern.name}: row ${was.index} freed at ${run.distance - was.back} mm past its back edge`);
               }
               if (r.alive && rowBack(r) < behind) problems.push(`${pattern.name}: row ${r.index} alive ${run.distance - rowBack(r)} mm past its back edge`);
               was.alive = r.alive;
               was.index = r.index;
               was.back = rowBack(r);
            });
            run.coinPool.forEach((c, i) => {
               const was = coinWas[i];
               if (was.alive && (!c.alive || c.slot !== was.slot)) {
                  coinsFreed += 1;
                  if (was.s >= behind) problems.push(`${pattern.name}: coin ${was.slot} freed at ${run.distance - was.s} mm past it`);
               }
               if (c.alive && c.s < behind) problems.push(`${pattern.name}: coin ${c.slot} alive ${run.distance - c.s} mm past it`);
               was.alive = c.alive;
               was.slot = c.slot;
               was.s = c.s;
            });
            if (problems.length > 20) break;
         }
      }
      expect(problems).toEqual([]);
      expect(rowsFreed).toBeGreaterThan(3 * 100);
      expect(coinsFreed).toBeGreaterThan(3 * 100);
   });

   it("createRun fills the corridor for the countdown: rows up to 74 m, then coins up to 72 m", () => {
      for (let seed = 0; seed < 200; seed++) {
         const run = createRun(seed);
         const alive = run.rows.filter((r) => r.alive);
         expect(alive.length).toBeGreaterThan(0);
         expect(alive.every((r) => rowFront(r) <= ROW_LOOKAHEAD)).toBe(true);
         expect(rowFront(run.nextRow)).toBeGreaterThan(ROW_LOOKAHEAD);
         expect(alive.map((r) => r.index)).toEqual(alive.map((_r, i) => i));
         expect(run.nextCoinSlot).toBe(6); // slots at 20, 30, ..., 70 m
         expect(run.coinPool.filter((c) => c.alive).every((c) => c.s <= COIN_LOOKAHEAD && !c.taken)).toBe(true);
         expect([run.simMs, run.distance, run.score, run.lane, run.x, run.jumpMs, run.poolFull]).toEqual([0, 0, 0, 1, 0, -1, 0]);
      }
   });

   it("same seed, same track; another seed, another track; coins never shift the rows", () => {
      const a = driveTrack(77, FPS_60.make(0), 120_000).log;
      const b = driveTrack(77, FPS_60.make(0), 120_000).log;
      const c = driveTrack(78, FPS_60.make(0), 120_000).log;
      const otherCoins = driveTrack(77, FPS_60.make(0), 120_000, 12345).log;
      expect(placedBy(a, 120_000)).toBe(placedBy(b, 120_000));
      expect(JSON.stringify(a.rows)).not.toBe(JSON.stringify(c.rows));
      expect(JSON.stringify(a.coins)).not.toBe(JSON.stringify(c.coins));
      // the coin stream is separate: a different coin seed changes the coins, never a row
      expect(JSON.stringify(otherCoins.rows)).toBe(JSON.stringify(a.rows));
      expect(JSON.stringify(otherCoins.coins.map((x) => x && [x.slot, x.lane]))).not.toBe(JSON.stringify(a.coins.map((x) => x && [x.slot, x.lane])));
   });

   it("is frame-rate independent: 300 seeds x 300 s at 144, 120, 60, 30 and 20 fps, 8.3 / 16.7 ms and random 1-50 ms", () => {
      const patterns = [FPS_60, FPS_144, MS_8_3, MS_16_7, FPS_30, FPS_20, RANDOM];
      const problems: string[] = [];
      const stats = newStats();
      let compared = 0;
      for (let seed = 0; seed < 300; seed++) {
         let reference = "";
         for (const pattern of patterns) {
            const { run, log } = driveTrack(seed, pattern.make(seed), 300_000);
            const placed = placedBy(log, 300_000);
            if (pattern === FPS_60) {
               reference = placed;
               problems.push(...trackProblems(log, stats, `seed ${seed}`));
            } else {
               compared += 1;
               if (placed !== reference) problems.push(`seed ${seed}: ${pattern.name} differs from 60 fps`);
            }
            if (run.poolFull !== 0 || log.maxRows > 7 || log.maxCoins > 9) problems.push(`seed ${seed} ${pattern.name}: pools ${log.maxRows}/${log.maxCoins}, full ${run.poolFull}`);
         }
      }
      expect(compared).toBe(300 * 6);
      expect(problems).toEqual([]);
      // the sweep really met raised and removed coins, which are the frame-timing-sensitive ones
      expect(stats.raised).toBeGreaterThan(1000);
      expect(stats.removed).toBeGreaterThan(1000);
   }, 120_000);

   it("is frame-rate independent with fixed 1 ms and 50 ms steps too (100 seeds x 300 s)", () => {
      const problems: string[] = [];
      for (let seed = 1000; seed < 1100; seed++) {
         const reference = placedBy(driveTrack(seed, FPS_60.make(seed), 300_000).log, 300_000);
         for (const pattern of [MS_1, FPS_20]) {
            const { run, log } = driveTrack(seed, pattern.make(seed), 300_000);
            if (placedBy(log, 300_000) !== reference) problems.push(`seed ${seed}: ${pattern.name} differs`);
            if (run.poolFull !== 0) problems.push(`seed ${seed}: pool full`);
         }
      }
      expect(problems).toEqual([]);
   }, 120_000);

   it("keeps every track rule for 1000 seeds x 300 s (incl. 32-bit seeds)", () => {
      const problems: string[] = [];
      const stats = newStats();
      const seeds = [...Array.from({ length: 995 }, (_v, i) => 5000 + i), 2 ** 32 - 1, 123456789, 987654321, 3141592653, 2718281828];
      for (const seed of seeds) {
         const { run, log } = driveTrack(seed, FPS_60.make(seed), 300_000);
         problems.push(...trackProblems(log, stats, `seed ${seed}`));
         if (run.poolFull !== 0) problems.push(`seed ${seed}: pool full`);
      }
      expect(problems).toEqual([]);
      // README bounds: centres >= 13.35 m apart, gaps >= 950 ms
      expect(stats.minSpacing).toBeGreaterThanOrEqual(13_350);
      expect(stats.minGapMs).toBe(GAP_MIN_MS);
      // stages 0-1 never have 3 obstacles; later stages do
      expect(stats.countsPerStage[0][3] + stats.countsPerStage[1][3]).toBe(0);
      for (let k = 2; k <= 8; k++) expect(stats.countsPerStage[k][3]).toBeGreaterThan(0);
      expect([...stats.types].sort()).toEqual([0, 1, 2, 3, 4, 5]);
   }, 120_000);

   it("keeps every track rule for whole runs: 100 seeds x 29:55 at 60 fps and random frames", () => {
      const problems: string[] = [];
      const stats = newStats();
      let maxRows = 0;
      let maxCoins = 0;
      for (let seed = 7000; seed < 7100; seed++) {
         const a = driveTrack(seed, FPS_60.make(seed), RUN_LIMIT_MS);
         const b = driveTrack(seed, RANDOM.make(seed), RUN_LIMIT_MS);
         problems.push(...trackProblems(a.log, stats, `seed ${seed}`));
         if (placedBy(a.log, RUN_LIMIT_MS) !== placedBy(b.log, RUN_LIMIT_MS)) problems.push(`seed ${seed}: random frames differ`);
         if (a.run.poolFull + b.run.poolFull !== 0) problems.push(`seed ${seed}: pool full`);
         maxRows = Math.max(maxRows, a.log.maxRows, b.log.maxRows);
         maxCoins = Math.max(maxCoins, a.log.maxCoins, b.log.maxCoins);
      }
      expect(problems).toEqual([]);
      for (let k = 0; k <= 8; k++) expect(stats.rowsPerStage[k]).toBeGreaterThan(0);
      // the pool bound is tight enough to matter: 8 row slots for at most 7 alive, 10 coin slots for 9
      expect(maxRows).toBeLessThanOrEqual(ROW_SLOTS - 1);
      expect(maxCoins).toBeLessThanOrEqual(COIN_SLOTS - 1);
      console.log(`office-escape pools: at most ${maxRows} rows and ${maxCoins} coins alive`);
   }, 120_000);

   it("rewrites the same pool slots and events object (no allocation in step)", () => {
      const run = createRun(21);
      const rows = run.rows;
      const slots = [...run.rows];
      const coins = [...run.coinPool];
      const lanes = run.rows.map((r) => r.lanes);
      const events = run.events;
      const bot = proofBot();
      for (let i = 0; i < 20_000; i++) {
         bot(run, nextStepMs(run, 16), run.input);
         expect(step(run, 16, run.input)).toBe(events);
      }
      expect(run.simMs).toBeGreaterThan(300_000);
      expect(run.rows).toBe(rows);
      expect(run.rows).toEqual(slots);
      run.rows.forEach((r, i) => {
         expect(r).toBe(slots[i]);
         expect(r.lanes).toBe(lanes[i]);
      });
      run.coinPool.forEach((c, i) => expect(c).toBe(coins[i]));
   });
});

describe("office-escape collisions", () => {
   it("every dodge obstacle hits in every jump phase", () => {
      for (const type of DODGES) {
         for (let j = 0; j <= JUMP_MS; j++) {
            expect(overlapsObstacle(type, 1, 50_000, 50_000, LANES[1], jumpHeight(j))).toBe(true);
         }
      }
   });

   it("a jumpable is cleared exactly when the feet are at or above its top on every overlapping check", () => {
      for (const type of JUMPABLES) {
         const top = OBSTACLE_TYPES[type].top;
         expect(overlapsObstacle(type, 1, 0, 0, 0, top - 1)).toBe(true);
         expect(overlapsObstacle(type, 1, 0, 0, 0, top)).toBe(false);
      }
   });

   it("the press windows match the README: 344 / 419 ms (desk, printer) and 308 / 389 ms (boxes) at 8 / 16 m/s", () => {
      /** Press offsets (ms before the runner reaches the obstacle) that clear it at `speed`, on a 1 ms clock. */
      const window = (type: number, speed: number) => {
         const o = OBSTACLE_TYPES[type];
         const last = Math.floor((o.depth + 2 * RUNNER.halfDepth) / speed);
         const ok: number[] = [];
         for (let p = 0; p <= JUMP_MS; p++) {
            let clear = true;
            for (let t = 0; t <= last && clear; t++) clear = jumpHeight(p + t) >= o.top;
            if (clear) ok.push(p);
         }
         // one contiguous window
         expect(ok.at(-1)! - ok[0]).toBe(ok.length - 1);
         return ok.length - 1;
      };
      expect([window(OBSTACLE.desk, 8), window(OBSTACLE.desk, 16)]).toEqual([344, 419]);
      expect([window(OBSTACLE.printer, 8), window(OBSTACLE.printer, 16)]).toEqual([344, 419]);
      // the README's 307 is the continuous 470 - 162.5; whole ms give 308
      expect([window(OBSTACLE.boxes, 8), window(OBSTACLE.boxes, 16)]).toEqual([308, 389]);
      // at every speed, every window is far longer than the longest frame
      for (let v = 8; v <= 16; v++) for (const type of JUMPABLES) expect(window(type, v)).toBeGreaterThan(6 * MAX_STEP_MS);
   });

   it("a runner centred in a neighbouring lane never touches", () => {
      for (const type of [...JUMPABLES, ...DODGES]) {
         for (const runnerLane of [0, 2]) {
            for (let d = -2000; d <= 2000; d += 50) expect(overlapsObstacle(type, 1, 0, d, LANES[runnerLane], 0)).toBe(false);
            expect(touchesCoin(1, 0, "ground", 0, LANES[runnerLane], 0)).toBe(false);
         }
         // and the full lane-change corridor is the only way in: 0.95 m of air either side
         const o = OBSTACLE_TYPES[type];
         expect(overlapsObstacle(type, 1, 0, 0, o.halfWidth + RUNNER.halfWidth - 1, 0)).toBe(true);
         expect(overlapsObstacle(type, 1, 0, 0, o.halfWidth + RUNNER.halfWidth, 0)).toBe(false);
      }
   });

   it("at 50 ms frames and 16 m/s no obstacle or coin is skipped, whatever the frame grid", () => {
      const forward = MAX_SPEED * MAX_STEP_MS;
      for (const type of [...JUMPABLES, ...DODGES]) {
         const reach = OBSTACLE_TYPES[type].depth / 2 + RUNNER.halfDepth;
         for (let offset = 0; offset < forward; offset++) {
            let seen = false;
            for (let d = -reach - 2000 + offset; d <= reach + 2000 && !seen; d += forward) seen = overlapsObstacle(type, 1, 0, d, 0, 0);
            expect(seen).toBe(true);
         }
      }
      for (let offset = 0; offset < forward; offset++) {
         let seen = false;
         for (let d = -2000 + offset; d <= 2000 && !seen; d += forward) seen = touchesCoin(1, 0, "ground", d, 0, 0);
         expect(seen).toBe(true);
      }
   });

   it("coins: ground coins need feet below 0.95 m, raised ones feet above 0.25 m; removed ones never count", () => {
      expect(touchesCoin(1, 0, "ground", 599, 0, 949)).toBe(true);
      expect(touchesCoin(1, 0, "ground", 600, 0, 0)).toBe(false);
      expect(touchesCoin(1, 0, "ground", 0, 0, 950)).toBe(false);
      expect(touchesCoin(1, 0, "ground", 0, 699, 0)).toBe(true);
      expect(touchesCoin(1, 0, "ground", 0, 700, 0)).toBe(false);
      expect(touchesCoin(1, 0, "raised", 0, 0, 250)).toBe(false);
      expect(touchesCoin(1, 0, "raised", 0, 0, 251)).toBe(true);
      expect(touchesCoin(1, 0, "raised", 0, 0, JUMP_APEX)).toBe(true);
      expect(touchesCoin(1, 0, "removed", 0, 0, 0)).toBe(false);
      // jumping a jumpable collects its raised coin: the bot's jump is above 0.25 m all through the band
      expect(jumpHeight(JUMP_LEAD)).toBeGreaterThan(250);
   });

   it("an idle runner hits the first row with something in the middle lane, on the frame it reaches it (>= 5000 ms)", () => {
      for (let seed = 0; seed < 300; seed++) {
         const pattern = [FPS_60, FPS_20, RANDOM, MS_8_3][seed % 4];
         const res = play(seed, pattern.make(seed), idleBot, { log: true });
         const { run } = res;
         const row = res.log!.rows.find((r) => r.lanes[1] !== NO_OBSTACLE)!;
         const type = row.lanes[1];
         const reachMs = timeAt(row.s - OBSTACLE_TYPES[type].depth / 2 - RUNNER.halfDepth);
         expect([run.endReason, run.events.hitRow, run.events.hitLane, run.events.hitType]).toEqual(["lose", row.index, 1, type]);
         expect(run.simMs).toBeGreaterThanOrEqual(Math.max(FIRST_ROW_MS, reachMs));
         expect(run.simMs - run.stepMs).toBeLessThan(reachMs);
         expect(res.elapsedMs).toBeGreaterThanOrEqual(4950);
         expect(run.score).toBe(scoreFor(run.distance, run.coins));
         expect(withinServerLimits(run.score, res.elapsedMs)).toBe(true);
      }
   });

   it("a jump cleared at the README's edges: desk from in - 447 to in - 103, nothing outside", () => {
      const tryPress = (lead: number) => {
         const run = createRun(30);
         isolate(run);
         const row = placeRow(run, 0, 6000, [NO_OBSTACLE, OBSTACLE.desk, NO_OBSTACLE]);
         while (!run.over && run.simMs < row.outMs + 100) step(run, 1, press(0, run.simMs === row.inMs - lead));
         return run.over ? "hit" : "clear";
      };
      expect([102, 103, 115, 300, 447, 448].map(tryPress)).toEqual(["hit", "clear", "clear", "clear", "clear", "hit"]);
   });

   it("a hit ends the step at once: the coin of that frame is not counted, the score keeps the formula", () => {
      const run = createRun(31);
      isolate(run);
      setClock(run, 9000);
      const row = placeRow(run, 0, 0, [NO_OBSTACLE, OBSTACLE.chair, NO_OBSTACLE]);
      row.s = run.distance + 700;
      const coin = run.coinPool[0];
      Object.assign(coin, { alive: true, slot: 0, s: row.s, lane: 1, kind: "ground", taken: false });
      // one 50 ms frame (400 mm): the runner reaches both the chair and the coin on the same frame
      const ev = step(run, 50, NONE);
      expect([ev.hit, ev.ended, ev.coin, run.coins, coin.taken]).toEqual([true, "lose", 0, 0, false]);
      expect(run.score).toBe(scoreFor(run.distance, 0));
      // nothing moves after the end (the events object is cleared: nothing happened)
      const frozen = () => JSON.stringify({ ...run, events: null });
      const after = frozen();
      const later = step(run, 16, press(1, true));
      expect([later.ended, later.hit, later.laneChanged, later.jumped]).toEqual([null, false, false, false]);
      expect(frozen()).toBe(after);
   });

   it("the run limit ends with win at 29:55, and a hit on the same frame wins over it", () => {
      const win = createRun(32);
      isolate(win);
      setClock(win, RUN_LIMIT_MS - 10);
      expect(step(win, 6, NONE).ended).toBe(null);
      expect(step(win, 6, NONE).ended).toBe("win");
      expect([win.endReason, win.simMs, win.score]).toEqual(["win", RUN_LIMIT_MS + 2, scoreFor(distanceAt(RUN_LIMIT_MS + 2), 0)]);

      const both = createRun(32);
      isolate(both);
      setClock(both, RUN_LIMIT_MS - 20);
      const row = placeRow(both, 0, 0, [NO_OBSTACLE, OBSTACLE.waterCooler, NO_OBSTACLE]);
      row.s = distanceAt(RUN_LIMIT_MS);
      expect(step(both, 30, NONE).ended).toBe("lose");
   });
});

describe("office-escape fairness", () => {
   it("every gap leaves time to steer across the corridor, land and take off again, at every stage", () => {
      // README fairness steps 2 and 5, in whole ms
      const steer = (LANES[2] - LANES[0]) / SLIDE_SPEED;
      const airAfterClearing = JUMP_MS - firstClearPhase(Math.min(...JUMPABLE_TOPS));
      expect([steer, airAfterClearing]).toEqual([400, 597]);
      expect(steer + MAX_STEP_MS).toBeLessThanOrEqual(GAP_MIN_MS);
      expect(airAfterClearing + JUMP_LEAD).toBeLessThanOrEqual(GAP_MIN_MS);
      expect(JUMP_MS + JUMP_LEAD).toBe(815);
      expect(GAP_MIN_MS - (JUMP_MS + JUMP_LEAD)).toBeGreaterThan(MAX_STEP_MS);
      // a press buffered before leaving a row lands the second jump by out + 135 + 700, in time for the lead
      expect(JUMP_BUFFER_MS + JUMP_MS + JUMP_LEAD).toBeLessThanOrEqual(GAP_MIN_MS);
   });

   it("a jump buffered just before leaving a row still leaves time to take off for the next one, at every stage", () => {
      // starting lane (passable), row lanes: boxes need take-off by in - 115, desk and printer by in - 103
      const cases: Array<[number, number[]]> = [
         [2, [OBSTACLE.chair, OBSTACLE.waterCooler, OBSTACLE.boxes]],
         [1, [OBSTACLE.printer, OBSTACLE.desk, OBSTACLE.chair]],
         [0, [OBSTACLE.boxes, OBSTACLE.chair, OBSTACLE.waterCooler]],
      ];
      const airLeft: number[] = [];
      for (let left = 1; left <= JUMP_BUFFER_MS; left += 7) airLeft.push(left);
      if (airLeft.at(-1) !== JUMP_BUFFER_MS) airLeft.push(JUMP_BUFFER_MS);
      const problems: string[] = [];
      let runs = 0;
      for (let stage = 0; stage <= 8; stage++) {
         const out = stage * SPEED.stageMs + (stage < 8 ? SPEED.stageMs - 300 : 5000);
         for (const [lane, lanes] of cases) {
            for (const left of airLeft) {
               for (const pattern of [MS_1, FPS_144, FPS_60, FPS_20, RANDOM]) {
                  const run = createRun(50 + stage);
                  isolate(run);
                  setClock(run, out);
                  run.lane = lane;
                  run.x = LANES[lane];
                  // in the air with `left` ms to go and a second jump already buffered
                  run.jumpMs = JUMP_MS - left;
                  run.jumpBuffered = true;
                  run.feet = jumpHeight(run.jumpMs);
                  const row = placeRow(run, 1, out + GAP_MIN_MS, lanes);
                  const bot = proofBot();
                  const dt = pattern.make(stage * 1000 + left);
                  while (!run.over && run.simMs < row.outMs + 100) {
                     const dtMs = dt();
                     bot(run, nextStepMs(run, dtMs), run.input);
                     step(run, dtMs, run.input);
                  }
                  runs += 1;
                  if (run.over) {
                     const ev = run.events;
                     problems.push(`stage ${stage} [${lanes}] air left ${left} ${pattern.name}: hit ${OBSTACLE_TYPES[ev.hitType].name} at ${run.simMs - out} ms after leaving, feet ${run.feet}`);
                  }
               }
            }
         }
      }
      expect(problems).toEqual([]);
      expect(runs).toBe(9 * 3 * airLeft.length * 5);
   });

   it("the worst case at every stage: leave a row in the far lane in the air, then a minimum gap to a 3-row with only boxes passable", () => {
      // starting lane, row lanes (passable lane at the other side), air left when leaving
      const cases: Array<[number, number[]]> = [
         [0, [OBSTACLE.chair, OBSTACLE.coffeeCart, OBSTACLE.boxes]],
         [2, [OBSTACLE.boxes, OBSTACLE.waterCooler, OBSTACLE.chair]],
         [0, [OBSTACLE.coffeeCart, OBSTACLE.chair, OBSTACLE.desk]],
      ];
      const problems: string[] = [];
      for (let stage = 0; stage <= 8; stage++) {
         // leave 300 ms before the next speed step, so the speed changes inside the gap
         const out = stage * SPEED.stageMs + (stage < 8 ? SPEED.stageMs - 300 : 5000);
         for (const [lane, lanes] of cases) {
            for (const jumpMs of [-1, 0, 103]) {
               for (const pattern of [MS_1, FPS_144, FPS_60, FPS_20, RANDOM]) {
                  const run = createRun(40 + stage);
                  isolate(run);
                  setClock(run, out);
                  run.lane = lane;
                  run.x = LANES[lane];
                  run.jumpMs = jumpMs;
                  run.feet = jumpHeight(jumpMs);
                  const row = placeRow(run, 1, out + GAP_MIN_MS, lanes);
                  const bot = proofBot();
                  const dt = pattern.make(stage);
                  while (!run.over && run.simMs < row.outMs + 100) {
                     const dtMs = dt();
                     bot(run, nextStepMs(run, dtMs), run.input);
                     step(run, dtMs, run.input);
                  }
                  if (run.over) problems.push(`stage ${stage} lane ${lane} air ${jumpMs} ${pattern.name}: hit at ${run.simMs - out} ms after leaving`);
               }
            }
         }
      }
      expect(problems).toEqual([]);
   });

   it("the proof's bot reaches 29:55 on 40 seeds at 144, 60, 30 and 20 fps; the track is the same at every rate and without a runner", () => {
      const problems: string[] = [];
      let jumps = 0;
      let laneChanges = 0;
      let coins = 0;
      for (let seed = 0; seed < 40; seed++) {
         const reference = placedBy(driveTrack(seed, FPS_60.make(seed), RUN_LIMIT_MS).log, RUN_LIMIT_MS);
         for (const pattern of BOT_RATES) {
            const res = play(seed, pattern.make(seed), proofBot(), { log: true });
            const label = `seed ${seed} ${pattern.name}`;
            if (res.run.endReason !== "win") problems.push(`${label}: ${describeEnd(res)}`);
            if (placedBy(res.log!, RUN_LIMIT_MS) !== reference) problems.push(`${label}: track differs`);
            if (res.capped || res.formulaMisses) problems.push(`${label}: capped ${res.capped}, formula ${res.formulaMisses}`);
            if (res.run.poolFull || res.log!.maxRows > 7 || res.log!.maxCoins > 9) problems.push(`${label}: pools`);
            if (!withinServerLimits(res.run.score, res.elapsedMs)) problems.push(`${label}: score ${res.run.score} over the limit`);
            if (res.run.simMs < RUN_LIMIT_MS || res.run.simMs >= RUN_LIMIT_MS + MAX_STEP_MS) problems.push(`${label}: ended at ${res.run.simMs}`);
            jumps += res.jumps;
            laneChanges += res.laneChanges;
            coins += res.run.coins;
         }
      }
      expect(problems).toEqual([]);
      // the bot really plays: it jumps, changes lanes and picks up coins
      expect(jumps).toBeGreaterThan(160 * 100);
      expect(laneChanges).toBeGreaterThan(160 * 100);
      expect(coins).toBeGreaterThan(160 * 100);
   }, 180_000);

   it("a sloppy bot that also jumps right after every row reaches 29:55 too (10 seeds x 4 rates)", () => {
      const problems: string[] = [];
      let jumps = 0;
      for (let seed = 100; seed < 110; seed++) {
         for (const pattern of BOT_RATES) {
            const res = play(seed, pattern.make(seed), proofBot({ sloppy: true }));
            if (res.run.endReason !== "win") problems.push(`seed ${seed} ${pattern.name}: ${describeEnd(res)}`);
            jumps += res.jumps;
         }
      }
      expect(problems).toEqual([]);
      expect(jumps).toBeGreaterThan(40 * 800);
   }, 120_000);
});

describe("office-escape scoring", () => {
   it("is 1 point per full metre plus 50 per coin", () => {
      expect(scoreFor(0, 0)).toBe(0);
      expect(scoreFor(999, 0)).toBe(0);
      expect(scoreFor(1000, 0)).toBe(1);
      expect(scoreFor(390_000, 20)).toBe(1390);
      expect(scoreFor(distanceAt(45_000), 20)).toBe(1390);
      expect(scoreFor(28_000_000, 2799)).toBe(167_950);
   });

   it("matches the server's check for meta.ts", () => {
      expect(withinServerLimits(1000, 10_000)).toBe(true);
      expect(withinServerLimits(1001, 10_000)).toBe(false);
      expect(withinServerLimits(100, 2_999)).toBe(false);
      expect(withinServerLimits(100, 3_000)).toBe(true);
      expect(withinServerLimits(100, 1_800_000)).toBe(true);
      expect(withinServerLimits(100, 1_800_001)).toBe(false);
      expect(withinServerLimits(200_001, 1_800_000)).toBe(false);
      expect(withinServerLimits(12.5, 10_000)).toBe(false);
      expect(capScore(5000, 10_000)).toBe(1000);
      // 100 points/s x 1800 s = 180,000: the rate binds before maxScore (200,000) at every duration
      expect(capScore(500_000, 1_800_000)).toBe(180_000);
      // the server sees Math.round(elapsedMs)
      expect(capScore(1000, 9_999.4)).toBe(999);
      expect(capScore(1000, 9_999.5)).toBe(1000);
   });
});

describe("office-escape scoring limit proof (README 'Server limits')", () => {
   it("6 · D(d + 50) <= 0.1 · d for every whole ms d from 4950 to 1,795,050; the largest ratio is 0.936, at the end", () => {
      let worst = 0;
      let worstAt = 0;
      for (let d = 4950; d <= RUN_LIMIT_MS + 50; d++) {
         // in points: 6 · distanceAt(d + 50) / 1000 <= 100 · d / 1000
         const ratio = (6 * distanceAt(d + 50)) / (100 * d);
         if (ratio > worst) {
            worst = ratio;
            worstAt = d;
         }
      }
      expect(worst).toBeLessThanOrEqual(1);
      expect(worst).toBeCloseTo(0.936, 3);
      expect(worstAt).toBe(RUN_LIMIT_MS + 50);
   });

   it("coins are bounded by distance: fewer than one per 10 m run", () => {
      // a coin is first touched 599 mm before its centre (whole mm)...
      const s0 = coinSlotS(0);
      expect([touchesCoin(1, s0, "ground", s0 - 600, 0, 0), touchesCoin(1, s0, "ground", s0 - 599, 0, 0)]).toEqual([false, true]);
      // ...so the formula counts exactly the slots a runner at D can have touched
      for (let d = 0; d <= 100_000; d += 7) {
         let reachable = 0;
         for (let slot = 0; coinSlotS(slot) - 599 <= d; slot++) reachable += 1;
         expect(slotsReached(d)).toBe(reachable);
      }
      // the worst case is right after each new slot comes into reach: still under D / 10 m
      for (let k = 0; k < 2800; k++) {
         const d = COIN.first - 600 + 1 + k * COIN.spacing;
         expect(slotsReached(d)).toBe(k + 1);
         expect(slotsReached(d) * COIN.spacing).toBeLessThan(d);
         expect(scoreFor(d, slotsReached(d))).toBeLessThan((6 * d) / 1000);
      }
      // the best run possible: 28,000 m and a coin in every slot is 167,950 < 179,495 < 200,000
      const end = distanceAt(RUN_LIMIT_MS + MAX_STEP_MS - 1);
      expect(end).toBe(28_000_784);
      expect(slotsReached(end)).toBe(2799);
      expect(scoreFor(end, slotsReached(end))).toBe(167_950);
      expect(167_950).toBeLessThanOrEqual(Math.floor(0.1 * (RUN_LIMIT_MS - 50)));
      expect(withinServerLimits(167_950, RUN_LIMIT_MS)).toBe(true);
      // the earliest hit: at most 40 m and 3 coins (190) against a cap of 495 at 4950 ms
      expect(scoreFor(distanceAt(FIRST_ROW_MS), slotsReached(distanceAt(FIRST_ROW_MS)))).toBe(190);
      expect(capScore(10_000, 4950)).toBe(495);
   });

   it("random and mashing inputs never break the limit (300 seeds x 4 frame patterns)", () => {
      const problems: string[] = [];
      let frames = 0;
      let hits = 0;
      for (let seed = 0; seed < 300; seed++) {
         for (const pattern of [RANDOM, MS_8_3, MS_16_7, FPS_20]) {
            const [laneRate, jumpRate] = seed % 3 === 0 ? [0.5, 0.5] : seed % 3 === 1 ? [0.05, 0.02] : [0.2, 0.1];
            const res = play(seed, pattern.make(seed), randomBot(seed, laneRate, jumpRate), { untilMs: 300_000 });
            frames += res.frames;
            const label = `seed ${seed} ${pattern.name}`;
            if (res.capped || res.formulaMisses || res.coinOverruns) problems.push(`${label}: capped ${res.capped}, formula ${res.formulaMisses}, coins ${res.coinOverruns}`);
            if (res.run.over) {
               hits += 1;
               if (res.run.simMs < FIRST_ROW_MS || res.elapsedMs < 4950) problems.push(`${label}: ended at ${res.run.simMs} ms`);
               if (!withinServerLimits(res.run.score, res.elapsedMs)) problems.push(`${label}: ${res.run.score} in ${res.elapsedMs} ms`);
            }
         }
      }
      expect(problems).toEqual([]);
      expect(hits).toBeGreaterThan(1000);
      expect(frames).toBeGreaterThan(100_000);
   }, 120_000);

   it("a coin-chasing bot never breaks the limit at full speed, at any frame pattern, and collects more than the proof's bot", () => {
      const problems: string[] = [];
      let greedyCoins = 0;
      let plainCoins = 0;
      let wins = 0;
      for (let seed = 200; seed < 208; seed++) {
         for (const pattern of [FPS_60, MS_8_3, MS_16_7, FPS_20, RANDOM]) {
            const greedy = play(seed, pattern.make(seed), proofBot({ greedy: true }));
            const plain = play(seed, pattern.make(seed), proofBot());
            greedyCoins += greedy.run.coins;
            plainCoins += plain.run.coins;
            if (greedy.run.endReason === "win") wins += 1;
            const label = `seed ${seed} ${pattern.name}`;
            // every frame: score <= 100 points/s and <= 200,000, and no more coins than slots reached
            if (greedy.capped || greedy.formulaMisses || greedy.coinOverruns) problems.push(`${label}: capped ${greedy.capped}, coins ${greedy.coinOverruns}`);
            if (greedy.run.over && !withinServerLimits(greedy.run.score, greedy.elapsedMs)) problems.push(`${label}: over the limit`);
            // at most one coin per 10 m of track, whatever the lanes
            if (greedy.run.coins * COIN.spacing >= greedy.run.distance) problems.push(`${label}: ${greedy.run.coins} coins in ${greedy.run.distance} mm`);
         }
      }
      expect(problems).toEqual([]);
      expect(greedyCoins).toBeGreaterThan(plainCoins);
      // the checks really ran at 16 m/s: most greedy runs reach the limit
      expect(wins).toBeGreaterThanOrEqual(30);
   }, 180_000);
});

describe("office-escape with the real store (README proof step 1)", () => {
   it("drives the store like ShellStage: no untimed step, e - 1 < simMs <= e, Scene's store calls give a valid submission", () => {
      expect(FRAME_PRIORITY.clock).toBeLessThan(FRAME_PRIORITY.simulation);
      const store = createArcadeStore();
      // untimed, no lives: the defaults office-escape's definition leaves alone
      store.getState().configure({});
      store.getState().markReady();
      const rng = createRng(2026);
      let carried = 0;
      for (const [i, ending] of (["win", "lose", "restart", "lose", "restart", "lose"] as const).entries()) {
         const { phase } = store.getState();
         if (phase === "ready" || phase === "over") store.getState().start();
         // Scene remounts per runId and draws a new seed
         const run = createRun(900 + i);
         const bot = ending === "lose" ? idleBot : proofBot();
         const stopAtMs = 6_000 + rng() * 60_000;
         let untimed = 0;
         let worstAhead = -Infinity;
         let worstBehind = -Infinity;
         let first = true;
         while (store.getState().phase !== "over") {
            const roll = rng();
            if (roll < 0.01) store.getState().pause();
            else if (roll < 0.03) store.getState().resume();
            const before = store.getState().elapsedMs;
            advanceRunClock(store, rng() < 0.1 ? 0.05 + rng() * 0.25 : 0.004 + rng() * 0.03);
            const dt = playedFrameDt(store.getState());
            if (dt === 0) continue;
            if (dt * 1000 > store.getState().elapsedMs - before + 1e-9) untimed += 1;
            if (first && dt < MAX_FRAME_DT - 1e-9) carried += 1;
            first = false;
            // Scene: useRunFrame -> readInput / bot -> step -> store calls
            const dtMs = dt * 1000;
            bot(run, nextStepMs(run, dtMs), run.input);
            const ev = step(run, dtMs, run.input);
            const s = store.getState();
            if (ev.scoreChanged) s.setScore(run.score);
            if (ev.coin) s.setStat("coins", run.coins);
            if (ev.stageChanged) s.setLevel(run.stage + 1);
            if (ev.ended) {
               s.setScore(capScore(run.score, store.getState().elapsedMs));
               store.getState().end(ev.ended);
            }
            const e = store.getState().elapsedMs;
            worstAhead = Math.max(worstAhead, run.simMs - e);
            worstBehind = Math.max(worstBehind, e - run.simMs);
            if (ending === "restart" && e >= stopAtMs) break;
         }
         const s = store.getState();
         expect(untimed).toBe(0);
         // the integer clock never runs ahead of elapsedMs and lags it by less than 1 ms
         expect(worstAhead).toBeLessThanOrEqual(1e-6);
         expect(worstBehind).toBeLessThan(1);
         expect(s.score).toBe(run.score);
         expect(s.score).toBe(scoreFor(run.distance, run.coins));
         expect(s.stats.coins ?? 0).toBe(run.coins);
         expect(s.level).toBe(run.stage + 1);
         if (ending === "win") {
            expect(s.endReason).toBe("win");
            expect(s.elapsedMs).toBeGreaterThanOrEqual(RUN_LIMIT_MS - 1e-6);
            expect(s.elapsedMs).toBeLessThanOrEqual(RUN_LIMIT_MS + 50);
            expect(run.coins).toBeGreaterThan(500);
         }
         if (ending === "lose") {
            expect(s.endReason).toBe("lose");
            expect(run.simMs).toBeGreaterThanOrEqual(FIRST_ROW_MS);
            expect(s.elapsedMs).toBeGreaterThanOrEqual(4950);
         }
         if (ending !== "restart") expect(withinServerLimits(s.score, s.elapsedMs)).toBe(true);
         if (ending === "restart") store.getState().restart();
      }
      // the random frames really ended countdowns mid-frame
      expect(carried).toBeGreaterThan(0);
   }, 120_000);
});
