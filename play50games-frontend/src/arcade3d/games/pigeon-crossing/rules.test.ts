import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { sweptAabbXZ, type AABB } from "@/arcade3d/core/collision";
import { advanceRunClock, isResultShown, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createInputController } from "@/arcade3d/core/inputController";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { pigeonCrossingMeta } from "./meta";
import {
   CYCLE_MS, DOWN, DURATION_MS, HOP_MS, LEFT, NONE, RIGHT, UP, VEHICLE_TYPES,
   applyFallback, columnX, createRun, createStepInput, fillHorizon, firstHit, isGrass,
   laneFor, levelSeedFor, scoreFor, step, syncTraffic, validateLane,
   type Lane, type PigeonRun, type StepInput,
} from "./rules";
import * as rules from "./rules";

describe("pigeon-crossing golden constants", () => {
   it("pins the approved grid, clock, traffic and pool sizes", () => {
      expect(rules).toMatchObject({
         COLUMNS: 7, COLUMN_PITCH: 1.6, ROW_PITCH: 1.8, ROWS_PER_LEVEL: 20,
         HOP_MS: 550, PREVIEW_MS: 3050, MAX_STEP_MS: 50, DURATION_MS: 1800000,
         CYCLE_MS: 12000, CLEAR_FROM_MS: 9000, TIER_CAP: 10,
         LANE_SLOTS: 40, VEHICLES_PER_LANE: 4, VEHICLE_SLOTS: 160,
         PLAY_HALF_WIDTH: 5.6, SPAWN_MARGIN: 0.4, COVER_INNER_X: 6,
         PIGEON: { halfX: 0.28, halfZ: 0.25, height: 1.25, hopHeight: 0.25 },
         GRASS_ROWS: [0, 3, 6, 9, 12, 15, 18, 20],
         VEHICLE_TYPES: [
            { name: "car", length: 2.8, depth: 1.15, baseSpeed: 3 },
            { name: "taxi", length: 3.1, depth: 1.2, baseSpeed: 3.4 },
            { name: "van", length: 3.8, depth: 1.3, baseSpeed: 2.6 },
         ],
         ROW_POINTS: 10, LEVEL_BONUS: 100, LEVEL_SEED_MIX: 0x9e3779b9,
      });
   });
});

const IDLE: StepInput = { pressed: { up: false, down: false, left: false, right: false }, tap: null };
const PRESS: StepInput = { pressed: { ...IDLE.pressed, up: true }, tap: null };
const request = (direction: number): StepInput => ({ pressed: { up: direction === UP, down: direction === DOWN, left: direction === LEFT, right: direction === RIGHT }, tap: null });
const LIMITS = pigeonCrossingMeta.scoring;

function advance(run: PigeonRun, ms: number, nextDt = () => 50): void {
   const end = run.timeMs + ms;
   for (let guard = 0; run.timeMs < end && !run.ended && guard < 300000; guard++) step(run, Math.min(nextDt(), end - run.timeMs), IDLE);
}

function place(run: PigeonRun, row: number, col = 3, time = 120000): void {
   run.player.row = row;
   run.player.col = col;
   run.player.x = columnX(col);
   run.player.z = -row * 1.8;
   run.player.y = 0;
   run.level = Math.floor(row / 20) + 1;
   run.completed = run.level - 1;
   run.furthest = row % 20;
   run.hops = row;
   run.score = scoreFor(run.completed, run.furthest);
   run.timeMs = time;
   run.poseMs = time;
   run.remainder = 0;
   run.hop.active = false;
   run.queued = NONE;
   run.ended = null;
   if (!fillHorizon(run, Math.max(0, row - 9), row + 20)) throw new Error(`Test horizon rejected at row ${row}`);
   syncTraffic(run, time);
}

function descriptor(l: Lane): number[] {
   return [l.row, l.level, l.localRow, Number(l.road), l.kind, l.direction, l.phaseMs, l.speed, l.packSize, l.gap, l.headwayMs, l.travelMs, l.startMs, Number(l.fallback)];
}

/** Independent live-interval sweep oracle; these test boxes are allocated once, not per path edge. */
const PB: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 0 } };
const VB: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 0 } };
const RELATIVE = { x: 0, z: 0 };
let oracleSweeps = 0;
function safeEdge(run: PigeonRun, row: number, col: number, at: number): boolean {
   const x = columnX(col), z = -row * 1.8;
   for (let r = row; r <= row + 1; r++) {
      const lane = laneFor(run, r);
      if (!lane || !lane.road) continue;
      const type = VEHICLE_TYPES[lane.kind], spawn = 6 + type.length / 2;
      for (let cycle = Math.floor((at + lane.phaseMs) / 12000); cycle <= Math.floor((at + 550 + lane.phaseMs) / 12000); cycle++) {
         for (let member = 0; member < lane.packSize; member++) {
            const birth = cycle * 12000 - lane.phaseMs + lane.startMs + member * lane.headwayMs;
            const lo = Math.max(at, birth), hi = Math.min(at + 550, birth + lane.travelMs);
            if (hi < lo) continue;
            const px = x, pz = z - 1.8 * (lo - at) / 550;
            const vx = lane.direction * (-spawn + lane.speed * (lo - birth) / 1000);
            const vz = -r * 1.8;
            PB.min.x = px - 0.28; PB.max.x = px + 0.28;
            PB.min.z = pz - 0.25; PB.max.z = pz + 0.25;
            VB.min.x = vx - type.length / 2; VB.max.x = vx + type.length / 2;
            VB.min.z = vz - type.depth / 2; VB.max.z = vz + type.depth / 2;
            RELATIVE.x = -lane.direction * lane.speed * (hi - lo) / 1000;
            RELATIVE.z = -1.8 * (hi - lo) / 550;
            oracleSweeps++;
            if (sweptAabbXZ(PB, RELATIVE, VB) !== null) return false;
         }
      }
   }
   return true;
}

/** Time-expanded graph: seven columns, grass waits, and real swept edges at candidate departures. */
function routeExists(run: PigeonRun, level: number): boolean {
   const base = (level - 1) * 20;
   place(run, base);
   const times = new Float64Array(7);
   for (let col = 0; col < 7; col++) times[col] = 3050 + Math.abs(col - 3) * 550;
   for (let group = 0; group < 7; group++) {
      const row = base + group * 3;
      const roads = group === 6 ? 1 : 2;
      const lane = laneFor(run, row + 1)!;
      for (let col = 0; col < 7; col++) {
         const arrived = times[col];
         const quiet = arrived + ((9000 - (arrived + lane.phaseMs) % 12000 + 12000) % 12000) + 350;
         let best = Infinity;
         for (const depart of [arrived, arrived + 50, quiet]) {
            let safe = true;
            for (let hop = 0; hop <= roads; hop++) if (!safeEdge(run, row + hop, col, depart + hop * 550)) { safe = false; break; }
            if (safe) best = Math.min(best, depart + (roads + 1) * 550);
         }
         times[col] = best;
      }
   }
   return times.some(Number.isFinite);
}

function viewFor(run: PigeonRun): void {
   const row = Math.floor(-run.player.z / 1.8 + 1e-9);
   if (!fillHorizon(run, Math.max(0, row - 9), row + 18)) throw new Error("Valid view rejected");
}

/** Predictive forward bot: tests a complete future hop, including queued takeoff time. */
function botInput(run: PigeonRun, input: StepInput): StepInput {
   input.pressed.up = false;
   if (run.timeMs < 3050 || run.queued !== NONE) return input;
   const row = run.hop.active ? run.hop.toRow : run.player.row;
   if (row >= run.completed * 20 + 20) return input;
   const at = run.timeMs + (run.hop.active ? 550 - run.hop.elapsedMs : 0);
   const x = columnX(run.hop.active ? run.hop.toCol : run.player.col);
   let safe = true;
   // Commit from grass only when the entire crossing reaches safe grass; waiting in a road
   // after a locally safe first hop is not a perfect survival strategy.
   const end = isGrass(row % 20) ? Math.min(row + (row % 20 === 18 ? 2 : 3), (run.completed + 1) * 20) : row + 1;
   for (let r = row; r < end; r++) {
      if (Number.isFinite(firstHit(run, at + (r - row) * 550, 550, x, -r * 1.8, x, -(r + 1) * 1.8, r, r + 1))) safe = false;
   }
   input.pressed.up = safe;
   return input;
}

function measure(seed: number, nextDt: () => number, duration: number, adversarial = false): PigeonRun {
   const run = createRun(seed), input = createStepInput(), rng = createRng(seed ^ 19);
   for (let guard = 0; !run.ended && run.timeMs < duration && guard < 300000; guard++) {
      viewFor(run);
      if (adversarial) {
         const pick = Math.floor(rng() * 6);
         input.pressed.up = pick <= 2;
         input.pressed.down = pick === 3;
         input.pressed.left = pick === 4;
         input.pressed.right = pick === 5;
      } else botInput(run, input);
      step(run, nextDt(), input);
      const n = 20 * run.completed + run.furthest;
      if (run.timeMs + 1e-8 < 3050 + 550 * n && n) throw new Error("Progress before its timed bound");
      if (run.score !== scoreFor(run.completed, run.furthest)) throw new Error("Cap concealed invalid score");
      if (run.score > LIMITS.maxPointsPerSec * run.poseMs / 1000 + 1e-8 || run.score > LIMITS.maxScore) throw new Error("Server score limit broken");
      if (run.hops < n) throw new Error("Rows awarded without hops");
   }
   return run;
}

describe("pigeon-crossing traffic and pools", () => {
   it("pins grass, speed tiers, pack sizes, gaps, integer headways and the core RNG draw order", () => {
      for (let level = 1; level <= 11; level++) {
         const run = createRun(5050);
         place(run, (level - 1) * 20);
         expect(Array.from({ length: 21 }, (_, row) => row).filter(isGrass)).toEqual([0, 3, 6, 9, 12, 15, 18, 20]);
         const rng = createRng(levelSeedFor(5050, level));
         expect(levelSeedFor(5050, level)).toBe((5050 ^ Math.imul(level, 0x9e3779b9)) >>> 0);
         const tier = Math.min(level, 10);
         for (let group = 0; group < 7; group++) {
            const phase = Math.floor(rng() * 12000), dir = rng() < 0.5 ? 1 : -1;
            for (let road = 0; road < (group === 6 ? 1 : 2); road++) {
               const draw = Math.floor(rng() * 7), kind = draw < 4 ? 0 : draw < 6 ? 1 : 2;
               const lane = laneFor(run, (level - 1) * 20 + 3 * group + 1 + road)!;
               const type = VEHICLE_TYPES[kind], speed = Math.min(8, type.baseSpeed + 0.6 * (tier - 1));
               const gap = 3 - 0.2 * (tier - 1), pack = 1 + Math.floor((tier - 1) / 3);
               const headway = Math.ceil((3.8 + gap) * 1000 / speed);
               const travel = 2 * (6 + type.length / 2) * 1000 / speed;
               const maxStart = Math.floor(Math.min(2000, 9000 - travel - (pack - 1) * headway));
               const start = Math.floor(rng() * (maxStart + 1));
               expect(lane).toMatchObject({ phaseMs: phase, direction: road === 0 ? dir : -dir, kind, speed, gap, packSize: pack, headwayMs: headway, startMs: start, fallback: false });
               expect(lane.travelMs).toBeCloseTo(travel, 10);
               expect(validateLane(lane)).toBe(true);
               expect(lane.startMs + (lane.packSize - 1) * lane.headwayMs + lane.travelMs).toBeLessThanOrEqual(9000);
            }
         }
      }
   });

   it("the shared [9,12) clear window holds at every tier/type, including both endpoints and fallback", () => {
      for (let level = 1; level <= 10; level++) for (const fallback of [false, true]) {
         const run = createRun(7, 28, fallback);
         place(run, (level - 1) * 20);
         for (let group = 0; group < 7; group++) {
            const lane = laneFor(run, (level - 1) * 20 + group * 3 + 1)!;
            if (group !== 6) {
               const other = laneFor(run, lane.row + 1)!;
               expect(other.phaseMs).toBe(lane.phaseMs);
               expect(other.direction).toBe(-lane.direction);
            }
            for (const phase of [9000, 9500, 11000, 11999.999]) {
               syncTraffic(run, 12000 - lane.phaseMs + phase);
               expect(run.vehicles.slice(lane.slot * 4, lane.slot * 4 + 4).every((v) => !v.active)).toBe(true);
            }
         }
      }
   });

   it("validates corrupt traffic and repairs it in place with one deterministic car, zero start offset", () => {
      const run = createRun(9);
      const lane = laneFor(run, 1)!;
      const phase = lane.phaseMs, direction = lane.direction;
      for (const corrupt of [
         (l: Lane) => { l.startMs = 8999; },
         (l: Lane) => { l.headwayMs = 1; },
         (l: Lane) => { l.packSize = 5; },
         (l: Lane) => { l.speed = 100; },
      ]) {
         corrupt(lane);
         expect(validateLane(lane)).toBe(false);
         applyFallback(lane);
         expect(lane).toMatchObject({ kind: 0, packSize: 1, startMs: 0, fallback: true, phaseMs: phase, direction });
         expect(validateLane(lane)).toBe(true);
      }
   });

   it("a swept time-expanded path exists for 1000 seeds at every tier, later levels and forced fallback", () => {
      let paths = 0;
      for (const forced of [false, true]) {
         for (let seed = 0; seed < 1000; seed++) {
            const run = createRun(seed, 28, forced);
            for (let level = 1; level <= 10; level++) {
               if (!routeExists(run, level)) throw new Error(`No path: seed ${seed}, level ${level}, fallback ${forced}`);
               paths++;
            }
         }
      }
      const fallback = createRun(0xffffffff, 28, true);
      for (const level of [1, 2, 10, 11, 100, 164]) expect(routeExists(fallback, level)).toBe(true);
      expect(paths).toBe(20000);
      expect(oracleSweeps).toBeGreaterThan(1000);
   }, 15000);

   it("keeps the 40/160 ring fixed, fills/validates/falls back without allocation, and preserves late preview phases", () => {
      const run = createRun(9), lanes = [...run.lanes], vehicles = [...run.vehicles];
      const expected = descriptor(laneFor(run, 21)!);
      expect(fillHorizon(run, 0, 39)).toBe(true);
      expect(descriptor(laneFor(run, 21)!)).toEqual(expected);
      const before = run.lanes.map(descriptor);
      expect(fillHorizon(run, 0, 40)).toBe(false);
      expect(run.lanes.map(descriptor)).toEqual(before);
      expect(fillHorizon(run, 0, 39)).toBe(true);
      for (let level = 2; level <= 300; level++) {
         place(run, (level - 1) * 20);
         if (run.lanes.length !== 40 || run.vehicles.length !== 160) throw new Error(`Pool grew at level ${level}`);
         for (let i = 0; i < 40; i++) if (run.lanes[i] !== lanes[i]) throw new Error(`Lane ${i} replaced at level ${level}`);
         for (let i = 0; i < 160; i++) if (run.vehicles[i] !== vehicles[i]) throw new Error(`Vehicle ${i} replaced at level ${level}`);
      }
      const late = createRun(9);
      place(late, 20, 3, 43210);
      expect(descriptor(laneFor(late, 21)!)).toEqual(expected);
      syncTraffic(late, 43210);
      place(run, 20, 3, 43210);
      expect(run.vehicles.slice(21 % 40 * 4, 21 % 40 * 4 + 4)).toEqual(late.vehicles.slice(21 % 40 * 4, 21 % 40 * 4 + 4));
      expect(fillHorizon(run, 22, 39)).toBe(false); // cannot evict the pigeon
      expect(run.horizonBlocked).toBe(true);
      const clock = run.timeMs;
      step(run, 50, PRESS);
      expect(run.timeMs).toBe(clock);
      expect(fillHorizon(run, 11, 38)).toBe(true);
      step(run, 50, PRESS);
      expect(run.hop.active).toBe(true);
      expect(fillHorizon(run, 0, 20)).toBe(false); // cannot evict the hop destination
   });

   it("birth/death centres put the complete vehicle under |x| >=6 and never sweep a cycle teleport", () => {
      const run = createRun(31);
      for (const row of [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19]) {
         const l = laneFor(run, row)!, type = VEHICLE_TYPES[l.kind];
         const birth = 12000 - l.phaseMs + l.startMs;
         syncTraffic(run, birth);
         const v = run.vehicles[l.slot * 4];
         expect(v.active).toBe(true);
         expect(Math.abs(v.x) - type.length / 2).toBeCloseTo(6, 10);
         syncTraffic(run, birth + l.travelMs - 1e-6);
         expect(Math.abs(v.x) - type.length / 2).toBeGreaterThan(5.999999);
         syncTraffic(run, birth + l.travelMs + 1e-6);
         expect(v.active).toBe(false);
         const wrap = 24000 - l.phaseMs;
         expect(firstHit(run, wrap - 25, 50, 0, -row * 1.8, 0, -row * 1.8, row, row)).toBe(Infinity);
      }
   });
});

describe("pigeon-crossing inputs, hops and swept contacts", () => {
   it("drops preview requests, needs a fresh press and gives exactly 550 ms per hop", () => {
      const run = createRun(1);
      step(run, 50, PRESS);
      advance(run, 2999);
      step(run, 2, PRESS); // request made before preview expires, not replayed within this frame
      expect(run.timeMs).toBe(3051);
      expect(run.hop.active).toBe(false);
      step(run, 1, request(LEFT));
      expect(run.hop.elapsedMs).toBe(1);
      advance(run, 548);
      expect(run.player.row).toBe(0);
      expect(run.player.col).toBe(3);
      expect(step(run, 1, IDLE).landedRow).toBe(0);
      expect(run.player.col).toBe(2);
      expect(run.hops).toBe(1);
      expect(run.score).toBe(0);
   });

   it("uses core pressed (including swipes) once, and taps only on release; one request per frame", () => {
      const input = createInputController();
      const run = createRun(1);
      advance(run, 3050);
      input.keyDown("ArrowLeft"); input.keyUp("ArrowLeft"); input.latch();
      step(run, 1, input.state.current);
      expect(run.hop.toCol).toBe(2);
      input.latch(); step(run, 1, input.state.current);
      expect(run.queued).toBe(NONE);
      advance(run, 548);
      input.keyDown("ArrowLeft", true); input.latch(); step(run, 1, input.state.current);
      expect(run.hop.active).toBe(false);
      input.keyUp("ArrowLeft");
      input.pointerDown(0, 0, 0, 0, 0);
      input.pointerMove(0, 0, 0, 40, 100);
      input.latch();
      expect(input.state.current.pressed.down).toBe(true);
      const from = run.hops;
      step(run, 1, input.state.current); // down invalid at row 0, not a tap-down/up hop
      expect(run.hops).toBe(from);
      input.pointerUp(0, 40, 120); input.latch();
      expect(input.state.current.tap).toBe(null);
      input.pointerDown(0, 0, 0, 0, 200); input.pointerUp(0, 0, 250); input.latch();
      step(run, 1, input.state.current);
      expect(run.hop.toRow).toBe(1);
      expect(run.queued).toBe(NONE);
      const priority = createRun(4); advance(priority, 3050);
      step(priority, 1, { pressed: { up: true, down: true, left: true, right: true }, tap: { x: 0, y: 0 } });
      expect(priority.hop.toRow).toBe(1);
      expect(priority.queued).toBe(NONE);
   });

   it("validates a queued request against the destination; invalid requests leave the slot free", () => {
      const run = createRun(1); place(run, 0, 5);
      step(run, 1, request(RIGHT));
      step(run, 1, request(RIGHT));
      expect(run.queued).toBe(NONE);
      step(run, 1, request(LEFT));
      expect(run.queued).toBe(LEFT);
      step(run, 1, PRESS);
      expect(run.queued).toBe(LEFT);
      advance(run, 546);
      expect(run.player.col).toBe(6);
      expect(run.hop.active).toBe(true);
      expect(run.hop.toCol).toBe(5);
      expect(run.queued).toBe(NONE);
      advance(run, 550);
      expect(run.player.col).toBe(5);
      const other = createRun(1); place(other, 0, 0);
      step(other, 1, request(RIGHT)); step(other, 1, request(LEFT));
      expect(other.queued).toBe(LEFT);
      advance(other, 1098);
      expect(other.player.col).toBe(0);
      expect(other.hops).toBe(2);
   });

   it("has no mid-hop steering, preserves leftover time and never rewards lateral/revisited rows", () => {
      const run = createRun(1); place(run, 0, 3);
      step(run, 50, request(LEFT));
      expect(run.player.x).toBeCloseTo(-1.6 * 50 / 550, 12);
      step(run, 50, request(RIGHT));
      expect(run.player.x).toBeCloseTo(-1.6 * 100 / 550, 12);
      advance(run, 425);
      const ev = step(run, 50, IDLE);
      expect(ev.landedRow).toBe(0);
      expect(run.hop.elapsedMs).toBe(25);
      expect(run.player.x).toBeCloseTo(-1.6 + 1.6 * 25 / 550, 12);
      expect(run.score).toBe(0);
   });

   it("sweeps a moving car past a stationary bird and freezes every vehicle at the fractional contact", () => {
      const run = createRun(1); place(run, 1, 3, 120000);
      const lane = laneFor(run, 1)!;
      lane.kind = 0; lane.speed = 8; lane.direction = 1; lane.packSize = 1;
      lane.startMs = 0; lane.phaseMs = 690.5; lane.travelMs = 1850;
      syncTraffic(run, run.timeMs);
      const beforeScore = run.score;
      expect(step(run, 50, IDLE).ended).toBe("lose");
      expect(run.hitAtMs).toBeCloseTo(120024.5, 8); // x -1.876 -> -1.68, exactly touching
      expect(Number.isInteger(run.timeMs)).toBe(true);
      expect(run.timeMs).toBe(120024);
      expect(run.remainder).toBeCloseTo(0.5, 8);
      const hit = run.vehicles[run.hitVehicle];
      expect(hit.x).toBeCloseTo(-1.68, 10);
      expect(run.player.x).toBe(0);
      expect(run.score).toBe(beforeScore);
      const frozen = run.vehicles.map((v) => [v.x, v.z, v.active]);
      expect(step(run, 50, PRESS).ended).toBe(null);
      expect(run.vehicles.map((v) => [v.x, v.z, v.active])).toEqual(frozen);
      const touching = createRun(1); place(touching, 1, 3, 120000);
      const l = laneFor(touching, 1)!;
      l.kind = 0; l.speed = 8; l.direction = 1; l.packSize = 1; l.startMs = 0; l.phaseMs = 715; l.travelMs = 1850;
      expect(step(touching, 1, IDLE).ended).toBe("lose");
      expect(touching.hitAtMs).toBeCloseTo(120000, 8);
   });

   it("a swept contact at landing beats points and clears the queue; time-up beats a final callback", () => {
      const run = createRun(2); place(run, 180, 3, 200000);
      const l = laneFor(run, 181)!;
      l.kind = 2; l.speed = 8; l.direction = -1; l.packSize = 1; l.startMs = 0; l.travelMs = 1975; l.phaseMs = 4165;
      step(run, 50, PRESS); step(run, 50, PRESS);
      advance(run, 450);
      expect(run.ended).toBe("lose");
      expect(run.hitAtMs).toBeCloseTo(200550, 6);
      expect(run.furthest).toBe(0);
      expect(run.score).toBe(2700);
      expect(run.queued).toBe(NONE);
      const timeup = createRun(0); advance(timeup, 1800000 - 1);
      expect(step(timeup, 1, PRESS).ended).toBe("timeup");
      expect(timeup.score).toBe(0);
   });

   it("lands on the far-side once, awards 110, preserves absolute position and discards cross-level queue", () => {
      const run = createRun(2); place(run, 19, 3, 120000);
      const lane = laneFor(run, 19)!;
      lane.phaseMs = 9500; // the complete departure is in its quiet window
      const preview = descriptor(laneFor(run, 21)!);
      step(run, 50, PRESS); step(run, 50, request(LEFT));
      advance(run, 450);
      expect(run.ended).toBe(null);
      expect(run.events.levelChanged).toBe(2);
      expect(run.events.delta).toBe(110);
      expect(run.score).toBe(300);
      expect(run.completed).toBe(1);
      expect(run.furthest).toBe(0);
      expect(run.player.row).toBe(20);
      expect(run.player.z).toBe(-36);
      expect(run.queued).toBe(NONE);
      expect(run.hop.active).toBe(false);
      expect(descriptor(laneFor(run, 21)!)).toEqual(preview);
      step(run, 50, request(DOWN));
      expect(run.hop.active).toBe(false);
      expect(run.score).toBe(300);
   });
});

describe("pigeon-crossing clock, scoring and parity", () => {
   it("carries fractional milliseconds, ignores invalid dt and clamps at 50 ms", () => {
      const run = createRun(1);
      for (const dt of [0, -1, NaN, Infinity, -Infinity]) step(run, dt, PRESS);
      expect(run.timeMs).toBe(0);
      step(run, 0.25, IDLE); step(run, 0.25, IDLE); step(run, 0.25, IDLE);
      expect(run.timeMs).toBe(0);
      expect(run.remainder).toBe(0.75);
      step(run, 0.25, IDLE); step(run, 300, IDLE);
      expect(run.timeMs).toBe(51);
      const rng = createRng(50);
      let counted = 51;
      for (let i = 0; i < 1000; i++) {
         const dt = 1 + rng() * 49; counted += dt; step(run, dt, IDLE);
         expect(run.timeMs).toBeLessThanOrEqual(counted + 1e-8);
         expect(counted - run.timeMs).toBeLessThan(1 + 1e-8);
         expect(run.remainder).toBeGreaterThanOrEqual(0);
         expect(run.remainder).toBeLessThan(1);
      }
   });

   it("traffic and hop poses are frame-rate independent at common simulation instants", () => {
      const snapshots = [];
      for (const pattern of [() => 8.3, () => 16.7, () => 50, (() => { const r = createRng(3); return () => 1 + r() * 49; })()]) {
         const run = createRun(8);
         advance(run, 3050, pattern);
         step(run, 1, request(LEFT));
         advance(run, 549, pattern);
         step(run, 1, request(RIGHT)); advance(run, 549, pattern);
         advance(run, 1000, pattern);
         snapshots.push([run.timeMs, run.player.x, run.player.z, run.hops, run.score, run.vehicles.map((v) => [v.x, v.active])]);
      }
      for (const s of snapshots) expect(s).toEqual(snapshots[0]);
   });

   it("perfect and adversarial bots respect the strong timed-row bound and both score caps at every cadence", () => {
      let best = 0;
      const minuteScores: number[] = [];
      for (const ms of [8.3, 16.7, 50, -1]) {
         const rng = createRng(123);
         const dt = ms === -1 ? () => 1 + rng() * 49 : () => ms;
         const run = measure(7, dt, 120000);
         expect(run.ended).toBe(null);
         expect(run.score).toBeGreaterThan(600);
         best = Math.max(best, run.score * 60000 / run.timeMs);
         for (const seed of [1, 2, 3]) {
            const attack = measure(seed, dt, 20000, true);
            if (attack.ended) expect(withinServerLimits(attack.score, attack.hitAtMs, LIMITS)).toBe(true);
         }
      }
      const long = createRun(7), input = createStepInput();
      let nextMinute = 60000;
      for (let i = 0; !long.ended && i < 36001; i++) {
         viewFor(long); step(long, 50, botInput(long, input));
         if (long.timeMs >= nextMinute) { minuteScores.push(long.score); nextMinute += 60000; }
         const n = 20 * long.completed + long.furthest;
         if (n && long.timeMs < 3050 + 550 * n) throw new Error("Untimed progress");
         if (capScore(long.score, long.timeMs, LIMITS) !== long.score) throw new Error("Clamp was active");
      }
      expect(long.ended).toBe("timeup");
      expect(long.timeMs).toBe(1800000);
      expect(long.score).toBeLessThanOrEqual(48970);
      expect(withinServerLimits(long.score, long.timeMs, LIMITS)).toBe(true);
      expect(minuteScores).toHaveLength(30);
      const bestMinute = Math.max(minuteScores[0], ...minuteScores.slice(1).map((v, i) => v - minuteScores[i]));
      console.log(`Pigeon measured: best average ${best.toFixed(2)} pts/min over 2-minute runs; best full-minute gain ${bestMinute}; 30-minute score ${long.score}`);
   }, 15000);

   it("pins every theoretical progress prefix and the unreachable 50000 threshold", () => {
      for (let n = 0; n <= 3267; n++) {
         const score = scoreFor(Math.floor(n / 20), n % 20), time = 3050 + 550 * n;
         expect(capScore(score, time, LIMITS)).toBe(score);
         expect(withinServerLimits(score, time, LIMITS)).toBe(true);
      }
      expect(scoreFor(163, 7)).toBe(48970);
      expect(scoreFor(166, 19)).toBe(49990);
      expect(scoreFor(167, 0)).toBe(50100);
      expect(3050 + 550 * 3340).toBe(1840050);
      // the limits: 28 points/s is the tightest integer rate the no-traffic bound allows (S/t < 300/11
      // = 27.27); 27 fails with zero waits from level 28 on (8400 at 311050 ms > 27 x 311.05 = 8398)
      expect(LIMITS).toMatchObject({ kind: "points", maxScore: 50000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 28 });
      expect(scoreFor(28, 0) * 1000).toBeGreaterThan((LIMITS.maxPointsPerSec - 1) * (3050 + 550 * 560));
      expect(withinServerLimits(scoreFor(28, 0), 3050 + 550 * 560, LIMITS)).toBe(true);
      // integer slack 28 · (3050 + 550n) − 1000 S = 85400 + 8000k + 5400r > 0 for n = 20k + r
      for (const [k, r] of [[0, 0], [0, 19], [163, 7], [166, 19]]) {
         const n = 20 * k + r;
         expect(28 * (3050 + 550 * n) - 1000 * scoreFor(k, r)).toBe(85400 + 8000 * k + 5400 * r);
      }
      // the rate alone reaches 50000 only at a claimed 1785715 ms
      expect(withinServerLimits(50000, 1785714, LIMITS)).toBe(false);
      expect(withinServerLimits(50000, 1785715, LIMITS)).toBe(true);
      expect(capScore(3000, 30000, LIMITS)).toBe(840);
   });

   it("real store counts countdown residuals and pause, then holds the ended scene for 800 ms", () => {
      const store = createArcadeStore(); store.getState().configure({ durationMs: 1800000 }); store.getState().markReady(); store.getState().start();
      for (let i = 0; i < 59; i++) advanceRunClock(store, 0.05);
      advanceRunClock(store, 0.047); advanceRunClock(store, 0.01);
      expect(store.getState().elapsedMs).toBeCloseTo(7, 8);
      const run = createRun(3); step(run, playedFrameDt(store.getState()) * 1000, IDLE);
      const rng = createRng(9), input = createStepInput();
      for (let i = 0; i < 1200; i++) {
         if (i === 500) store.getState().pause();
         if (i === 505) store.getState().resume();
         const before = run.timeMs;
         advanceRunClock(store, i % 4 ? 0.001 + rng() * 0.049 : 0.3);
         const dt = playedFrameDt(store.getState());
         if (dt) { viewFor(run); const ev = step(run, dt * 1000, botInput(run, input)); if (ev.delta) store.getState().addScore(ev.delta); if (ev.levelChanged !== NONE) store.getState().setStat("level", ev.levelChanged); }
         else expect(run.timeMs).toBe(before);
         expect(run.timeMs).toBeLessThanOrEqual(store.getState().elapsedMs + 1e-8);
         expect(store.getState().elapsedMs - run.timeMs).toBeLessThan(1 + 1e-8);
      }
      expect(run.score).toBe(store.getState().score);
      for (const reason of ["lose", "timeup"] as const) {
         const ending = createArcadeStore(); ending.getState().configure({ durationMs: 1800000 }); ending.getState().markReady(); ending.getState().start();
         advanceRunClock(ending, 0.05); ending.getState().end(reason);
         const frozen = structuredClone(run);
         for (let ms = 0; ms < 750; ms += 50) { advanceRunClock(ending, 0.05); expect(playedFrameDt(ending.getState())).toBe(0); expect(isResultShown(ending.getState())).toBe(false); }
         advanceRunClock(ending, 0.05); expect(isResultShown(ending.getState())).toBe(true);
         expect(run).toEqual(frozen);
      }
      store.getState().restart();
      expect(store.getState().elapsedMs).toBe(0);
      expect(createRun(4).score).toBe(0);
   });

   it("step and its fills allocate no objects, arrays, closures or local PRNG/sweep implementations", () => {
      const text = readFileSync(new URL("./rules.ts", import.meta.url), "utf8");
      const source = ts.createSourceFile("rules.ts", text, ts.ScriptTarget.Latest, true);
      const funcs = new Map<string, ts.FunctionDeclaration>();
      for (const n of source.statements) if (ts.isFunctionDeclaration(n) && n.name) funcs.set(n.name.text, n);
      const seen = new Set<string>();
      // methods that return a new array, object, iterator, string or function (review: a
      // `void run.vehicles.slice(0, 0)` in the step loop used to pass)
      const allocatingMethods = new Set(["slice", "splice", "map", "filter", "concat", "flat", "flatMap", "from", "of", "split", "join", "keys", "values", "entries", "bind", "toSorted", "toReversed", "toSpliced", "with", "fill", "assign", "create", "structuredClone", "toString", "toFixed"]);
      const inspect = (name: string): void => {
         if (seen.has(name)) return; seen.add(name);
         const body = funcs.get(name)?.body;
         expect(body, name).toBeDefined();
         const visit = (n: ts.Node): void => {
            if (ts.isNewExpression(n) || ts.isObjectLiteralExpression(n) || ts.isArrayLiteralExpression(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) throw new Error(`Allocation in ${name}`);
            if (ts.isSpreadElement(n) || ts.isSpreadAssignment(n) || ts.isTemplateExpression(n)) throw new Error(`Allocation in ${name}: ${n.getText(source)}`);
            if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && allocatingMethods.has(n.expression.name.text)) throw new Error(`Allocating call in ${name}: ${n.getText(source)}`);
            if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "structuredClone") throw new Error(`Allocating call in ${name}: ${n.getText(source)}`);
            if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && funcs.has(n.expression.text)) inspect(n.expression.text);
            ts.forEachChild(n, visit);
         };
         if (body) visit(body);
      };
      inspect("step"); inspect("fillHorizon"); inspect("applyFallback");
      expect(text).toMatch(/import .*rngNext.*core\/math/);
      expect(text).toMatch(/import .*sweptAabbXZ.*core\/collision/);
      expect(text).not.toMatch(/Math\.random\s*\(|Date\.now\s*\(|performance\.now\s*\(|input\.swipe|input\.moveX|input\.moveY|0x6d2b79f5/);
   });
});
