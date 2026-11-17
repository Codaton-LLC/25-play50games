// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the limit proof per level, and a human-paced bot that can clear.
// The 200-seed store proof of level 1 stays in rules.test.ts (byte-identical). A full store
// loop of 200 seeds on every level would multiply that file's ~66 s; these tests prove each
// level's ceiling in closed form and drive a smaller store sample through the same harness.
import { describe, expect, it, vi } from "vitest";
import { createRng } from "../../core/math";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "../../core/levels";
import { capScore, withinServerLimits } from "../../core/limits";
import { fixedFrames, simulateRun } from "../../core/testing/botHarness";
import { createArcadeStore } from "../../core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "../../levelMeta";
import { LEVEL_IDS, type LevelId } from "../../types";
import definition from "./index";
import { LEVELS } from "./levels";
import { knightArenaMeta as meta } from "./meta";
import {
   BEAT,
   BEAT_TIMES_MS,
   BOUNDARY_GAP_MS,
   COMBO,
   PROPOSED_LEVEL_LIMITS,
   STAGES,
   TIMING,
   buildVariantSchedule,
   comboForStreak,
   createBeatMap,
   createRun,
   perfectScore,
   scoreCeiling,
   scoreCeilingFor,
   solveOptimalSpinSchedule,
   stepRun,
   travelXZ,
} from "./rules";

vi.mock("./Scene", () => ({
   KnightArenaScene: () => null,
   KnightArenaHud: () => null,
   CAMERA_CONFIG: { position: [0, 7.8, 6.2], lookAt: [0, 0.5, 0], fov: 45 },
}));

type Run = ReturnType<typeof createRun>;

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const beatsOf = (id: LevelId) => (id === 1 ? BEAT.BEAT_COUNT : buildVariantSchedule(LEVELS[id].bpm).beatTimesMs.length);
const slotsOf = (id: LevelId) => beatsOf(id) + sum(LEVELS[id].doubles);
const proposedMax = (slots: number, step: number) => {
   const ceiling = scoreCeilingFor(slots, step);
   const maxScore = Math.ceil((ceiling * 1.04) / 100) * 100;
   return { ceiling, maxScore, pps: Math.ceil(maxScore / 58) };
};

function runOracle(seed: number, id: LevelId, frameMs: number) {
   const level = LEVELS[id];
   const state = createRun(seed, level);
   const { spinBeats } = solveOptimalSpinSchedule(state.map);
   const handled = new Set<number>();
   const final = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      frame: fixedFrames(frameMs),
      step: (dt, time, store) => {
         const judgeMs = Math.max(0, (time - dt * 0.5) * 1000);
         let strikeDir: Run["swingDir"] | null = null;
         let spin = false;
         for (const cue of state.map.cues) {
            if (cue.kind === "tomato" || cue.status !== "pending") continue;
            if (handled.has(cue.beatIndex)) continue;
            if (Math.abs(judgeMs - cue.beatTimeMs) <= level.onBeatWindowMs) {
               handled.add(cue.beatIndex);
               if (spinBeats.has(cue.beatIndex) && state.spinMeter >= 100) spin = true;
               else strikeDir = cue.direction;
               break;
            }
         }
         stepRun(state, { strikeDir, spin }, dt, time);
         store.getState().setScore(state.score);
      },
   });
   return { final, perfect: perfectScore(state.map) };
}

function humanPresses(seed: number, id: LevelId) {
   const level = LEVELS[id];
   const state = createRun(seed, level);
   const rng = createRng(seed ^ 0x5a17);
   const normal = () => {
      const u1 = Math.max(1e-9, rng());
      const u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
   };
   const presses = new Map<number, { timeMs: number; dir: Run["swingDir"] }>();
   for (const cue of state.map.cues) {
      if (presses.has(cue.beatIndex)) continue;
      if (cue.kind === "tomato") {
         if (rng() < 0.04) presses.set(cue.beatIndex, { timeMs: cue.beatTimeMs + normal() * 50, dir: cue.direction });
         continue;
      }
      const lead = cue.beatTimeMs - cue.spawnTimeMs;
      const reaction = 150 + rng() * 100;
      if (lead >= reaction && rng() < 0.92) {
         const jitter = Math.max(-160, Math.min(160, normal() * 50));
         presses.set(cue.beatIndex, { timeMs: cue.beatTimeMs + jitter, dir: cue.direction });
      }
   }
   return { state, presses, level };
}

function runHuman(seed: number, id: LevelId) {
   const { state, presses, level } = humanPresses(seed, id);
   return simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      frame: fixedFrames(1000 / 60),
      step: (dt, time, store) => {
         const judgeMs = Math.max(0, (time - dt * 0.5) * 1000);
         let strikeDir: Run["swingDir"] | null = null;
         let spin = false;
         for (const [beat, action] of presses) {
            if (judgeMs >= action.timeMs) {
               presses.delete(beat);
               if (state.spinMeter >= 100) spin = true;
               else strikeDir = action.dir;
               break;
            }
         }
         stepRun(state, { strikeDir, spin }, dt, time);
         store.getState().setScore(state.score);
      },
   });
}

describe("knight-arena levels: declarations", () => {
   it("declares five levels with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(PROPOSED_LEVEL_LIMITS[1]).toEqual(meta.scoring);
      expect(meta.scoring).toEqual({
         kind: "points", maxScore: 11600, minDurationMs: 58000, maxDurationMs: 62000,
         base: 0, maxPointsPerSec: 200, unitLabel: "pts", display: "int",
      });
      expect(meta.levels!.map((level) => level.clearScore)).toEqual([4400, 4500, 5100, 6000, undefined]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) {
         if (id === 5) continue;
         const clear = meta.levels![id - 1].clearScore!;
         expect(clear).toBeGreaterThanOrEqual(1);
         expect(clear).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });

   it("level 1 is today's game: same grid, windows, combo, look and clock", () => {
      const level = LEVELS[1];
      expect(level.bpm).toEqual([100, 110, 120, 130]);
      expect(level.shields).toEqual([4, 4, 4]);
      expect(level.doubles).toEqual([0, 13, 16]);
      expect(level.tomatoes).toEqual([0, 9, 9]);
      expect(level.farFromBeat).toBe(23);
      expect(level.onBeatWindowMs).toBe(TIMING.ON_BEAT_WINDOW_MS);
      expect(level.comboStep).toBe(COMBO.STEP_HITS);
      expect(level.moving).toBe(false);
      expect(level.durationMs).toBe(BEAT.DURATION_MS);
      const plain = createBeatMap(101);
      const tagged = createBeatMap(101, level);
      expect(tagged.cues).toEqual(plain.cues);
      expect(tagged.beatCount).toBe(111);
      expect(tagged.beatTimesMs).toBe(BEAT_TIMES_MS);
      expect(tagged.stages).toBe(STAGES);
      expect(plain.cues.every((cue) => cue.originPostIndex === -1)).toBe(true);
      const run = createRun(101);
      expect(run.onBeatWindowMs).toBe(110);
      expect(run.comboStep).toBe(8);
      expect(run.durationMs).toBe(60_000);
      expect(run.bpm).toBe(100);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(definition.environment).toEqual({ background: "#2a1830", lighting: "sunset", fog: ["#3b2038", 16, 42] });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toBe(definition.hudStats);
      expect(levelRunConfig(definition, 1).durationMs).toBe(60_000);
      expect(scoreCeiling()).toBe(11090);
      expect(scoreCeilingFor(140, 8)).toBe(11090);
      expect(comboForStreak(25, 8)).toBe(comboForStreak(25));
   });

   it("levels 2-5 only change the line under the tiles, the instructions and the light", () => {
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["sunset", "day", "sunset", "night", "sunset"]);
      expect(levelEnvironment(definition, 4)!.background).toBe("#0b1020");
      expect(levelEnvironment(definition, 5)!.lighting).toBe("sunset");
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id).durationMs).toBe(60_000);
         expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
         expect(definition.levels![id - 1].description.length).toBeGreaterThan(0);
      }
      expect(levelInstructions(definition, 2).some((line) => /slide/i.test(line))).toBe(true);
      expect(levelInstructions(definition, 3).some((line) => /tighter/i.test(line))).toBe(true);
      expect(levelInstructions(definition, 4).some((line) => /combo/i.test(line))).toBe(true);
      expect(levelInstructions(definition, 5).some((line) => /tightest/i.test(line))).toBe(true);
      expect(meta.levels!.map((level) => level.title)).toEqual([
         "Basic Training", "Moving Targets", "Timed Course", "Combo Arena", "Royal Trial",
      ]);
   });
});

describe("knight-arena levels: difficulty", () => {
   it("is monotone: more beats and targets, never a wider window or a slower combo", () => {
      expect(LEVEL_IDS.map(beatsOf)).toEqual([111, 113, 118, 122, 128]);
      expect(LEVEL_IDS.map(slotsOf)).toEqual([140, 145, 156, 163, 176]);
      for (const id of LEVEL_IDS.slice(1)) {
         const prev = LEVELS[(id - 1) as LevelId];
         const level = LEVELS[id];
         for (let stage = 0; stage < 4; stage++) expect(level.bpm[stage]).toBeGreaterThanOrEqual(prev.bpm[stage]);
         expect(sum(level.shields)).toBeGreaterThanOrEqual(sum(prev.shields));
         expect(sum(level.doubles)).toBeGreaterThanOrEqual(sum(prev.doubles));
         expect(sum(level.tomatoes)).toBeGreaterThanOrEqual(sum(prev.tomatoes));
         expect(level.onBeatWindowMs).toBeLessThanOrEqual(prev.onBeatWindowMs);
         expect(level.comboStep).toBeLessThanOrEqual(prev.comboStep);
         expect(level.farFromBeat).toBeLessThanOrEqual(prev.farFromBeat);
         expect(slotsOf(id)).toBeGreaterThan(slotsOf((id - 1) as LevelId));
         expect(scoreCeilingFor(slotsOf(id), level.comboStep)).toBeGreaterThan(scoreCeilingFor(slotsOf((id - 1) as LevelId), prev.comboStep));
      }
      expect(LEVELS[2].moving).toBe(true);
      expect(LEVELS[5].moving).toBe(true);
   });

   it("every seed places the level's caps, and variant beats stay off the stage boundaries", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let n = 0; n < 40; n++) {
            const map = createBeatMap(1000 + n * 17 + id, level);
            expect(map.beatCount).toBe(beatsOf(id));
            expect(map.shieldCount).toBe(sum(level.shields));
            expect(map.doubleCount).toBe(sum(level.doubles));
            expect(map.tomatoCount).toBe(sum(level.tomatoes));
            expect(map.realSlotCount).toBe(slotsOf(id));
            expect(map.comboStep).toBe(level.comboStep);
            expect(map.beatTimesMs).toHaveLength(map.beatCount);
            for (let i = 1; i < map.beatTimesMs.length; i++) expect(map.beatTimesMs[i]).toBeGreaterThan(map.beatTimesMs[i - 1]);
            const tomatoes = map.cues.filter((cue) => cue.kind === "tomato");
            for (const tomato of tomatoes) {
               let overlaps = false;
               for (const cue of map.cues) {
                  if (cue.kind !== "tomato" && cue.direction === tomato.direction
                     && Math.abs(cue.beatTimeMs - tomato.beatTimeMs) <= TIMING.TOMATO_CLEARANCE_MS) overlaps = true;
               }
               expect(overlaps).toBe(false);
            }
            if (level.moving) {
               const moving = map.cues.filter((cue) => cue.originPostIndex >= 0);
               expect(moving.length).toBeGreaterThan(0);
               for (const cue of moving) {
                  expect(cue.ring).toBe("far");
                  expect(cue.kind).toBe("regular");
                  expect(cue.originPostIndex).toBe(cue.postIndex - 4);
               }
            } else {
               expect(map.cues.every((cue) => cue.originPostIndex === -1)).toBe(true);
            }
         }
      }
      for (const id of [2, 3, 4, 5] as const) {
         for (const t of buildVariantSchedule(LEVELS[id].bpm).beatTimesMs) {
            expect(t).toBeGreaterThanOrEqual(1500);
            expect(t).toBeLessThanOrEqual(59_600);
            expect(Math.abs(t - 15_000)).toBeGreaterThanOrEqual(BOUNDARY_GAP_MS);
            expect(Math.abs(t - 30_000)).toBeGreaterThanOrEqual(BOUNDARY_GAP_MS);
            expect(Math.abs(t - 45_000)).toBeGreaterThanOrEqual(BOUNDARY_GAP_MS);
         }
      }
   });

   it("a moving marker starts on the near post and arrives on the beat", () => {
      const map = createBeatMap(7, LEVELS[2]);
      const cue = map.cues.find((c) => c.originPostIndex >= 0)!;
      const at = { x: 0, z: 0 };
      const post = { x: 0, z: 0 };
      travelXZ(cue, cue.spawnTimeMs, at);
      travelXZ(cue, cue.beatTimeMs, post);
      expect(Math.hypot(at.x, at.z)).toBeCloseTo(1.6, 5);
      expect(Math.hypot(post.x, post.z)).toBeCloseTo(2.6, 5);
      const still = createBeatMap(7).cues[0];
      travelXZ(still, still.beatTimeMs, at);
      expect(Math.hypot(at.x, at.z)).toBeCloseTo(1.6, 5);
   });
});

describe("knight-arena levels: limit proof per level", () => {
   for (const id of LEVEL_IDS) it(`L${id}: B(t) <= maxScore, pps covers 58 s, and the DP optimum stays inside`, () => {
      const level = LEVELS[id];
      const { ceiling, maxScore, pps } = proposedMax(slotsOf(id), level.comboStep);
      const limits = PROPOSED_LEVEL_LIMITS[id];
      expect(limits.maxScore).toBe(maxScore);
      expect(limits.maxPointsPerSec).toBe(pps);
      expect(limits.base).toBe(0);
      expect(limits.minDurationMs).toBe(58000);
      expect(limits.maxDurationMs).toBe(62000);
      expect(limits.maxPointsPerSec! * (limits.minDurationMs / 1000)).toBeGreaterThanOrEqual(limits.maxScore);
      expect(ceiling).toBeLessThanOrEqual(limits.maxScore);
      expect(limits.maxScore / ceiling).toBeLessThanOrEqual(1.05);
      let best = 0;
      for (let n = 0; n < 80; n++) {
         const map = createBeatMap(2000 + n * 13 + id, level);
         const score = perfectScore(map);
         expect(score).toBeLessThanOrEqual(ceiling);
         expect(score).toBeGreaterThanOrEqual(Math.floor(limits.maxScore * 0.9));
         best = Math.max(best, score);
      }
      expect(best).toBeGreaterThanOrEqual(Math.floor(limits.maxScore * 0.9));
   });
});

describe("knight-arena levels: the same window for every device", () => {
   for (const id of LEVEL_IDS) it(`L${id}: a strike at the on-beat edge scores the same however it was pressed`, () => {
      const level = LEVELS[id];
      const beat = createRun(3, level).map.cues.find((cue) => cue.kind === "regular" && cue.doublePairId < 0 && cue.beatIndex < 2)!;
      const hit = (offset: number) => {
         const run = createRun(3, level);
         const cue = run.map.cues.find((c) => c.id === beat.id)!;
         stepRun(run, { strikeDir: cue.direction, spin: false }, 0.002, (cue.beatTimeMs + offset + 1) / 1000);
         return { grade: cue.hitGrade, score: run.score };
      };
      const on = hit(level.onBeatWindowMs);
      const off = hit(level.onBeatWindowMs + 1);
      expect(on.grade).toBe("onBeat");
      expect(on.score).toBe(20);
      expect(off.grade).toBe("offBeat");
      expect(off.score).toBe(10);
      const touch = createRun(3, level);
      const keys = createRun(3, level);
      const cue = touch.map.cues.find((c) => c.id === beat.id)!;
      const at = (cue.beatTimeMs + level.onBeatWindowMs + 1) / 1000;
      stepRun(touch, { strikeDir: cue.direction, spin: false }, 0.002, at);
      stepRun(keys, { strikeDir: cue.direction, spin: false }, 0.002, at);
      expect(touch.score).toBe(keys.score);
      expect(touch.map.cues.find((c) => c.id === cue.id)!.hitGrade).toBe(keys.map.cues.find((c) => c.id === cue.id)!.hitGrade);
   });
});

describe("knight-arena levels: bots", () => {
   it("the oracle on the store reaches the map optimum and stays inside the limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         for (const seed of [101, 202, 303]) {
            const { final, perfect } = runOracle(seed, id, 1000 / 60);
            expect(final.phase).toBe("over");
            expect(final.endReason).toBe("timeup");
            expect(final.score).toBeGreaterThanOrEqual(Math.floor(perfect * 0.97));
            expect(withinServerLimits(final.score, final.elapsedMs, limits)).toBe(true);
            expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
         }
      }
   });

   it("an idle run and a direction mash never clear, and stay inside the limits", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const clear = meta.levels![id - 1].clearScore ?? 6400;
         const idle = createRun(11, level);
         stepRun(idle, { strikeDir: null, spin: false }, level.durationMs / 1000, level.durationMs / 1000);
         expect(idle.score).toBe(0);
         expect(idle.finished).toBe(true);
         const mash = createRun(11, level);
         const rng = createRng(99);
         let next = 120;
         const mashed = simulateRun(createArcadeStore(), {
            durationMs: level.durationMs,
            frame: fixedFrames(1000 / 30),
            step: (dt, time, store) => {
               const nowMs = time * 1000;
               let strikeDir: Run["swingDir"] | null = null;
               if (nowMs >= next) {
                  strikeDir = (["up", "down", "left", "right"] as const)[Math.floor(rng() * 4)];
                  next = nowMs + 110 + rng() * 90;
               }
               stepRun(mash, { strikeDir, spin: false }, dt, time);
               store.getState().setScore(mash.score);
            },
         });
         expect(mashed.score).toBeLessThan(clear);
         expect(withinServerLimits(mashed.score, mashed.elapsedMs, limits)).toBe(true);
         expect(capScore(mashed.score, mashed.elapsedMs, limits)).toBe(mashed.score);
      }
   });

   it("the human-paced bot clears at least 90% of seeds on every level", () => {
      const seeds = [4, 11, 18, 27, 36, 42, 55, 63, 71, 88];
      for (const id of LEVEL_IDS) {
         const clear = meta.levels![id - 1].clearScore ?? 6400;
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let cleared = 0;
         const scores: number[] = [];
         for (const seed of seeds) {
            const final = runHuman(seed, id);
            scores.push(final.score);
            expect(withinServerLimits(final.score, final.elapsedMs, limits)).toBe(true);
            expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
            if (final.score >= clear) cleared++;
         }
         expect(cleared, `L${id} scores ${scores.join(",")}`).toBeGreaterThanOrEqual(9);
      }
   });
});
