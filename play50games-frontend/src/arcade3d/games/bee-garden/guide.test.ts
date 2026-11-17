// guide.ts: the beacon walks the nectar (nearest first, no flicker), then the hive; read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { SWITCH_SHARE, beeHint, flowerGoal, hintCode, hiveGoal, nextFlower } from "./guide";
import { TUNING, createRun } from "./rules";

describe("bee-garden guide", () => {
   it("points at the nearest nectar first, never at an empty flower, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(21, LEVELS[id], id);
         const before = JSON.stringify(run);
         let next = nextFlower(run, -1);
         expect(JSON.stringify(run)).toBe(before);
         const nearest = Math.min(...run.flowers.map((f) => Math.hypot(f.x - run.bee.x, f.z - run.bee.z)));
         expect(Math.hypot(run.flowers[next].x - run.bee.x, run.flowers[next].z - run.bee.z)).toBe(nearest);
         for (let n = 0; n < run.flowers.length; n++) {
            expect(next).toBeGreaterThanOrEqual(0);
            expect(run.flowers[next].hasNectar).toBe(true);
            run.flowers[next].hasNectar = false;
            run.bee.x = run.flowers[next].x;
            run.bee.z = run.flowers[next].z;
            next = nextFlower(run, next);
         }
         expect(next).toBe(-1);
      }
   });

   it("keeps the current flower unless another is clearly closer", () => {
      const run = createRun(5, LEVELS[1], 1);
      const first = nextFlower(run, -1);
      const other = run.flowers.findIndex((_, i) => i !== first);
      const keepD = Math.hypot(run.flowers[first].x - run.bee.x, run.flowers[first].z - run.bee.z);
      const otherD = Math.hypot(run.flowers[other].x - run.bee.x, run.flowers[other].z - run.bee.z);
      if (otherD > keepD * SWITCH_SHARE) expect(nextFlower(run, first)).toBe(first);
   });

   it("shows the flower beacon while there is room, the hive beacon while carrying", () => {
      const run = createRun(8, LEVELS[1], 1);
      const f = nextFlower(run, -1);
      expect(flowerGoal(run, f)).toBe(true);
      expect(hiveGoal(run)).toBe(false);
      expect(beeHint(run, hintCode(run, f), false).text).toMatch(/hold Space/);
      expect(beeHint(run, hintCode(run, f), true).text).toMatch(/hold Boost/);
      run.carried.push(0);
      expect(hiveGoal(run)).toBe(true);
      expect(beeHint(run, hintCode(run, f), false).tone).toBe("carry");
      while (run.carried.length < TUNING.carryCap) run.carried.push(run.carried.length);
      expect(flowerGoal(run, f)).toBe(false);
      expect(beeHint(run, hintCode(run, f), false)).toMatchObject({ tone: "ready" });
      run.stunTimer = 0.4;
      expect(beeHint(run, hintCode(run, f), false)).toMatchObject({ tone: "warn", sticky: true });
   });
});
