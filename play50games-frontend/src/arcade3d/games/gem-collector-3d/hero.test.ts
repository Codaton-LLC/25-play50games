// The hero's motion for the shared animator (menu2/heroAnim): pure, from the run.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, floorUnder, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step } from "./rules";
import { sunkGroup } from "./arena";

describe("writeHeroMotion", () => {
   it("rolls with the run's velocity and passes each event once; a fall curls it into the ball", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      run.hero.vx = 3;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vx).toBe(3);
      expect(m.rolling).toBe(false);
      run.hero.lostUntil = 500;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.rolling).toBe(true);
      run.hero.lostUntil = -1;
      anim.jumpAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(false);
      anim.winAt = 3;
      writeHeroMotion(m, memo, run, anim, 3);
      expect(m.celebrating).toBe(true);
   });

   it("the intro drops the hero in curled; Zuno's magnet shows as the magnet power", () => {
      const run = createRun(1, 1, "zuno");
      const m = createHeroMotion();
      const anim = createHeroAnim();
      anim.intro = 0.5;
      writeHeroMotion(m, createMotionMemo(), run, anim, 0);
      expect(m.rolling).toBe(true);
      const p = createStepInput();
      p.actionPressed = true;
      step(run, 16, p);
      anim.intro = Number.NaN;
      writeHeroMotion(m, createMotionMemo(), run, anim, 0);
      expect(m.power).toBe("magnet");
   });

   it("the shadow lies on the pedestal top, the floor, and nowhere over a sunk tile", () => {
      const run = createRun(1, 1);
      const p = run.arena.pedestals[0];
      run.hero.x = p.x;
      run.hero.z = p.z;
      run.hero.y = p.h;
      expect(floorUnder(run)).toBe(p.h);
      run.hero.x = 0;
      run.hero.z = -6;
      run.hero.y = 0;
      expect(floorUnder(run)).toBe(0);
      const r2 = createRun(1, 2);
      const t = r2.arena.tiles!;
      const c = t.cells.find((q) => q.group === sunkGroup(t, 0))!;
      r2.hero.x = (c.x0 + c.x1) / 2;
      r2.hero.z = (c.z0 + c.z1) / 2;
      expect(floorUnder(r2)).toBeLessThan(-1);
   });
});
