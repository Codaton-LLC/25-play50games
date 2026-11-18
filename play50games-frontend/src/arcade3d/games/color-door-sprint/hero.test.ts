// The hero's motion writer (Hero.tsx writeHeroMotion, pure): the run down the hall, the roll as the
// shell ball, the dash and the red rush as the dash streak, and the one-frame events.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step } from "./rules";

describe("writeHeroMotion", () => {
   it("runs down the hall (-z at the run speed), grounded; a roll curls into the ball; the rush is the dash streak", () => {
      const run = createRun(1, 1, "riko");
      step(run, 50, createStepInput());
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.vz).toBeCloseTo(-run.hero.v, 6);
      expect(m.grounded).toBe(true);
      expect(m.rolling).toBe(false);
      run.hero.rollUntil = run.simMs + 500;
      writeHeroMotion(m, memo, run, anim, 1.1);
      expect(m.rolling).toBe(true);
      run.hero.rushUntil = run.simMs + 500;
      writeHeroMotion(m, memo, run, anim, 1.2);
      expect(m.power).toBe("dash");
   });

   it("turns the Scene's stamps into one-frame events once each (jump, Nami's flip, hurt)", () => {
      const run = createRun(1, 1, "nami");
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      anim.jumpAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 1.05);
      expect(m.events.jumped).toBe(false);
      anim.airJumpAt = 1.2;
      writeHeroMotion(m, memo, run, anim, 1.2);
      expect(m.events.airJumped).toBe(true);
      anim.hurtAt = 1.3;
      writeHeroMotion(m, memo, run, anim, 1.3);
      expect(m.events.hurt).toBe(true);
   });

   it("the intro drops the hero curled into the ball, then lets it stand", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const anim = createHeroAnim();
      anim.intro = 0.4;
      writeHeroMotion(m, createMotionMemo(), run, anim, 1);
      expect(m.rolling).toBe(true);
      expect(m.grounded).toBe(false);
      anim.intro = 1;
      writeHeroMotion(m, createMotionMemo(), run, anim, 1.1);
      expect(m.rolling).toBe(false);
   });
});
