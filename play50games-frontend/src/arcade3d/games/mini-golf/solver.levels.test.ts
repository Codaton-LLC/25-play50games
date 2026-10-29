import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { buildHole, courseSpecs } from "./course";
import { feltRects, onFelt, decorSpots } from "./looks";
import { createRun } from "./rules";
import { LEVELS } from "./levels";
import { LEVEL_PAR_LINES } from "./levelLines.fixture";
import { ROBUST_WINDOW, linePsi, robustPutt, solveHole } from "./solver";

describe("mini-golf robust level par witnesses", () => {
   for (const id of LEVEL_IDS) for (let h = 0; h < LEVELS[id].holes; h++) {
      it(`L${id} H${h + 1}: within par on both mirrors over nine start ticks`, () => {
         for (const mirrored of [false, true]) {
            const hole = { ...createRun(13, LEVELS[id]).course[h], ...buildHole(courseSpecs(LEVELS[id].holes, LEVELS[id].course)[h], mirrored, h) };
            // buildHole supplies geometry and signed obstacle phases; reapply this level's speed.
            if (hole.windmill) hole.windmill.omega = 2 * Math.PI / LEVELS[id].windmillPeriod * hole.sx;
            if (hole.turntable) hole.turntable.omega = LEVELS[id].turntableOmega * hole.sx;
            expect(LEVEL_PAR_LINES[id][h][0].w).toBeGreaterThanOrEqual(120);
            let at = { ...hole.tee, upper: hole.terrain === "tiers" };
            let captured = false, earliest = 0, strokes = 0;
            for (const q of LEVEL_PAR_LINES[id][h]) {
               expect(q.w).toBeGreaterThanOrEqual(earliest);
               const r = robustPutt(hole, at, at.upper, linePsi(hole, q), q.p, q.w);
               expect(r).not.toBeNull(); expect(r!.water).toBe(false);
               strokes++;
               if (r!.captured) { captured = true; break; }
               earliest = q.w + ROBUST_WINDOW - 1 + r!.ticks + 60;
               at = r!;
            }
            expect(captured).toBe(true); expect(strokes).toBeLessThanOrEqual(hole.par);
         }
      });
   }
   for (let h = 6; h < 9; h++) it(`new H${h + 1}: live beam search at unchanged resolution`, { timeout: 60_000 }, () => {
      for (const mirrored of [false, true]) {
         const hole = { ...buildHole(h, mirrored), vMax: 5, cupRadius: 0.08, captureSpeed: 1 };
         const line = solveHole(hole);
         expect(line).not.toBeNull(); expect(line!.length).toBeLessThanOrEqual(hole.par);
         const rects = feltRects(hole);
         expect(onFelt(rects, hole.tee.x, hole.tee.z)).toBe(true);
         expect(onFelt(rects, hole.cup.x, hole.cup.z)).toBe(true);
         expect(decorSpots([hole]).trees).toHaveLength(2);
      }
   });
});
