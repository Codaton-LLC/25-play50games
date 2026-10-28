// The hero's motion writer (pure): what the shared menu2/heroAnim animator is told every frame in a
// free-fall: standing on the column, the leap, the spread fall (tipped belly-down), the Dive (the
// armoured ball), Nami's flip (the somersault), the powers' auras, a hit, the landing and the cheer.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { SKYDIVE_TIP, createHeroAnim, createMotionMemo, skydiveTip, writeHeroMotion } from "./Hero";
import { V_SPREAD, createRun, createStepInput, step } from "./rules";

describe("writeHeroMotion", () => {
   it("on the column: grounded, no roll; the leap is a jump", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 0, 0);
      expect(m.grounded).toBe(true);
      expect(m.rolling).toBe(false);
      anim.leapAt = 1;
      writeHeroMotion(m, memo, run, anim, 1, 0);
      expect(m.events.jumped).toBe(true);
   });

   it("a spread fall tips belly-down; a Dive is the ball (no tip); Nami's flip is the somersault", () => {
      const run = createRun(1, 1, "nami");
      const leap = createStepInput();
      leap.jumpPressed = true;
      step(run, 16, leap);
      const fall = createStepInput();
      for (let f = 0; f < 90; f++) step(run, 16, fall);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 2, run.simMs);
      expect(m.grounded).toBe(false);
      expect(m.rolling).toBe(false);
      expect(skydiveTip(run, run.simMs)).toBeCloseTo(SKYDIVE_TIP * Math.min(1, -run.hero.vy / V_SPREAD), 6);
      fall.jumpHeld = true;
      step(run, 16, fall);
      writeHeroMotion(m, memo, run, anim, 2.1, run.simMs);
      expect(m.rolling).toBe(true);
      expect(skydiveTip(run, run.simMs)).toBe(0);
      fall.jumpHeld = false;
      fall.actionPressed = true;
      step(run, 16, fall);
      anim.flipAt = 2.2;
      writeHeroMotion(m, memo, run, anim, 2.2, run.simMs);
      expect(m.events.airJumped).toBe(true);
      expect(m.rolling).toBe(false);
   });

   it("powers map to the animator's auras; a hit is hurt; the win cheers", () => {
      const run = createRun(1, 1, "kiro");
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      run.hero.mode = "fall";
      run.simMs = 1000;
      run.hero.shieldUntil = 2000;
      writeHeroMotion(m, memo, run, anim, 1, 1000);
      expect(m.power).toBe("shield");
      anim.hurtAt = 1.5;
      writeHeroMotion(m, memo, run, anim, 1.5, 1000);
      expect(m.events.hurt).toBe(true);
      anim.winAt = 2;
      writeHeroMotion(m, memo, run, anim, 2.5, 1000);
      expect(m.celebrating).toBe(true);
   });
});
