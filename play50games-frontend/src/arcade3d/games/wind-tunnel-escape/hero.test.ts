// The hero's motion writer (Hero.tsx writeHeroMotion, pure): what the shared animator gets from the run.
// Riding a current curls the hero into the armoured ball (the signature roll), Nami's hop out of one
// unrolls her, a dash is the dash power, moments become one-frame events (each once).
import { afterEach, describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createHeroAnim, createMotionMemo, rollsInCurrent, writeHeroMotion } from "./Hero";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { dirIndex } from "./tunnel";
import { createRun, createStepInput, step } from "./rules";

describe("writeHeroMotion", () => {
   it("on foot: velocity and grounded pass through, no ball, no power", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const i = createStepInput();
      i.moveZ = -1;
      for (let k = 0; k < 20; k++) step(run, 16, i);
      writeHeroMotion(m, createMotionMemo(), run, createHeroAnim(), 1);
      expect(m.vz).toBeLessThan(-5);
      expect(m.grounded).toBe(true);
      expect(m.rolling).toBe(false);
      expect(m.power).toBe(null);
   });

   it("in a current the hero rolls as the ball; Nami's hop out of it unrolls her", () => {
      const run = createRun(1, 1, "nami");
      const f = run.course.rooms[1].solution[0].fan;
      run.world.dir[f] = dirIndex("n");
      const fan = run.course.fans[f];
      Object.assign(run.hero, { x: fan.x, y: fan.y, z: fan.z - 1.1 });
      for (let k = 0; k < 20; k++) step(run, 16, createStepInput());
      expect(rollsInCurrent(run)).toBe(true);
      const m = createHeroMotion();
      writeHeroMotion(m, createMotionMemo(), run, createHeroAnim(), 1);
      expect(m.rolling).toBe(true);
      const j = createStepInput();
      j.jumpPressed = true;
      step(run, 16, j);
      expect(run.events.airJumped).toBe(true);
      expect(rollsInCurrent(run)).toBe(false);
   });

   it("one-frame events fire once per moment; a dash is the dash power", () => {
      const run = createRun(1, 1, "riko");
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      anim.jumpAt = 1;
      anim.hitAt = 2;
      writeHeroMotion(m, memo, run, anim, 3);
      expect(m.events.jumped).toBe(true);
      expect(m.events.hurt).toBe(true);
      m.events.jumped = false;
      m.events.hurt = false;
      writeHeroMotion(m, memo, run, anim, 3.1);
      expect(m.events.jumped).toBe(false);
      expect(m.events.hurt).toBe(false);
      run.hero.dashUntil = run.ms + 200;
      writeHeroMotion(m, memo, run, anim, 3.2);
      expect(m.power).toBe("dash");
   });

   it("the intro drop curls the hero up; the cheer starts at the win", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const anim = createHeroAnim();
      anim.intro = 0.3;
      writeHeroMotion(m, createMotionMemo(), run, anim, 1);
      expect(m.rolling).toBe(true);
      expect(m.grounded).toBe(false);
      anim.intro = Number.NaN;
      anim.winAt = 2;
      writeHeroMotion(m, createMotionMemo(), run, anim, 2.5);
      expect(m.celebrating).toBe(true);
   });
});

describe("hero pick", () => {
   afterEach(() => selectHero(DEFAULT_HERO));

   it("World 2's lead, Nami, is preselected; a new pick notifies once; every hero has its own GLB", () => {
      expect(DEFAULT_HERO).toBe("nami");
      expect(pickedHero()).toBe("nami");
      let calls = 0;
      const off = subscribeHero(() => calls++);
      selectHero("vexa");
      selectHero("vexa");
      expect(calls).toBe(1);
      off();
      expect(HEROES.map((h) => h.id)).toEqual([...M2_HERO_IDS]);
      expect(new Set(M2_HERO_IDS.map((id) => heroModelAsset(id).url)).size).toBe(5);
   });
});
