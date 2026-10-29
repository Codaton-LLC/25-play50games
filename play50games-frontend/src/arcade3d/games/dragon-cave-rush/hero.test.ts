// The rider's animation motion (Hero.tsx writeHeroMotion, pure): a duck curls the hero into the ball, a
// hop / second hop / hit fire once each, the power shows, the cheer waits for the win; the cart's pose.
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { cartPose, createCartPose, createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { createRun } from "./rules";
import { centreAt } from "./track";

describe("the rider", () => {
   it("ducking rolls the hero into the ball; each event fires once", () => {
      const run = createRun(1, 1, "nami");
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.rolling).toBe(false);
      run.cart.ducking = true;
      writeHeroMotion(m, memo, run, anim, 0.1);
      expect(m.rolling).toBe(true);
      anim.hopAt = 0.2;
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.2);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.25);
      expect(m.events.jumped).toBe(false);
      anim.airHopAt = 0.3;
      writeHeroMotion(m, memo, run, anim, 0.3);
      expect(m.events.airJumped).toBe(true);
      anim.hitAt = 0.4;
      writeHeroMotion(m, memo, run, anim, 0.4);
      expect(m.events.hurt).toBe(true);
      expect(m.celebrating).toBe(false);
      anim.winAt = 0.5;
      writeHeroMotion(m, memo, run, anim, 0.6);
      expect(m.celebrating).toBe(true);
   });

   it("the power shows while it lasts", () => {
      const run = createRun(1, 1, "kiro");
      const m = createHeroMotion();
      run.cart.shieldUntil = 1000;
      writeHeroMotion(m, createMotionMemo(), run, createHeroAnim(), 0);
      expect(m.power).toBe("shield");
   });

   it("the cart is drawn on its lane over the rails, at its hop height", () => {
      const run = createRun(1, 1, "riko");
      run.cart.s = 40;
      run.cart.h = 1.2;
      const p = cartPose(run, createCartPose());
      const c = centreAt(run.course, 40, { x: 0, y: 0, z: 0, h: 0 });
      expect(p.x).toBeCloseTo(c.x, 6);
      expect(p.y).toBeCloseTo(c.y + 1.2, 6);
      expect(p.heading).toBeCloseTo(c.h, 6);
   });
});
