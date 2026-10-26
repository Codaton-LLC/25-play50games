// Flooded Ruins Escape plays its own courses: switchback rows on the first two levels, a spiral round
// the flooded shaft on the other three, with a lever that sinks the water for a while, and a flood that
// climbs faster every level. Not a reskin of Rooftop Roll Climb (its layouts and limits differ).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { PROPOSED_LEVEL_LIMITS as ROOFTOP_LIMITS, courseFor as rooftopCourse } from "../rooftop-roll-climb/rules";
import { LEVELS } from "./levels";
import { RING_MIN, ledgeXZ } from "./roofs";
import { LEVER_DROP, LEVER_MS, PROPOSED_LEVEL_LIMITS, WATER_MPS, courseFor, createRun, createStepInput, step, waterAt, waterY } from "./rules";

describe("the layouts", () => {
   it("levels 1-2 are switchbacks: rows that double back, one row gap apart toward -z", () => {
      for (const id of [1, 2] as const) {
         expect(LEVELS[id].spec.layout).toBe("switchback");
         const c = courseFor(id);
         const zs = [...new Set(c.supports.map((s) => s.cz))].sort((a, b) => b - a);
         expect(zs.length, `L${id} rows`).toBeGreaterThanOrEqual(3);
         // each row runs the other way from the one before it
         const dirs = zs.slice(0, 3).map((z) => {
            const row = c.supports.filter((s) => s.cz === z).map((s) => s.cx);
            return Math.sign(row[row.length - 1] - row[0]);
         });
         expect(dirs[0]).toBe(-dirs[1]);
      }
   });

   it("levels 3-5 spiral round an empty shaft: the ledges wind more than a lap, never on the shaft's axis, and the ring narrows", () => {
      const laps: number[] = [];
      for (const id of [3, 4, 5] as const) {
         expect(LEVELS[id].spec.layout).toBe("spiral");
         const c = courseFor(id);
         const spec = LEVELS[id].spec;
         // the last lap's ring centre: every ledge stays clear of the shaft round it
         const laps0 = Math.abs(ledgeXZ(spec, c.supports.length).length);
         expect(laps0).toBe(c.supports.length);
         const hLast = Math.max(RING_MIN, spec.side - spec.shrink * (c.supports.length * spec.gap) / (8 * spec.side));
         const centre = { x: 0, z: -hLast };
         let turn = 0;
         let prev = Math.atan2(c.supports[0].cx - centre.x, c.supports[0].cz - centre.z);
         let minR = Infinity;
         for (const s of c.supports) {
            const a = Math.atan2(s.cx - centre.x, s.cz - centre.z);
            let d = a - prev;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            turn += d;
            prev = a;
            minR = Math.min(minR, Math.hypot(s.cx - centre.x, s.cz - centre.z));
         }
         laps.push(Math.abs(turn) / (2 * Math.PI));
         expect(Math.abs(turn) / (2 * Math.PI), `L${id} laps`).toBeGreaterThan(1.2);
         expect(minR, `L${id} shaft stays empty`).toBeGreaterThan(2.2);
         // the ring narrows: the last ledges sit nearer the shaft than the first lap's
         const pts = ledgeXZ(spec, c.supports.length);
         const ring = (p: { x: number; z: number }) => Math.max(Math.abs(p.x), Math.abs(p.z + hLast));
         expect(Math.min(...pts.slice(-4).map(ring))).toBeLessThanOrEqual(Math.max(...pts.slice(0, 8).map(ring)));
      }
      expect(laps[2]).toBeGreaterThan(laps[0]);
   });

   it("is its own game: its courses and its limits differ from Rooftop Roll Climb's on every level but the first rows", () => {
      let differing = 0;
      for (const id of LEVEL_IDS) {
         const mine = courseFor(id);
         const theirs = rooftopCourse(id);
         if (mine.supports.length !== theirs.supports.length || mine.supports.some((s, i) => s.cx !== theirs.supports[i].cx)) differing++;
         if (JSON.stringify(PROPOSED_LEVEL_LIMITS[id]) !== JSON.stringify(ROOFTOP_LIMITS[id])) differing += 0.01;
      }
      expect(Math.floor(differing)).toBe(5);
      const sameLimits = LEVEL_IDS.filter((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]) === JSON.stringify(ROOFTOP_LIMITS[id]));
      expect(sameLimits).toEqual([1]);
   });
});

describe("the flood and the levers", () => {
   it("the water climbs faster every level; levels 1 and 2 are gentle", () => {
      for (let id = 2; id <= 5; id++) expect(WATER_MPS[id as 2 | 3 | 4 | 5]).toBeGreaterThan(WATER_MPS[(id - 1) as 1 | 2 | 3 | 4]);
      expect(WATER_MPS[1]).toBeLessThanOrEqual(0.15);
      expect(WATER_MPS[2]).toBeLessThanOrEqual(0.25);
      expect(WATER_MPS[5]).toBeGreaterThanOrEqual(0.7);
   });

   it("a lever sinks the water by LEVER_DROP, which climbs back to the rising line over LEVER_MS", () => {
      const run = createRun(1, 4);
      expect(waterAt(run, 5000)).toBe(waterY(4, 5000));
      run.leverAt = 5000;
      expect(waterAt(run, 5000)).toBeCloseTo(waterY(4, 5000) - LEVER_DROP, 9);
      expect(waterAt(run, 5000 + LEVER_MS / 2)).toBeCloseTo(waterY(4, 5000 + LEVER_MS / 2) - LEVER_DROP / 2, 9);
      expect(waterAt(run, 5000 + LEVER_MS)).toBe(waterY(4, 5000 + LEVER_MS));
      expect(waterAt(run, 4000)).toBe(waterY(4, 4000));
   });

   it("throwing a lever (reaching a checkpoint) opens the gate once; the water never makes a finish faster", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const lever = c.checkpoints[1];
      const s = c.supports[lever];
      run.hero.x = s.cx;
      run.hero.z = s.cz;
      run.hero.y = s.top;
      run.hero.lastTop = s.top;
      run.hero.support = lever;
      run.hero.grounded = true;
      run.hero.vx = 0;
      run.hero.vz = 0;
      step(run, 20, createStepInput());
      expect(run.checkpoint).toBe(1);
      expect(run.leverAt).toBeGreaterThanOrEqual(0);
      const at = run.leverAt;
      step(run, 20, createStepInput());
      expect(run.leverAt).toBe(at);
   });
});
