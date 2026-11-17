// Test-only bot for levels.bots.test.ts. Runtime code never imports this file.
// The human is the rules.test.ts sweeper: reaction 0.22 s, turn at π rad/s toward the statue
// with the least time left, flash when two would arrive within 2.2 s and one is inside 45°.
// Speed comes from the run's level, so a later phase is not judged with level 1's multipliers.
import { expect, it } from "vitest";
import type { LevelId } from "@/arcade3d/types";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS } from "../levels";
import {
   BEAM, FLASH, PROPOSED_LEVEL_LIMITS, TURN_RATE, TYPES,
   createRun, finalScore, stepGame, wrapAngle,
   type Exhibit, type GuardInput, type Run,
} from "../rules";

export type Hands = "keys" | "hover" | "touch" | "camp" | "spin" | "idle" | "spam";

interface Brain { lock: number; pending: number; wait: number }

const ZERO: GuardInput = { moveX: 0, pointerX: null, dragYaw: null, coarse: false, flash: false };

function timeLeft(run: Run, index: number): number {
   const ex = run.exhibits[index];
   const ped = run.pedestals[ex.pedestal];
   const dist = Math.hypot(ex.x - ped.exitX, ex.z - ped.exitZ);
   const speed = ex.coast > 0 ? ex.coastSpeed : TYPES[ex.kind].speed * run.level.speed[run.phase];
   return Math.max(0, dist - BEAM.alarm) / speed;
}

function bearingOf(ex: Exhibit): number {
   return Math.atan2(ex.x, ex.z);
}

function urgent(run: Run): number {
   let best = -1;
   let left = Infinity;
   for (let i = 0; i < run.exhibits.length; i++) {
      const mode = run.exhibits[i].mode;
      if (mode !== "sneaking" && mode !== "frozen") continue;
      const t = timeLeft(run, i);
      if (t < left) { left = t; best = i; }
   }
   return best;
}

function wantFlash(run: Run): boolean {
   if (run.cooldown > 0 || run.flashLeft > 0) return false;
   let hot = 0;
   let inside = false;
   for (let i = 0; i < run.exhibits.length; i++) {
      if (run.exhibits[i].mode !== "sneaking") continue;
      if (timeLeft(run, i) <= 2.2) hot += 1;
      if (Math.abs(wrapAngle(bearingOf(run.exhibits[i]) - run.yaw)) <= FLASH.half) inside = true;
   }
   return hot >= 2 && inside;
}

function steer(run: Run, brain: Brain, dt: number, reaction: number): { target: number; hold: boolean } {
   if (brain.lock >= 0) {
      const mode = run.exhibits[brain.lock].mode;
      if (mode === "returning" || mode === "still") brain.lock = -1;
   }
   const next = urgent(run);
   if (brain.lock < 0 && next >= 0) {
      if (brain.pending !== next) { brain.pending = next; brain.wait = reaction; }
      brain.wait -= dt;
      if (brain.wait <= 0) brain.lock = next;
   }
   const focus = brain.lock;
   if (focus < 0) return { target: 0, hold: false };
   const off = Math.abs(wrapAngle(bearingOf(run.exhibits[focus]) - run.yaw));
   return { target: bearingOf(run.exhibits[focus]), hold: off <= run.half };
}

function drive(run: Run, brain: Brain, live: GuardInput, dt: number, t: number, hands: Hands, reaction: number): void {
   live.moveX = 0;
   live.pointerX = null;
   live.dragYaw = null;
   live.flash = false;
   live.coarse = hands === "touch";
   if (hands === "camp") {
      run.yaw = Math.PI / 2;
      return;
   }
   if (hands === "idle") return;
   if (hands === "spin") {
      live.moveX = 1;
      return;
   }
   if (hands === "spam") {
      live.moveX = Math.sin(t * 17) > 0 ? 1 : -1;
      live.flash = true;
      return;
   }
   const aim = steer(run, brain, dt, reaction);
   live.flash = wantFlash(run);
   if (aim.hold) {
      if (hands === "touch") live.dragYaw = run.yaw;
      return;
   }
   const delta = wrapAngle(aim.target - run.yaw);
   const dir = delta > 0.02 ? 1 : delta < -0.02 ? -1 : 0;
   if (hands === "keys") live.moveX = dir;
   else if (hands === "hover") live.pointerX = dir;
   else live.dragYaw = aim.target;
}

export interface Sweep {
   won: boolean;
   score: number;
   ms: number;
   legal: boolean;
   alarms: number;
   returns: number;
}

/** One night on the pure rules loop (no store). `hz` is the outer frame; stepGame still slices to 1/60. */
export function sweep(seed: number, id: LevelId, hands: Hands, hz: number, reaction = 0.22): Sweep {
   const run = createRun(seed, LEVELS[id]);
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const brain: Brain = { lock: -1, pending: -2, wait: 0 };
   const live: GuardInput = { ...ZERO };
   const dt = 1 / hz;
   let t = 0;
   let legal = true;
   const cap = LEVELS[id].dawn + 5;
   while (!run.outcome && t < cap) {
      t += dt;
      drive(run, brain, live, dt, t, hands, reaction);
      stepGame(run, live, dt, t);
      if (run.score * 1000 > limits.base! * 1000 + limits.maxPointsPerSec! * t * 1000) legal = false;
   }
   const ms = t * 1000;
   if (!withinServerLimits(run.score, ms, limits) || capScore(run.score, ms, limits) !== run.score) legal = false;
   return { won: run.outcome === "win", score: run.score, ms, legal, alarms: run.alarms, returns: run.returns };
}

/** The same bot through the real store, so finalScore and the submitted duration are checked. */
export function storeSweep(seed: number, id: LevelId, hands: Hands, hz: number, reaction = 0.22): Sweep & { stored: number } {
   const run = createRun(seed, LEVELS[id]);
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const brain: Brain = { lock: -1, pending: -2, wait: 0 };
   const live: GuardInput = { ...ZERO };
   let legal = true;
   const end = simulateRun(createArcadeStore(), {
      resultDelayMs: 0,
      frame: fixedFrames(1000 / hz),
      step: (dt, time, store) => {
         drive(run, brain, live, dt, time, hands, reaction);
         stepGame(run, live, dt, time, store.getState());
         if (run.score * 1000 > limits.base! * 1000 + limits.maxPointsPerSec! * store.getState().elapsedMs) legal = false;
      },
   });
   const scored = finalScore(end);
   if (scored.score !== end.score) legal = false;
   if (!withinServerLimits(end.score, end.elapsedMs, limits) || capScore(end.score, end.elapsedMs, limits) !== end.score) legal = false;
   return { won: end.endReason === "win", score: end.score, ms: end.elapsedMs, legal, alarms: run.alarms, returns: run.returns, stored: scored.score };
}

export const TURN = TURN_RATE;

/** One level's bot row. Call inside a describe(); vitest runs files in parallel, so each level is its own file. */
export function levelBotRow(id: LevelId): void {
   const limits = PROPOSED_LEVEL_LIMITS[id];

   it(`L${id}: human wins >= 90% of 200 seeds, oracle reaches 90% of maxScore, idle never clears`, () => {
      const human = { wins: 0, best: 0 };
      for (let seed = 1; seed <= 200; seed++) {
         const run = sweep(seed, id, "keys", 30, 0.22);
         expect(run.legal).toBe(true);
         if (run.won) human.wins += 1;
         if (run.score > human.best) human.best = run.score;
      }
      let oracleBest = 0;
      let oracleWins = 0;
      for (let seed = 1; seed <= 20; seed++) {
         const run = sweep(seed, id, "keys", 30, 0);
         expect(run.legal).toBe(true);
         expect(run.won).toBe(true);
         oracleWins += 1;
         if (run.score > oracleBest) oracleBest = run.score;
      }
      for (let seed = 1; seed <= 4; seed++) {
         for (const hands of ["idle", "camp", "spin"] as const) {
            const run = sweep(seed, id, hands, 30, 0.22);
            expect(run.legal).toBe(true);
            expect(run.won).toBe(false);
         }
      }
      for (let seed = 1; seed <= 4; seed++) expect(sweep(seed, id, "spam", 30, 0).legal).toBe(true);
      console.info(`museum-guard L${id}`, JSON.stringify({ humanWins: human.wins, humanBest: human.best, oracleWins, oracleBest, maxScore: limits.maxScore }));
      expect(human.wins).toBeGreaterThanOrEqual(180);
      expect(oracleWins).toBe(20);
      expect(oracleBest).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
   }, 90000);

   it(`L${id}: hover and touch clear >= 90% of 20 seeds, and a store run matches finalScore`, () => {
      const handsWins: Record<string, number> = {};
      for (const hands of ["hover", "touch"] as const) {
         let wins = 0;
         for (let seed = 1; seed <= 20; seed++) {
            const run = sweep(seed, id, hands, 30, 0.22);
            expect(run.legal).toBe(true);
            if (run.won) wins += 1;
         }
         handsWins[hands] = wins;
         expect(wins).toBeGreaterThanOrEqual(18);
      }
      for (const hz of [60, 144]) {
         const run = sweep(id + hz, id, "keys", hz, 0);
         expect(run.legal).toBe(true);
         expect(run.won).toBe(true);
      }
      console.info(`museum-guard L${id} hands`, JSON.stringify(handsWins));
      const oracle = storeSweep(id, id, "keys", 60, 0);
      expect(oracle.legal).toBe(true);
      expect(oracle.won).toBe(true);
      expect(oracle.stored).toBe(oracle.score);
      const idle = storeSweep(id + 50, id, "idle", 60, 0.22);
      expect(idle.legal).toBe(true);
      expect(idle.won).toBe(false);
      expect(idle.stored).toBe(idle.score);
   }, 90000);
}
