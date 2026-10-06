import { sweptAabbXZ, type AABB, type SweepHit } from "@/arcade3d/core/collision";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { rngNext } from "@/arcade3d/core/math";
import { pigeonCrossingMeta } from "./meta";

export const COLUMNS = 7;
export const COLUMN_PITCH = 1.6;
export const ROW_PITCH = 1.8;
export const ROWS_PER_LEVEL = 20;
export const HOP_MS = 550;
export const PREVIEW_MS = 3050;
export const MAX_STEP_MS = 50;
export const DURATION_MS = 1800000;
export const CYCLE_MS = 12000;
export const CLEAR_FROM_MS = 9000;
export const TIER_CAP = 10;
export const LANE_SLOTS = 40;
export const VEHICLES_PER_LANE = 4;
export const VEHICLE_SLOTS = LANE_SLOTS * VEHICLES_PER_LANE;
export const PLAY_HALF_WIDTH = 5.6;
export const SPAWN_MARGIN = 0.4;
export const COVER_INNER_X = PLAY_HALF_WIDTH + SPAWN_MARGIN;
export const ROW_POINTS = 10;
export const LEVEL_BONUS = 100;
export const LEVEL_SEED_MIX = 0x9e3779b9;
export const PIGEON = { halfX: 0.28, halfZ: 0.25, height: 1.25, hopHeight: 0.25 } as const;
export const GRASS_ROWS = [0, 3, 6, 9, 12, 15, 18, 20] as const;
export const VEHICLE_TYPES = [
   { name: "car", length: 2.8, depth: 1.15, baseSpeed: 3 },
   { name: "taxi", length: 3.1, depth: 1.2, baseSpeed: 3.4 },
   { name: "van", length: 3.8, depth: 1.3, baseSpeed: 2.6 },
] as const;
const COLUMN_X = [-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8] as const;
export const NONE = -1;
export const UP = 0;
export const DOWN = 1;
export const LEFT = 2;
export const RIGHT = 3;
type EndReason = "lose" | "timeup";

export interface StepInput {
   pressed: { up: boolean; down: boolean; left: boolean; right: boolean };
   /** Release tap anywhere means forward; swipes already appear in pressed. */
   tap?: { x: number; y: number } | null;
}

export interface Lane {
   slot: number;
   row: number;
   level: number;
   localRow: number;
   road: boolean;
   group: number;
   kind: number;
   direction: number;
   phaseMs: number;
   speed: number;
   packSize: number;
   gap: number;
   headwayMs: number;
   travelMs: number;
   startMs: number;
   fallback: boolean;
}

export interface Vehicle {
   row: number;
   kind: number;
   member: number;
   direction: number;
   x: number;
   z: number;
   active: boolean;
}

export interface StepEvents {
   hopStarted: boolean;
   landedRow: number;
   delta: number;
   levelChanged: number;
   hitVehicle: number;
   ended: EndReason | null;
}

export interface PigeonRun {
   seed: number;
   forceFallback: boolean;
   rng: { s: number };
   lanes: Lane[];
   vehicles: Vehicle[];
   horizonMin: number;
   horizonMax: number;
   horizonBlocked: boolean;
   timeMs: number;
   remainder: number;
   /** Exact contact time for the frozen poses; timeMs remains an integer. */
   poseMs: number;
   player: { row: number; col: number; x: number; y: number; z: number };
   hop: { active: boolean; fromRow: number; fromCol: number; toRow: number; toCol: number; elapsedMs: number };
   queued: number;
   level: number;
   completed: number;
   furthest: number;
   hops: number;
   score: number;
   hitAtMs: number;
   hitVehicle: number;
   ended: EndReason | null;
   ranked: boolean;
   events: StepEvents;
   scratch: { pigeon: AABB; vehicle: AABB; delta: { x: number; z: number }; hit: SweepHit; hitVehicle: number };
}

export function columnX(col: number): number {
   return COLUMN_X[col];
}

export function isGrass(row: number): boolean {
   return row === ROWS_PER_LEVEL || (row >= 0 && row < ROWS_PER_LEVEL && row % 3 === 0);
}

export function levelSeedFor(seed: number, level: number): number {
   return (seed ^ Math.imul(level, LEVEL_SEED_MIX)) >>> 0;
}

export function scoreFor(completed: number, furthest: number): number {
   return (ROWS_PER_LEVEL * ROW_POINTS + LEVEL_BONUS) * completed + ROW_POINTS * furthest;
}

export function createStepInput(): StepInput {
   return { pressed: { up: false, down: false, left: false, right: false }, tap: null };
}

export function createRun(seed: number, horizonRows = 28, forceFallback = false): PigeonRun {
   const lanes: Lane[] = [];
   const vehicles: Vehicle[] = [];
   for (let slot = 0; slot < LANE_SLOTS; slot++) {
      lanes.push({ slot, row: NONE, level: 0, localRow: 0, road: false, group: NONE, kind: 0, direction: 1, phaseMs: 0, speed: 0, packSize: 0, gap: 0, headwayMs: 0, travelMs: 0, startMs: 0, fallback: false });
      for (let member = 0; member < VEHICLES_PER_LANE; member++) vehicles.push({ row: NONE, kind: 0, member, direction: 1, x: 0, z: 0, active: false });
   }
   const run: PigeonRun = {
      seed: seed >>> 0, forceFallback, rng: { s: 0 }, lanes, vehicles,
      horizonMin: NONE, horizonMax: NONE, horizonBlocked: false,
      timeMs: 0, remainder: 0, poseMs: 0,
      player: { row: 0, col: 3, x: 0, y: 0, z: 0 },
      hop: { active: false, fromRow: 0, fromCol: 3, toRow: 0, toCol: 3, elapsedMs: 0 },
      queued: NONE, level: 1, completed: 0, furthest: 0, hops: 0, score: 0,
      hitAtMs: NONE, hitVehicle: NONE, ended: null, ranked: false,
      events: { hopStarted: false, landedRow: NONE, delta: 0, levelChanged: NONE, hitVehicle: NONE, ended: null },
      scratch: {
         pigeon: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: PIGEON.height, z: 0 } },
         vehicle: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1.5, z: 0 } },
         delta: { x: 0, z: 0 }, hit: { time: 0, normalX: 0, normalZ: 0 }, hitVehicle: NONE,
      },
   };
   fillHorizon(run, 0, horizonRows - 1);
   return run;
}

/** Inclusive camera-derived guarded row range. Reject before changing any visible slot. */
export function fillHorizon(run: PigeonRun, firstRow: number, lastRow: number): boolean {
   if (!Number.isSafeInteger(firstRow) || !Number.isSafeInteger(lastRow) || firstRow < 0 || lastRow < firstRow || lastRow - firstRow >= LANE_SLOTS ||
      run.player.row < firstRow || run.player.row > lastRow ||
      (run.hop.active && (run.hop.toRow < firstRow || run.hop.toRow > lastRow))) {
      run.horizonBlocked = true;
      return false;
   }
   run.horizonBlocked = false;
   if (run.horizonMin === firstRow && run.horizonMax === lastRow) return true;
   run.horizonMin = firstRow;
   run.horizonMax = lastRow;
   for (let row = firstRow; row <= lastRow; row++) {
      const lane = run.lanes[row % LANE_SLOTS];
      if (lane.row !== row) fillLane(run, lane, row);
   }
   for (let slot = 0; slot < LANE_SLOTS; slot++) {
      const lane = run.lanes[slot];
      if (lane.row < firstRow || lane.row > lastRow) {
         lane.row = NONE;
         lane.road = false;
         lane.packSize = 0;
      }
   }
   syncTraffic(run, run.poseMs);
   return true;
}

export function laneFor(run: PigeonRun, row: number): Lane | null {
   if (row < run.horizonMin || row > run.horizonMax) return null;
   const lane = run.lanes[row % LANE_SLOTS];
   return lane.row === row ? lane : null;
}

function fillLane(run: PigeonRun, lane: Lane, row: number): void {
   lane.row = row;
   lane.level = Math.floor(row / ROWS_PER_LEVEL) + 1;
   lane.localRow = row % ROWS_PER_LEVEL;
   lane.road = !isGrass(lane.localRow);
   lane.group = lane.road ? Math.floor((lane.localRow - 1) / 3) : NONE;
   lane.kind = 0;
   lane.direction = 1;
   lane.phaseMs = 0;
   lane.speed = 0;
   lane.packSize = 0;
   lane.gap = 0;
   lane.headwayMs = 0;
   lane.travelMs = 0;
   lane.startMs = 0;
   lane.fallback = false;
   if (!lane.road) return;
   const tier = Math.min(lane.level, TIER_CAP);
   const gap = 3 - 0.2 * (tier - 1);
   const pack = 1 + Math.floor((tier - 1) / 3);
   run.rng.s = levelSeedFor(run.seed, lane.level);
   // Replay the stable group/member draws. Filling order cannot change a group's phase.
   for (let group = 0; group <= lane.group; group++) {
      const phase = Math.floor(rngNext(run.rng) * CYCLE_MS);
      const direction = rngNext(run.rng) < 0.5 ? 1 : -1;
      for (let road = 0; road < (group === 6 ? 1 : 2); road++) {
         const draw = Math.floor(rngNext(run.rng) * 7);
         const kind = draw < 4 ? 0 : draw < 6 ? 1 : 2;
         const type = VEHICLE_TYPES[kind];
         const speed = Math.min(8, type.baseSpeed + 0.6 * (tier - 1));
         // Round headway up to whole ms, preserving the minimum bumper gap.
         const headway = Math.ceil((3.8 + gap) * 1000 / speed);
         const travel = 2 * (COVER_INNER_X + type.length / 2) * 1000 / speed;
         const maxStart = Math.floor(Math.min(2000, CLEAR_FROM_MS - travel - (pack - 1) * headway));
         const start = Math.floor(rngNext(run.rng) * (maxStart + 1));
         if (group * 3 + 1 + road !== lane.localRow) continue;
         lane.kind = kind;
         lane.direction = road === 0 ? direction : -direction;
         lane.phaseMs = phase;
         lane.speed = speed;
         lane.packSize = pack;
         lane.gap = gap;
         lane.headwayMs = headway;
         lane.travelMs = travel;
         lane.startMs = start;
         if (run.forceFallback || !validateLane(lane)) applyFallback(lane);
         return;
      }
   }
}

/** Validate the deadline as well as spacing; checking only the gap would allow blocked cycles. */
export function validateLane(lane: Lane): boolean {
   if (!lane.road) return lane.packSize === 0;
   if (!Number.isInteger(lane.kind) || lane.kind < 0 || lane.kind >= VEHICLE_TYPES.length ||
      !Number.isInteger(lane.level) || lane.level < 1 || (lane.direction !== 1 && lane.direction !== -1) ||
      !Number.isInteger(lane.phaseMs) || lane.phaseMs < 0 || lane.phaseMs >= CYCLE_MS) return false;
   const tier = Math.min(lane.level, TIER_CAP), type = VEHICLE_TYPES[lane.kind];
   const speed = Math.min(8, type.baseSpeed + 0.6 * (tier - 1));
   const gap = 3 - 0.2 * (tier - 1);
   const pack = lane.fallback ? 1 : 1 + Math.floor((tier - 1) / 3);
   const travel = 2 * (COVER_INNER_X + type.length / 2) * 1000 / speed;
   return lane.speed === speed && lane.gap === gap && lane.packSize === pack &&
      Number.isInteger(lane.headwayMs) && lane.headwayMs >= (3.8 + gap) * 1000 / speed &&
      lane.travelMs === travel && Number.isInteger(lane.startMs) && lane.startMs >= 0 && lane.startMs <= 2000 &&
      lane.startMs + (pack - 1) * lane.headwayMs + travel <= CLEAR_FROM_MS &&
      (!lane.fallback || (lane.kind === 0 && lane.startMs === 0));
}

export function applyFallback(lane: Lane): void {
   const tier = Math.min(lane.level, TIER_CAP);
   lane.kind = 0;
   lane.speed = Math.min(8, VEHICLE_TYPES[0].baseSpeed + 0.6 * (tier - 1));
   lane.gap = 3 - 0.2 * (tier - 1);
   lane.packSize = 1;
   lane.headwayMs = Math.ceil((3.8 + lane.gap) * 1000 / lane.speed);
   lane.travelMs = 2 * (COVER_INNER_X + VEHICLE_TYPES[0].length / 2) * 1000 / lane.speed;
   lane.startMs = 0;
   lane.fallback = true;
}

function phaseAt(time: number, phase: number): number {
   return ((time + phase) % CYCLE_MS + CYCLE_MS) % CYCLE_MS;
}

/** Positions always use run time, including rows filled late or during a paused refit. */
export function syncTraffic(run: PigeonRun, time: number): void {
   for (let slot = 0; slot < LANE_SLOTS; slot++) {
      const lane = run.lanes[slot];
      const type = VEHICLE_TYPES[lane.kind];
      const phase = phaseAt(time, lane.phaseMs);
      for (let member = 0; member < VEHICLES_PER_LANE; member++) {
         const vehicle = run.vehicles[slot * VEHICLES_PER_LANE + member];
         vehicle.row = lane.row;
         vehicle.kind = lane.kind;
         vehicle.direction = lane.direction;
         vehicle.z = lane.row === NONE ? 0 : -lane.row * ROW_PITCH;
         const age = phase - lane.startMs - member * lane.headwayMs;
         vehicle.active = lane.road && member < lane.packSize && age >= 0 && age < lane.travelMs;
         vehicle.x = lane.direction * (-(COVER_INNER_X + type.length / 2) + lane.speed * Math.max(0, Math.min(age, lane.travelMs)) / 1000);
      }
   }
}

/** Absolute first contact time, or Infinity. Scratch hitVehicle accompanies the scalar result. */
export function firstHit(run: PigeonRun, at: number, ms: number, fromX: number, fromZ: number, toX: number, toZ: number, fromRow: number, toRow: number): number {
   let earliest = Infinity;
   run.scratch.hitVehicle = NONE;
   const pb = run.scratch.pigeon, vb = run.scratch.vehicle, delta = run.scratch.delta;
   for (let side = 0; side < (fromRow === toRow ? 1 : 2); side++) {
      const row = side === 0 ? fromRow : toRow;
      const lane = laneFor(run, row);
      if (!lane || !lane.road) continue;
      const type = VEHICLE_TYPES[lane.kind], spawn = COVER_INNER_X + type.length / 2;
      for (let cycle = Math.floor((at + lane.phaseMs) / CYCLE_MS); cycle <= Math.floor((at + ms + lane.phaseMs) / CYCLE_MS); cycle++) {
         for (let member = 0; member < lane.packSize; member++) {
            const birth = cycle * CYCLE_MS - lane.phaseMs + lane.startMs + member * lane.headwayMs;
            const death = birth + lane.travelMs;
            const lo = Math.max(at, birth), hi = Math.min(at + ms, death);
            if (hi < lo || lo >= death) continue;
            const fraction = ms > 0 ? (lo - at) / ms : 0;
            const x = fromX + (toX - fromX) * fraction, z = fromZ + (toZ - fromZ) * fraction;
            const vx = lane.direction * (-spawn + lane.speed * (lo - birth) / 1000);
            // Normalize box edges to picometres. Otherwise 0.6800000000000002 - 0.28
            // can make an exact landing contact look just beyond the sweep's endpoint.
            pb.min.x = boxEdge(x - PIGEON.halfX); pb.max.x = boxEdge(x + PIGEON.halfX);
            pb.min.z = boxEdge(z - PIGEON.halfZ); pb.max.z = boxEdge(z + PIGEON.halfZ);
            vb.min.x = boxEdge(vx - type.length / 2); vb.max.x = boxEdge(vx + type.length / 2);
            vb.min.z = boxEdge(-row * ROW_PITCH - type.depth / 2); vb.max.z = boxEdge(-row * ROW_PITCH + type.depth / 2);
            const live = hi - lo;
            delta.x = (ms > 0 ? (toX - fromX) * live / ms : 0) - lane.direction * lane.speed * live / 1000;
            delta.z = ms > 0 ? (toZ - fromZ) * live / ms : 0;
            const hit = sweptAabbXZ(pb, delta, vb, run.scratch.hit);
            if (hit !== null && lo + live * hit < earliest) {
               earliest = lo + live * hit;
               run.scratch.hitVehicle = lane.slot * VEHICLES_PER_LANE + member;
            }
         }
      }
   }
   return earliest;
}

function boxEdge(value: number): number {
   return Math.round(value * 1e12) / 1e12;
}

function validRequest(run: PigeonRun, direction: number, row: number, col: number): boolean {
   if (direction === NONE) return false;
   const nextRow = row + (direction === UP ? 1 : direction === DOWN ? -1 : 0);
   const nextCol = col + (direction === LEFT ? -1 : direction === RIGHT ? 1 : 0);
   return nextCol >= 0 && nextCol < COLUMNS && nextRow >= run.completed * ROWS_PER_LEVEL &&
      nextRow <= (run.completed + 1) * ROWS_PER_LEVEL && laneFor(run, nextRow) !== null;
}

function beginHop(run: PigeonRun, direction: number): void {
   const hop = run.hop;
   hop.active = true;
   hop.fromRow = run.player.row;
   hop.fromCol = run.player.col;
   hop.toRow = hop.fromRow + (direction === UP ? 1 : direction === DOWN ? -1 : 0);
   hop.toCol = hop.fromCol + (direction === LEFT ? -1 : direction === RIGHT ? 1 : 0);
   hop.elapsedMs = 0;
   run.events.hopStarted = true;
}

function updatePigeon(run: PigeonRun): void {
   const hop = run.hop;
   const f = hop.elapsedMs / HOP_MS;
   run.player.x = columnX(hop.fromCol) + (columnX(hop.toCol) - columnX(hop.fromCol)) * f;
   run.player.z = -(hop.fromRow + (hop.toRow - hop.fromRow) * f) * ROW_PITCH;
   run.player.y = PIGEON.hopHeight * Math.sin(Math.PI * f);
}

function land(run: PigeonRun): void {
   const hop = run.hop;
   hop.active = false;
   run.player.row = hop.toRow;
   run.player.col = hop.toCol;
   run.player.x = columnX(hop.toCol);
   run.player.z = -hop.toRow * ROW_PITCH;
   run.player.y = 0;
   run.hops++;
   run.events.landedRow = hop.toRow;
   const localRow = hop.toRow - run.completed * ROWS_PER_LEVEL;
   if (localRow > run.furthest) run.furthest = localRow;
   if (localRow === ROWS_PER_LEVEL) {
      run.completed++;
      run.level++;
      run.furthest = 0;
      run.queued = NONE;
      run.events.levelChanged = run.level;
   }
   const nextScore = capScore(scoreFor(run.completed, run.furthest), run.timeMs, pigeonCrossingMeta.scoring);
   run.events.delta += nextScore - run.score;
   run.score = nextScore;
   const queued = run.queued;
   run.queued = NONE;
   if (validRequest(run, queued, run.player.row, run.player.col)) beginHop(run, queued);
}

function finish(run: PigeonRun, reason: EndReason): void {
   run.ended = reason;
   run.queued = NONE;
   run.events.ended = reason;
   run.ranked = withinServerLimits(run.score, run.timeMs, pigeonCrossingMeta.scoring);
}

/** dtMs is frameMs from useRunFrame (seconds * 1000); no wall-clock or held-axis input. */
export function step(run: PigeonRun, dtMs: number, input: StepInput): StepEvents {
   const events = run.events;
   events.hopStarted = false;
   events.landedRow = NONE;
   events.delta = 0;
   events.levelChanged = NONE;
   events.hitVehicle = NONE;
   events.ended = null;
   if (run.ended || run.horizonBlocked || !Number.isFinite(dtMs) || dtMs <= 0) return events;
   const accumulated = run.remainder + Math.min(MAX_STEP_MS, dtMs);
   let remaining = Math.floor(accumulated);
   run.remainder = accumulated - remaining;
   // Match RunClock's priority: its cap prevents the last simulation callback/award.
   if (run.timeMs + remaining >= DURATION_MS) {
      run.timeMs = DURATION_MS;
      finish(run, "timeup");
      return events;
   }
   const pressed = input.pressed;
   const direction = pressed.up ? UP : pressed.down ? DOWN : pressed.left ? LEFT : pressed.right ? RIGHT : input.tap ? UP : NONE;
   if (run.timeMs >= PREVIEW_MS) {
      if (run.hop.active) {
         if (run.queued === NONE && validRequest(run, direction, run.hop.toRow, run.hop.toCol)) run.queued = direction;
      } else if (validRequest(run, direction, run.player.row, run.player.col)) beginHop(run, direction);
   }
   while (remaining > 0) {
      if (run.timeMs < PREVIEW_MS) {
         const preview = Math.min(remaining, PREVIEW_MS - run.timeMs);
         run.timeMs += preview;
         run.poseMs = run.timeMs;
         remaining -= preview;
         continue;
      }
      const hop = run.hop;
      const ms = hop.active ? Math.min(remaining, HOP_MS - hop.elapsedMs) : remaining;
      const fromX = run.player.x, fromZ = run.player.z;
      const f = hop.active ? (hop.elapsedMs + ms) / HOP_MS : 0;
      const toX = hop.active ? columnX(hop.fromCol) + (columnX(hop.toCol) - columnX(hop.fromCol)) * f : fromX;
      const toZ = hop.active ? -(hop.fromRow + (hop.toRow - hop.fromRow) * f) * ROW_PITCH : fromZ;
      const contact = firstHit(run, run.timeMs, ms, fromX, fromZ, toX, toZ, hop.active ? hop.fromRow : run.player.row, hop.active ? hop.toRow : run.player.row);
      if (Number.isFinite(contact)) {
         if (hop.active) { hop.elapsedMs += contact - run.timeMs; updatePigeon(run); }
         run.poseMs = contact;
         run.timeMs = Math.floor(contact);
         run.remainder = contact - run.timeMs;
         run.hitAtMs = contact;
         run.hitVehicle = run.scratch.hitVehicle;
         events.hitVehicle = run.hitVehicle;
         syncTraffic(run, contact);
         finish(run, "lose");
         return events;
      }
      run.timeMs += ms;
      run.poseMs = run.timeMs;
      remaining -= ms;
      if (hop.active) {
         hop.elapsedMs += ms;
         updatePigeon(run);
         if (hop.elapsedMs === HOP_MS) land(run);
      }
   }
   syncTraffic(run, run.poseMs);
   return events;
}
