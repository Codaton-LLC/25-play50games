// The hero's motion for the shared animator (menu2/heroAnim): pure, from the run.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, floorUnder, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step, V_RED } from "./rules";
import { BUS_ROOF } from "./city";

describe("writeHeroMotion", () => {
   it("runs with the run's velocity, curls into the ball at red-lane speed, and passes each event once", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      run.hero.vx = 3;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vx).toBe(3);
      expect(m.rolling).toBe(false);
      run.hero.curled = true;
      run.hero.vx = V_RED;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.rolling).toBe(true);
      anim.jumpAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(false);
      anim.hurtAt = 2;
      writeHeroMotion(m, memo, run, anim, 2);
      expect(m.events.hurt).toBe(true);
      anim.winAt = 3;
      writeHeroMotion(m, memo, run, anim, 3);
      expect(m.celebrating).toBe(true);
   });

   it("the intro drops the hero in curled; the dash shows as the dash power", () => {
      const run = createRun(1, 1, "riko");
      const m = createHeroMotion();
      const anim = createHeroAnim();
      anim.intro = 0.5;
      writeHeroMotion(m, createMotionMemo(), run, anim, 0);
      expect(m.rolling).toBe(true);
      expect(m.grounded).toBe(false);
      const p = createStepInput();
      p.actionPressed = true;
      step(run, 16, p);
      anim.intro = Number.NaN;
      writeHeroMotion(m, createMotionMemo(), run, anim, 0);
      expect(m.power).toBe("dash");
   });

   it("the shadow lies on the bus roof under a hero standing there", () => {
      const run = createRun(1, 1);
      const b = run.buses[0];
      run.hero.x = b.x;
      run.hero.z = b.z;
      run.hero.y = BUS_ROOF;
      expect(floorUnder(run)).toBe(BUS_ROOF);
      run.hero.x = 0;
      run.hero.z = 0;
      run.hero.y = 0;
      expect(floorUnder(run)).toBe(0);
   });
});
