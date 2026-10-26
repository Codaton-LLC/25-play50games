// Rising Water and Temple Escape use the deep-shaft look. Levels 1-3 keep the misty ruin daylight.
import { describe, expect, it } from "vitest";
import definition from "./index";
import { FOG } from "./World";
import { COLORS, STORM, isStormLevel, levelEnvironment, lightningFlash } from "./look";

function channel(hex: string, i: number): number {
   return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

function lum(hex: string): number {
   return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

describe("cloud-hopper dusk look", () => {
   it("levels 4 and 5 use the deep-shaft preset; levels 1-3 keep the misty daylight", () => {
      expect(definition.environment).toMatchObject({
         background: COLORS.background,
         lighting: "day",
         fog: [FOG.color, FOG.near, FOG.far],
      });
      for (const id of [1, 2, 3]) {
         expect(isStormLevel(id)).toBe(false);
         expect(levelEnvironment(id)).toBeNull();
         expect(definition.levels![id - 1].environment).toBeUndefined();
      }
      for (const id of [4, 5] as const) {
         const env = levelEnvironment(id);
         expect(env).not.toBeNull();
         expect(definition.levels![id - 1].environment).toEqual(env);
         expect(env!.lighting).toBe("night");
         expect(env!.background).toBe(STORM.background);
         expect(env!.fog[0]).toBe(STORM.fog);
         expect(env!.fog[1]).toBeLessThan(FOG.near);
         expect(env!.fog[2]).toBeLessThan(FOG.far);
         expect(env!.fog[2] - env!.fog[1]).toBeLessThan(FOG.far - FOG.near);
      }
      expect(levelEnvironment(5)!.fog[2]).toBeLessThan(levelEnvironment(4)!.fog[2]);
   });

   it("the deep shaft is darker, and bluer than it is warm", () => {
      expect(lum(STORM.skyTop)).toBeLessThan(lum(COLORS.skyTop));
      expect(lum(STORM.skyMid)).toBeLessThan(lum(COLORS.skyMid));
      expect(lum(STORM.skyBottom)).toBeLessThan(lum(COLORS.skyBottom));
      expect(lum(STORM.fog)).toBeLessThan(lum(COLORS.fog));
      expect(lum(STORM.background)).toBeLessThan(lum(COLORS.background));
      for (const hex of [STORM.skyTop, STORM.skyMid, STORM.skyBottom, STORM.fog, STORM.background]) {
         expect(channel(hex, 2)).toBeGreaterThan(channel(hex, 0));
      }
      expect(STORM.fill).toBeLessThan(1);
      expect(STORM.lighting).toBe("night");
   });

   it("lightning flashes are occasional and do not stay on", () => {
      expect(lightningFlash(0)).toBe(0);
      expect(lightningFlash(0.12)).toBeGreaterThan(0.9);
      expect(lightningFlash(2)).toBe(0);
      // the skipped cycle (every third) stays dark
      expect(lightningFlash(6.2 * 2 + 0.12)).toBe(0);
      let lit = 0;
      const step = 0.02;
      const span = 40;
      for (let t = 0; t < span; t += step) if (lightningFlash(t) > 0.15) lit++;
      const fraction = lit / (span / step);
      expect(fraction).toBeGreaterThan(0.005);
      expect(fraction).toBeLessThan(0.08);
   });
});
