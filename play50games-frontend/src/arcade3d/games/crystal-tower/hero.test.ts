// The hero's motion for the shared animator (menu2/heroAnim): pure, from the run.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, floorUnder, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step } from "./rules";

describe("writeHeroMotion", () => {
   it("runs with the run's velocity and passes each event once; a fall curls it into the ball", () => {
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

   it("the intro drops the hero in curled; Vexa's phase shows as the phase power", () => {
      const run = createRun(1, 1, "vexa");
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
      expect(m.power).toBe("phase");
   });

   it("the shadow lies on the pad under the hero, on the sky ledge, and nowhere over the void", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const p = c.pads[2];
      run.hero.x = p.x;
      run.hero.z = p.z;
      run.hero.y = p.y + 2;
      expect(floorUnder(run)).toBe(p.y);
      const ledge = c.pads.find((q) => q.kind === "ledge")!;
      run.hero.x = ledge.x;
      run.hero.z = ledge.z;
      run.hero.y = ledge.y + 0.1;
      expect(floorUnder(run)).toBe(ledge.y);
      run.hero.x = 40;
      run.hero.z = 40;
      expect(floorUnder(run)).toBe(-Infinity);
   });
});
