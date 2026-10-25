// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the analytic limit proof per level and bot checks across levels.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
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
   nextWindow,
   shipDistance,
   stageAt,
   stepRun,
   type RunState,
   type StepInput,
} from "./rules";
import { boundNodes, firstPress, harvestBound, pressGap } from "./bound";
import * as rules from "./rules";
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

      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: definition.resultDelayMs });
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
      expect(LEVELS[2].shipSpeeds).toEqual([2, 2.5, 3]);

      // L3: Glow Marsh (5 s cycles, longer 7 s spore duration, 180 s)
      expect(LEVELS[3].plots.filter((p) => p.kind === "glowPod").every((p) => p.cycleS === 5)).toBe(true);
      expect(LEVELS[3].sporesLifeS).toBe(7);

      // L4: Meteor Field (fast ship [2.5, 3, 3.5], tight 0.5 s late window, all active, 180 s)
      expect(LEVELS[4].shipSpeeds).toEqual([2.5, 3, 3.5]);
      expect(LEVELS[4].cycleHalfLate).toBe(0.5);
      expect(LEVELS[4].plots.every((p) => p.activateAt === 0)).toBe(true);

      // L5: Grand Alien Harvest (210 s, 5 s cycles, 7 s gourd, capacity 4, tight 0.5 s late window)
      expect(LEVELS[5].durationMs).toBe(210_000);
      expect(LEVELS[5].plots.every((p) => p.cycleS === (p.kind === "glowPod" ? 5 : 7))).toBe(true);
      expect(LEVELS[5].capacity).toBe(4);
      expect(LEVELS[5].cycleHalfLate).toBe(0.5);
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

   // L4 and L5 run in levels.certificate.test.ts (a second file, so the two halves run in parallel)
   for (const id of [1, 2, 3] as const) {
      it(`L${id} (${meta.levels![id - 1].title}): certificate S* and H*, 3-5% margin, rate inequality`, () => {
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

         // maxScore = 100 * ceil(1.04 * star / 100)
         expect(limits.maxScore).toBe(exp.maxScore);
         expect(limits.maxScore).toBe(100 * Math.ceil((1.04 * star) / 100));
         const margin = limits.maxScore / star - 1;
         expect(margin).toBeGreaterThanOrEqual(0.03);
         expect(margin).toBeLessThanOrEqual(0.05);

         // Rate: every harvest pays at most 200 (50 + 50 perfect + its 100 share of a full load), so the
         // score at t is at most 200 H(t). Presses on different beds are >= g = min pressGap apart (bed
         // positions are the same on every level); the same bed repeats only a cycle later (>= C - 2 x 0.9
         // s > g). The first press is >= f = the level's earliest (window open, walk from the start) over
         // every offset table. So the H-th press is at >= f + (H - 1) g, and base + pps t covers 200 H.
         let g = Infinity;
         for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) if (a !== b) g = Math.min(g, pressGap(a, b));
         expect(g).toBeCloseTo(71 / 90, 6);
         for (const p of lvl.plots) expect(p.cycleS - 2 * CYCLE.halfEarly).toBeGreaterThan(g);
         let f = Infinity;
         for (let t = 0; t < 16; t++) for (const n of boundNodes(t, opts.deadline, lvl.plots, lvl.cycleHalfLate)) f = Math.min(f, Math.max(n.open, firstPress(n.plot)));
         const lastPress = opts.deadline - HARVEST.channelS;
         const maxH = Math.floor(1 + (lastPress - f) / g);
         let minMargin = Infinity;
         for (let h = 1; h <= maxH; h++) minMargin = Math.min(minMargin, limits.base! + limits.maxPointsPerSec! * (f + (h - 1) * g) - 200 * h);
         expect(minMargin).toBeGreaterThanOrEqual(0);
      }, 120000);
   }
});

describe("alien-farm levels: bots through the real store", () => {
   function drive(seed: number, bot: Bot, level: AlienFarmLevel): { score: number; elapsedMs: number } {
      const run = createRun(seed, level);
      const input: StepInput = { ...NONE };
      const store = createArcadeStore();
      const end = simulateRun(store, {
         durationMs: level.durationMs,
         resultDelayMs: 1600,
         maxFrames: 80000,
         frame: fixedFrames(1000 / 30),
         step: (dt, _time, s) => {
            bot(run, input);
            feedStore(run, stepRun(run, input, dt), s.getState());
         },
      });
      return { score: end.score, elapsedMs: end.elapsedMs };
   }

   for (const id of LEVEL_IDS) {
      it(`L${id} (${meta.levels![id - 1].title}): the human-paced bot clears >= 90 % of 30 seeds, greedy always, idle and camping never; all inside the limits`, () => {
         const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id], levelMeta = meta.levels![id - 1];
         const check = (r: { score: number; elapsedMs: number }) => {
            expect(withinServerLimits(r.score, r.elapsedMs, limits)).toBe(true);
            expect(capScore(r.score, r.elapsedMs, limits)).toBe(r.score);
            return isLevelCleared("timeup", r.score, levelMeta);
         };
         let human = 0, worst = Infinity;
         for (let s = 1; s <= 30; s++) { const r = drive(s * 977, humanBot(s), level); worst = Math.min(worst, r.score); if (check(r)) human++; }
         let greedy = 0;
         for (let s = 1; s <= 4; s++) if (check(drive(s * 977, greedyBot(), level))) greedy++;
         expect(check(drive(101, idleBot, level))).toBe(false);
         expect(drive(101, idleBot, level).score).toBe(0);
         const camp = drive(101, campBot(4), level);
         expect(camp.score).toBeLessThanOrEqual(400);
         expect(check(camp)).toBe(false);
         console.info(`ALIEN L${id}: human ${human}/30 clear (worst ${worst}), greedy ${greedy}/4, clearScore ${levelMeta.clearScore ?? "none (L5)"}`);
         if (levelMeta.clearScore !== undefined) {
            expect(human / 30).toBeGreaterThanOrEqual(0.9);
            expect(greedy).toBe(4);
         }
      }, 120000);
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
      // L2 keeps L1's ship; L4 and L5 fly faster
      expect(dL2).toBe(dL1);
      expect(dL4).toBeGreaterThan(dL1);

      const runL1 = createRun(42, LEVELS[1]);
      const runL2 = createRun(42, LEVELS[2]);
      const runL4 = createRun(42, LEVELS[4]);
      expect(runL1.level.shipSpeeds).toEqual([2, 2.5, 3]);
      expect(runL2.level.shipSpeeds).toEqual([2, 2.5, 3]);
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

   it("index.tsx hands each level its config", () => {
      for (const id of LEVEL_IDS) expect(definition.levels![id - 1].config).toBe(LEVELS[id]);
   });

   it("the level's spore life applies to natural bursts and to a mistimed press", () => {
      for (const id of LEVEL_IDS) {
         const life = LEVELS[id].sporesLifeS;
         // natural bursts: idle 30 s
         const idle = createRun(3, LEVELS[id]);
         while (idle.time < 30) stepRun(idle, NONE, 1 / 60);
         const burst = idle.plots.filter((p) => p.sporeFrom >= 0);
         expect(burst.length).toBeGreaterThan(0);
         for (const p of burst) expect(p.sporeTo - p.sporeFrom).toBeCloseTo(life, 9);
         // a press while the centre bed is still growing bursts it at once
         const run = createRun(3, LEVELS[id]), bed = run.plots[4];
         while (stageAt(bed, run.time) !== "growing") stepRun(run, NONE, 1 / 60);
         run.farmer.x = bed.x; run.farmer.z = bed.z + 0.5; run.farmer.vx = 0; run.farmer.vz = 0;
         stepRun(run, { dirX: 0, dirZ: 0, press: true }, 1 / 60);
         expect(bed.missed).toBeGreaterThanOrEqual(0);
         expect(bed.sporeTo - bed.sporeFrom).toBeCloseTo(life, 9);
      }
   });

   it("the ripe window a bed shows (nextWindow) uses the level's late half-window", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, LEVELS[id]), bed = run.plots[4];
         const out = { open: 0, close: 0, peak: 0, cycle: 0 };
         expect(nextWindow(bed, 80, out, 1000)).toBe(true);
         expect(out.peak).toBeGreaterThan(70);
         expect(out.close - out.peak).toBeCloseTo(LEVELS[id].cycleHalfLate, 9);
      }
   });

   it("sporesLifeS knob governs spore duration on bursts", () => {
      const runL1 = createRun(7, LEVELS[1]);
      const runL3 = createRun(7, LEVELS[3]);
      expect(runL1.level.sporesLifeS).toBe(5);
      expect(runL3.level.sporesLifeS).toBe(7);
   });
});

const L1_TODAY = [
   "2500:4878:049ef26b48d2739c",
   "3400:4885:ca87cdf6d1e9ec59",
   "5625:4915:5943b6240b2c62b7",
   "3650:4857:77b7e6382729f6f6",
   "3100:4887:6d9963b7b4422a0e",
   "4825:4865:6fe62c72b0d0019a",
   "3650:4895:c93274228b96fd5a",
   "3300:4909:4885092131c78411",
   "6075:4869:3bfcd490053657fc",
];

describe("alien-farm level 1 is today's game", () => {
   it("replays bit-exact against today's createRun (9 seeds, human-paced and greedy bots, ragged frames)", () => {
      for (let seed = 0; seed < L1_TODAY.length; seed++) {
         expect(l1Trace(rules as any, seed), `seed ${seed}`).toBe(L1_TODAY[seed]);
         expect(l1Trace(rules as any, seed, (s) => createRun(s, LEVELS[1])), `seed ${seed} L1`).toBe(L1_TODAY[seed]);
      }
   }, 120000);
});

/** Level 1 replay: a human-paced bot (seeded reactions and jitter) or the greedy bot drives a run on
 * ragged frames, and every frame's full serialized run (the new `level` field excluded) and step
 * events are hashed. Shape-agnostic, so the same code ran on today's rules.ts (origin/main before
 * levels) to record L1_TODAY. */
interface FarmRules { createRun(seed: number): any; stepRun(run: any, input: StepInput, dt: number): any }
function l1Trace(m: FarmRules, seed: number, make: (seed: number) => any = m.createRun): string {
   const run = make(seed), bot = seed % 3 === 2 ? greedyBot() : humanBot(seed);
   const input: StepInput = { dirX: 0, dirZ: 0, press: false };
   const hash = createHash("sha256");
   let frames = 0, rnd = seed * 2654435761 + 5;
   while (run.time < 100 - 1e-9 && frames++ < 12000) {
      rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
      const dt = [1 / 60, 1 / 30, 1 / 144, 0.05 * rnd / 4294967296][frames % 4];
      bot(run, input);
      const ev = m.stepRun(run, input, Math.min(dt, 100 - run.time));
      hash.update(JSON.stringify(run, (key, value) => key === "level" ? undefined : value));
      hash.update(JSON.stringify(ev));
   }
   return `${run.score}:${frames}:${hash.digest("hex").slice(0, 16)}`;
}
