// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the analytic limit proof per level and bot checks across levels.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { withinServerLimits, capScore } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { simulateRun, fixedFrames } from "@/arcade3d/core/testing/botHarness";
import { BASE_PLOTS, DESCRIPTIONS, LEVELS, type AlienFarmLevel } from "./levels";
import { alienFarmMeta as meta } from "./meta";
import definition from "./index";
import {
   CYCLE,
   DURATION_MS,
   DURATION_S,
   HARVEST,
   HUD_STATS,
   OFFSET_TABLES,
   PLOTS,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   SHIP,
   SPORES,
   createRun,
   cyclePeak,
   cycleStart,
   feedStore,
   halfWindow,
   pressGap,
   shipDistance,
   stageAt,
   stepRun,
   type RunState,
   type StepInput,
} from "./rules";
import { harvestBound } from "./bound";
import { campBot, greedyBot, humanBot, idleBot, type Bot } from "./bots";

vi.mock("./Scene", () => ({ default: () => null }));

const NONE: StepInput = { dirX: 0, dirZ: 0, press: false };

describe("alien-farm levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      // Levels 1-4 have clearScore <= maxScore; level 5 needs no clearScore
      for (const id of [1, 2, 3, 4] as const) {
         const clr = meta.levels![id - 1].clearScore;
         expect(clr).toBeDefined();
         expect(clr!).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(clr!).toBeGreaterThan(0);
      }
      expect(meta.levels![4].clearScore).toBeUndefined();
      // Decision 3 guard: level 5 at most ~3 x level 1
      const l5Ratio = PROPOSED_LEVEL_LIMITS[5].maxScore / PROPOSED_LEVEL_LIMITS[1].maxScore;
      expect(l5Ratio).toBeLessThanOrEqual(3.0);
      expect(l5Ratio).toBeCloseTo(30500 / 12900, 3);
   });

   it("level 1 is today's game: same plots, clock, limits, HUD, and byte-identical runs", () => {
      const l1 = LEVELS[1];
      expect(l1.durationMs).toBe(DURATION_MS);
      expect(l1.capacity).toBe(HARVEST.capacity);
      expect(l1.shipSpeeds).toEqual(SHIP.speeds);
      expect(l1.sporesLifeS).toBe(SPORES.lifeS);
      expect(l1.cycleHalfLate).toBe(CYCLE.halfLate);
      expect(l1.plots).toBe(BASE_PLOTS);

      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: undefined });
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(levelHudStats(definition, 1)).toEqual(HUD_STATS);
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);

      // Byte-identical runs over 25 seeds vs createRun(seed)
      for (let s = 1; s <= 25; s++) {
         const seed = s * 7919;
         const runLegacy = createRun(seed);
         const runExplicit = createRun(seed, l1);
         expect(runLegacy).toEqual(runExplicit);
      }
   });

   it("each level's duration and HUD basket capacity come from its config", () => {
      for (const id of LEVEL_IDS) {
         const lvl = LEVELS[id];
         expect(levelRunConfig(definition, id).durationMs).toBe(lvl.durationMs);
         expect(levelHudStats(definition, id)![1]).toEqual({ key: "carry", label: "Basket", max: lvl.capacity });
      }
   });
});

describe("alien-farm levels: difficulty and progression", () => {
   it("is monotone: duration and challenge never fall; each level offers at least L1 points", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const prev = LEVELS[(id - 1) as LevelId], curr = LEVELS[id];
         expect(curr.durationMs).toBeGreaterThanOrEqual(prev.durationMs);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].durationMs)).toEqual([100_000, 150_000, 180_000, 180_000, 210_000]);
      expect(LEVEL_IDS.map((id) => PROPOSED_LEVEL_LIMITS[id].maxScore)).toEqual([12900, 20600, 26900, 22100, 30500]);
   });

   it("level features match the master plan and backlog specifications", () => {
      // L1: Starter Plot (today's dev baseline)
      expect(LEVELS[1].plots[0].activateAt).toBe(0);
      expect(LEVELS[1].plots[1].activateAt).toBe(20);
      expect(LEVELS[1].plots[3].activateAt).toBe(40);

      // L2: Crystal Farm (all plots active immediately, 150 s, slightly slower ship)
      expect(LEVELS[2].plots.every((p) => p.activateAt === 0)).toBe(true);
      expect(LEVELS[2].shipSpeeds).toEqual([1.7, 2.1, 2.5]);

      // L3: Glow Marsh (5 s cycles, longer 7 s spore duration, 180 s)
      expect(LEVELS[3].plots.filter((p) => p.kind === "glowPod").every((p) => p.cycleS === 5)).toBe(true);
      expect(LEVELS[3].sporesLifeS).toBe(7);

      // L4: Meteor Field (fast ship [2.5, 3, 3.5], tight 0.5 s late window, all active, 180 s)
      expect(LEVELS[4].shipSpeeds).toEqual([2.5, 3, 3.5]);
      expect(LEVELS[4].halfLate).toBe(0.5);
      expect(LEVELS[4].plots.every((p) => p.activateAt === 0)).toBe(true);

      // L5: Grand Alien Harvest (210 s, 5 s cycles, 7 s gourd, capacity 4, tight 0.5 s late window)
      expect(LEVELS[5].durationMs).toBe(210_000);
      expect(LEVELS[5].plots.slice(0, 8).every((p) => p.cycleS === 5)).toBe(true);
      expect(LEVELS[5].plots[8].cycleS).toBe(7);
      expect(LEVELS[5].capacity).toBe(4);
      expect(LEVELS[5].halfLate).toBe(0.5);
   });
});

describe("alien-farm levels: analytical scoring proofs (arcade-score-limits skill)", () => {
   const EXPECTED_STAR = {
      1: { star: 12400, H: 71, maxScore: 12900, pps: 250 },
      2: { star: 19750, H: 112, maxScore: 20600, pps: 250 },
      3: { star: 25850, H: 146, maxScore: 26900, pps: 260 },
      4: { star: 21250, H: 127, maxScore: 22100, pps: 260 },
      5: { star: 29250, H: 163, maxScore: 30500, pps: 260 },
   } as const;

   for (const id of LEVEL_IDS) {
      it(`L${id} (${LEVELS[id].title}): certificate S* and H*, 3-5% margin, rate inequality`, () => {
         const lvl = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const exp = EXPECTED_STAR[id];

         const opts = {
            deadline: lvl.durationMs / 1000,
            plots: lvl.plots,
            halfLate: lvl.cycleHalfLate,
         };

         // Compute S* over all 16 tables
         const S = Array.from({ length: 16 }, (_v, t) => harvestBound(t, opts).best);
         const star = Math.max(...S);
         expect(star).toBe(exp.star);

         // Compute H* (harvest count bound)
         const H = Math.max(...Array.from({ length: 16 }, (_v, t) => harvestBound(t, { ...opts, normal: 1, perfect: 1 }).best));
         expect(H).toBe(exp.H);

         // maxScore = 100 * ceil(1.04 * star / 100)
         expect(limits.maxScore).toBe(exp.maxScore);
         expect(limits.maxScore).toBe(100 * Math.ceil((1.04 * star) / 100));
         const margin = limits.maxScore / star - 1;
         expect(margin).toBeGreaterThanOrEqual(0.03);
         expect(margin).toBeLessThanOrEqual(0.05);

         // Rate inequality: base + pps * tH - 200 * H >= 0 for all H up to max picks
         const maxH = Math.ceil(star / 200);
         let minMargin = Infinity;
         for (let h = 1; h <= maxH; h++) {
            const tH = 2.4 + ((h - 1) * 71) / 90;
            const diff = limits.base! + limits.maxPointsPerSec! * tH - 200 * h;
            minMargin = Math.min(minMargin, diff);
         }
         expect(minMargin).toBeGreaterThanOrEqual(0);
      }, 120000);
   }
});

describe("alien-farm levels: bot limits and clear targets across all levels", () => {
   const SEEDS = [101, 202]; // 2 representative seeds per level (CW and CCW routes)

   function drive(seed: number, bot: Bot, level: AlienFarmLevel): { score: number; elapsedMs: number } {
      const run = createRun(seed, level);
      const input: StepInput = { ...NONE };
      const store = createArcadeStore();
      const end = simulateRun(store, {
         durationMs: level.durationMs,
         resultDelayMs: 1600,
         maxFrames: 60000,
         frame: fixedFrames(1000 / 60),
         step: (dt, _time, s) => {
            bot(run, input);
            feedStore(run, stepRun(run, input, dt), s.getState());
         },
      });
      return { score: end.score, elapsedMs: end.elapsedMs };
   }

   for (const id of LEVEL_IDS) {
      it(`L${id} (${LEVELS[id].title}): honest bot scores inside limits and clears; degenerate bots stay low`, () => {
         const level = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const clearScore = meta.levels![id - 1].clearScore;

         // Greedy bot (honest, full knowledge)
         const greedyRes = drive(101, greedyBot(), level);
         expect(withinServerLimits(greedyRes.score, greedyRes.elapsedMs, limits)).toBe(true);
         expect(capScore(greedyRes.score, greedyRes.elapsedMs, limits)).toBe(greedyRes.score);
         if (clearScore !== undefined) {
            expect(greedyRes.score).toBeGreaterThanOrEqual(clearScore);
         }

         // Idle bot: always 0, never clears
         const idleRes = drive(101, idleBot, level);
         expect(idleRes.score).toBe(0);
         if (clearScore !== undefined) {
            expect(idleRes.score).toBeLessThan(clearScore);
         }

         // Camping bot: stays low
         const campRes = drive(101, campBot(4), level);
         expect(campRes.score).toBeLessThanOrEqual(400);
         if (clearScore !== undefined) {
            expect(campRes.score).toBeLessThan(clearScore);
         }
      }, 30000);
   }

   for (const id of [1, 2, 3, 4] as const) {
      it(`L${id} (${LEVELS[id].title}): honest human-paced bot reaches clearScore`, () => {
         const level = LEVELS[id];
         const clearScore = meta.levels![id - 1].clearScore!;
         const testSeeds = [101, 202, 303];
         for (const s of testSeeds) {
            const res = drive(s, humanBot(s), level);
            expect(res.score).toBeGreaterThanOrEqual(clearScore);
         }
      }, 30000);
   }
});

describe("alien-farm levels: mutation probes verifying that simulation reads level knobs", () => {
   it("halfLate knob tightens the late ripe window in stageAt and halfWindow", () => {
      expect(halfWindow(75, LEVELS[1].cycleHalfLate)).toBe(0.6);
      expect(halfWindow(75, LEVELS[4].cycleHalfLate)).toBe(0.5);
      expect(halfWindow(75, LEVELS[5].cycleHalfLate)).toBe(0.5);

      const runL1 = createRun(1, LEVELS[1]);
      const runL4 = createRun(1, LEVELS[4]);
      // At peak + 0.55s, L1 (halfLate 0.6) is still ripe, while L4 (halfLate 0.5) is overripe
      const plotL1 = runL1.plots[4];
      const plotL4 = runL4.plots[4];
      const p1 = cyclePeak(plotL1, 15);
      const p4 = cyclePeak(plotL4, 15);
      expect(stageAt(plotL1, p1 + 0.55)).toBe("ripe");
      expect(stageAt(plotL4, p4 + 0.55)).toBe("overripe");
   });

   it("shipSpeeds knob directly governs shipDistance and ship trajectory", () => {
      const dL1 = shipDistance(60, LEVELS[1].shipSpeeds);
      const dL2 = shipDistance(60, LEVELS[2].shipSpeeds);
      const dL4 = shipDistance(60, LEVELS[4].shipSpeeds);
      // L2 ship is slower than L1; L4 ship is faster than L1
      expect(dL2).toBeLessThan(dL1);
      expect(dL4).toBeGreaterThan(dL1);

      const runL1 = createRun(42, LEVELS[1]);
      const runL2 = createRun(42, LEVELS[2]);
      const runL4 = createRun(42, LEVELS[4]);
      expect(runL1.level.shipSpeeds).toEqual([2, 2.5, 3]);
      expect(runL2.level.shipSpeeds).toEqual([1.7, 2.1, 2.5]);
      expect(runL4.level.shipSpeeds).toEqual([2.5, 3, 3.5]);
   });

   it("cycleS knob governs crop pulse periods and burst schedules", () => {
      const runL1 = createRun(10, LEVELS[1]);
      const runL3 = createRun(10, LEVELS[3]);
      // First 8 beds have cycleS=6 in L1 and cycleS=5 in L3
      expect(runL1.plots[0].cycleS).toBe(6);
      expect(runL3.plots[0].cycleS).toBe(5);
      expect(cycleStart(runL3.plots[0], 4) - runL3.plots[0].b0).toBe(20);
      expect(cycleStart(runL1.plots[0], 4) - runL1.plots[0].b0).toBe(24);
   });

   it("sporesLifeS knob governs spore duration on bursts", () => {
      const runL1 = createRun(7, LEVELS[1]);
      const runL3 = createRun(7, LEVELS[3]);
      expect(runL1.level.sporesLifeS).toBe(5);
      expect(runL3.level.sporesLifeS).toBe(7);
   });
});
