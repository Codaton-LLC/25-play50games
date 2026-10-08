import { describe, expect, it } from "vitest";
import { createPath } from "../path";
import { investigate, stepPatrol, type PatrolState } from "./patrol";
const v = (x: number, z = 0) => ({ x, y: 0, z });
describe("patrol", () => {
   it("returns to route after an investigation and resumes its waypoint", () => {
      const route = createPath([v(0), v(10), v(10, 10), v(0, 10)], { closed: true });
      const agent = { ...v(2), vx: 0, vy: 0, vz: 0, yaw: 0 };
      const state: PatrolState = { index: 1, wait: 0, mode: "patrol", target: v(0) };
      investigate(state, v(2, -2));
      const opts = { speed: 2, investigateWait: 1 };
      stepPatrol(agent, state, route, 1.5, opts);
      expect(agent.z).toBe(-2); expect(state.wait).toBeCloseTo(0.5); expect(state.mode).toBe("investigate");
      stepPatrol(agent, state, route, 0.75, opts); expect(state.mode).toBe("return"); expect(agent.z).toBeCloseTo(-1.5);
      stepPatrol(agent, state, route, 0.75, opts); expect(state.mode).toBe("patrol"); expect(agent.z).toBe(0); expect(state.index).toBe(1);
      stepPatrol(agent, state, route, 1, opts); expect(agent.x).toBe(4);
   });
   it("loops waypoints, waits and looks around deterministically", () => {
      const route = createPath([v(0), v(1)], { closed: true });
      const agent = { ...v(0), vx: 0, vy: 0, vz: 0, yaw: 0 };
      const state: PatrolState = { index: 1, wait: 0, mode: "patrol", target: v(0) };
      stepPatrol(agent, state, route, 1.25, { speed: 1, wait: 0.5 });
      expect(agent.x).toBe(1); expect(state.index).toBe(0); expect(state.wait).toBeCloseTo(0.25);
      expect(agent.yaw).not.toBe(Math.PI / 2);
      stepPatrol(agent, state, route, 1.25, { speed: 1, wait: 0.5 }); expect(agent.x).toBe(0); expect(state.index).toBe(1);
   });
   it("consumes long frames consistently and terminates coincident routes", () => {
      const route = createPath([v(0), v(1)], { closed: true });
      const a = { ...v(0), vx: 0, vy: 0, vz: 0, yaw: 0 }, b = { ...a };
      const first: PatrolState = { index: 1, wait: 0, mode: "patrol", target: v(0) };
      const second: PatrolState = { ...first, target: v(0) };
      stepPatrol(a, first, route, 30.25, { speed: 1 });
      for (let i = 0; i < 121; i++) stepPatrol(b, second, route, 0.25, { speed: 1 });
      expect(a.x).toBeCloseTo(b.x, 10); expect(first.index).toBe(second.index);
      stepPatrol(a, first, createPath([v(0), v(0)]), 100, { speed: 1 });
      expect(a.x).toBe(0);
   });
});
