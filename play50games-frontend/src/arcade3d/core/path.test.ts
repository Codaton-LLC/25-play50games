import { describe, expect, it } from "vitest";
import { advanceGraph, advance, createPath, createPathGraph, nearestS, pointAt, tangentAt } from "./path";
const v = (x: number, z = 0) => ({ x, y: 0, z });
describe("paths", () => {
   it("measures a circle polygon within 0.5 percent", () => {
      const points = Array.from({ length: 64 }, (_, i) => v(Math.cos(i * Math.PI / 32) * 10, Math.sin(i * Math.PI / 32) * 10));
      const path = createPath(points, { closed: true });
      expect(Math.abs(path.total / (20 * Math.PI) - 1)).toBeLessThan(0.005);
      const state = { path, s: path.total - 0.5, position: v(0) };
      expect(advance(state, path.total * 3 + 1)).toBe(state);
      expect(state.s).toBeCloseTo(0.5, 10);
      expect(state.position).toEqual(pointAt(path, 0.5));
      advance(state, -1); expect(state.s).toBeCloseTo(path.total - 0.5);
   });
   it("is continuous at joints and clamps open endpoints", () => {
      const path = createPath([v(0), v(2), v(2, 3)]);
      expect(pointAt(path, 2 - 1e-7).x).toBeCloseTo(pointAt(path, 2 + 1e-7).x, 6);
      expect(pointAt(path, -5)).toEqual(v(0)); expect(pointAt(path, 20)).toEqual(v(2, 3));
      expect(tangentAt(path, 3)).toEqual(v(0, 1));
      expect(nearestS(path, v(3, 2))).toBeCloseTo(4);
      const out = v(0); expect(pointAt(path, 3, out)).toBe(out); expect(tangentAt(path, 3, out)).toBe(out);
   });
   it("samples smooth paths and handles single/duplicate points", () => {
      const points = [v(0), v(1, 1), v(2)];
      const path = createPath(points, { smooth: true, samples: 8 });
      expect(path.points).toHaveLength(17); expect(pointAt(path, path.lengths[8])).toEqual(points[1]);
      points[0].x = 99; expect(path.points[0].x).toBe(0);
      const singleton = createPath([v(3)]);
      expect(pointAt(singleton, 9)).toEqual(v(3)); expect(tangentAt(singleton, 0)).toEqual(v(0));
      expect(pointAt(createPath([v(1), v(1)]), 0)).toEqual(v(1));
      const closed = createPath([v(0), v(1, 1), v(2)], { smooth: true, closed: true, samples: 8 });
      expect(pointAt(closed, closed.total)).toEqual(pointAt(closed, 0));
   });
   it("chooses junction branches and terminates missing choices", () => {
      const path = createPath([v(0), v(1)]), graph = createPathGraph([path, path, path], [[1, 2], [0], []]);
      expect(graph.next(0, 1)).toBe(2); expect(graph.next(2, 0)).toBeNull(); expect(graph.next(9, 0)).toBeNull();
   });
   it("preserves junction overflow across multiple segments", () => {
      const paths = [createPath([v(0), v(1)]), createPath([v(1), v(3)]), createPath([v(3), v(8)])];
      const rider = { path: paths[0], s: 0.9, position: v(0.9), overflow: 0 };
      advance(rider, 5); expect(rider.overflow).toBeCloseTo(4.9, 12);
      rider.s = 0.9;
      advanceGraph(rider, createPathGraph(paths, [[1], [2], []]), (junction) => junction + 1, 5);
      expect(rider.path).toBe(paths[2]); expect(Math.abs(3 + rider.s - 5.9)).toBeLessThan(1e-9);
      expect(rider.position.x).toBeCloseTo(5.9, 12); expect(rider.overflow).toBe(0);
   });
   it("uses the start for NaN and last nonzero endpoint tangent", () => {
      const path = createPath([v(2), v(4), v(4)]);
      expect(pointAt(path, NaN)).toEqual(v(2)); expect(tangentAt(path, path.total)).toEqual(v(1));
   });
});
