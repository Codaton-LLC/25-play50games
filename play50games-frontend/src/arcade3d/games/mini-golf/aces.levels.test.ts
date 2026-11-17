import { expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { buildHole, courseSpecs } from "./course";
import { createRun } from "./rules";
import { LEVELS } from "./levels";
import { LEVEL_ACE_LINES } from "./levelLines.fixture";
import { linePsi, robustPutt } from "./solver";
for (const id of LEVEL_IDS) it(`L${id}: every hole's scoring ceiling has a robust ace witness on both mirrors`, () => {
   for (let h = 0; h < LEVELS[id].holes; h++) for (const mirrored of [false, true]) {
      const hole = { ...createRun(13, LEVELS[id]).course[h], ...buildHole(courseSpecs(LEVELS[id].holes, LEVELS[id].course)[h], mirrored, h) };
      if (hole.windmill) hole.windmill.omega = 2 * Math.PI / LEVELS[id].windmillPeriod * hole.sx;
      if (hole.turntable) hole.turntable.omega = LEVELS[id].turntableOmega * hole.sx;
      const q = LEVEL_ACE_LINES[id][h][0];
      expect(robustPutt(hole, hole.tee, hole.terrain === "tiers", linePsi(hole, q), q.p, q.w)?.captured).toBe(true);
   }
});
