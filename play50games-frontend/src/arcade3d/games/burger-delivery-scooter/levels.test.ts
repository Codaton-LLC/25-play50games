import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems } from "../../core/levels";
import { levelMetaProblems, scoringFor } from "../../levelMeta";
import { capScore } from "../../core/limits";
import { LEVEL_IDS } from "../../types";
import { LEVELS } from "./levels";
import { LIMITS, burgerDeliveryScooterMeta } from "./meta";
import { BARRIER_OFFSET, PITCH, VEHICLE, cityHalf, createRun, inside, type Point, type Rect } from "./rules";
import definition from "./index";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));
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
/** The analytic earliest win and the raw score bound of a level (README "Server limits"). */
function levelBound(id: (typeof LEVEL_IDS)[number]) {
   const r = createRun(1, id), n = r.config.orders;
   const distances = r.doors.map((d) => shortest(r.shop, d, r.buildings));
   // Every trip starts/ends below 0.5 m/s. Acceleration time is bounded from 0.5 rather than zero;
   // steering, hazards and drag only add time. Each pad's radius is credited on both ends of a leg.
   const trips = 2 * n - 1;
   const length = 2 * distances.reduce((a, b) => a + b, 0) - Math.max(...distances) - trips * 2.2;
   const accelerationPenalty = ((11 - 0.5) ** 2 / (2 * 11)) * (1 / 14 + 1 / 16);
   const minimum = length / 11 + trips * (accelerationPenalty - 0.05) + 2 * n * 0.45;
   const raw = 140 * n + 4 * Math.floor(r.config.durationMs / 1000 - minimum);
   return { minimum, raw };
}

describe("five level contracts", () => {
   it("meta and definition declare the same five levels, level 1 = meta.scoring", () => {
      const meta = burgerDeliveryScooterMeta;
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.status).toBe("dev");
      expect(meta.owner).toBe("claude");
      expect(meta.collection).toBe("skill");
      expect(meta.scoring).toEqual(LIMITS[0]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(LIMITS[id - 1]);
         expect(definition.levels![id - 1].config).toBe(LEVELS[id]);
         expect(definition.levels![id - 1].durationMs).toBe(LEVELS[id].durationMs);
         expect(definition.levels![id - 1].environment?.lighting).toBe(LEVELS[id].lighting);
         expect(definition.levels![id - 1].environment?.background).toBe(LEVELS[id].background);
         expect(definition.levels![id - 1].hudStats?.[0].max).toBe(LEVELS[id].orders);
         expect(LIMITS[id - 1].maxDurationMs).toBe(LEVELS[id].durationMs);
         expect(LIMITS[id - 1].base).toBe(140 * LEVELS[id].orders);
         expect(meta.levels![id - 1].clearScore).toBeUndefined();
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].orders)).toEqual([3, 4, 5, 6, 8]);
   });

   it("difficulty is monotone; every level is worth at least level 1; level 5 at most 3 x level 1", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as 1], b = LEVELS[id];
         expect(b.orders).toBeGreaterThan(a.orders);
         expect(b.barriers).toBeGreaterThanOrEqual(a.barriers);
         expect(b.traffic).toBeGreaterThanOrEqual(a.traffic);
         expect(b.blocksX * b.blocksZ).toBeGreaterThanOrEqual(a.blocksX * a.blocksZ);
         expect(b.wetDrain).toBeGreaterThanOrEqual(a.wetDrain);
         expect(b.qualityMin).toBeLessThanOrEqual(a.qualityMin);
         expect(LIMITS[id - 1].maxScore).toBeGreaterThanOrEqual(LIMITS[0].maxScore);
         expect(LIMITS[id - 1].maxScore).toBeGreaterThan(LIMITS[id - 2].maxScore);
      }
      expect(LIMITS[4].maxScore).toBeLessThanOrEqual(3 * LIMITS[0].maxScore);
   });

   for (const id of LEVEL_IDS) {
      it("L" + id + ": the run reads every field of its level (counts, grid, wet, clock)", () => {
         const c = LEVELS[id];
         for (let seed = 0; seed < 64; seed++) {
            const r = createRun(seed, id);
            expect(r.config).toBe(c);
            expect(r.doors).toHaveLength(c.orders);
            expect(r.barriers).toHaveLength(c.barriers);
            expect(r.cars).toHaveLength(c.traffic);
            expect(r.buildings).toHaveLength(c.blocksX * c.blocksZ);
            expect(r.wet.length > 0).toBe(c.wet);
            expect(cityHalf(c)).toEqual({ x: c.blocksX * 9 + 2.4, z: c.blocksZ * 9 + 2.4 });
         }
      });

      it("L" + id + ": pads 14 m apart, hazards off the centre lines and off every pad, cars at the curb", () => {
         for (let seed = 0; seed < 64; seed++) {
            const r = createRun(seed, id);
            const pads = [r.shop, ...r.doors];
            r.doors.forEach((d, i) => {
               expect(Math.hypot(d.x - r.shop.x, d.z - r.shop.z)).toBeGreaterThanOrEqual(14);
               r.doors.slice(i + 1).forEach((b) => expect(Math.hypot(d.x - b.x, d.z - b.z)).toBeGreaterThanOrEqual(14));
            });
            for (const wet of r.wet) for (const pad of pads) expect(inside(pad, wet, 1.45)).toBe(false);
            for (const b of r.barriers) {
               for (const pad of pads) expect(inside(pad, b, 1.45)).toBe(false);
               // its own x street's centre line passes 1.9 - 0.33 m from it: a scooter on the line clears it
               const line = Math.round((b.z - r.shop.z) / PITCH) * PITCH + r.shop.z;
               expect(Math.abs(b.z - line)).toBeCloseTo(BARRIER_OFFSET, 6);
               expect(Math.abs(b.z - line) - b.hz).toBeGreaterThan(VEHICLE.radius + 0.4);
            }
            for (const car of r.cars) {
               expect(r.buildings.some((b) => inside(car, b, -0.01))).toBe(false);
               const line = Math.round((car.x - r.shop.x) / PITCH) * PITCH + r.shop.x;
               expect(Math.abs(car.x - line) - car.hx).toBeGreaterThan(VEHICLE.radius + 0.25);
               for (const pad of pads) expect(inside(pad, car, 1.45)).toBe(false);
            }
         }
      });

      it("L" + id + ": proves the raw score limits without needing capScore", () => {
         const limits = LIMITS[id - 1], { minimum, raw } = levelBound(id);
         expect(minimum).toBeGreaterThan(limits.minDurationMs / 1000);
         expect(raw).toBeLessThanOrEqual(limits.maxScore);
         // a win at the earliest time sits under the line; later wins pay less and the line rises
         expect(raw).toBeLessThanOrEqual(limits.base + limits.maxPointsPerSec * minimum);
         expect(capScore(raw, minimum * 1000, limits)).toBe(raw);
         // the limits are not loose: at most 2 % over the bound (rounded up to 10)
         expect(limits.maxScore).toBeLessThanOrEqual(Math.ceil((raw * 1.02) / 10) * 10);
      });
   }
});
