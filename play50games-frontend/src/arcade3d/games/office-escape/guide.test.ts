// guide.ts: the hint follows the run and never changes it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { COACHED_ROWS, hintCode, hintFor, nextRow, obstacleName } from "./guide";
import { NO_OBSTACLE, OBSTACLE, createRun } from "./rules";

describe("office-escape guide", () => {
   it("coaches the first rows and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(11, LEVELS[id]);
         const before = JSON.stringify(run.rows.map((r) => r.lanes));
         const row = nextRow(run);
         expect(row).not.toBeNull();
         expect(hintCode(run)).toBeGreaterThan(0);
         expect(JSON.stringify(run.rows.map((r) => r.lanes))).toBe(before);
      }
   });

   it("says jump for a low obstacle in the lane, dodge for a tall one, and nothing past the coached rows", () => {
      const run = createRun(11, LEVELS[1]);
      const row = nextRow(run)!;
      row.lanes[run.lane] = OBSTACLE.desk;
      expect(hintFor(hintCode(run), run).text).toMatch(/jump it/);
      row.lanes[run.lane] = OBSTACLE.chair;
      expect(hintFor(hintCode(run), run).tone).toBe("warn");
      row.lanes[run.lane] = NO_OBSTACLE;
      expect(hintCode(run)).toBe(3);
      row.index = COACHED_ROWS;
      expect(hintCode(run)).toBe(0);
      run.over = true;
      expect(hintCode(run)).toBe(0);
   });

   it("names the obstacle for the crash pop", () => {
      expect(obstacleName(OBSTACLE.coffeeCart)).toBe("coffee cart");
      expect(obstacleName(OBSTACLE.desk)).toBe("desk");
      expect(obstacleName(-1)).toBe("obstacle");
   });
});
