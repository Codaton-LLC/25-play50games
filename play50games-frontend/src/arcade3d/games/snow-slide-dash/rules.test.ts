import { describe, expect, it } from "vitest";
import { createRun, step, idleInput, surfaceAt, aligned, LIMITS, TOP_SPEED } from "./rules";
import { LEVELS } from "./levels";
import { HEROES } from "./heroes";

describe("Carve & Air", () => {
   it("starts with World 4's lead and moves without lanes", () => {
      const r = createRun(1, 1);
      expect(r.heroId).toBe("zuno");
      step(r, 200, { ...idleInput(), moveX: 0.37 });
      expect(r.hero.x).toBeGreaterThan(0);
      expect(r.distance).toBeGreaterThan(0);
      expect(r.hero.x).not.toBe(Math.round(r.hero.x));
   });
   it("carving tightens steering and costs speed", () => {
      const a = createRun(1, 1), b = createRun(1, 1);
      step(a, 200, { ...idleInput(), moveX: 1 });
      step(b, 200, { ...idleInput(), moveX: 1, carve: true });
      expect(b.hero.x).toBeGreaterThan(a.hero.x);
      expect(b.speed).toBeLessThan(a.speed);
   });
   it("ice has no steering and alignment allows twenty degrees", () => {
      expect(surfaceAt(LEVELS[3], 170, 0)).toBe("ice");
      const r = createRun(1, 3);
      r.distance = 170;
      r.hero.z = -170;
      step(r, 100, { ...idleInput(), moveX: 1 });
      expect(r.hero.x).toBe(0);
      expect(aligned(Math.PI * 2 + 0.34)).toBe(true);
      expect(aligned(Math.PI * 2 + 0.36)).toBe(false);
   });
   it("derives separate level bounds from the absolute travel-speed cap", () => {
      expect(([1, 2, 3, 4, 5] as const).map((id) => [LIMITS[id].minDurationMs, LIMITS[id].maxScore])).toEqual([[14771, 8522], [20908, 10409], [24999, 12000], [29544, 13545], [40908, 16909]]);
      for (const id of [1, 2, 3, 4, 5] as const) {
         expect(LIMITS[id].minDurationMs).toBe(Math.floor(LEVELS[id].length / TOP_SPEED * 1000) - 1);
         expect(LIMITS[id].maxScore).toBe(Math.floor((LEVELS[id].durationMs - LIMITS[id].minDurationMs) / 10));
      }
   });
   it("each hero opens its own side route on every level, leaving the ordinary line open", () => {
      for (const id of [1, 2, 3, 4, 5] as const) for (const hero of HEROES) {
         const r = createRun(9, id, hero.id);
         const i = r.course.routes.findIndex((p) => p.hero === hero.id), route = r.course.routes[i];
         r.distance = route.d + 1; r.hero.x = route.x; r.hero.z = -r.distance;
         if (hero.id === "nami") { r.airMs = 500; r.airTotal = 1100; r.airApex = 6; }
         step(r, 8, { ...idleInput(), actionPressed: true });
         expect(r.routeDone[i], `${hero.id} L${id}`).toBe(1);
         if (hero.id === "zuno") expect(r.trailCoins).toBe(12);
      }
   });
   it("a missed gate breaks the streak and every star can be collected only once", () => {
      const r = createRun(1, 1), g = r.course.gates[0];
      r.distance = g.d - 0.01; r.hero.x = g.x;
      step(r, 8, idleInput());
      expect(r.orbs).toBe(1); expect(r.streak).toBe(1);
      r.nextGate = 0; r.distance = g.d - 0.01;
      step(r, 8, idleInput());
      expect(r.orbs).toBe(1);
      r.hero.x = 16; r.distance = r.course.gates[1].d - 0.01;
      step(r, 8, idleInput());
      expect(r.streak).toBe(0);
   });
   it("turning the camera rotates ground steering without increasing the speed cap", () => {
      const r = createRun(7, 1);
      step(r, 200, { ...idleInput(), moveY: 1, yaw: Math.PI / 2 });
      expect(r.hero.x).toBeGreaterThan(0);
      expect(r.speed).toBeLessThanOrEqual(TOP_SPEED);
   });
   it("Big Drift gains on a broken streak even while a previous boost is still fast", () => {
      const r = createRun(1, 5);
      r.speed = 44; r.boost = 8; r.streak = 0;
      step(r, 100, idleInput());
      expect(r.gap).toBeLessThan(110);
   });
});
