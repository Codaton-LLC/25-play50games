// The five levels (docs/arcade-levels.md §6.3 step 6, §5): declarations, level 1 = today's
// game, monotone difficulty, one limit proof per level, and the honest / oracle / idle / spam
// bots. rules.test.ts is unchanged and still pins level 1's numbers.
import { describe, expect, it, vi } from "vitest";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, type LuggageLevel } from "./levels";
import { luggageRushMeta as meta } from "./meta";
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
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

import { blank, earliestLose } from "./testing/levelBot";
describe("luggage-rush levels: declarations", () => {
   it("declares five levels with the proposed limits, and level 5 stays within 3× level 1", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels?.map((level) => level.title)).toEqual([
         "Training Belt", "Two Destinations", "Four Destinations", "Rush Hour", "International Hub",
      ]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(PROPOSED_LEVEL_LIMITS[1]).toBe(PROPOSED_LIMITS);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) {
         const clear = meta.levels![id - 1].clearScore ?? 0;
         expect(clear).toBeGreaterThanOrEqual(1);
         expect(clear).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });

   it("level 1 is today's game: same constants, clock, lighting, HUD and instructions", () => {
      const level = LEVELS[1];
      expect(level.durationMs).toBe(DURATION_MS);
      expect(level.durationMs).toBe(120_000);
      expect(level.beltBase).toBe(BELT.base);
      expect(level.beltBase).toBe(1.35);
      expect([level.spawnStart, level.spawnEnd, level.spawnRampS]).toEqual([SPAWN.start, SPAWN.end, SPAWN.rampS]);
      expect([level.spawnStart, level.spawnEnd, level.spawnRampS]).toEqual([2.2, 0.9, 120]);
      expect(level.phaseD3).toBe(PHASE_D3);
      expect(level.phaseD4).toBe(PHASE_D4);
      expect([level.phaseD3, level.phaseD4]).toEqual([40, 70]);
      expect(level.speedEvery).toBe(15);
      expect(level.heavyLate).toBe(ROLL.heavyLate);
      expect(STRIKE_LIMIT).toBe(3);
      expect(speedUntil(level)).toBe(105);
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: RESULT_DELAY() });
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(levelEnvironment(definition, 1)!.lighting).toBe("indoor");
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
      expect(levelInstructions(definition, 1)[0]).toContain("70 s");
   });

   it("replays today's createRun against level 1 over 24 seeds", () => {
      const seeds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 17, 19, 42, 100, 256, 1024, 4096, 4242, 99991, 2 ** 31 - 1, 2 ** 32 - 1];
      expect(seeds.length).toBeGreaterThanOrEqual(24);
      for (const seed of seeds) {
         const plain = createRun(seed);
         const tagged = createRun(seed, LEVELS[1]);
         expect(plain.config).toEqual(LEVELS[1]);
         let t = 0;
         const a = blank();
         const b = blank();
         while (t < 120 - 1e-9 && !plain.lost && !tagged.lost) {
            t += 0.05;
            const n = Math.floor(t * 4);
            const slot = (seed + n) % 4;
            const fire = (n + seed) % 5 === 0;
            a.flip[0] = a.flip[1] = a.flip[2] = a.flip[3] = false;
            b.flip[0] = b.flip[1] = b.flip[2] = b.flip[3] = false;
            if (fire) a.flip[slot] = b.flip[slot] = true;
            stepRun(plain, a, 0.05, t);
            stepRun(tagged, b, 0.05, t);
         }
         expect(tagged.score, `seed ${seed}`).toBe(plain.score);
         expect(tagged.strikes, `seed ${seed}`).toBe(plain.strikes);
         expect(tagged.lost, `seed ${seed}`).toBe(plain.lost);
         expect(tagged.bags.map((bag) => [bag.alive, bag.flight, bag.vip, bag.heavy, bag.s])).toEqual(
            plain.bags.map((bag) => [bag.alive, bag.flight, bag.vip, bag.heavy, bag.s])
         );
      }
      expect(oracleCeiling()).toEqual(oracleCeiling(120, LEVELS[1]));
      for (let t = 0; t <= 120; t += 5) {
         expect(beltSpeed(t)).toBe(beltSpeed(t, LEVELS[1]));
         expect(intervalAt(t)).toBe(intervalAt(t, LEVELS[1]));
      }
   });

   it("gives later levels their own clock, mood and chute-open line", () => {
      expect(LEVEL_IDS.map((id) => levelRunConfig(definition, id).durationMs)).toEqual(LEVEL_IDS.map((id) => LEVELS[id].durationMs));
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["indoor", "day", "sunset", "night", "space"]);
      for (const id of LEVEL_IDS) expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
      for (const id of [2, 3, 4, 5] as const) {
         expect(levelInstructions(definition, id)[0]).toContain(`${LEVELS[id].phaseD4} s`);
      }
      expect(levelInstructions(definition, 2)[0]).not.toContain("70 s");
   });
});

function RESULT_DELAY(): number | undefined {
   return definition.resultDelayMs;
}

describe("luggage-rush levels: difficulty", () => {
   it("is monotone: longer or at least as long, never a slower belt, never an easier spawn or a later chute", () => {
      let previous = oracleCeiling(LEVELS[1].durationMs / 1000, LEVELS[1]).score;
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id];
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(b.beltBase).toBeGreaterThanOrEqual(a.beltBase);
         expect(b.spawnEnd).toBeLessThanOrEqual(a.spawnEnd);
         expect(b.spawnStart).toBe(a.spawnStart);
         expect(b.spawnRampS).toBeLessThanOrEqual(a.spawnRampS);
         expect(b.phaseD3).toBeLessThanOrEqual(a.phaseD3);
         expect(b.phaseD4).toBeLessThanOrEqual(a.phaseD4);
         expect(b.phaseD4).toBeGreaterThan(b.phaseD3);
         expect(b.speedEvery).toBeLessThanOrEqual(a.speedEvery);
         expect(b.heavyLate).toBeGreaterThanOrEqual(a.heavyLate);
         expect(b.heavyLate).toBeGreaterThan(ROLL.vip);
         const harder = b.durationMs > a.durationMs || b.beltBase > a.beltBase || b.spawnEnd < a.spawnEnd
            || b.phaseD3 < a.phaseD3 || b.speedEvery < a.speedEvery || b.heavyLate > a.heavyLate;
         expect(harder).toBe(true);
         const ceiling = oracleCeiling(b.durationMs / 1000, b).score;
         expect(ceiling).toBeGreaterThan(previous);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         previous = ceiling;
      }
   });

   it("opens a later level's chutes on its own clock and keeps level 1 locked", () => {
      const early = LEVELS[3];
      const locked = createRun(1, LEVELS[1]);
      const open = createRun(1, early);
      const flip: StepInput = { flip: [false, false, true, false] };
      stepRun(locked, flip, 0.016, 35);
      stepRun(open, flip, 0.016, 35);
      expect(locked.choices[2]).toBe(0);
      expect(open.choices[2]).toBe(1);
      expect(diverterLocked(2, 35, LEVELS[1])).toBe(true);
      expect(diverterLocked(2, 35, early)).toBe(false);
      expect(rollKind(50, 0.31)).toBe("normal");
      expect(rollKind(50, 0.31, LEVELS[4].heavyLate)).toBe("heavy");
      expect(rollKind(50, 0.11, LEVELS[5].heavyLate)).toBe("vip");
   });
});

describe("luggage-rush levels: limit proof per level", () => {
   for (const id of LEVEL_IDS) it(`L${id}: oracle ceiling, points line, duration window, spacing`, () => {
      const level = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const clock = level.durationMs / 1000;
      const oracle = oracleCeiling(clock, level);
      expect(oracle.score).toBeLessThanOrEqual(limits.maxScore);
      expect(oracle.score).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      expect(limits.maxScore / oracle.score).toBeLessThanOrEqual(1.05);
      expect(oracle.last).toBeLessThan(clock);
      expect(oracle.missed).toBeGreaterThan(clock);
      let t = 0;
      let streak = 0;
      let score = 0;
      let peak = 0;
      for (let i = 0; i < oracle.bags; i++) {
         const arrive = t + travelTime(8.4, t, level);
         streak++;
         score += deliveryPoints(streak, t >= 50);
         const chord = score / arrive;
         if (chord > peak) peak = chord;
         expect(score).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * arrive + 1e-6);
         t += intervalAt(t, level);
      }
      expect(score).toBe(oracle.score);
      expect(peak).toBeCloseTo(oracle.peak, 6);
      expect(limits.maxPointsPerSec!).toBeGreaterThanOrEqual(peak);
      expect(limits.maxPointsPerSec!).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
      expect(limits.base! + limits.maxPointsPerSec! * clock).toBeGreaterThanOrEqual(limits.maxScore);
      // normal bags never close inside the 1.1 m gap, so the oracle schedule is physically legal
      let spacing = Infinity;
      for (let at = 0; at <= clock; at += 0.25) spacing = Math.min(spacing, beltSpeed(at, level) * intervalAt(at, level));
      expect(spacing).toBeGreaterThan(GAP);
      const lose = earliestLose(level);
      expect(lose * 1000).toBeGreaterThanOrEqual(limits.minDurationMs);
      expect(lose * 1000 - limits.minDurationMs).toBeLessThan(800);
      expect(lose * 1000).toBeLessThan(limits.maxDurationMs);
      expect(level.durationMs + 2000).toBe(limits.maxDurationMs);
      if (id === 1) {
         expect(oracle.bags).toBe(77);
         expect(oracle.score).toBe(7500);
         expect(limits).toEqual(PROPOSED_LIMITS);
      }
   }, 20000);
});

describe("luggage-rush levels: fairness", () => {
   it("touch and keyboard share one phase lock on every level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const keys = createRun(5, level);
         const touch = createRun(5, level);
         const input: StepInput = { flip: [false, false, true, true] };
         stepRun(keys, input, 0.016, level.phaseD3 - 0.02);
         stepRun(touch, input, 0.016, level.phaseD3 - 0.02);
         expect(keys.choices).toEqual([0, 0, 0, 0]);
         expect(touch.choices).toEqual(keys.choices);
         stepRun(keys, input, 0.016, level.phaseD3);
         stepRun(touch, input, 0.016, level.phaseD3);
         expect(keys.choices[2]).toBe(1);
         expect(keys.choices[3]).toBe(0);
         expect(touch.choices).toEqual(keys.choices);
         stepRun(keys, input, 0.016, level.phaseD4);
         stepRun(touch, input, 0.016, level.phaseD4);
         expect(keys.choices[3]).toBe(1);
         expect(touch.strikes).toBe(keys.strikes);
         expect(touch.score).toBe(keys.score);
         expect(touch.choices).toEqual(keys.choices);
      }
   });
});
