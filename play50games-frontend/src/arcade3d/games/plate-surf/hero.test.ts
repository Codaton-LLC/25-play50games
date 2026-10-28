// The hero on its plate (Hero.tsx): the pure motion writer (the animator never "runs" on the plate,
// the air states come from the vertical speed, a swallow rolls into the ball, one-frame events once),
// and the surf stance poses (pure, allocation-free, feet flat on the floor).
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createPose } from "@/arcade3d/core/rig";
import { createHeroAnim, createMotionMemo, grabPose, surfStancePose, writeHeroMotion } from "./Hero";
import { createRun } from "./rules";

describe("writeHeroMotion", () => {
   it("riding: no run speed, grounded; in the air the vertical speed; a swallow rolls into the ball", () => {
      const run = createRun(1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      run.hero.vx = 7;
      run.hero.v = 20;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vx).toBe(0);
      expect(m.vz).toBe(0);
      expect(m.grounded).toBe(true);
      expect(m.rolling).toBe(false);
      run.hero.grounded = false;
      run.hero.vy = 6;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vy).toBe(6);
      expect(m.grounded).toBe(false);
      run.hero.state = "lost";
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.rolling).toBe(true);
   });

   it("one-frame events fire once per stamp: jump, Nami's double air, landing, a sting / bail / wipeout as a hurt", () => {
      const run = createRun(1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      anim.jumpAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 1.1);
      expect(m.events.jumped).toBe(false);
      anim.airJumpAt = 2;
      writeHeroMotion(m, memo, run, anim, 2);
      expect(m.events.airJumped).toBe(true);
      anim.landAt = 3;
      writeHeroMotion(m, memo, run, anim, 3);
      expect(m.events.landed).toBe(true);
      for (const [i, k] of (["stungAt", "bailAt", "lostAt"] as const).entries()) {
         m.events.hurt = false;
         anim[k] = 4 + i;
         writeHeroMotion(m, memo, run, anim, 4);
         expect(m.events.hurt).toBe(true);
      }
      anim.winAt = 5;
      writeHeroMotion(m, memo, run, anim, 5.5);
      expect(m.celebrating).toBe(true);
   });
});

describe("the surf stance", () => {
   it("is a full pose with the feet kept on the floor (ground 1), unit quaternions, at every crouch and lean", () => {
      const p = createPose();
      for (const crouch of [0, 0.5, 1]) {
         for (const lean of [-1, 0, 1]) {
            surfStancePose(crouch, lean, p);
            expect(p.ground).toBe(1);
            for (let i = 0; i < p.q.length; i += 4) {
               const n = Math.hypot(p.q[i], p.q[i + 1], p.q[i + 2], p.q[i + 3]);
               expect(n).toBeCloseTo(1, 5);
            }
         }
      }
      grabPose(p);
      expect(p.ground).toBe(0);
   });
});
