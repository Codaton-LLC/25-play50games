// Obstacle Race level themes (themes.ts): the per-level looks differ, and every decor set piece
// stays out of the play area. Level 1 is special: its theme is empty, so its resolved palette is
// BASE_COLORS bit for bit, it draws no decor, and it keeps the default environment — level 1
// looks exactly as before. The course geometry, the obstacle timeline and the scoring are not
// touched here (levels.test.ts proves them; this only covers the look layer).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { buildCourse } from "./rules";
import {
   BASE_COLORS,
   decorOf,
   decorSpotClear,
   LEVEL_THEMES,
   OVERHEAD_Y,
   PLAY_HALF_X,
   playAreaClear,
   resolveColors,
} from "./themes";

describe("obstacle-race themes: level 1 is today's look", () => {
   it("level 1's theme is empty: base palette, no decor, default environment", () => {
      expect(LEVEL_THEMES[1].tint).toEqual({});
      expect(resolveColors(LEVEL_THEMES[1])).toEqual(BASE_COLORS);
      const course = buildCourse(LEVELS[1]);
      const decor = decorOf(1, course);
      expect([decor.boxes.length, decor.cylinders.length, decor.cones.length, decor.tris.length, decor.beacons.length, decor.sweepers.length]).toEqual([0, 0, 0, 0, 0, 0]);
      expect(definition.levels![0].environment).toBeUndefined();
   });
});

describe("obstacle-race themes: every level has its own look", () => {
   it("levels 2-5 override the palette and carry their own decor", () => {
      const base = resolveColors(LEVEL_THEMES[1]);
      const signatures = new Set<string>();
      for (const id of LEVEL_IDS.slice(1) as Array<2 | 3 | 4 | 5>) {
         const colors = resolveColors(LEVEL_THEMES[id]);
         const changed = Object.keys(BASE_COLORS).filter((k) => colors[k as keyof typeof BASE_COLORS] !== base[k as keyof typeof BASE_COLORS]);
         expect(changed.length, `level ${id} palette changes`).toBeGreaterThanOrEqual(3);
         const course = buildCourse(LEVELS[id]);
         const decor = decorOf(id, course);
         const staticSpots = decor.boxes.length + decor.cylinders.length + decor.cones.length + decor.tris.length;
         expect(staticSpots, `level ${id} decor`).toBeGreaterThanOrEqual(20);
         // the level's twist piece: rail beacons (2), overhead rope bridges (3), sweep cones (4), confetti (5)
         if (id === 2) expect(decor.beacons.length, `level ${id} beacons`).toBeGreaterThan(0);
         if (id === 3) expect(decor.boxes.some((b) => b.y > 3 && b.sz > 1 && Math.abs(b.x) < 1), `level ${id} overhead bridge`).toBe(true);
         if (id === 4) expect(decor.sweepers.length, `level ${id} sweepers`).toBeGreaterThan(0);
         if (id === 5) expect(decor.tris.length, `level ${id} bunting`).toBeGreaterThan(0);
         signatures.add(JSON.stringify([decor.boxes, decor.cylinders, decor.cones, decor.tris]));
      }
      // the four decor layouts are pairwise distinct
      expect(signatures.size).toBe(4);
   });

   it("levels 2-5 set their own environment (lighting / fog)", () => {
      for (const id of LEVEL_IDS.slice(1) as Array<2 | 3 | 4 | 5>) {
         const env = definition.levels![id - 1].environment;
         expect(env, `level ${id} environment`).toBeDefined();
      }
      const envs = LEVEL_IDS.slice(1).map((id) => JSON.stringify(definition.levels![id - 1].environment));
      expect(new Set(envs).size).toBe(4);
   });
});

describe("obstacle-race themes: props stay out of the play area", () => {
   it("no decor spot intersects the runner corridor below the overhead clearance", () => {
      for (const id of LEVEL_IDS) {
         const course = buildCourse(LEVELS[id]);
         const decor = decorOf(id, course);
         for (const spot of decor.boxes) expect(decorSpotClear(spot, course), `L${id} box ${JSON.stringify(spot)}`).toBe(true);
         for (const spot of decor.cylinders) expect(decorSpotClear(spot, course), `L${id} cylinder ${JSON.stringify(spot)}`).toBe(true);
         for (const spot of decor.cones) expect(decorSpotClear(spot, course), `L${id} cone ${JSON.stringify(spot)}`).toBe(true);
         for (const spot of decor.tris) expect(decorSpotClear(spot, course), `L${id} tri ${JSON.stringify(spot)}`).toBe(true);
      }
   });

   it("the rule itself: corridor spots are caught, side and overhead spots pass", () => {
      const course = buildCourse(LEVELS[1]);
      // inside the corridor at ground level: rejected
      expect(playAreaClear({ minX: -1, maxX: 1, minP: 20, maxP: 21, bottom: 0 }, course)).toBe(false);
      // inside the corridor but overhead: allowed
      expect(playAreaClear({ minX: -8, maxX: 8, minP: 20, maxP: 21, bottom: OVERHEAD_Y }, course)).toBe(true);
      // just below the overhead clearance: rejected
      expect(playAreaClear({ minX: -8, maxX: 8, minP: 20, maxP: 21, bottom: OVERHEAD_Y - 0.01 }, course)).toBe(false);
      // beside the corridor: allowed even at ground level
      expect(playAreaClear({ minX: PLAY_HALF_X + 0.2, maxX: PLAY_HALF_X + 1, minP: 20, maxP: 21, bottom: -2 }, course)).toBe(true);
      // beyond the finish pad and behind the start: allowed
      expect(playAreaClear({ minX: -1, maxX: 1, minP: course.finish.line + 20, maxP: course.finish.line + 21, bottom: -2 }, course)).toBe(true);
      expect(playAreaClear({ minX: -1, maxX: 1, minP: -12, maxP: -8, bottom: -2 }, course)).toBe(true);
   });

   it("the dynamic pieces sit beside the course too", () => {
      for (const id of LEVEL_IDS) {
         const course = buildCourse(LEVELS[id]);
         const decor = decorOf(id, course);
         for (const b of decor.beacons) {
            expect(Math.abs(b.x) - 0.16, `L${id} beacon x`).toBeGreaterThanOrEqual(PLAY_HALF_X);
            expect(b.p, `L${id} beacon p`).toBeGreaterThanOrEqual(course.supports.find((s) => s.kind === "block")!.minP);
         }
         for (const s of decor.sweepers) expect(Math.abs(s.x) - 3.4, `L${id} sweeper x`).toBeGreaterThanOrEqual(PLAY_HALF_X);
      }
   });
});
