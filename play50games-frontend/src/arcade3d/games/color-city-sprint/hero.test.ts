import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { V_RED, createRun } from "./rules";

describe("hero motion", () => {
   it("rolls on a fast red lane, marks an air jump, and cheers on a win", () => {
      const run = createRun(1, 1);
      const e = run.course.edges.find((g) => g.kind === "street")!;
      const index = run.course.edges.indexOf(e);
      run.painted[index] = 1;
      run.lap = 1;
      run.hero.edge = index;
      run.hero.grounded = true;
      run.hero.vx = V_RED;
      const motion = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(motion, memo, run, anim, 1);
      expect(motion.rolling).toBe(true);
      anim.airJumpAt = 2;
      writeHeroMotion(motion, memo, run, anim, 2);
      expect(motion.events.airJumped).toBe(true);
      anim.winAt = 3;
      writeHeroMotion(motion, memo, run, anim, 4);
      expect(motion.celebrating).toBe(true);
   });
});
