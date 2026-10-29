import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "../../types";
import { levelMetaProblems } from "../../levelMeta";
import { definitionLevelProblems, levelEnvironment } from "../../core/levels";
import { LEVELS } from "./levels";
import { createRng } from "../../core/math";
import { advanceRun as advanceLegacy, createRun as createLegacy } from "./legacyRules.fixture";
import { createBall, createBallEvents, launchBall, placeBall, stepBall } from "./physics";
import { generateCourse } from "./course";
import { advanceRun, canPutt, currentHole, createRun, PROPOSED_LEVEL_LIMITS } from "./rules";
import { miniGolfMeta as meta } from "./meta";
import definition from "./index";
vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("mini-golf five levels", () => {
   it("declares matching runtime, metadata and proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels).toHaveLength(5);
      for (const id of LEVEL_IDS) {
         expect(meta.levels![id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(definition.levels![id - 1].config).toBe(LEVELS[id]);
         expect(definition.levels![id - 1].hudStats![0].max).toBe(LEVELS[id].holes);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(4100);
      }
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(12300);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
   });
   it("keeps today's default course byte-equivalent to the explicit L1 course", () => {
      for (let seed = 0; seed < 64; seed++) {
         expect(createRun(seed, LEVELS[1]).course).toEqual(generateCourse(seed));
      }
      expect(LEVELS[1]).toEqual({ holes: 6, vMax: 4.5, pickUpOver: 4, capS: 600, turntableOmega: 1.2, windmillPeriod: 6, cupRadius: 0.1, captureSpeed: 1.2 });
   });
   it("adds pressure monotonically; levels 2-4 play their own six (par 17), level 5 the original six plus three", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as 1 | 2 | 3 | 4], b = LEVELS[id];
         expect(b.holes).toBeGreaterThanOrEqual(a.holes);
         expect(b.pickUpOver).toBeLessThanOrEqual(a.pickUpOver);
         expect(b.capS / b.holes).toBeLessThanOrEqual(a.capS / a.holes);
         expect(b.turntableOmega).toBeGreaterThanOrEqual(a.turntableOmega);
         expect(b.windmillPeriod).toBeLessThanOrEqual(a.windmillPeriod);
         expect(b.cupRadius).toBeLessThanOrEqual(a.cupRadius);
         expect(b.captureSpeed).toBeLessThanOrEqual(a.captureSpeed);
         expect(b.vMax).toBeGreaterThanOrEqual(a.vMax);
         expect(b.requireAllCups).toBe(true);
         const course = createRun(7, b).course;
         expect(course).toHaveLength(b.holes);
         course.forEach((hole, i) => expect(hole.index).toBe(i));
         if (id === 5) expect(course.slice(0, 6).map(h => [h.tee, h.cup, h.rails, h.par])).toEqual(generateCourse(7).map(h => [h.tee, h.cup, h.rails, h.par]));
         else expect(course.reduce((s, h) => s + h.par, 0)).toBe(17);
      }
      // each of levels 2-4 is its own course: new layouts (specs 9+) and a different order
      const sets = ([2, 3, 4] as const).map(id => LEVELS[id].course!);
      for (const set of sets) {
         expect(set).toHaveLength(6);
         expect(new Set(set).size).toBe(6);
         expect(set.filter(s => s >= 9).length).toBeGreaterThanOrEqual(2);
      }
      expect(new Set(sets.map(s => s.join())).size).toBe(3);
      expect(sets.map(s => s.join())).not.toContain("0,1,2,3,4,5");
   });
});


describe("mini-golf level regression and physics", () => {
   it("replays the pre-level rules frame-for-frame, including spam, water, pick-ups and timeout", { timeout: 120_000 }, () => {
      const snapshot = (run: ReturnType<typeof createRun> | ReturnType<typeof createLegacy>) => {
         const { config, pickups, tick, ...state } = run as ReturnType<typeof createRun>;
         const { lose, ...events } = state.events;
         return { ...state, events };
      };
      for (let seed = 0; seed < 8; seed++) {
         const a = createLegacy(seed), b = createRun(seed, LEVELS[1]), rng = createRng(seed + 71);
         let f = 0;
         while (!a.over && f++ < 30_000) {
            const dt = 0.004 + rng() * 0.046, psi = (rng() - 0.5) * 2 * Math.PI, power = rng(), putt = rng() < 0.4;
            advanceLegacy(a, dt, psi, power, putt);
            advanceRun(b, dt, psi, power, putt);
            if (a.events.strokeEnded || a.events.holeOut >= 0 || a.over || f % 120 === 0) expect(snapshot(b)).toEqual(snapshot(a));
         }
         expect(b.over).toBe(true);
      }
   });

   for (const id of LEVEL_IDS) {
      it(`L${id}: launch speed, cap, pick-up and ready gap use the captured config`, () => {
         const run = createRun(31, LEVELS[id]);
         advanceRun(run, 1 / 120, 0, 1, true);
         expect(run.strokes).toBe(1);
         expect(Math.hypot(run.ball.vx, run.ball.vz)).toBeCloseTo(LEVELS[id].vMax - 0.9 / 120, 6);
         const h = currentHole(run);
         run.phase = "aim"; run.pending.on = false; run.readyTicks = 0;
         expect(canPutt(run)).toBe(false);
         for (let f = 0; f < 49; f++) advanceRun(run, 0.01, 0, 1, true);
         expect(run.strokes).toBe(1);
         advanceRun(run, 0.02, 0, 1, false);
         expect(canPutt(run)).toBe(true);
         run.strokes = h.par + run.config.pickUpOver - 1;
         placeBall(h, run.ball, h.tee, false);
         advanceRun(run, 1 / 120, 0, 0.1, true);
         for (let f = 0; f < 1000 && run.card[0] < 0; f++) advanceRun(run, 1 / 120, 0, 0, false);
         expect(run.card[0]).toBe(h.par + LEVELS[id].pickUpOver);
         expect(run.pickups).toBe(1);
         const idle = createRun(31, LEVELS[id]);
         idle.time = LEVELS[id].capS - 0.01;
         advanceRun(idle, 0.02, 0, 0, false);
         expect(idle.events.timeup).toBe(true);
         expect(idle.total).toBe(0);
      });

      it(`L${id}: cup radius and capture speed control captures and lip-outs`, () => {
         const h = createRun(19, LEVELS[id]).course[3];
         const roll = (offset: number, speed: number) => {
            const at = { x: h.cup.x + offset, z: h.cup.z + 0.001 };
            const b = createBall(at, false), ev = createBallEvents();
            placeBall(h, b, at, false); launchBall(b, 0, speed);
            stepBall(h, b, 0, 1 / 240, ev);
            return ev;
         };
         expect(roll(LEVELS[id].cupRadius - 0.005, LEVELS[id].captureSpeed - 0.01).captured).toBe(true);
         expect(roll(LEVELS[id].cupRadius + 0.005, 0.5).captured).toBe(false);
         expect(roll(0, LEVELS[id].captureSpeed + 0.02).lipOut).toBe(true);
      });
   }
});


describe("mini-golf per-level analytic server bounds", () => {
   for (const id of LEVEL_IDS) it(`L${id}: ceiling, earliest end and final score envelope`, () => {
      const c = LEVELS[id], run = createRun(13, c), limits = PROPOSED_LEVEL_LIMITS[id];
      const max = run.course.reduce((sum, h) => sum + 100 * (h.par + 2) + 200, 0);
      const earliest = (run.course.length - 1) * 2 + run.course.reduce((sum, h) => {
         // For harder bars, grant the entire contact disk's diameter as free travel.
         // This also covers positional overlap correction, independently of wall speed.
         const freeBarTravel = id > 1 && h.turntable ? 2 * (h.turntable.half + 0.06) : 0;
         const capture = (Math.hypot(h.tee.x - h.cup.x, h.tee.z - h.cup.z) - c.cupRadius - freeBarTravel) / 6;
         const water = h.terrain === "ramp" || h.ponds.length > 0;
         const pickup = (Math.ceil((h.par + c.pickUpOver) / (water ? 2 : 1)) - 1) * 0.5;
         return sum + Math.min(capture, pickup);
      }, 0);
      expect(limits.maxScore).toBe(max);
      expect(limits.minDurationMs / 1000).toBeLessThan(earliest);
      // tight on the original courses; the level courses (2-4, their own holes) stay within 2 s
      expect(earliest - limits.minDurationMs / 1000).toBeLessThan(id === 1 || id === 5 ? 1 : 2);
      expect(limits.base! + limits.maxPointsPerSec! * limits.minDurationMs / 1000).toBeGreaterThanOrEqual(max);
      expect(c.capS + 0.05).toBeLessThan(limits.maxDurationMs / 1000);
   });
   it("pins the harder physics independently of their consumers", () => {
      expect(LEVEL_IDS.map(id => [LEVELS[id].holes, LEVELS[id].vMax, LEVELS[id].pickUpOver, LEVELS[id].capS, LEVELS[id].turntableOmega, LEVELS[id].windmillPeriod, LEVELS[id].cupRadius, LEVELS[id].captureSpeed])).toEqual([
         [6, 4.5, 4, 600, 1.2, 6, 0.1, 1.2], [6, 5, 3, 480, 1.2, 6, 0.1, 1.2],
         [6, 5, 3, 480, 1.6, 5, 0.1, 1.2], [6, 5, 3, 480, 1.6, 5, 0.08, 1], [9, 5, 2, 600, 1.6, 5, 0.08, 1],
      ]);
      for (const id of LEVEL_IDS) {
         const course = createRun(13, LEVELS[id]).course;
         const windmills = course.filter(h => h.windmill), tables = course.filter(h => h.turntable);
         for (const h of windmills) expect(Math.abs(h.windmill!.omega)).toBeCloseTo(2 * Math.PI / LEVELS[id].windmillPeriod);
         for (const h of tables) expect(Math.abs(h.turntable!.omega)).toBe(LEVELS[id].turntableOmega);
      }
   });
});


describe("mini-golf configured course endings", () => {
   for (const id of LEVEL_IDS) it(`L${id}: final cup pays once and ends, pick-ups cannot win harder courses`, () => {
      for (const pickedUp of [false, true]) {
         const run = createRun(91, LEVELS[id]);
         run.hole = run.course.length - 1;
         const h = currentHole(run);
         placeBall(h, run.ball, h.cup, false);
         run.strokes = 1; run.pickups = pickedUp ? 1 : 0;
         launchBall(run.ball, 0, 0.1); run.phase = "moving";
         advanceRun(run, 1 / 120, 0, 0, false);
         expect(run.over).toBe(true);
         expect(run.card).toHaveLength(LEVELS[id].holes);
         expect(run.card[run.hole]).toBe(1);
         expect(run.won).toBe(id === 1 || !pickedUp);
         expect(run.events.lose).toBe(id !== 1 && pickedUp);
         const score = run.total;
         advanceRun(run, 0.05, 0, 1, true);
         expect(run.total).toBe(score);
      }
   });
   it("Master Course proceeds past hole six, with the same two-second hole-out", () => {
      const run = createRun(91, LEVELS[5]); run.hole = 5;
      const h = currentHole(run); placeBall(h, run.ball, h.cup, false);
      launchBall(run.ball, 0, 0.1); run.phase = "moving"; run.strokes = 1;
      advanceRun(run, 1 / 120, 0, 0, false);
      expect(run.over).toBe(false); expect(run.phase).toBe("holeOut");
      for (let i = 0; i < 39; i++) advanceRun(run, 0.05, 0, 0, false);
      expect(run.hole).toBe(5);
      advanceRun(run, 0.05, 0, 0, false);
      expect(run.hole).toBe(6); expect(run.phase).toBe("aim"); expect(canPutt(run)).toBe(true);
   });
   it("clear targets require points, and the final level clears on a win", () => {
      expect(meta.levels!.map(l => l.clearScore)).toEqual([2000, 2000, 2000, 2000, undefined]);
   });
});
