import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { taxiRush3dMeta as meta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, activePad, citySize, createRun, idleInput, step, streetX, streetZ } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

describe("taxi levels: declarations", () => {
   it("five levels in meta and the definition, limits = PROPOSED_LEVEL_LIMITS, cleared by a win only", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta).toMatchObject({ slug: "taxi-rush-3d", status: "dev", owner: "cursor", collection: "skill", order: 32, difficulty: 2 });
      expect(meta.controls.scheme).toBe("steer");
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition).toMatchObject({ slug: "taxi-rush-3d", lives: 3, resultDelayMs: 900, touchControls: ["joystick"] });
      expect(definition.finalScore).toBeUndefined();
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels![id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(meta.levels![id - 1].clearScore).toBeUndefined();
      }
   });

   it("each level's spec carries its own config, clock, lighting and the rides chip's max", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const spec = definition.levels!.find((l) => l.id === id)!;
         expect(spec.config).toBe(level);
         expect(spec.description).toBe(LEVEL_LINES[id]);
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)!.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)!.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         const stats = levelHudStats(definition, id)!;
         expect(stats.find((s) => s.key === "rides")!.max).toBe(level.rides);
         expect(stats.find((s) => s.key === "fare")!.max).toBe(100);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].lighting)).toEqual(["day", "day", "sunset", "night", "sunset"]);
   });

   it("difficulty never drops; every level pays at least level 1; L5 <= 3 x L1; time per fare never grows", () => {
      for (let n = 2; n <= 5; n++) {
         const a = LEVELS[(n - 1) as LevelId];
         const b = LEVELS[n as LevelId];
         expect(b.rides).toBeGreaterThan(a.rides);
         expect(b.blocksX * b.blocksZ).toBeGreaterThanOrEqual(a.blocksX * a.blocksZ);
         expect(b.lights).toBeGreaterThan(a.lights);
         expect(b.traffic).toBeGreaterThan(a.traffic);
         expect(b.trafficSpeed).toBeGreaterThan(a.trafficSpeed);
         expect(b.patienceDrain).toBeGreaterThan(a.patienceDrain);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(b.durationMs / b.rides).toBeLessThanOrEqual(a.durationMs / a.rides);
         expect(PROPOSED_LEVEL_LIMITS[n as LevelId].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(n - 1) as LevelId].maxScore);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});

describe("taxi levels: the rules read the level they are given", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: grid, fares, lights, cars, traffic speed and patience drain`, () => {
         const level = LEVELS[id];
         const run = createRun(21, level);
         expect([run.width, run.depth]).toEqual([level.blocksX * 20 + 6, level.blocksZ * 20 + 6]);
         expect(citySize(level)).toEqual({ x: run.width, z: run.depth });
         expect(run.buildings.length).toBe(level.blocksX * level.blocksZ);
         expect(run.fares.length).toBe(level.rides);
         expect(run.lights.length).toBe(level.lights);
         expect(run.cars.length).toBe(level.traffic);
         expect(run.stops.length).toBe(4 * level.lights);
         // traffic speed: no lights, the cab parked on an inner street far from the loop
         run.stops.length = 0;
         run.lightAt.fill(-1);
         run.x = streetX(1);
         run.z = (streetZ(0) + streetZ(1)) / 2;
         const before = run.cars.map((c) => c.s);
         for (let i = 0; i < 60; i++) step(run, idleInput(), 1 / 60, 100_000);
         run.cars.forEach((c, k) => {
            let moved = c.s - before[k];
            if (moved < 0) moved += run.loopLength;
            expect(moved).toBeCloseTo(level.trafficSpeed, 6);
         });
         // patience: 1 s of the first fare
         expect(run.patience).toBeCloseTo(1 - level.patienceDrain, 6);
      });
      it(`L${id}: the win comes with the ${LEVELS[id].rides}th drop-off, not before`, () => {
         const run = createRun(5, LEVELS[id]);
         let drops = 0;
         for (let guard = 0; guard < 100 && !run.over; guard++) {
            const pad = activePad(run)!;
            run.x = pad.x;
            run.z = pad.z;
            run.speed = 0;
            run.patience = 1;
            run.dwell = 0.5 - 1 / 120;
            const ev = step(run, idleInput(), 1 / 60, 100_000);
            if (ev.drop) drops++;
            expect(ev.won).toBe(drops === LEVELS[id].rides);
         }
         expect(run.over).toBe("win");
         expect(drops).toBe(LEVELS[id].rides);
      });
   }
});
