// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the closed-form limit proof per level, the lattice on every level, and
// the honest-bot clear rates. rules.test.ts stays the level-1 proof and is not edited here.
import { describe, expect, it, vi } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { rngNext, type RngState } from "@/arcade3d/core/math";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, type FactoryLevel } from "./levels";
import { robotFactoryMeta as meta } from "./meta";
import {
   BELT,
   EARLIEST_LOSS_S,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   SHIFT,
   STREAM,
   beltSpeed,
   blueprintHas,
   capScore,
   createRun,
   createShown,
   earliestLossS,
   inZone,
   isWanted,
   maxInstalls,
   NO_INPUT,
   perfectScore,
   robotsFor,
   stepRun,
   syncStore,
   withinServerLimits,
   type FrameInput,
   type Run,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null, CAMERA: { position: [0, 7.2, 8.5], fov: 40, lookAt: [0, 0.75, 0.1] } }));

const input = (grab: boolean, scrap: boolean, target = -1): FrameInput => ({ grab, scrap, target });
const prev = (id: LevelId): FactoryLevel => LEVELS[(id - 1) as LevelId];

/** Installs, robots and points at the end of the shift if every needed part is taken at the top combo. */
function ceiling(level: FactoryLevel): { installs: number; robots: number; score: number } {
   const installs = maxInstalls(level.duration, level);
   const robots = robotsFor(installs);
   return { installs, robots, score: perfectScore(installs, robots) };
}

/** Longest a missed needed part can take to re-enter the grab zone, at the slowest belt. */
const fairnessWait = (level: FactoryLevel) => level.period + BELT.GRAB_MIN / level.v0;

const perfectBot = (run: Run): FrameInput => {
   let grab = -1;
   let scrap = -1;
   for (const p of run.parts) {
      if (!inZone(p)) continue;
      if (p.faulty) scrap = p.uid;
      else if (isWanted(run, p)) grab = p.uid;
   }
   if (grab >= 0) return input(true, false, grab);
   return input(false, scrap >= 0, scrap);
};

/** The level-1 human bot (rules.test.ts): 150-250 ms, sometimes 400-600, 6 % mis-aim, 5 % of faults overlooked. */
function humanBot(seed: number): (run: Run, seen: Map<number, number>) => FrameInput {
   const rng: RngState = { s: seed * 7919 + 13 };
   const delay = new Map<number, number>();
   const ignored = new Set<number>();
   return (run, seen) => {
      for (const p of run.parts) {
         if (!inZone(p) || delay.has(p.uid)) continue;
         const slow = rngNext(rng) < 0.08;
         delay.set(p.uid, slow ? 0.4 + 0.2 * rngNext(rng) : 0.15 + 0.1 * rngNext(rng));
         if (p.faulty && rngNext(rng) < 0.05) ignored.add(p.uid);
      }
      if (run.lockout > 0) return NO_INPUT;
      for (const p of run.parts) {
         if (!inZone(p) || run.t - (seen.get(p.uid) ?? run.t) < (delay.get(p.uid) ?? 1)) continue;
         if (p.faulty && !ignored.has(p.uid)) return input(false, true, p.uid);
         if (!p.faulty && isWanted(run, p)) {
            if (rngNext(rng) < 0.06) {
               const other = run.parts.find((q) => q !== p && inZone(q));
               if (other) return input(true, false, other.uid);
            }
            return input(true, false, p.uid);
         }
      }
      return NO_INPUT;
   };
}

function look(run: Run, seen: Map<number, number>) {
   for (const p of run.parts) if (inZone(p) && !seen.has(p.uid)) seen.set(p.uid, run.t);
}

/** One shift, stepped directly. Returns when the rules end it. */
function play(level: FactoryLevel, seed: number, decide: (run: Run, seen: Map<number, number>) => FrameInput, frame: () => number) {
   const run = createRun(seed, level);
   const seen = new Map<number, number>();
   let gapOk = true;
   let disjoint = true;
   let waitMax = 0;
   let lastMiss = -1;
   while (!run.over) {
      look(run, seen);
      stepRun(run, decide(run, seen), frame());
      // grabs happen before spawns, so the robot at the end of the frame is the one the spawn was banned from
      const robot = run.robot;
      for (const p of run.parts) {
         if (!inZone(p) || !seen.has(p.uid)) continue;
         if (isWanted(run, p) && lastMiss >= 0) {
            waitMax = Math.max(waitMax, run.t - lastMiss);
            lastMiss = -1;
         }
      }
      for (let i = 0; i < run.eventCount; i++) {
         const e = run.events[i];
         if (e.kind === "missed" && lastMiss < 0) lastMiss = run.t;
         if (e.kind !== "spawn") continue;
         const part = run.parts.find((p) => p.uid === e.uid);
         if (!part) continue;
         if (!part.needed) {
            const pair = part.kind * 4 + part.colour;
            if (blueprintHas(run, robot, pair) || blueprintHas(run, robot + 1, pair)) disjoint = false;
         }
         for (const q of run.parts) {
            if (q.active && q !== part && Math.abs(q.sEq - part.sEq) < STREAM.MIN_PART_GAP - 1e-9) gapOk = false;
         }
      }
   }
   return { run, gapOk, disjoint, waitMax };
}

describe("robot-factory levels: declarations", () => {
   it("declares five levels in meta and the definition", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels!.map((level) => level.title)).toEqual(["Basic Sort", "Shape Sort", "Color + Shape", "Fast Factory", "Overdrive"]);
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);
      // level 1 stays the provisional set until Claude copies PROPOSED_LIMITS; 2-5 are already the proof
      expect(scoringFor(meta, 1)).toEqual(meta.scoring);
      expect(meta.scoring).toMatchObject({ maxScore: 6000, minDurationMs: 10000, maxDurationMs: 92000, base: 6000, maxPointsPerSec: 6000 });
      for (const id of LEVEL_IDS.slice(1)) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(PROPOSED_LEVEL_LIMITS[1]).toBe(PROPOSED_LIMITS);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's shift: the same constants, clock, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect(l1).toMatchObject({
         duration: SHIFT.DURATION, winQuota: SHIFT.WIN_QUOTA, v0: BELT.V0, v1: BELT.V1, growth: BELT.GROWTH, vMax: BELT.V_MAX,
         feederT: BELT.FEEDER_T, period: STREAM.PERIOD, half: STREAM.HALF, faultyChance: STREAM.FAULTY_CHANCE,
         faultMinInterval: STREAM.FAULT_MIN_INTERVAL, sorter: false,
      });
      expect(earliestLossS(l1)).toBeCloseTo(EARLIEST_LOSS_S, 9);
      expect(maxInstalls(90, l1)).toBe(maxInstalls(90));
      expect(beltSpeed(14, l1)).toBe(beltSpeed(14));
      const bare = createRun(5);
      const named = createRun(5, l1);
      expect(bare.level).toBe(l1);
      expect(bare.stepKind).toEqual(named.stepKind);
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: SHIFT.LIVES, resultDelayMs: SHIFT.RESULT_DELAY_MS });
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(levelEnvironment(definition, 1)).toEqual({ background: "#0f172a", fog: ["#0f172a", 24, 42], lighting: "indoor" });
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
      expect(levelHudStats(definition, 1)![0].max).toBeUndefined();
      expect(levelInstructions(definition, 1)).toEqual([
         "Grab the ringed part the blueprint wants next: tap it, or Space.",
         "Swipe down on a sparking faulty part (or S / Down) to scrap it. Grabbing one is a strike.",
         "Build 5 robots in the 90 s shift. Clean grabs build a combo.",
      ]);
   });

   it("keeps the indoor bay, the shell clock off, and a quota chip on levels 2-5", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(levelEnvironment(definition, id)!.lighting).toBe("indoor");
         expect(levelHudStats(definition, id)!.map((stat) => stat.key)).toEqual(["robots", "combo", "time"]);
      }
      for (const id of LEVEL_IDS.slice(1)) {
         expect(levelHudStats(definition, id)![0].max).toBe(LEVELS[id].winQuota);
         expect(levelInstructions(definition, id).at(-1)).toBe(
            `Build ${LEVELS[id].winQuota} robots in the ${LEVELS[id].duration} s shift. Clean grabs build a combo.`,
         );
      }
      expect(levelInstructions(definition, 4).some((line) => line.includes("sorting"))).toBe(true);
      expect(levelInstructions(definition, 5).some((line) => line.includes("sorting"))).toBe(true);
   });
});

describe("robot-factory levels: difficulty", () => {
   it("is monotone: quota, speed and faults never ease off, and each level adds pressure", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.duration).toBeGreaterThanOrEqual(a.duration);
         expect(b.winQuota).toBeGreaterThanOrEqual(a.winQuota);
         expect(b.v1).toBeGreaterThanOrEqual(a.v1);
         expect(b.growth).toBeGreaterThanOrEqual(a.growth);
         expect(b.vMax).toBeGreaterThanOrEqual(a.vMax);
         expect(b.feederT).toBeLessThanOrEqual(a.feederT);
         expect(b.faultyChance).toBeGreaterThanOrEqual(a.faultyChance);
         expect(b.faultMinInterval).toBeLessThanOrEqual(a.faultMinInterval);
         expect(b.period).toBeLessThanOrEqual(a.period);
         expect(b.half).toBeLessThanOrEqual(a.half);
         if (a.sorter) expect(b.sorter).toBe(true);
         const pressure = b.winQuota + b.vMax + b.faultyChance + (60 - b.feederT) + (4 - b.period);
         const before = a.winQuota + a.vMax + a.faultyChance + (60 - a.feederT) + (4 - a.period);
         expect(pressure).toBeGreaterThan(before);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].winQuota)).toEqual([5, 6, 7, 9, 11]);
      expect(LEVELS[4].sorter).toBe(true);
      expect(LEVELS[5].sorter).toBe(true);
   });

   it("keeps the lattice fair: half a period clears the gap, and a miss is replaced inside 4 s", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(level.half * level.v0).toBeGreaterThanOrEqual(STREAM.MIN_PART_GAP);
         expect(fairnessWait(level)).toBeLessThan(4);
         // a wrong grab's 1.0 s lockout still outlasts a part's time in the 1.8 m grab zone
         expect((BELT.GRAB_MAX - BELT.GRAB_MIN) / level.vMax).toBeLessThan(1);
      }
   });
});

describe("robot-factory levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: the closed form fits its proposed limits, and the ceiling never falls`, () => {
      const level = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const top = ceiling(level);
      const earliest = earliestLossS(level);
      expect(top.score).toBeLessThanOrEqual(limits.maxScore);
      expect(top.score).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      expect(top.score).toBeGreaterThanOrEqual(ceiling(LEVELS[1]).score);
      expect(top.score).toBeLessThanOrEqual(3 * ceiling(LEVELS[1]).score);
      expect(limits.minDurationMs).toBeLessThanOrEqual(earliest * 1000);
      expect(limits.minDurationMs).toBeGreaterThan(earliest * 1000 * 0.95);
      expect(limits.maxDurationMs).toBeGreaterThanOrEqual(level.duration * 1000 + 2000);
      expect(limits.maxDurationMs).toBeLessThanOrEqual(level.duration * 1000 + 2000);
      for (let t = 0; t <= level.duration + 1e-9; t += 0.01) {
         const m = maxInstalls(t, level);
         const bound = perfectScore(m, robotsFor(m));
         expect(bound).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * t);
         expect(5 * robotsFor(m)).toBeLessThanOrEqual(m + 7);
      }
      expect(withinServerLimits(top.score, level.duration * 1000, limits)).toBe(true);
      expect(capScore(top.score, level.duration * 1000, limits)).toBe(top.score);
   });
});

describe("robot-factory levels: lattice and bots", () => {
   it("keeps the gaps and the disjoint distractors on every level (40 seeds)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 40; seed++) {
            const played = play(level, seed, seed % 2 === 0 ? perfectBot : () => NO_INPUT, () => 1 / 30);
            expect(played.run.skippedSpawns, `L${id} seed ${seed}`).toBe(0);
            expect(played.gapOk, `L${id} seed ${seed}`).toBe(true);
            expect(played.disjoint, `L${id} seed ${seed}`).toBe(true);
            expect(played.waitMax, `L${id} seed ${seed}`).toBeLessThanOrEqual(fairnessWait(level) + 1 / 30 + 1e-6);
            expect(played.run.t).toBeGreaterThanOrEqual(earliestLossS(level) - 1e-6);
         }
      }
   }, 60000);

   it("the oracle hits the ceiling on 30 seeds per level and stays inside the limits", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const top = ceiling(level);
         const limits = PROPOSED_LEVEL_LIMITS[id];
         for (let seed = 1; seed <= 30; seed++) {
            const frame = seed % 3 === 0 ? () => 1 / 30 : seed % 3 === 1 ? () => 1 / 60 : () => 1 / 144;
            const { run } = play(level, seed, perfectBot, frame);
            expect(run.outcome, `L${id} seed ${seed}`).toBe("win");
            expect(run.partsInstalled, `L${id} seed ${seed}`).toBe(top.installs);
            expect(run.robot, `L${id} seed ${seed}`).toBe(top.robots);
            expect(run.score, `L${id} seed ${seed}`).toBe(top.score);
            expect(run.score).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
            expect(withinServerLimits(run.score, level.duration * 1000, limits)).toBe(true);
         }
      }
   }, 60000);

   it("a human-like player clears at least 90 % of seeds, and idle never does", () => {
      const rates: Record<number, { wins: number; mean: number }> = {};
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         let wins = 0;
         let total = 0;
         for (let seed = 1; seed <= 200; seed++) {
            const frame = randomFrames(seed + 500, 0.012, 0.05);
            const { run } = play(level, seed, humanBot(seed), frame);
            if (run.outcome === "win") wins++;
            total += run.score;
            expect(run.t).toBeGreaterThanOrEqual(earliestLossS(level) - 1e-6);
            expect(withinServerLimits(run.score, run.t * 1000, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
            expect(capScore(run.score, run.t * 1000, PROPOSED_LEVEL_LIMITS[id])).toBe(run.score);
         }
         rates[id] = { wins, mean: Math.round(total / 200) };
         expect(wins, `L${id}`).toBeGreaterThanOrEqual(180);
         let idleWins = 0;
         for (let seed = 1; seed <= 20; seed++) {
            const { run } = play(level, seed, () => NO_INPUT, () => 1 / 30);
            if (run.outcome === "win") idleWins++;
            expect(run.score).toBe(0);
            expect(isLevelCleared(run.outcome, run.score, meta.levels![id - 1])).toBe(false);
         }
         expect(idleWins).toBe(0);
      }
      console.info("robot-factory level clear rates", JSON.stringify(rates));
   }, 120000);

   it("spam, mash and a store run stay inside each level's limits", () => {
      const spam = () => input(true, false);
      const mash = (run: Run) => input(Math.floor(run.t * 30) % 2 === 0, Math.floor(run.t * 30) % 2 === 1);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         for (const decide of [spam, mash]) {
            for (let seed = 1; seed <= 12; seed++) {
               const { run } = play(level, seed, decide, randomFrames(seed + 1300, 0.016, 0.05));
               expect(run.t * 1000, `L${id} seed ${seed}`).toBeGreaterThanOrEqual(earliestLossS(level) * 1000 - 1);
               expect(withinServerLimits(run.score, run.t * 1000, limits)).toBe(true);
               expect(capScore(run.score, run.t * 1000, limits)).toBe(run.score);
            }
         }
         // one run through the real store, the way Scene drives a level
         for (const hz of [30, 60, 144]) {
            const store = createArcadeStore();
            const run = createRun(id * 100 + hz, level);
            const shown = createShown();
            const end = simulateRun(store, {
               lives: SHIFT.LIVES,
               resultDelayMs: SHIFT.RESULT_DELAY_MS,
               frame: fixedFrames(1000 / hz),
               step: (dt) => {
                  stepRun(run, perfectBot(run), dt);
                  syncStore(run, store.getState(), shown);
               },
            });
            expect(end.phase).toBe("over");
            expect(end.endReason).toBe("win");
            expect(end.score).toBe(ceiling(level).score);
            expect(withinServerLimits(end.score, end.elapsedMs, limits)).toBe(true);
            expect(capScore(end.score, end.elapsedMs, limits)).toBe(end.score);
            expect(isLevelCleared(end.endReason, end.score, meta.levels![id - 1])).toBe(true);
         }
      }
   }, 120000);
});
