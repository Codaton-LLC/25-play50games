// Roll Dash with the shared orbit camera (menu2/camera): the lanes stay screen-relative (laneSign flips
// them only when the camera looks back down the street), the camera helpers, and the hero pick (the W6
// lead; the whole squad follows).
import { describe, expect, it } from "vitest";
import { dashOrbit, heroPivot, introKeyframes, laneSign, orbitLookUp, orbitScale, playCamera } from "./camera";
import { createRun } from "./rules";
import { pickedHero, resetHeroPick, selectHero } from "./heroes";

describe("screen-relative lanes", () => {
   it("left is -x looking down the street, and swaps when the camera is turned round", () => {
      expect(laneSign(0)).toBe(1);
      expect(laneSign(0.8)).toBe(1);
      expect(laneSign(Math.PI)).toBe(-1);
      expect(laneSign(-2.5)).toBe(-1);
   });
});

describe("camera helpers", () => {
   it("behind the roller, auto-follow on, the pivot led down the street", () => {
      const o = dashOrbit(false);
      expect(o.autoFollow).toBe(true);
      expect(o.yaw).toBe(0);
      expect(dashOrbit(true).distance!).toBeGreaterThan(o.distance!);
      expect(orbitScale(0.5)).toBeGreaterThan(orbitScale(1.6));
      expect(Number.isFinite(orbitLookUp(0.5))).toBe(true);
      const r = createRun(1, 1);
      r.hero.d = 100;
      const p = heroPivot(r, { x: 0, y: 0, z: 0 });
      expect(p.z).toBeLessThan(-100);
      expect(playCamera(false, 1.6).position.every(Number.isFinite)).toBe(true);
      expect(introKeyframes(600).length).toBeGreaterThan(1);
   });
});

describe("hero pick", () => {
   it("the picked hero leads the run", () => {
      resetHeroPick();
      selectHero("zuno");
      expect(pickedHero()).toBe("zuno");
      expect(createRun(1, 1, pickedHero()).active).toBe("zuno");
      resetHeroPick();
   });
});
