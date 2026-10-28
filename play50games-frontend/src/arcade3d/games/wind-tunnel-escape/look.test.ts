// The look's pure helpers: the panel lines, the dusk levels, the lightning, and the fan's drawn yaw
// (the grille faces the current's direction).
import { describe, expect, it } from "vitest";
import { DIR_X, DIR_Z } from "./tunnel";
import { fanYaw } from "./Course";
import { fogFor, isDusk, levelEnvironment, lightningFlash, panelLine } from "./look";

describe("look", () => {
   it("panel lines sit at every panel edge and nowhere inside a panel", () => {
      expect(panelLine(0, 2)).toBe(1);
      expect(panelLine(2.02, 2)).toBe(1);
      expect(panelLine(1, 2)).toBe(0);
      expect(panelLine(-0.5, 2)).toBe(0);
   });

   it("levels 4 and 5 are storm dusk (night lighting, closer fog); 1-3 day", () => {
      for (const id of [1, 2, 3]) {
         expect(isDusk(id)).toBe(false);
         expect(levelEnvironment(id).lighting).toBe("day");
      }
      for (const id of [4, 5]) {
         expect(isDusk(id)).toBe(true);
         expect(levelEnvironment(id).lighting).toBe("night");
         expect(fogFor(id).far).toBeLessThan(fogFor(1).far);
      }
   });

   it("the lightning flashes now and then, always within 0..1", () => {
      let flashes = 0;
      for (let t = 0; t < 60; t += 0.02) {
         const f = lightningFlash(t);
         expect(f).toBeGreaterThanOrEqual(0);
         expect(f).toBeLessThanOrEqual(1);
         if (f > 0.9) flashes++;
      }
      expect(flashes).toBeGreaterThan(0);
      expect(lightningFlash(-1)).toBe(0);
   });

   it("a fan's model (grille facing +z) turns to face its direction", () => {
      for (let d = 0; d < 4; d++) {
         const y = fanYaw(d);
         expect(Math.sin(y)).toBeCloseTo(DIR_X[d], 6);
         expect(Math.cos(y)).toBeCloseTo(DIR_Z[d], 6);
      }
   });
});
