// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's route,
// monotone difficulty, valid cities, the algebraic limit proof. Bot proofs: rules.levels.test.ts.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import definition from "./index";
import { LEVELS, type DroneLevel } from "./levels";
import { COLORS } from "./looks";
import { deliveryDroneMeta as meta } from "./meta";
import {
   BATTERY,
   CITY,
   DELIVERY_CAP,
   PARCEL,
   PIGEON,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   ROUTE,
   WIND,
   createRun,
   earliestLossSeconds,
   generateCity,
   isValidCity,
   predictProjectile,
   stepRun,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const idle = { dirX: 0, dirZ: 0, drop: false };
const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];

describe("delivery-drone levels: declarations", () => {
   it("declares five levels in meta and the definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(PROPOSED_LEVEL_LIMITS[1]).toBe(PROPOSED_LIMITS);
      expect(PROPOSED_LEVEL_LIMITS[1]).toEqual(meta.scoring);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) if (id > 1) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's route: same limits, city knobs, clock, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect(l1).toMatchObject({
         count: ROUTE.count, ceiling: ROUTE.ceiling, towers: CITY.towers, padRadius: ROUTE.padRadius,
         windFrom: WIND.from, windAccel: WIND.accel,
         pigeons: PIGEON.count, pigeonInitial: PIGEON.initialCount, pigeonMiddle: PIGEON.middleCount,
         pigeonMiddleFrom: PIGEON.middleFrom, pigeonFinalFrom: PIGEON.finalFrom,
         fragileFrom: PARCEL.fragileFrom, fragilePrecision: PARCEL.fragilePrecision,
         drain: BATTERY.drain, battery: BATTERY.initial,
      });
      expect(l1.bands).toEqual([4, 4, 4]);
      for (const seed of [0, 1, 34, 900]) {
         const plain = createRun(seed, seed % 2 === 0);
         const level = createRun(seed, seed % 2 === 0, l1);
         expect(level.city).toEqual(plain.city);
         expect(level.battery).toBe(plain.battery);
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: 1200 });
      expect(levelEnvironment(definition, 1)).toEqual({ background: COLORS.skyBottom, lighting: "day" });
      expect(levelHudStats(definition, 1)).toEqual([
         { key: "deliveries", label: "Deliveries", max: 12 },
         { key: "distance", label: "Target m" },
      ]);
      expect(levelInstructions(definition, 1)).toEqual([
         "Hover at the depot for 4 seconds to load a parcel.",
         "Fly to the blue rooftop; brake early and line up the landing cross.",
         "Space, E, Enter or Drop releases. Complete 12 deliveries before the battery runs flat.",
      ]);
   });

   it("every level keeps the day sky and its own delivery chip", () => {
      for (const id of LEVEL_IDS) {
         expect(levelEnvironment(definition, id)).toEqual({ background: COLORS.skyBottom, lighting: "day" });
         expect(levelRunConfig(definition, id).durationMs).toBeUndefined();
         expect(levelHudStats(definition, id)![0]).toEqual({ key: "deliveries", label: "Deliveries", max: LEVELS[id].count });
         expect(meta.levels![id - 1].clearScore).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });
});

describe("delivery-drone levels: difficulty", () => {
   it("never gets easier, and each route offers at least as many drops as the one before", () => {
      for (const id of LEVEL_IDS) if (id > 1) {
         const a = prev(id), b = LEVELS[id];
         expect(b.count).toBeGreaterThanOrEqual(a.count);
         expect(b.ceiling).toBeGreaterThanOrEqual(a.ceiling);
         expect(b.towers).toBeGreaterThanOrEqual(a.towers);
         expect(b.padRadius).toBeLessThanOrEqual(a.padRadius);
         expect(b.windFrom).toBeLessThanOrEqual(a.windFrom);
         expect(b.windAccel).toBeGreaterThanOrEqual(a.windAccel);
         expect(b.pigeons).toBeGreaterThanOrEqual(a.pigeons);
         expect(b.pigeonInitial).toBeGreaterThanOrEqual(a.pigeonInitial);
         expect(b.pigeonMiddle).toBeGreaterThanOrEqual(a.pigeonMiddle);
         expect(b.pigeonMiddleFrom).toBeLessThanOrEqual(a.pigeonMiddleFrom);
         expect(b.pigeonFinalFrom).toBeLessThanOrEqual(a.pigeonFinalFrom);
         expect(b.fragileFrom).toBeLessThanOrEqual(a.fragileFrom);
         expect(b.fragilePrecision).toBeGreaterThanOrEqual(a.fragilePrecision);
         expect(b.drain).toBeGreaterThanOrEqual(a.drain);
      }
   });

   it("keeps one loading, express and pickup window on every level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(level.bands.reduce((sum, n) => sum + n, 0)).toBe(level.count);
         expect(level.pigeonInitial).toBeLessThanOrEqual(level.pigeonMiddle);
         expect(level.pigeonMiddle).toBeLessThanOrEqual(level.pigeons);
         expect(ROUTE.loading * level.count).toBeLessThan(level.ceiling);
         const fine = createRun(11, false, level), coarse = createRun(11, true, level);
         expect(fine.city.targets).toEqual(coarse.city.targets);
         expect(fine.level).toBe(coarse.level);
         for (const run of [fine, coarse]) {
            for (let t = 0; t < 4 - 1e-9; t += 0.05) stepRun(run, idle, Math.min(0.05, 4 - t));
            expect(run.attached).toBe(true);
            expect(run.pickupAt).toBeCloseTo(4, 8);
         }
      }
   });
});

describe("delivery-drone levels: cities and the limit proof", () => {
   it("builds a valid city for every level, including the literal fallback", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < 40; seed++) {
            const city = generateCity(seed, undefined, level);
            expect(isValidCity(city, level)).toBe(true);
            expect(city.targets).toHaveLength(level.count);
            expect(city.buildings.filter((b) => b.tower)).toHaveLength(level.towers);
            expect(city.birds).toHaveLength(level.pigeons);
            expect(city.winds).toHaveLength(2);
         }
         const fallback = generateCity(1, () => false, level);
         expect(fallback.fallback).toBe(true);
         expect(isValidCity(fallback, level)).toBe(true);
      }
   }, 60000);

   it("bounds every level by deliveries x 300, the loading rate and the battery-loss time", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
         expect(limits.maxScore).toBe(DELIVERY_CAP * level.count);
         expect(limits.maxDurationMs).toBe(level.ceiling * 1000 + 2000);
         expect(limits.minDurationMs).toBe(20000);
         expect(limits.base).toBe(300);
         expect(limits.maxPointsPerSec).toBe(75);
         expect(earliestLossSeconds(level) * 1000).toBeGreaterThan(limits.minDurationMs);
         // n awards need 4n seconds of loading, so score <= 75 t, and the base covers the first award's slack.
         for (let n = 1; n <= level.count; n++) {
            const t = ROUTE.loading * n;
            const score = DELIVERY_CAP * n;
            expect(score).toBeLessThanOrEqual(limits.maxScore);
            expect(score).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * t + 1e-9);
         }
      }
      expect(earliestLossSeconds(LEVELS[1])).toBeCloseTo(24.25, 8);
      expect(earliestLossSeconds(LEVELS[4])).toBeCloseTo(157 / 4.25, 8);
      expect(earliestLossSeconds(LEVELS[5])).toBeCloseTo(227 / 4.5, 8);
   });
});

// Gate review: each level knob must reach the simulation (rules.ts call sites mutation-probed).
describe("delivery-drone levels: the simulation reads every level knob", () => {
   const run1 = (level: DroneLevel, seed = 3) => createRun(seed, false, level);
   const until = (run: ReturnType<typeof createRun>, t: number) => {
      while (!run.reason && run.time < t - 1e-9) stepRun(run, idle, Math.min(1 / 30, t - run.time));
   };

   it("battery and drain: the start charge, the drain rate and the empty-battery time", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = run1(level);
         expect(run.battery).toBe(level.battery);
         until(run, 10);
         expect(run.battery).toBeCloseTo(level.battery - 10 * level.drain, 6);
         // 1/7 s frames do not divide the empty time, so the last slice has to stop on the battery
         while (!run.reason) stepRun(run, idle, 1 / 7);
         expect(run.reason).toBe("lose");
         expect(run.time).toBeCloseTo(level.battery / level.drain, 6);
      }
   });

   it("ceiling: a run that cannot empty its battery ends timeup at the level's ceiling", () => {
      const run = run1({ ...LEVELS[1], battery: 1000, ceiling: 40 });
      while (!run.reason) stepRun(run, idle, 1 / 30);
      expect(run.reason).toBe("timeup");
      expect(run.time).toBe(40);
   });

   it("windFrom: the gusts start at the level's time", () => {
      const level: DroneLevel = { ...LEVELS[1], windFrom: 5 };
      const run = run1(level);
      const w = run.city.winds[0];
      until(run, 4);
      Object.assign(run.drone, { x: w.x, z: w.z, vx: 0, vz: 0 });
      until(run, 4.9);
      expect(Math.hypot(run.drone.vx, run.drone.vz)).toBeLessThan(1e-9);
      until(run, 5.5);
      const along = run.drone.vx * w.ax + run.drone.vz * w.az;
      expect(along).toBeGreaterThan(0.3);
   });

   it("pigeon waves: the level's bird count is live in each phase", () => {
      // a live bird re-arms its touch flag when the drone is far away; a sleeping bird keeps it
      const live = (run: ReturnType<typeof createRun>) => {
         for (const bird of run.birds) bird.touching = true;
         stepRun(run, idle, 1 / 30);
         return run.birds.filter((bird) => !bird.touching).length;
      };
      const level = LEVELS[3];
      const run = run1(level);
      until(run, 1);
      expect(live(run)).toBe(level.pigeonInitial);
      until(run, level.pigeonMiddleFrom + 1);
      expect(live(run)).toBe(level.pigeonMiddle);
      until(run, level.pigeonFinalFrom + 1);
      expect(live(run)).toBe(level.pigeons);
      expect(run.birds.length).toBe(level.pigeons);
   });

   it("fragileFrom: the parcel loaded after that many drops is fragile", () => {
      for (const id of [1, 4] as LevelId[]) {
         const run = run1(LEVELS[id]);
         run.completed = 5;
         until(run, ROUTE.loading + 0.5);
         expect(run.attached).toBe(true);
         expect(run.fragile).toBe(5 >= LEVELS[id].fragileFrom);
      }
   });

   it("padRadius, fragilePrecision, the battery cap and the drop count act on a landing", () => {
      const dropAt = (id: LevelId, offset: number, fragile: boolean, completed = 0) => {
         const run = run1(LEVELS[id], 7);
         run.completed = completed;
         const b = run.city.buildings[run.city.targets[completed]];
         run.attached = true;
         run.fragile = fragile;
         run.pickupAt = run.time;
         run.battery = LEVELS[id].battery - 5;
         Object.assign(run.fall, { x: b.x + offset, y: b.height + 1, z: b.z, vx: 0, vy: 0, vz: 0 });
         predictProjectile(run, run.fall, run.impact);
         const preview = { valid: run.impact.valid, precision: run.impact.precision };
         run.fallAt = run.time; run.falling = true; run.attached = false;
         Object.assign(run.drone, { x: 0, z: 0, vx: 0, vz: 0 });
         for (let i = 0; i < 60 && run.falling; i++) stepRun(run, idle, 1 / 60);
         return { run, preview };
      };
      // a 1.1 m miss is on level 1's 1.25 m pad but off level 4's 1.0 m pad
      expect(dropAt(1, 1.1, false).preview.valid).toBe(true);
      expect(dropAt(4, 1.1, false).preview.valid).toBe(false);
      expect(dropAt(4, 0.5, false).preview.precision).toBe(50);
      // precision 45: enough for level 1's fragile 40, not for level 4's 50
      expect(dropAt(4, 0.55, true).preview.valid).toBe(false);
      expect(dropAt(1, 0.6875, true).preview.valid).toBe(true);
      // the recharge caps at the level's battery, not level 1's 100
      const landed = dropAt(4, 0, false);
      expect(landed.run.completed).toBe(1);
      expect(landed.run.battery).toBeGreaterThan(BATTERY.initial);
      expect(landed.run.battery).toBeLessThanOrEqual(LEVELS[4].battery);
      // level 2 has 13 drops: the 12th is not a win there
      const twelfth = dropAt(2, 0, false, 11);
      expect(twelfth.run.completed).toBe(12);
      expect(twelfth.run.reason).toBe(null);
   });
});
