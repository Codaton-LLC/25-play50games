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
   BEAM, EXITS, FLASH, PHASES, PROPOSED_LEVEL_LIMITS, PROPOSED_LIMITS, RING, SCORE, TURN_RATE,
   beamHalfFor, boundScore, createRun, earliestLoseS, earliestStartTimes, inPedestalSquare, levelCeiling, levelStarts,
   makePedestal, pointOnPath, stepGame, wrapAngle,
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

describe("museum-guard levels: wing look, prop bounds, and twists", () => {
   it("gives each of the five levels its own wing theme, twist, palette, environment background, and set piece", () => {
      const wings = new Set(LEVEL_IDS.map((id) => LEVELS[id].wing));
      const twists = new Set(LEVEL_IDS.map((id) => LEVELS[id].twist));
      const setPieces = new Set(LEVEL_IDS.map((id) => LEVELS[id].decor.setPiece));
      const walls = new Set(LEVEL_IDS.map((id) => LEVELS[id].palette.wallMid));
      const floors = new Set(LEVEL_IDS.map((id) => LEVELS[id].palette.floorCore));
      const skylights = new Set(LEVEL_IDS.map((id) => LEVELS[id].palette.skylight));
      const ropes = new Set(LEVEL_IDS.map((id) => LEVELS[id].palette.velvet));
      const backgrounds = new Set(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.background));
      expect(wings.size).toBe(5);
      expect(twists.size).toBe(5);
      expect(setPieces.size).toBe(5);
      expect(walls.size).toBe(5);
      expect(floors.size).toBe(5);
      expect(skylights.size).toBe(5);
      expect(ropes.size).toBe(5);
      expect(backgrounds.size).toBe(5);
   });

   it("keeps every level's props and lane paths out of the play area, inside the wall, and clear of the exit doors", () => {
      const playRadius = Math.hypot(RING.pedestalR + RING.pedestalHalf, RING.pedestalHalf);
      const wallRadius = 7.9;
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const d = level.decor;
         const outerGroups: Array<{ spots: typeof d.vaseSpots; halfR: number; halfT: number }> = [
            { spots: d.vaseSpots, halfR: 0.16, halfT: 0.16 },
            { spots: d.sarcophagusSpots, halfR: 0.58, halfT: 0.7 },
            { spots: d.bustSpots, halfR: 0.24, halfT: 0.24 },
            { spots: d.chestSpots, halfR: 0.3, halfT: 0.45 },
            { spots: d.rocketSpots, halfR: 0.54, halfT: 0.54 },
            { spots: d.glowPodSpots, halfR: 0.34, halfT: 0.34 },
            { spots: d.cannonSpots, halfR: 0.4, halfT: 0.55 },
            { spots: d.benchSpots.filter((s) => Math.hypot(s.x, s.z) > 5), halfR: 0.43, halfT: 1.0 },
         ];
         for (const group of outerGroups) {
            for (const spot of group.spots) {
               const r = Math.hypot(spot.x, spot.z);
               const a = Math.atan2(spot.x, spot.z);
               expect(r - group.halfR).toBeGreaterThan(playRadius);
               expect(Math.hypot(r + group.halfR, group.halfT)).toBeLessThan(wallRadius);
               expect(Math.abs(wrapAngle(a - EXITS.pos))).toBeGreaterThanOrEqual(0.35);
               expect(Math.abs(wrapAngle(a - EXITS.neg))).toBeGreaterThanOrEqual(0.35);
            }
         }
         for (const spot of d.benchSpots.filter((s) => Math.hypot(s.x, s.z) <= 5)) {
            const r = Math.hypot(spot.x, spot.z);
            expect(r).toBeGreaterThan(1.9);
            expect(r + 0.45).toBeLessThan(RING.laneR - 0.45);
         }
         for (const a of d.setPieceAngles) {
            expect(Math.abs(wrapAngle(a - EXITS.pos))).toBeGreaterThanOrEqual(0.35);
            expect(Math.abs(wrapAngle(a - EXITS.neg))).toBeGreaterThanOrEqual(0.35);
         }
         const run = createRun(id * 11, level);
         for (const ped of run.pedestals) {
            const end = pointOnPath(ped, ped.length);
            expect(Math.hypot(end.x - ped.exitX, end.z - ped.exitZ)).toBeLessThan(1e-9);
            for (let s = RING.inward; s <= ped.length; s += 0.1) {
               const p = pointOnPath(ped, s);
               const r = Math.hypot(p.x, p.z);
               expect(r).toBeGreaterThanOrEqual(RING.laneR - 1e-9);
               expect(r).toBeLessThan(RING.pedestalR - RING.pedestalHalf);
               for (let k = 0; k < RING.count; k++) expect(inPedestalSquare(makePedestal(k), p.x, p.z)).toBe(false);
            }
         }
      }
   });

   it("applies per-level twists (L2 cordon, L3 paired chain, L4 turntable jitter, L5 alternating exit) while keeping L1 baseline", () => {
      // L2 (cordon): north pedestals bow outward around the cordon and block simultaneous north starts
      const r2 = createRun(7, LEVELS[2]);
      const mid2 = pointOnPath(r2.pedestals[0], (RING.inward + r2.pedestals[0].length) / 2);
      expect(Math.hypot(mid2.x, mid2.z)).toBeGreaterThan(RING.laneR + 0.15);
      r2.exhibits[0].mode = "sneaking";
      r2.exhibits[7].kind = "knight";
      r2.yaw = Math.PI;
      stepGame(r2, { moveX: 0, pointerX: null, dragYaw: null, coarse: false, flash: false }, 1 / 60, 3.1);
      expect(r2.exhibits[7].mode).toBe("still");

      // L3 (paired): sending a statue home queues its paired counterpart kind
      const r3 = createRun(8, LEVELS[3]);
      r3.exhibits[0].kind = "robot";
      r3.exhibits[0].mode = "sneaking";
      r3.exhibits[0].s = 1.5;
      pointOnPath(r3.pedestals[0], 1.5, r3.exhibits[0]);
      r3.yaw = Math.atan2(r3.exhibits[0].x, r3.exhibits[0].z);
      for (let step = 1; step <= 43; step++) {
         stepGame(r3, { moveX: 0, pointerX: null, dragYaw: null, coarse: false, flash: false }, 1 / 60, step / 60);
      }
      expect(r3.exhibits[0].mode).toBe("returning");
      expect(r3.chainKind).toBe("robot");

      // L4 (randomized): long pedestals shift angle with seed while short pedestals stay at 2.842 m
      const r4a = createRun(1, LEVELS[4]);
      const r4b = createRun(2, LEVELS[4]);
      expect(r4a.pedestals[0].angle).not.toBe(LEVELS[1] ? makePedestal(0).angle : 0);
      expect(r4a.pedestals.map((p) => p.angle)).not.toEqual(r4b.pedestals.map((p) => p.angle));
      for (const shortIdx of [1, 2, 5, 6]) {
         expect(r4a.pedestals[shortIdx].length).toBeCloseTo(2.842, 3);
      }

      // L5 (full-night): consecutive departures alternate exits when the beam is centred
      const r5 = createRun(12, LEVELS[5]);
      for (const ex of r5.exhibits) ex.kind = "knight";
      stepGame(r5, { moveX: 0, pointerX: null, dragYaw: null, coarse: false, flash: false }, 1 / 60, 3.1);
      const firstExit = r5.lastExit;
      expect(Math.abs(firstExit)).toBeCloseTo(Math.PI / 2, 5);
      stepGame(r5, { moveX: 0, pointerX: null, dragYaw: null, coarse: false, flash: false }, 1 / 60, 7.0);
      expect(r5.lastExit).toBeCloseTo(-firstExit, 5);
   });
});
