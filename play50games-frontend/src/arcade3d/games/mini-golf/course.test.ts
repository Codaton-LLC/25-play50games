// Every hole is solvable within par at every frame rate (README "Solvable within par"): the
// committed lines sink as designed for both mirrors and every start tick a frame can produce, and a
// live coarse search finds a robust two-putt from the tee on its own (the lines are not luck).
import { describe, expect, it } from "vitest";
import { HOLE_COUNT, PARS, buildHole, heightAt, type Hole } from "./course";
import { ACE_LINES, PAR_LINES, ROBUST_WINDOW, linePsi, playPutt, robustPutt, type LinePutt } from "./solver";

const DEG = Math.PI / 180;
const upper = (h: Hole) => h.terrain === "tiers";

/** Play a line from the tee; every putt must be robust over ROBUST_WINDOW start ticks. Returns strokes or -1. */
function playLine(hole: Hole, line: LinePutt[]): number {
   let at = { x: hole.tee.x, z: hole.tee.z, upper: upper(hole) };
   for (let i = 0; i < line.length; i++) {
      const r = robustPutt(hole, at, at.upper, linePsi(hole, line[i]), line[i].p, line[i].w);
      if (!r || r.water) return -1;
      if (r.captured) return i + 1;
      // the next putt waits for the ball to stop (latest start + its ticks) plus the 0.5 s ready gap
      if (i + 1 < line.length && line[i + 1].w < line[i].w + ROBUST_WINDOW - 1 + r.ticks + 60) return -1;
      at = { x: r.x, z: r.z, upper: r.upper };
   }
   return -1;
}

describe("mini-golf holes", () => {
   for (let h = 0; h < HOLE_COUNT; h++) {
      it(`hole ${h + 1}: the ace line holes in one and the par line within par, both mirrors, any start tick in the window`, () => {
         for (const mirrored of [false, true]) {
            const hole = buildHole(h, mirrored);
            expect(playLine(hole, ACE_LINES[h])).toBe(1);
            const strokes = playLine(hole, PAR_LINES[h]);
            expect(strokes).toBeGreaterThan(0);
            expect(strokes).toBeLessThanOrEqual(PARS[h]);
         }
      });
   }

   it("a coarse search (1 deg, 0.05 power, then a sink) finds a robust two-putt on every hole", { timeout: 60_000 }, () => {
      for (let h = 0; h < HOLE_COUNT; h++) {
         const hole = buildHole(h, false);
         let found = false;
         const lags: { x: number; z: number; upper: boolean; ticks: number; d: number }[] = [];
         for (let a = -30; a <= 30 && lags.length < 400; a += 2) {
            for (let p = 0.4; p <= 0.951; p += 0.05) {
               const r = robustPutt(hole, hole.tee, upper(hole), a * DEG, p, 0);
               if (r && !r.water && !r.captured) lags.push({ x: r.x, z: r.z, upper: r.upper, ticks: r.ticks, d: Math.hypot(r.x - hole.cup.x, r.z - hole.cup.z) });
            }
         }
         lags.sort((p, q) => p.d - q.d);
         for (const lag of lags.slice(0, 6)) {
            const base = Math.atan2(hole.cup.x - lag.x, -(hole.cup.z - lag.z)) / DEG;
            const w = lag.ticks + ROBUST_WINDOW + 60;
            for (let da = 0; da <= 6 && !found; da += 0.5) {
               for (const s of [1, -1]) {
                  for (let p = 0.1; p <= 1 && !found; p += 0.01) {
                     for (const wait of hole.windmill || hole.turntable ? [w, w + 60, w + 120, w + 180] : [w]) {
                        const r = robustPutt(hole, lag, lag.upper, (base + s * da) * DEG, p, wait);
                        if (r?.captured) {
                           found = true;
                           break;
                        }
                     }
                  }
               }
            }
            if (found) break;
         }
         expect(found, `hole ${h + 1}`).toBe(true);
      }
   });

   it("keeps every tee and cup on the felt, inside the rails and off the water", () => {
      for (let h = 0; h < HOLE_COUNT; h++) {
         const hole = buildHole(h, false);
         for (const p of [hole.tee, hole.cup]) {
            expect(heightAt(hole, p.x, p.z, p === hole.tee && upper(hole))).not.toBeNull();
            expect(p.x).toBeGreaterThan(hole.box.x0 + 0.1);
            expect(p.x).toBeLessThan(hole.box.x1 - 0.1);
            expect(hole.ponds.every((q) => !(p.x >= q.x0 && p.x <= q.x1 && p.z >= q.z0 && p.z <= q.z1))).toBe(true);
         }
      }
   });

   it("a putt from the tee straight at the cup never leaves the rails on any hole", () => {
      for (let h = 0; h < HOLE_COUNT; h++) {
         const hole = buildHole(h, h % 2 === 1);
         for (let p = 0.1; p <= 1.001; p += 0.1) {
            for (const a of [-40, -15, 0, 15, 40]) {
               const r = playPutt(hole, hole.tee, upper(hole), a * DEG, p, 17);
               if (r.water || r.captured) continue;
               expect(r.x).toBeGreaterThanOrEqual(hole.box.x0);
               expect(r.x).toBeLessThanOrEqual(hole.box.x1);
               expect(r.z).toBeGreaterThanOrEqual(hole.box.z0);
               expect(r.z).toBeLessThanOrEqual(hole.box.z1);
            }
         }
      }
   });
});
