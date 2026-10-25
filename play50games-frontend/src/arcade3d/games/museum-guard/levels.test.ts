// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the analytic limit proof per level, and the same timings on touch and keys.
// Bot clear rates are in levels.bots.test.ts.
import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { museumGuardMeta as meta } from "./meta";
import {
   BEAM, FLASH, PHASES, PROPOSED_LEVEL_LIMITS, PROPOSED_LIMITS, SCORE, TURN_RATE,
   beamHalfFor, boundScore, createRun, earliestLoseS, earliestStartTimes, levelCeiling, levelStarts, stepGame,
   type GuardInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const prev = (id: LevelId): LevelId => (id - 1) as LevelId;
const add = (n: readonly number[]) => n[0] + n[1] + n[2];
const fast = (id: LevelId) => LEVELS[id].roster[2] + LEVELS[id].roster[3];

describe("museum-guard levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's game: same phases, beam, roster, limits, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect([...l1.ends]).toEqual([...PHASES.ends]);
      expect(l1.dawn).toBe(PHASES.dawn);
      expect([...l1.speed]).toEqual([...PHASES.speed]);
      expect([...l1.cap]).toEqual([...PHASES.cap]);
      expect([...l1.starts]).toEqual([...PHASES.starts]);
      expect([...l1.gap]).toEqual([...PHASES.gap]);
      expect(l1.first).toBe(PHASES.first);
      expect([...l1.beam]).toEqual([...BEAM.halfDeg]);
      expect([...l1.roster]).toEqual([2, 2, 2, 2]);
      expect(levelCeiling(l1)).toBe(SCORE.ceiling);
      expect(earliestLoseS(l1)).toBeCloseTo(13.79, 2);
      const dealt = createRun(4);
      const again = createRun(4, l1);
      expect(dealt.level).toBe(l1);
      expect(dealt.exhibits.map((ex) => ex.kind)).toEqual(again.exhibits.map((ex) => ex.kind));
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(definition.environment).toEqual({ background: "#1e1b4b", fog: ["#1e1b4b", 18, 28], lighting: "night" });
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: 1100 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
      expect(meta.scoring).toEqual({ kind: "points", maxScore: 2050, minDurationMs: 12000, maxDurationMs: 92000, base: 0, maxPointsPerSec: 25, unitLabel: "pts", display: "int" });
   });

   it("only lighting and the extra instruction change around the same run config", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
      }
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["night", "night", "night", "night", "space"]);
      expect(levelInstructions(definition, 2)).toHaveLength(4);
      expect(levelInstructions(definition, 1)).toHaveLength(3);
      expect(meta.levels!.map((level) => level.title)).toEqual(["Main Hall", "Ancient Wing", "Art Wing", "Science Wing", "Full Museum Night"]);
   });
});

describe("museum-guard levels: difficulty", () => {
   it("is monotone: more departures, never a slower patrol, never a wider beam, never fewer fast statues", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(level.roster.reduce((a, b) => a + b, 0)).toBe(8);
         expect(level.ends[2]).toBe(level.dawn);
         expect(level.ends[0]).toBeLessThan(level.ends[1]);
         expect(level.ends[1]).toBeLessThan(level.ends[2]);
         expect(level.first).toBe(PHASES.first);
         expect(level.speed[0]).toBe(1);
         expect(level.cap[2]).toBeLessThanOrEqual(3);
      }
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[prev(id)], b = LEVELS[id];
         expect(add(b.starts)).toBeGreaterThan(add(a.starts));
         expect(b.dawn).toBeGreaterThanOrEqual(a.dawn);
         for (let phase = 0; phase < 3; phase++) {
            expect(b.speed[phase]).toBeGreaterThanOrEqual(a.speed[phase]);
            expect(b.cap[phase]).toBeGreaterThanOrEqual(a.cap[phase]);
            expect(b.gap[phase]).toBeLessThanOrEqual(a.gap[phase]);
            expect(b.beam[phase]).toBeLessThanOrEqual(a.beam[phase]);
         }
         expect(fast(id)).toBeGreaterThanOrEqual(fast(prev(id)));
      }
      expect(LEVELS[4].cap[0]).toBe(3);
      expect(fast(5)).toBeGreaterThan(fast(1));
      expect(LEVELS[5].beam[2]).toBeLessThan(LEVELS[1].beam[2]);
   });

   it("deals the level's roster, and every configured departure fits before the hold can miss dawn", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const counts = { knight: 0, robot: 0, penguin: 0, dino: 0 };
         for (const ex of createRun(id * 17, level).exhibits) counts[ex.kind] += 1;
         expect(counts).toEqual({ knight: level.roster[0], robot: level.roster[1], penguin: level.roster[2], dino: level.roster[3] });
         const starts = earliestStartTimes(level);
         expect(starts.length).toBe(levelStarts(level));
         expect(starts[0]).toBe(level.first);
         expect(starts[starts.length - 1] + BEAM.hold).toBeLessThanOrEqual(level.dawn);
         for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(Math.min(...level.gap) - 1e-9);
      }
   });
});

describe("museum-guard levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: B(t) <= base + pps t, the ceiling, and the duration window`, () => {
      const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id], starts = earliestStartTimes(level);
      const ceiling = levelCeiling(level);
      expect(boundScore(level, level.dawn, starts)).toBe(ceiling);
      expect(limits.maxScore).toBeGreaterThanOrEqual(ceiling);
      expect(limits.maxScore).toBeLessThanOrEqual(Math.ceil(ceiling * 1.06));
      let slope = 0;
      for (let sec = 1; sec <= level.dawn; sec++) {
         const score = boundScore(level, sec, starts);
         expect(score).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * sec);
         slope = Math.max(slope, score / sec);
      }
      for (const start of starts) {
         const t = start + BEAM.hold;
         const score = boundScore(level, t, starts);
         expect(score).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * t + 1e-6);
         slope = Math.max(slope, score / t);
      }
      expect(limits.maxPointsPerSec).toBe(25);
      expect(slope).toBeLessThanOrEqual(25);
      const lose = earliestLoseS(level);
      expect(limits.minDurationMs).toBeLessThanOrEqual(lose * 1000 - 900);
      expect(limits.minDurationMs).toBeGreaterThan(lose * 1000 - 2500);
      expect(limits.maxDurationMs).toBe(level.dawn * 1000 + 2000);
      expect(limits.base).toBe(0);
   });
});

describe("museum-guard levels: touch and keys share the timings", () => {
   const dt = 1 / 60;

   function hold(coarse: boolean, id: LevelId): number {
      const run = createRun(3, LEVELS[id]);
      const ex = run.exhibits[0];
      ex.kind = "knight";
      ex.mode = "sneaking";
      run.yaw = run.pedestals[0].angle;
      const live: GuardInput = { moveX: 0, pointerX: null, dragYaw: coarse ? run.yaw : null, coarse, flash: false };
      const mode = () => run.exhibits[0].mode;
      let t = 0;
      while (mode() !== "returning" && t < 2) {
         t += dt;
         if (coarse) live.dragYaw = run.yaw;
         stepGame(run, live, dt, t);
      }
      return t;
   }

   it("a centred hold finishes at 0.7 s on every level, for keys and for touch", () => {
      for (const id of LEVEL_IDS) {
         const keys = hold(false, id);
         const touch = hold(true, id);
         expect(keys).toBeCloseTo(BEAM.hold, 2);
         expect(touch).toBeCloseTo(keys, 5);
      }
   });

   it("flash lasts 1.2 s and the turn cap is π rad/s on every level, for both hands", () => {
      for (const id of LEVEL_IDS) {
         for (const coarse of [false, true]) {
            const run = createRun(5, LEVELS[id]);
            const live: GuardInput = { moveX: 1, pointerX: null, dragYaw: null, coarse, flash: true };
            stepGame(run, live, dt, dt);
            expect(run.flashLeft).toBeCloseTo(FLASH.duration - dt, 5);
            expect(run.yaw).toBeCloseTo(TURN_RATE * dt, 5);
            let t = dt;
            while (t < FLASH.duration - dt) {
               t += dt;
               live.flash = true;
               live.moveX = 0;
               stepGame(run, live, dt, t);
            }
            expect(run.flashLeft).toBeGreaterThan(0);
            stepGame(run, live, dt, t + dt);
            expect(run.flashLeft).toBe(0);
            expect(run.cooldown).toBeGreaterThan(FLASH.cooldown - FLASH.duration - 0.05);
         }
         const wide = beamHalfFor(LEVELS[id].beam, 0, true);
         const fine = beamHalfFor(LEVELS[id].beam, 0, false);
         expect(wide).toBeGreaterThanOrEqual(fine);
         expect(wide).toBeLessThanOrEqual((BEAM.coarseCapDeg * Math.PI) / 180 + 1e-9);
      }
   });
});
