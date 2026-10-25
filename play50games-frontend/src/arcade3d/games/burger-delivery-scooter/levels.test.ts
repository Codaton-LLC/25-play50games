import { describe, expect, it } from "vitest";
import { createInputController } from "../../core/inputController";
import { capScore } from "../../core/limits";
import { LEVEL_IDS } from "../../types";
import { LEVELS } from "./levels";
import { LIMITS, burgerDeliveryScooterMeta } from "./meta";
import { createRun, inside, stepRun, type Point, type Rect } from "./rules";
// Visibility-graph distance around expanded building footprints. Ignoring hazards is a lower bound.
function shortest(a: Point, b: Point, blocks: Rect[]): number {
   const rects = blocks.map((v) => ({ ...v, hx: v.hx + 0.55, hz: v.hz + 0.55 }));
   const nodes = [a, b, ...rects.flatMap((r) => [-1, 1].flatMap((x) => [-1, 1].map((z) => ({ x: r.x + x * r.hx, z: r.z + z * r.hz }))))];
   function clear(a: Point, b: Point): boolean {
      return !rects.some((r) => {
         let lo = 0, hi = 1;
         for (const axis of ["x", "z"] as const) {
            const half = axis === "x" ? r.hx : r.hz, d = b[axis] - a[axis];
            if (Math.abs(d) < 1e-9) { if (Math.abs(a[axis] - r[axis]) >= half - 1e-8) return false; }
            else {
               let t0 = (r[axis] - half + 1e-8 - a[axis]) / d, t1 = (r[axis] + half - 1e-8 - a[axis]) / d;
               if (t0 > t1) [t0, t1] = [t1, t0];
               lo = Math.max(lo, t0); hi = Math.min(hi, t1);
            }
         }
         return lo < hi;
      });
   }
   const d = nodes.map(() => Infinity), done = new Set<number>(); d[0] = 0;
   for (let k = 0; k < nodes.length; k++) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || d[i] < d[u])) u = i;
      if (u === 1) return d[u];
      done.add(u);
      for (let v = 0; v < nodes.length; v++) if (!done.has(v) && clear(nodes[u], nodes[v])) {
         d[v] = Math.min(d[v], d[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z));
      }
   }
   return d[1];
}
describe("five level contracts", () => {
   it("has the exact five configurations and scoring contracts", () => {
      expect(burgerDeliveryScooterMeta.status).toBe("dev");
      expect(burgerDeliveryScooterMeta.levels!.map((l) => l.id)).toEqual(LEVEL_IDS);
      expect(LEVEL_IDS.map((id) => LEVELS[id].orders)).toEqual([3, 4, 5, 6, 8]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].durationMs)).toEqual([120000, 150000, 180000, 180000, 210000]);
   });
   for (const id of LEVEL_IDS) {
      it("valid pads, counts and protected wet placement L" + id, () => {
         for (let seed = 0; seed < 64; seed++) {
            const r = createRun(seed, id);
            expect(r.doors).toHaveLength(r.config.orders);
            expect(r.barriers).toHaveLength(r.config.barriers); expect(r.cars).toHaveLength(r.config.traffic);
            r.doors.forEach((d, i) => {
               expect(Math.hypot(d.x - r.shop.x, d.z - r.shop.z)).toBeGreaterThanOrEqual(14);
               r.doors.slice(i + 1).forEach((b) => expect(Math.hypot(d.x - b.x, d.z - b.z)).toBeGreaterThanOrEqual(14));
            });
            for (const wet of r.wet) for (const pad of [r.shop, ...r.doors]) expect(inside(pad, wet, 1.45)).toBe(false);
            for (const car of r.cars) expect(r.buildings.some((b) => inside(car, { ...b, hx: b.hx - car.hx, hz: b.hz - car.hz }))).toBe(true);
         }
      });
      it("proves raw score limits without needing capScore L" + id, () => {
         const r = createRun(1, id), n = r.config.orders, limits = LIMITS[id - 1];
         const distances = r.doors.map((d) => shortest(r.shop, d, r.buildings));
         // Every trip starts/ends below 0.5 m/s. Bound acceleration time conservatively
         // from 0.5 rather than zero; steering, hazards and drag only increase elapsed.
         const trips = 2 * n - 1;
         const length = 2 * distances.reduce((a, b) => a + b, 0) - Math.max(...distances) - trips * 2.2;
         const accelerationPenalty = ((11 - 0.5) ** 2 / (2 * 11)) * (1 / 14 + 1 / 16);
         const minimum = length / 11 + trips * (accelerationPenalty - 0.05) + 2 * n * 0.45;
         const raw = 140 * n + 4 * Math.floor(r.config.durationMs / 1000 - minimum);
         expect(minimum).toBeGreaterThan(4);
         expect(raw).toBeLessThanOrEqual(limits.maxScore);
         expect(raw).toBeLessThanOrEqual(limits.base + limits.maxPointsPerSec * minimum);
         expect(capScore(raw, minimum * 1000, limits)).toBe(raw);
         console.info("L" + id + " minimum=" + minimum.toFixed(3) + " peak<=" + raw);
      });
   }
   it("keyboard and touch share stop and hop windows frame for frame", () => {
      const key = createInputController(), touch = createInputController();
      const a = createRun(3, 1), b = createRun(3, 1);
      for (let frame = 0; frame < 600; frame++) {
         if (frame === 30) { key.keyDown("KeyW"); touch.setJoystick(0, -1); }
         if (frame === 80) { key.keyDown("Space"); touch.setButton("jump", true); }
         if (frame === 81) { key.keyUp("Space"); touch.setButton("jump", false); }
         if (frame === 120) { key.keyUp("KeyW"); touch.setJoystick(0, 0); }
         key.latch(); touch.latch(); stepRun(a, key.state.current, 1 / 60); stepRun(b, touch.state.current, 1 / 60);
         expect(a).toEqual(b);
      }
   });
});
