// Test-only navigation for levels.test.ts. No game/runtime file imports this module.
import { distanceToBoxXZ, type AABB } from "../../core/collision";
import { matchesKind, type CleanRun, type StepInput } from "./rules";

type Point = { x: number; z: number };
function clear(a: Point, b: Point, boxes: readonly AABB[], margin = 0.51): boolean {
   for (const box of boxes) {
      // Collision's speed guard can leave the centre slightly inside the inflated square.
      // Permit an outward segment: distance to a convex box cannot fall after its slope is positive.
      if (a.x >= box.min.x - margin && a.x <= box.max.x + margin && a.z >= box.min.z - margin && a.z <= box.max.z + margin) {
         const d = distanceToBoxXZ(a.x, a.z, box);
         const next = distanceToBoxXZ(a.x + (b.x - a.x) * 0.001, a.z + (b.z - a.z) * 0.001, box);
         if (next > d + 1e-9) continue;
      }
      let lo = 0, hi = 1;
      for (const axis of ["x", "z"] as const) {
         const d = b[axis] - a[axis];
         const min = box.min[axis] - margin, max = box.max[axis] + margin;
         if (Math.abs(d) < 1e-12) { if (a[axis] < min || a[axis] > max) { lo = 2; break; } }
         else {
            const t1 = (min - a[axis]) / d, t2 = (max - a[axis]) / d;
            lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
         }
      }
      if (lo <= hi) return false;
   }
   return true;
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const networks = new WeakMap<AABB[], ReturnType<typeof network>>();
function network(boxes: AABB[]) {
   const points: Point[] = [];
   for (const box of boxes) for (const x of [box.min.x - 0.7, box.max.x + 0.7]) for (const z of [box.min.z - 0.7, box.max.z + 0.7]) {
      if (Math.abs(x) <= 13.5 && Math.abs(z) <= 13.5 && boxes.every((b) => distanceToBoxXZ(x, z, b) >= 0.65)) points.push({ x, z });
   }
   const n = points.length;
   const costs = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));
   const next = Array.from({ length: n }, () => new Int32Array(n).fill(-1));
   for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i === j || clear(points[i], points[j], boxes)) { costs[i][j] = distance(points[i], points[j]); next[i][j] = j; }
   for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (costs[i][k] + costs[k][j] < costs[i][j]) { costs[i][j] = costs[i][k] + costs[k][j]; next[i][j] = next[i][k]; }
   }
   return { points, costs, next };
}
function route(a: Point, b: Point, boxes: AABB[]): Point[] {
   if (clear(a, b, boxes, 0.499)) return [b];
   let graph = networks.get(boxes);
   if (!graph) { graph = network(boxes); networks.set(boxes, graph); }
   const { points, costs, next } = graph;
   const from = points.map((p) => clear(a, p, boxes, 0.499) ? distance(a, p) : Infinity);
   const to = points.map((p) => clear(p, b, boxes) ? distance(p, b) : Infinity);
   let best = Infinity, first = -1, last = -1;
   for (let i = 0; i < points.length; i++) for (let j = 0; j < points.length; j++) {
      const d = from[i] + costs[i][j] + to[j];
      if (d < best) { best = d; first = i; last = j; }
   }
   if (first < 0) throw new Error(`Bot cannot route to ${b.x}, ${b.z}`);
   const out = [points[first]];
   for (let i = first; i !== last;) { i = next[i][last]; out.push(points[i]); }
   out.push(b);
   return out;
}

/** Human: 150 ms reaction after each pickup/map swap, 90% stick; oracle: immediate full stick. */
export function collectorBot(human: boolean) {
   const input: StepInput = { moveX: 0, moveY: 0 };
   let map = -1, collected = -1, delivering = false, waitUntil = 0;
   let path: Point[] = [], k = 0;
   return (run: CleanRun): StepInput => {
      const r = run.runner;
      if (run.map !== map || run.collected !== collected || run.delivering !== delivering) {
         map = run.map; collected = run.collected; delivering = run.delivering;
         let target: Point = { x: 0, z: 12 }, best = Infinity;
         if (!delivering) for (const slot of run.litter) {
            if (!slot.active || (run.level.matching && !matchesKind(run, slot.kind))) continue;
            const d = distance(r, slot);
            if (d < best) { best = d; target = slot; }
         }
         path = route(r, target, run.caches[map].obstacles); k = 0;
         waitUntil = run.simMs + (human ? 150 : 0);
      }
      if (run.simMs < waitUntil) { input.moveX = input.moveY = 0; return input; }
      while (k < path.length - 1 && distance(r, path[k]) < 0.18) k++;
      const p = path[k], dx = p.x - r.x, dz = p.z - r.z, len = Math.hypot(dx, dz) || 1;
      const speed = Math.min(human ? 0.9 : 1, k < path.length - 1 ? len / 0.6 : 1);
      input.moveX = speed * dx / len; input.moveY = speed * dz / len;
      return input;
   };
}
