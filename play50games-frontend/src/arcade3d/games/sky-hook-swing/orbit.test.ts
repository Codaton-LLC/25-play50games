// Screen-up walks +x because the orbit starts on the -x side of the hero.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { SWING_ORBIT, introKeyframes, playCamera } from "./camera";
import { courseFor } from "./rules";
import { DEFAULT_HERO } from "./heroes";

describe("the orbit faces along the docks", () => {
   it("yaw -π/2 turns stick-up into +x", () => {
      expect(SWING_ORBIT.yaw).toBeCloseTo(-Math.PI / 2, 6);
      const w = inputToWorld(0, -1, SWING_ORBIT.yaw ?? 0);
      expect(w.x).toBeCloseTo(1, 5);
      expect(Math.abs(w.z)).toBeLessThan(1e-6);
   });

   it("the intro and the play camera are finite, and Nami is the default", () => {
      const course = courseFor(1);
      const play = playCamera(course, 16 / 9);
      expect(play.position.every((n) => Number.isFinite(n))).toBe(true);
      expect(play.lookAt.every((n) => Number.isFinite(n))).toBe(true);
      const keys = introKeyframes(course);
      expect(keys.length).toBeGreaterThan(1);
      expect(defaultHeroFor("sky-hook-swing", null)).toBe(DEFAULT_HERO);
      expect(DEFAULT_HERO).toBe("nami");
   });
});
