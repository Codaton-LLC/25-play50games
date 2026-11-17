// Space Pod Jump with the shared orbit camera (menu2/camera) and its roll: screen-relative walking through
// the rules' own input (StepInput.roll / yaw), the roll's rate limit (25 degrees a second), the intro
// ending on the orbit's first pose, and the preselected hero (World 5: Vexa).
import { describe, expect, it } from "vitest";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { POD_ORBIT, ROLL_RATE, introKeyframes, orbitPivot, orbitScale, playCamera, stepRoll } from "./camera";
import { courseFor, createRun, createStepInput, step, walkSign } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

describe("screen-relative walking", () => {
   it("with the view rolled to the local up a right press walks clockwise everywhere round the body", () => {
      for (const a of [0, 1, 2, 3, 4, 5, 6]) expect(walkSign(a, a - Math.PI / 2, 0)).toBe(-1);
   });

   it("with the up fixed, a right press at the bottom of a body walks counter-clockwise (screen right is +x there)", () => {
      expect(walkSign(-Math.PI / 2, 0, 0)).toBe(1);
      expect(walkSign(Math.PI / 2, 0, 0)).toBe(-1);
      // the camera turned round (yaw pi) mirrors it
      expect(walkSign(Math.PI / 2, 0, Math.PI)).toBe(1);
   });

   it("a right press from the start walks the hero clockwise (its angle goes down)", () => {
      const r = createRun(1, 1);
      const a0 = r.hero.angle;
      const i = createStepInput();
      i.moveX = 1;
      i.roll = a0 - Math.PI / 2;
      for (let k = 0; k < 20; k++) step(r, 16, i);
      expect(r.hero.angle).toBeLessThan(a0);
   });
});

describe("the camera", () => {
   it("the roll turns at most 25 degrees a second, the short way round", () => {
      expect(stepRoll(0, 1, 0.1)).toBeCloseTo(ROLL_RATE * 0.1, 9);
      expect(stepRoll(0, -1, 0.1)).toBeCloseTo(-ROLL_RATE * 0.1, 9);
      expect(stepRoll(3, -3, 1)).toBeGreaterThan(3);
      expect(stepRoll(0.2, 0.21, 1)).toBeCloseTo(0.21, 9);
   });

   it("the intro ends on the orbit's first pose (playCamera), portrait farther back", () => {
      for (const level of LEVEL_IDS) {
         const c = courseFor(level);
         for (const aspect of [1.6, 0.46]) {
            const p = orbitPivot(c.startX, c.startY, 0, 0, { x: 0, y: 0, z: 0 });
            const want = orbitPosition(p.x, p.y, p.z, POD_ORBIT.yaw!, POD_ORBIT.pitch!, POD_ORBIT.distance! * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            const got = playCamera(c, aspect);
            expect(got.position[0]).toBeCloseTo(want.x, 6);
            expect(got.position[1]).toBeCloseTo(want.y, 6);
            expect(got.position[2]).toBeCloseTo(want.z, 6);
         }
         expect(introKeyframes(c).length).toBeGreaterThanOrEqual(3);
      }
      // the start view looks at the play plane from +z
      expect(playCamera(courseFor(1), 1.6).position[2]).toBeGreaterThan(5);
   });
});

describe("the hero pick", () => {
   it("World 5's lead, Vexa, is preselected; the player's pick is remembered", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("space-pod-jump")).toBe("vexa");
      expect(DEFAULT_HERO).toBe("vexa");
      expect(pickedHero()).toBe("vexa");
      selectHero("riko");
      resetHeroPick();
      expect(pickedHero()).toBe("riko");
   });
});
