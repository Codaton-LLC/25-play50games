// The drawn island against the rules: the waterline is the rules' shoreline at every moment of the
// tide, the follow camera's window per screen, and where the decor crabs sit.
import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { FOV, PITCH, WINDOW, crabAngles, groundHeight, viewFor, waterLevel, windowHalf } from "./looks";
import { FALLBACK_ISLAND, ISLAND, TIDE, clearance, generateIsland, shoreAt } from "./rules";

describe("treasure-island looks", () => {
   it("draws the waterline exactly at the rules' shore through the whole tide", () => {
      for (let t = 0; t <= 95; t += 0.5) {
         const shore = shoreAt(t);
         expect(groundHeight(shore)).toBeCloseTo(waterLevel(shore), 9);
      }
      expect(waterLevel(1)).toBeCloseTo(-0.3, 9);
      expect(waterLevel(TIDE.finalShore)).toBeCloseTo(0, 9);
      // flat sand inland, then down, steeper past the full-tide shore
      expect(groundHeight(0.5)).toBe(0);
      expect(groundHeight(ISLAND.sandFlat)).toBe(0);
      expect(groundHeight(1.1)).toBeLessThan(groundHeight(1));
   });

   it("fits a closer window on a phone and about 60 % of the island on a desktop", () => {
      expect(windowHalf(390, 844)).toEqual({ hx: 3.75, hz: 5.25 });
      expect(windowHalf(844, 390)).toEqual({ hx: 8, hz: 5 });
      expect(windowHalf(1280, 800)).toEqual({ hx: WINDOW.maxHalfX, hz: WINDOW.maxHalfZ });
      const desk = windowHalf(1280, 800);
      const share = (4 * desk.hx * desk.hz) / (Math.PI * ISLAND.rx * ISLAND.rz);
      expect(share).toBeGreaterThan(0.55);
      expect(share).toBeLessThan(0.65);
      // one cached object per window size: useFittedView refits only when it changes
      expect(viewFor(390, 844)).toBe(viewFor(391, 845));
      expect(viewFor(390, 844)).not.toBe(viewFor(1280, 800));
      // with no HUD, the phone draws about 42 px per metre at the explorer
      const scale = (w: number, h: number) => {
         const v = viewFor(w, h);
         const fit = fitView({ ...v, width: w, height: h, fov: FOV });
         return h / (2 * fit.distance * Math.tan((FOV * Math.PI) / 360));
      };
      // the explorer (1.556 m, about 1 m on screen at this pitch) is drawn about 40 px tall
      expect(scale(390, 844) * 1.556 * Math.cos(PITCH)).toBeGreaterThan(38);
      const phone = windowHalf(390, 844);
      expect(desk.hx * desk.hz).toBeGreaterThan(3 * phone.hx * phone.hz);
      expect(PITCH).toBeCloseTo((50 * Math.PI) / 180, 9);
   });

   it("puts three crabs on the beach clear of every prop on most islands", () => {
      expect(crabAngles(FALLBACK_ISLAND)).toHaveLength(3);
      let three = 0;
      for (let seed = 0; seed < 200; seed++) {
         const island = generateIsland(seed);
         const angles = crabAngles(island);
         if (angles.length === 3) three++;
         for (const a of angles) expect(clearance(island, ISLAND.rx * 0.94 * Math.cos(a), ISLAND.rz * 0.94 * Math.sin(a))).toBeGreaterThanOrEqual(1.5);
      }
      expect(three).toBeGreaterThan(190);
   });
});
