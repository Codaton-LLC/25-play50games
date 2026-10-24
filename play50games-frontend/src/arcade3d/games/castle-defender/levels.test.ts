import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { castleDefenderMeta as meta } from "./meta";
import { definitionLevelProblems, isLevelCleared } from "@/arcade3d/core/levels";
import definition from "./index";
import { visibleGoblin } from "./Goblins";
import { generateArmy, impact, createRun, createInput, stepRun, ROCK_FLIGHT, PROPOSED_LEVEL_LIMITS, TYPES } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("five castle levels", () => {
   it("declares exactly five ordered levels with unchanged level-one limits", () => {
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels?.map((level) => level.id)).toEqual(LEVEL_IDS);
      expect(meta.levels?.[0].scoring).toEqual(meta.scoring);
      expect(PROPOSED_LEVEL_LIMITS[1]).toEqual(meta.scoring);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * meta.scoring.maxScore);
      for (const id of LEVEL_IDS) expect(meta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
   });
   it("preserves today's army and makes count, speed, mix and wave pressure monotone", () => {
      expect(createRun(42, LEVELS[1])).toEqual(createRun(42));
      let previousCount = 0, previousSpeed = 0, previousWaves = 0, previousGap = Infinity;
      for (const id of LEVEL_IDS) {
         const config = LEVELS[id], run = createRun(42, config);
         expect(run.goblins.length).toBeGreaterThanOrEqual(previousCount);
         expect(config.speed).toBeGreaterThanOrEqual(previousSpeed);
         expect(config.counts.length).toBeGreaterThanOrEqual(previousWaves);
         expect(config.period).toBeLessThanOrEqual(previousGap);
         expect(run.goblins.length).toBe(config.counts.flat().reduce((a, b) => a + b, 0));
         for (const g of run.goblins) expect(g.speed).toBe(TYPES[g.kind].speed * config.speed);
         previousCount = run.goblins.length; previousSpeed = config.speed;
         previousWaves = config.counts.length; previousGap = config.period;
      }
   });
   it("maps every configured wave to visible slots and resolves before its clear", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(19, LEVELS[id]);
         for (let wave = 0; wave < run.waves.length; wave++) {
            run.wave = wave;
            expect(run.waves[wave].length).toBeLessThanOrEqual(40);
            expect(run.waves[wave].map((g, slot) => visibleGoblin(run, slot)?.id)).toEqual(run.waves[wave].map((g) => g.id));
            for (const g of run.waves[wave]) expect(g.spawn + (8.8 - g.initialS) / g.speed + (g.crew >= 0 ? 2 : 0)).toBeLessThan(run.starts[wave] + run.config.clearAt);
         }
      }
   });
   it("bounds every score prefix and total analytically", () => {
      for (const id of LEVEL_IDS) {
         const c = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
         let kills = 0;
         for (let wave = 0; wave < c.counts.length; wave++) {
            kills += c.counts[wave].reduce((a, b) => a + b, 0) * 60;
            expect(kills + wave * 200).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * wave * c.period);
            expect(kills + (wave + 1) * 200 + (wave === c.counts.length - 1 ? 250 : 0)).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * (wave * c.period + c.clearAt));
         }
         expect(kills + c.counts.length * 200 + 250).toBe(limits.maxScore);
         expect((c.counts.length - 1) * c.period + c.clearAt + 3.95).toBeLessThanOrEqual(limits.maxDurationMs! / 1000);
      }
   });

   it("replays deterministic armies for 200 seeds on every level", () => {
      for (const id of LEVEL_IDS) for (let seed = 0; seed < 200; seed++) {
         expect(JSON.stringify(generateArmy(seed, LEVELS[id]))).toBe(JSON.stringify(generateArmy(seed, LEVELS[id])));
      }
   });
   it("retains front/rear shield damage and one-time kill awards on every level", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(17, LEVELS[id]);
         for (const g of run.goblins) g.status = "dead";
         const g = run.goblins[0]; g.status = "ground"; g.kind = "shield"; g.hp = 2; g.x = g.z = 0;
         impact(run, 0, 0); expect(g.hp).toBe(1.5);
         impact(run, 0, 0.1); expect(g.hp).toBe(1);
         impact(run, 0, -0.1); expect(g.status).toBe("dead"); expect(run.score).toBe(20);
         impact(run, 0, -0.1); expect(run.score).toBe(20);
      }
   });
   it("pays exactly one final clear and HP bonus after the configured last wave", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(9, LEVELS[id]), last = run.waves.length - 1;
         run.wave = run.cleared = last; run.time = run.starts[last] + run.config.clearAt - 0.01;
         run.hp = run.maxHP = 125; run.score = 0;
         for (const g of run.goblins) g.status = "dead";
         stepRun(run, createInput(), 0.02);
         expect(run.end).toBe("win"); expect(run.score).toBe(450);
         expect(run.cleared).toBe(run.waves.length); expect(run.offer).toBe(false);
         stepRun(run, createInput(), 1); expect(run.score).toBe(450);
      }
   });
   it("never reopens the capped upgrade pool in the added siege waves", () => {
      for (const id of [4, 5] as const) {
         const run = createRun(9, LEVELS[id]);
         for (const g of run.goblins) g.status = "dead";
         run.wave = run.cleared = 4; run.time = run.starts[4]; run.offered = 3;
         run.stacks = [2, 1, 1, 0]; run.upgrades = 4;
         stepRun(run, createInput(), run.safety - run.time);
         expect(run.end).toBe("win"); expect(run.upgrades).toBe(4);
         expect(run.offer).toBe(false); expect(run.stacks).toEqual([2, 1, 1, 0]);
      }
   });
   for (const id of LEVEL_IDS) {
      it("L" + id + ": identical touch/keyboard timing", () => {
         const fine = createRun(37, LEVELS[id]), touch = createRun(37, LEVELS[id]);
         const a = createInput(), b = createInput(); b.coarse = true;
         a.point = b.point = true; a.x = b.x = 5; a.z = b.z = -6; a.fire = b.fire = true;
         stepRun(fine, a, 0.05); stepRun(touch, b, 0.05); a.fire = b.fire = true;
         stepRun(fine, a, 0.05); stepRun(touch, b, 0.05); a.fire = b.fire = false;
         for (let n = 0; n < 25; n++) { stepRun(fine, a, 0.05); stepRun(touch, b, 0.05); }
         expect(fine.launches).toBe(2); expect(touch.launches).toBe(2);
         expect(touch.ready).toBe(fine.ready); expect(touch.impacts).toBe(fine.impacts);
         expect(touch.goblins).toEqual(fine.goblins);
         const crew = fine.crews[0];
         for (const run of [fine, touch]) {
            for (const g of run.goblins) g.status = "dead";
            run.wave = crew.wave; run.cleared = crew.wave; run.time = run.starts[crew.wave] + 16;
            run.offer = false; run.crews[crew.id].erected = run.time;
            for (const g of run.waves[crew.wave]) if (g.crew === crew.id) { g.status = "climb"; g.hp = 1; }
         }
         a.point = b.point = false; a.rock = b.rock = true;
         stepRun(fine, a, 0.01); stepRun(touch, b, 0.01);
         expect(touch.rock).toEqual(fine.rock);
         expect(touch.rock.impact - touch.rock.launched).toBeCloseTo(ROCK_FLIGHT, 9);
         expect(2 - ROCK_FLIGHT).toBeCloseTo(1.217938113, 7);
         expect(isLevelCleared("lose", 0, meta.levels![id - 1])).toBe(false);
         expect(isLevelCleared("win", 0, meta.levels![id - 1])).toBe(true);
      });
   }

});
