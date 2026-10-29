// The hero's motion for the shared animator (menu2/heroAnim): pure, from the run.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, floorUnder, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step } from "./rules";
import { DRUM_TOP } from "./room";
import { SHELF_Y } from "./levels";

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

   it("the shadow lies on the drum and the shelf", () => {
      const run = createRun(1, 1);
      const d = run.course.drums[0];
      run.hero.x = d.x;
      run.hero.z = d.z;
      run.hero.y = DRUM_TOP;
      expect(floorUnder(run)).toBe(DRUM_TOP);
      const shelf = run.course.plats.find((p) => p.kind === "shelf")!;
      run.hero.x = (shelf.x0 + shelf.x1) / 2;
      run.hero.z = shelf.z1 - 1;
      run.hero.y = SHELF_Y;
      expect(floorUnder(run)).toBe(SHELF_Y);
   });
});
