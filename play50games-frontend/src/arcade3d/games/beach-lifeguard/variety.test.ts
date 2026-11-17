// The five levels look like their names: per-level themes, set pieces and lighting, and every decor
// spot / set piece stays out of the play rectangle (the beach box: z in [-water, SAND_DEPTH], |x| <= width/2).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { END_GAP, THEMES, decorSpots, themeFor } from "./looks";
import { SAND_DEPTH } from "./rules";

describe("beach-lifeguard per-level variety", () => {
   it("every level has its own theme: no two share sky, water and weather", () => {
      const keys = LEVEL_IDS.map((id) => JSON.stringify(themeFor(id)));
      expect(new Set(keys).size).toBe(LEVEL_IDS.length);
      // the storm beach is the rainy one with the roughest sea; nobody else rains
      expect(THEMES[5].rain).toBe(true);
      for (const id of LEVEL_IDS.slice(0, 4)) expect(THEMES[id].rain).toBe(false);
      for (const id of LEVEL_IDS) expect(THEMES[id].waveAmp).toBeGreaterThan(0);
   });

   it("the lighting presets match the level names", () => {
      expect(LEVELS[1].lighting).toBe("day");
      expect(LEVELS[2].lighting).toBe("day");
      expect(LEVELS[3].lighting).toBe("sunset");
      expect(LEVELS[4].lighting).toBe("sunset");
      expect(LEVELS[5].lighting).toBe("night");
   });

   it("each level carries its own set pieces, and level 1 keeps today's plain beach", () => {
      const d2 = decorSpots(2);
      expect(d2.boardwalk.length).toBeGreaterThan(3);
      const d3 = decorSpots(3);
      expect(d3.hotels.length).toBe(2);
      expect(d3.deckChairs.length).toBeGreaterThan(4);
      expect(d3.pool).not.toBeNull();
      const d4 = decorSpots(4);
      expect(d4.slides.length).toBe(2);
      expect(d4.rings.length).toBeGreaterThan(3);
      // level 1 has no set pieces: today's huts / palms / clutter only
      const d1 = decorSpots(1);
      expect(d1.boardwalk.length + d1.hotels.length + d1.deckChairs.length + d1.slides.length + d1.rings.length).toBe(0);
      expect(d1.pool).toBeNull();
      // the set pieces are per-level, not shared
      const sum = (id: number) => {
         const d = decorSpots(id as 1);
         return d.boardwalk.length + d.hotels.length + d.deckChairs.length + d.slides.length + d.rings.length;
      };
      expect(sum(1)).toBe(0);
      expect(sum(3)).toBeGreaterThan(0);
      expect(sum(5)).toBe(0);
   });

   it("level 1's theme is the original day palette", () => {
      expect(THEMES[1]).toEqual({ skyTop: "#0ea5e9", waterShallow: "#38bdf8", waterDeep: "#0369a1", waterFoam: "#f0fdf4", waveAmp: 0.14, rain: false });
   });

   it("every decor spot and set piece stays out of the play area", () => {
      for (const id of LEVEL_IDS) {
         const halfW = LEVELS[id].width / 2;
         const d = decorSpots(id);
         // tall things only past the beach ends, never in the sea
         for (const s of [...d.palms, ...d.huts, ...d.hotels]) {
            expect(Math.abs(s.x), `L${id} tall decor at x ${s.x}`).toBeGreaterThanOrEqual(halfW + END_GAP);
            expect(s.z, `L${id} tall decor at z ${s.z}`).toBeGreaterThanOrEqual(0);
         }
         for (const s of d.slides) {
            // the flume's footprint: the spot is past the end minus the tube's half width (scale x 0.5)
            expect(Math.abs(s.x) - 0.5 * (s.scale ?? 1), `L${id} slide at x ${s.x}`).toBeGreaterThanOrEqual(halfW);
            expect(s.z, `L${id} slide at z ${s.z}`).toBeGreaterThanOrEqual(0);
         }
         // low things only on the camera side, behind the sand
         for (const s of [...d.castles, ...d.coolers, ...d.boardwalk, ...d.deckChairs, ...d.rings]) {
            expect(s.z, `L${id} low decor at z ${s.z}`).toBeGreaterThan(SAND_DEPTH);
         }
         if (d.pool) {
            expect(d.pool.z - d.pool.d / 2).toBeGreaterThan(SAND_DEPTH);
            expect(d.pool.w).toBeGreaterThan(4);
         }
      }
   });
});
