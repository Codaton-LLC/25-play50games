// The per-level district maps (rules.ts LEVEL_MAPS): levels 2-5 have no fallback layout (createRun
// throws "No valid clean-city layout"), so every map must place a valid layout for many seeds; and
// level 1, the live game, must place exactly what it placed on MAPS before the districts existed.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { MAPS, buildMapCache, createRun, generateLayout, isValidLayout } from "./rules";

describe("clean-city district maps", () => {
   it("L2-L5 build valid layouts for 100 seeds on every map", () => {
      for (const id of [2, 3, 4, 5] as const) {
         for (let seed = 0; seed < 100; seed++) {
            const run = createRun(seed * 7919 + 13, LEVELS[id]);
            for (let map = 0; map < 3; map++) {
               const layout = generateLayout(run.seed, map, run.caches[map], LEVELS[id]);
               expect(isValidLayout(layout, run.caches[map], LEVELS[id]), `L${id} seed ${seed} map ${map}`).toBe(true);
            }
         }
      }
   });

   it("level 1 lays out exactly as on MAPS (the live game)", () => {
      const caches = MAPS.map((_m, map) => buildMapCache(map));
      for (let seed = 0; seed < 100; seed++) {
         const run = createRun(seed * 104729 + 1, LEVELS[1]);
         for (let map = 0; map < 3; map++) {
            const a = generateLayout(run.seed, map, run.caches[map]);
            const b = generateLayout(run.seed, map, caches[map]);
            expect(JSON.stringify(a)).toBe(JSON.stringify(b));
         }
      }
   });
});
