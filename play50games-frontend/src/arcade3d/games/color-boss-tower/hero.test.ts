// The heroes' motion (Hero.tsx writeHeroMotion): the ring's tangent velocity, the power that is up,
// the one-shot events, the cheer and the slump; and the camera outside the wall facing the hero.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { R_PATH } from "./levels";
import { createRun } from "./rules";
import { outwardYaw, steerTowerCamera, towerOrbit } from "./camera";

describe("hero motion", () => {
   it("runs along the ring's tangent, fires each event once, cheers on a win", () => {
      const run = createRun(1, 1, "kiro");
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      run.hero.a = (Math.PI / 2) * R_PATH;
      run.hero.va = 4;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vx).toBeCloseTo(0, 6);
      expect(m.vz).toBeCloseTo(-4, 6);
      anim.jumpAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 1.1);
      expect(m.events.jumped).toBe(false);
      run.tag.powerUntil.kiro = run.simMs + 100;
      writeHeroMotion(m, memo, run, anim, 1.2);
      expect(m.power).toBe("shield");
      anim.winAt = 2;
      writeHeroMotion(m, memo, run, anim, 2.5);
      expect(m.celebrating).toBe(true);
   });
});

describe("the tower camera", () => {
   it("starts outside the wall facing the hero, and swings back there after a manual turn", () => {
      const run = createRun(1, 1);
      const o = createOrbit(towerOrbit(run));
      expect(o.yaw).toBeCloseTo(outwardYaw(run.hero.a), 6);
      run.hero.a = 20;
      o.idle = 10;
      for (let i = 0; i < 300; i++) steerTowerCamera(o, run, 1 / 60);
      expect(Math.abs(o.yaw - outwardYaw(20))).toBeLessThan(0.05);
      o.idle = 0;
      const before = o.yaw;
      run.hero.a = 40;
      steerTowerCamera(o, run, 1 / 60);
      expect(o.yaw).toBe(before);
   });
});
