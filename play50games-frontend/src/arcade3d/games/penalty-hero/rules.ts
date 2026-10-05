// Penalty Hero rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
// Scene draws the seed and calls step() with the frame dt in milliseconds. README.md is the design.
//
// Phase timers advance only by dtMs. Height of the reticle is a function of aim time, not a
// stored clock. Keeper draws use integer weights and never look at the zone just chosen.

import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { penaltyHeroMeta } from "./meta";

export { createRng };

// ---------- tuning ----------

export const SHOTS = 10;
export const AIM_TIMEOUT_MS = 20_000;
export const RUNUP_MS = 700;
export const FLIGHT_MS = 500;
export const HOLD_MS = 400;
export const CYCLE_MS = RUNUP_MS + FLIGHT_MS + HOLD_MS;

/** One untimed countdown frame, at most core MAX_FRAME_DT. Submitted duration can be this much shorter. */
export const UNTIMED_FRAME_MS = 50;
/** 10 * 1600 - 50. The rules clock itself is at least 16000; this is the submitted floor. */
export const MIN_SUBMITTED_MS = SHOTS * CYCLE_MS - UNTIMED_FRAME_MS;

export const FIRST_GOAL_POINTS = 100;
export const NEXT_GOAL_POINTS = 150;
export const MAX_SCORE = penaltyHeroMeta.scoring.maxScore;
export const MAX_POINTS_PER_SEC = penaltyHeroMeta.scoring.maxPointsPerSec;

export const RETICLE_PERIOD_S = 1.2;
export const RETICLE_AMPLITUDE = 0.6;
export const RETICLE_BAND = 0.25;
/** Mixes the run seed into the reticle stream so those draws cannot move the keeper stream. */
export const RETICLE_SEED_MIX = 0x9e3779b9;

export const INITIAL_WEIGHT = 2;
export const WIDE_X = 4.16;

export const ZONES = [
   "top-left",
   "top-centre",
   "top-right",
   "bottom-left",
   "bottom-centre",
   "bottom-right",
] as const;
export type ZoneId = (typeof ZONES)[number];

/** Column 0..2 is left/centre/right. Row 0 is bottom, row 1 is top. */
export const ZONE_CENTRE_X = [-2.44, 0, 2.44] as const;
export const ZONE_CENTRE_Y = [0.61, 1.83] as const;

const ZONE_LIMIT_MS = { runup: RUNUP_MS, flight: FLIGHT_MS, hold: HOLD_MS } as const;

export type Phase = "aim" | "runup" | "flight" | "hold";
export type ShotResult = "goal" | "saved" | "wide" | "timeout" | "none";

// ---------- pure helpers ----------

export function reticleSeed(seed: number): number {
   return (seed ^ RETICLE_SEED_MIX) >>> 0;
}

/** -1 below -0.5, +1 above +0.5, otherwise 0. The threshold itself is still the dead zone. */
export function axisClass(value: number): -1 | 0 | 1 {
   if (value < -0.5) return -1;
   if (value > 0.5) return 1;
   return 0;
}

export function zoneIndex(col: number, row: number): number {
   return row === 1 ? col : 3 + col;
}

export function reticleOffset(aimMs: number, phase: number): number {
   const aimSeconds = aimMs / 1000;
   return RETICLE_AMPLITUDE * Math.sin((2 * Math.PI * aimSeconds) / RETICLE_PERIOD_S + phase);
}

export function isAccurate(offset: number): boolean {
   return Math.abs(offset) <= RETICLE_BAND;
}

/**
 * Integer weighted index. `unit` is in [0, 1). The ticket is floor(unit * sum), then a walk of
 * the cumulative weights. The selected shot is not an argument: the dive cannot read it.
 */
export function drawWeightedIndex(weights: readonly number[], unit: number): number {
   let sum = 0;
   for (let i = 0; i < weights.length; i++) sum += weights[i];
   let ticket = Math.floor(unit * sum);
   if (ticket >= sum) ticket = sum - 1;
   if (ticket < 0) ticket = 0;
   for (let i = 0; i < weights.length; i++) {
      ticket -= weights[i];
      if (ticket < 0) return i;
   }
   return weights.length - 1;
}

/** Points for a goal struck while the streak (goals since the last miss) is `streakBefore`. */
export function pointsForGoal(streakBefore: number): number {
   return streakBefore > 0 ? NEXT_GOAL_POINTS : FIRST_GOAL_POINTS;
}

/** min(score, 1500, floor(150 * duration_s)), with duration_s = durationMs / 1000. */
export function finalScore(score: number, durationMs: number): { score: number; durationMs: number } {
   const budget = Math.floor((MAX_POINTS_PER_SEC * durationMs) / 1000);
   return { score: Math.min(score, MAX_SCORE, budget), durationMs };
}

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, penaltyHeroMeta.scoring);
}

/**
 * Safety net only (core/limits.ts capScore with meta.ts limits). Rounds elapsed the way GameShell
 * does, then min(score, 1500, floor(150 * roundedSeconds)). Reachable finished runs never hit it.
 */
export function capScore(score: number, elapsedMs: number): number {
   return capToLimits(score, elapsedMs, penaltyHeroMeta.scoring);
}

// ---------- run ----------

export interface StepEvents {
   aimMoved: boolean;
   shot: boolean;
   goal: boolean;
   saved: boolean;
   wide: boolean;
   timeout: boolean;
   ended: "win" | null;
}

export interface StepInput {
   moveX?: number;
   moveY?: number;
   jumpPressed?: boolean;
   actionPressed?: boolean;
   /** Zone already projected by Scene. null or omitted: no tap, or a tap that missed the goal. */
   zoneId?: ZoneId | null;
}

interface Pending {
   kind: "none" | "shot" | "timeout";
   accurate: boolean;
   zone: number;
   keeper: number;
   committed: boolean;
}

export interface RunState {
   seed: number;
   elapsedMs: number;
   phase: Phase;
   /** Time already spent in run-up, flight or hold. */
   phaseMs: number;
   aimMs: number;
   /** 0 left, 1 centre, 2 right. */
   col: number;
   /** 0 bottom, 1 top. moveY < 0 moves toward the top. */
   row: number;
   latchX: -1 | 0 | 1;
   latchY: -1 | 0 | 1;
   weights: number[];
   shotsDone: number;
   goals: number;
   streak: number;
   score: number;
   ended: "win" | null;
   reticlePhase: number;
   /** Reticle offset sampled when the current shot locked. */
   reticle: number;
   targetX: number;
   targetY: number;
   keeperIndex: number;
   lastResult: ShotResult;
   pending: Pending;
   events: StepEvents;
   keeperRng: () => number;
   reticleRng: () => number;
}

function makeEvents(): StepEvents {
   return { aimMoved: false, shot: false, goal: false, saved: false, wide: false, timeout: false, ended: null };
}

function clearEvents(events: StepEvents): void {
   events.aimMoved = false;
   events.shot = false;
   events.goal = false;
   events.saved = false;
   events.wide = false;
   events.timeout = false;
   events.ended = null;
}

function indexOfZone(id: ZoneId): number {
   for (let i = 0; i < ZONES.length; i++) {
      if (ZONES[i] === id) return i;
   }
   return -1;
}

export function createRun(seed: number): RunState {
   const weights = [INITIAL_WEIGHT, INITIAL_WEIGHT, INITIAL_WEIGHT, INITIAL_WEIGHT, INITIAL_WEIGHT, INITIAL_WEIGHT];
   const reticleRng = createRng(reticleSeed(seed));
   const state: RunState = {
      seed,
      elapsedMs: 0,
      phase: "aim",
      phaseMs: 0,
      aimMs: 0,
      col: 1,
      row: 0,
      latchX: 0,
      latchY: 0,
      weights,
      shotsDone: 0,
      goals: 0,
      streak: 0,
      score: 0,
      ended: null,
      reticlePhase: 0,
      reticle: 0,
      targetX: ZONE_CENTRE_X[1],
      targetY: ZONE_CENTRE_Y[0],
      keeperIndex: -1,
      lastResult: "none",
      pending: { kind: "none", accurate: false, zone: zoneIndex(1, 0), keeper: -1, committed: false },
      events: makeEvents(),
      keeperRng: createRng(seed),
      reticleRng,
   };
   state.reticlePhase = reticleRng() * Math.PI * 2;
   return state;
}

function aimHighlight(state: RunState, classX: -1 | 0 | 1, classY: -1 | 0 | 1): void {
   const crossX = classX !== 0 && classX !== state.latchX;
   const crossY = classY !== 0 && classY !== state.latchY;
   if (state.phase === "aim" && (crossX || crossY)) {
      let moved = false;
      if (crossX) {
         const col = state.col + classX;
         if (col >= 0 && col <= 2) {
            state.col = col;
            moved = true;
         }
      } else {
         const row = state.row + (classY < 0 ? 1 : -1);
         if (row >= 0 && row <= 1) {
            state.row = row;
            moved = true;
         }
      }
      if (moved) state.events.aimMoved = true;
   }
   state.latchX = classX;
   state.latchY = classY;
}

function placeTarget(state: RunState, accurate: boolean, offset: number): void {
   state.targetY = ZONE_CENTRE_Y[state.row];
   if (accurate) state.targetX = ZONE_CENTRE_X[state.col];
   else state.targetX = Math.sign(offset) * WIDE_X;
}

/** Draw the keeper from weights only, then reinforce the aimed zone. Timeouts never call this. */
function lockShot(state: RunState): void {
   const zone = zoneIndex(state.col, state.row);
   const offset = reticleOffset(state.aimMs, state.reticlePhase);
   const accurate = isAccurate(offset);
   const keeper = drawWeightedIndex(state.weights, state.keeperRng());
   state.weights[zone] += 1;
   state.reticle = offset;
   state.keeperIndex = keeper;
   placeTarget(state, accurate, offset);
   const pending = state.pending;
   pending.kind = "shot";
   pending.accurate = accurate;
   pending.zone = zone;
   pending.keeper = keeper;
   pending.committed = false;
   state.phase = "runup";
   state.phaseMs = 0;
   state.events.shot = true;
}

function lockTimeout(state: RunState): void {
   const pending = state.pending;
   pending.kind = "timeout";
   pending.accurate = false;
   pending.zone = zoneIndex(state.col, state.row);
   pending.keeper = -1;
   pending.committed = false;
   state.keeperIndex = -1;
   state.reticle = reticleOffset(state.aimMs, state.reticlePhase);
   state.phase = "runup";
   state.phaseMs = 0;
}

function commit(state: RunState): void {
   const pending = state.pending;
   if (pending.committed || pending.kind === "none") return;
   pending.committed = true;
   if (pending.kind === "timeout" || !pending.accurate) {
      state.streak = 0;
      if (pending.kind === "timeout") {
         state.events.timeout = true;
         state.lastResult = "timeout";
      } else {
         state.events.wide = true;
         state.lastResult = "wide";
      }
      return;
   }
   if (pending.keeper === pending.zone) {
      state.streak = 0;
      state.events.saved = true;
      state.lastResult = "saved";
      return;
   }
   state.score += pointsForGoal(state.streak);
   state.streak += 1;
   state.goals += 1;
   state.events.goal = true;
   state.lastResult = "goal";
}

function finishPhase(state: RunState): void {
   if (state.phase === "runup") {
      state.phase = "flight";
      state.phaseMs = 0;
      return;
   }
   if (state.phase === "flight") {
      commit(state);
      state.phase = "hold";
      state.phaseMs = 0;
      return;
   }
   state.shotsDone += 1;
   if (state.shotsDone >= SHOTS) {
      state.ended = "win";
      state.events.ended = "win";
      return;
   }
   state.phase = "aim";
   state.phaseMs = 0;
   state.aimMs = 0;
   state.reticlePhase = state.reticleRng() * Math.PI * 2;
   state.pending.kind = "none";
   state.pending.committed = false;
}

function consume(state: RunState, dtMs: number): void {
   let left = dtMs;
   let guard = 0;
   while (left > 1e-6 && !state.ended && guard++ < 80) {
      if (state.phase === "aim") {
         const room = AIM_TIMEOUT_MS - state.aimMs;
         if (room <= 1e-6) {
            lockTimeout(state);
            continue;
         }
         if (left < room) {
            state.aimMs += left;
            left = 0;
         } else {
            left -= room;
            state.aimMs = AIM_TIMEOUT_MS;
            lockTimeout(state);
         }
         continue;
      }
      const limit = ZONE_LIMIT_MS[state.phase];
      const room = limit - state.phaseMs;
      if (room <= 1e-6) {
         finishPhase(state);
         continue;
      }
      if (left < room) {
         state.phaseMs += left;
         left = 0;
      } else {
         left -= room;
         state.phaseMs = limit;
         finishPhase(state);
      }
   }
}

function applyZone(state: RunState, zoneId: ZoneId): void {
   const index = indexOfZone(zoneId);
   if (index < 0) return;
   state.col = index % 3;
   state.row = index < 3 ? 1 : 0;
}

/**
 * Advance one frame. dtMs <= 0 does nothing. The event object is reused; read it before the next step.
 * A shot or timeout locks first, then this frame's dt is spent across run-up, flight and hold.
 * Timeout on this frame outranks a new shot. The shooting edge is not reused when the next AIM starts.
 */
export function step(state: RunState, dtMs: number, input: StepInput = {}): StepEvents {
   const events = state.events;
   clearEvents(events);
   if (state.ended || !(dtMs > 0)) return events;

   const classX = axisClass(input.moveX ?? 0);
   const classY = axisClass(input.moveY ?? 0);
   aimHighlight(state, classX, classY);

   if (state.phase === "aim" && state.aimMs + dtMs < AIM_TIMEOUT_MS) {
      const tapped = typeof input.zoneId === "string";
      if (tapped) applyZone(state, input.zoneId as ZoneId);
      if (tapped || input.jumpPressed === true || input.actionPressed === true) lockShot(state);
   }

   consume(state, dtMs);
   state.elapsedMs += dtMs;
   return events;
}
