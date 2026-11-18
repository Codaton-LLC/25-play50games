import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { createRun } from "./rules";

describe("the swing writes the animator's motion", () => {
   it("grounded on the dock, cheering only after the win, and a dash is the power", () => {
      const run = createRun(1, 1, "riko");
      const anim = createHeroAnim();
      const motion = createHeroMotion();
      const memo = createMotionMemo();
      writeHeroMotion(motion, memo, run, anim, 0);
      expect(motion.grounded).toBe(true);
      expect(motion.power).toBeNull();
      expect(motion.celebrating).toBe(false);
      run.hero.dashUntil = run.simMs + 200;
      writeHeroMotion(motion, memo, run, anim, 0);
      expect(motion.power).toBe("dash");
      anim.winAt = 1;
      writeHeroMotion(motion, memo, run, anim, 1.2);
      expect(motion.celebrating).toBe(true);
      anim.jumpAt = 2;
      writeHeroMotion(motion, memo, run, anim, 2);
      expect(motion.events.jumped).toBe(true);
   });
});
