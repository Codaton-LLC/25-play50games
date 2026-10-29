// The hero's motion writer (Hero.tsx writeHeroMotion, pure): walking round a body is running along the
// local x, a pod's charge curls into the shell ball, the jump stamps become one-frame events once each,
// and the local up follows the body under the hero.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, targetUp, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step } from "./rules";

describe("writeHeroMotion", () => {
   it("walking runs along the local x, grounded; a pod's charge is the shell ball", () => {
      const run = createRun(1, 1, "riko");
      const i = createStepInput();
      i.moveX = 1;
      i.roll = run.hero.angle - Math.PI / 2;
      step(run, 50, i);
      const m = createHeroMotion();
      const anim = createHeroAnim();
      anim.up = run.hero.angle;
      writeHeroMotion(m, createMotionMemo(), run, anim, 1);
      expect(Math.abs(m.vx)).toBeGreaterThan(3);
      expect(m.grounded).toBe(true);
      expect(m.rolling).toBe(false);
      run.hero.pod = 0;
      writeHeroMotion(m, createMotionMemo(), run, anim, 1.1);
      expect(m.rolling).toBe(true);
   });

   it("turns the Scene's stamps into one-frame events once each", () => {
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
   });

   it("the local up is out of the body the hero stands on", () => {
      const run = createRun(1, 1);
      expect(targetUp(run)).toBeCloseTo(run.hero.angle, 9);
   });
});
