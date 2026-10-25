// The five levels (docs/arcade-levels.md §6.3 step 6, §5): declarations, level 1 = today's
// game, monotone difficulty, one limit proof per level, and the honest / oracle / idle / spam
// bots. rules.test.ts is unchanged and still pins level 1's numbers.
// Tests only: the level bots (rules.levels-<n>.test.ts), one file per level so they run in parallel.
import { describe, expect, it } from "vitest";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "../index";
import { LEVELS, type LuggageLevel } from "../levels";
import { luggageRushMeta as meta } from "../meta";
import {
   BELT,
   DURATION_MS,
   GAP,
   PATHS,
   PHASE_D3,
   PHASE_D4,
   POOL,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   ROLL,
   SEG,
   SPAWN,
   STRIKE_LIMIT,
   beltSpeed,
   capScore,
   createRun,
   deliveryPoints,
   diverterLocked,
   intervalAt,
   oracleCeiling,
   placeBag,
   rollKind,
   speedUntil,
   stepRun,
   travelTime,
   withinServerLimits,
   type RunState,
   type StepInput,
} from "../rules";



const APPROACH = [SEG.entry, SEG.mid, SEG.toD3, SEG.hold] as const;
/** Per-diverter gap between flips. The same StepInput is what a key and a tap both become. */
const REACT_S = 0.25;
const HZ = [30, 60, 144] as const;
const SWEEP = { human: 200, oracle: 24, idle: 60, spam: 24 } as const;

export const blank = (): StepInput => ({ flip: [false, false, false, false] });

function wanted(diverter: number, flight: number): number {
   if (diverter === 0) return flight === 0 ? 0 : 1;
   if (diverter === 1) return flight === 1 ? 0 : 1;
   if (diverter === 2) return flight === 3 ? 1 : 0;
   return 0;
}

/** Honest player: set each diverter for the bag closest to it, no faster than REACT_S. */
function aim(run: RunState, time: number, cool: number[], input: StepInput): void {
   const level = run.config;
   const speed = beltSpeed(time, level);
   for (let d = 0; d < 4; d++) {
      if (diverterLocked(d, time, level)) continue;
      const seg = APPROACH[d];
      let best = -1;
      let bestS = -1;
      for (let i = 0; i < POOL; i++) {
         const bag = run.bags[i];
         if (!bag.alive || bag.segment !== seg || bag.s <= bestS) continue;
         bestS = bag.s;
         best = i;
      }
      if (best < 0) continue;
      const bag = run.bags[best];
      const v = speed * (bag.heavy ? BELT.heavy : 1);
      const eta = (PATHS[seg].total - bag.s) / (v > 1e-6 ? v : 1);
      if (eta > 2.8) continue;
      if (wanted(d, bag.flight) === run.choices[d]) continue;
      if (time - cool[d] < REACT_S) continue;
      input.flip[d] = true;
      cool[d] = time;
   }
}

function entryOpen(run: RunState): boolean {
   for (let i = 0; i < POOL; i++) {
      const bag = run.bags[i];
      if (bag.alive && bag.segment === SEG.entry && bag.s < GAP) return false;
   }
   return true;
}

export type Policy = "human" | "oracle" | "idle" | "spam";

export function play(seed: number, id: LevelId, policy: Policy, dt: number): { score: number; lost: boolean; time: number } {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const limit = level.durationMs / 1000;
   const cool = [-10, -10, -10, -10];
   const input = blank();
   let t = 0;
   let next = 0;
   if (policy === "oracle") run.nextSpawn = 1e9;
   while (t < limit - 1e-9 && !run.lost) {
      const step = Math.min(dt, limit - t);
      t += step;
      input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = false;
      if (policy === "human") aim(run, t, cool, input);
      else if (policy === "spam") input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = true;
      else if (policy === "oracle" && t >= next && entryOpen(run)) {
         if (placeBag(run, 0, false, t >= 50) >= 0) next = t + intervalAt(t, level);
      }
      stepRun(run, input, step, t);
   }
   return { score: run.score, lost: run.lost, time: t };
}

export function storePlay(id: LevelId, policy: Policy, hz: number) {
   const level = LEVELS[id];
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const run = createRun(policy === "oracle" ? 1 : 9, level);
   if (policy === "oracle") run.nextSpawn = 1e9;
   const cool = [-10, -10, -10, -10];
   const input = blank();
   let next = 0;
   const final = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      frame: fixedFrames(1000 / hz),
      step(dt, time, store) {
         input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = false;
         if (policy === "human") aim(run, time, cool, input);
         else if (policy === "spam") input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = true;
         else if (policy === "oracle" && time >= next && entryOpen(run)) {
            if (placeBag(run, 0, false, time >= 50) >= 0) next = time + intervalAt(time, level);
         }
         stepRun(run, input, dt, time);
         const state = store.getState();
         for (let i = 0; i < run.eventCount; i++) if (run.events[i].kind === "deliver") state.addScore(run.events[i].points);
         if (run.lost) state.end("lose");
      },
   });
   return { score: final.score, elapsedMs: final.elapsedMs, reason: final.endReason ?? "", limits };
}

/** Three wrong bags down the red chute, no flips: the earliest legal lose. */
export function earliestLose(level: LuggageLevel): number {
   const run = createRun(1, level);
   run.nextSpawn = 1e9;
   let t = 0;
   let placed = 0;
   const due = [0, 0, 0];
   due[0] = 0;
   due[1] = intervalAt(0, level);
   due[2] = due[1] + intervalAt(due[1], level);
   const input = blank();
   while (!run.lost && t < 30) {
      t += 0.001;
      if (placed < 3 && t >= due[placed]) {
         placeBag(run, 1, false, false);
         placed++;
      }
      stepRun(run, input, 0.001, t);
   }
   return t;
}


export function luggageBotSuite(id: LevelId): void {
   describe(`luggage-rush L${id} bots`, () => {
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const levelMeta = meta.levels![id - 1];

      it(`L${id}: honest, oracle, idle and spam stay inside the limits`, () => {
         const stats: Record<Policy, { n: number; clears: number; survived: number; best: number; min: number; sum: number }> = {
            human: { n: 0, clears: 0, survived: 0, best: 0, min: Infinity, sum: 0 },
            oracle: { n: 0, clears: 0, survived: 0, best: 0, min: Infinity, sum: 0 },
            idle: { n: 0, clears: 0, survived: 0, best: 0, min: Infinity, sum: 0 },
            spam: { n: 0, clears: 0, survived: 0, best: 0, min: Infinity, sum: 0 },
         };
         for (const policy of ["human", "oracle", "idle", "spam"] as const) {
            const n = SWEEP[policy];
            const row = stats[policy];
            row.n = n;
            for (let seed = 0; seed < n; seed++) {
               const hz = HZ[seed % 3];
               const sim = play(seed + id * 1000, id, policy, 1 / hz);
               const ms = sim.lost ? sim.time * 1000 : LEVELS[id].durationMs;
               expect(withinServerLimits(sim.score, Math.max(ms, limits.minDurationMs), limits), `${policy} seed ${seed}`).toBe(true);
               expect(capScore(sim.score, Math.max(ms, limits.minDurationMs), limits)).toBe(sim.score);
               expect(sim.score).toBeLessThanOrEqual(limits.maxScore);
               const reason = sim.lost ? "lose" : "timeup";
               if (isLevelCleared(reason, sim.score, levelMeta)) row.clears++;
               if (!sim.lost) row.survived++;
               if (sim.score > row.best) row.best = sim.score;
               if (sim.score < row.min) row.min = sim.score;
               row.sum += sim.score;
            }
         }
         const human = stats.human;
         const summary = {
            human: { clears: human.clears, survived: human.survived, best: human.best, min: human.min, mean: Math.round(human.sum / human.n) },
            oracle: { best: stats.oracle.best, mean: Math.round(stats.oracle.sum / stats.oracle.n) },
            idle: { clears: stats.idle.clears, survived: stats.idle.survived, best: stats.idle.best },
            spam: { clears: stats.spam.clears, best: stats.spam.best },
         };
         console.info(`luggage-rush L${id}`, JSON.stringify(summary));
         expect(human.survived).toBeGreaterThanOrEqual(0.9 * human.n);
         expect(stats.oracle.best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         expect(stats.oracle.best).toBeLessThanOrEqual(limits.maxScore);
         expect(stats.idle.clears).toBe(0);
         expect(stats.idle.survived).toBe(0);
         expect(stats.spam.clears).toBe(0);
         if (levelMeta.clearScore !== undefined) {
            expect(human.clears, `min ${human.min} clear ${levelMeta.clearScore}`).toBeGreaterThanOrEqual(0.99 * human.n);
            expect(human.min).toBeGreaterThanOrEqual(levelMeta.clearScore);
         }
      }, 180000);

      it(`L${id}: the real store at 30/60/144 Hz stays inside the limits and capScore is a no-op`, () => {
         for (const policy of ["oracle", "human", "idle", "spam"] as const) for (const hz of HZ) {
            const sim = storePlay(id, policy, hz);
            expect(sim.reason === "lose" || sim.reason === "timeup").toBe(true);
            expect(withinServerLimits(sim.score, sim.elapsedMs, limits), `${policy} @ ${hz}`).toBe(true);
            expect(capScore(sim.score, sim.elapsedMs, limits)).toBe(sim.score);
            expect(sim.elapsedMs).toBeGreaterThanOrEqual(limits.minDurationMs);
            expect(sim.elapsedMs).toBeLessThanOrEqual(limits.maxDurationMs);
            if (policy === "oracle") {
               expect(sim.reason).toBe("timeup");
               expect(sim.score).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
            }
            if (policy === "idle") expect(isLevelCleared(sim.reason as "lose", sim.score, levelMeta)).toBe(false);
         }
      }, 180000);
   });
}
