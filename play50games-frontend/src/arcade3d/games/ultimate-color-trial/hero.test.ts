// The hero's motion for the shared animator (menu2/heroAnim): pure, from the run; the shadow's floor;
// the carried core.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { carrying, createHeroAnim, createMotionMemo, floorUnder, writeHeroMotion } from "./Hero";
import { createRun, createStepInput, step } from "./rules";
import { LEDGE_LIFT } from "./levels";
import { padCenterAt } from "./course";

describe("writeHeroMotion", () => {
   it("runs with the run's velocity and passes each event once; a fall into the void curls it up", () => {
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

   it("the intro drops the hero in curled; Zuno's magnet shows as the magnet power, Riko's dash as a rolling dash", () => {
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
      const riko = createRun(1, 1, "riko");
      const q = createStepInput();
      q.moveZ = -1;
      q.actionPressed = true;
      step(riko, 16, q);
      writeHeroMotion(m, createMotionMemo(), riko, createHeroAnim(), 0);
      expect(m.power).toBe("dash");
      expect(m.rolling).toBe(true);
   });

   it("the shadow lies on the floor, on a jump pad, on the sky ledge, and nowhere over the void", () => {
      const run = createRun(1, 1);
      const c = run.course;
      expect(floorUnder(run)).toBe(0);
      const pad = c.pads[0];
      const at = padCenterAt(pad, run.simMs, { x: 0, z: 0 });
      run.hero.x = at.x;
      run.hero.z = at.z;
      run.hero.y = pad.y + 0.1;
      expect(floorUnder(run)).toBe(pad.y);
      run.hero.x = at.x + pad.r + 2.5;
      expect(floorUnder(run)).toBe(Number.NEGATIVE_INFINITY);
      run.hero.x = (c.ledge.x0 + c.ledge.x1) / 2;
      run.hero.z = (c.ledge.z0 + c.ledge.z1) / 2;
      run.hero.y = LEDGE_LIFT;
      expect(floorUnder(run)).toBe(LEDGE_LIFT);
   });

   it("carrying reads a section's core in hand and the Sentinel's", () => {
      const run = createRun(1, 3);
      expect(carrying(run)).toBe(false);
      const i = run.course.sections.findIndex((s) => s.kind === "core");
      run.coreState[i] = 1;
      expect(carrying(run)).toBe(true);
      run.coreState[i] = 2;
      expect(carrying(run)).toBe(false);
      run.bossCore = 2;
      expect(carrying(run)).toBe(true);
   });
});
