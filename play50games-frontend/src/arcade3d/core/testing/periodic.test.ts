import { describe, expect, it } from "vitest";
import { createRng } from "../math";
import { NEIGHBOURS_4, earliestArrival, orMasks, periodicMask, planPeriodic, shiftMask, solvePeriodic, solvePeriodicSteps, type PeriodicProblem } from "./periodic";

/** a 5 × 1 corridor, goal at x = 4; x = 2 is blocked at phases 0 and 1 of 4 */
function corridor(): PeriodicProblem {
   const blocked = periodicMask(5, 4);
   blocked[0 * 5 + 2] = 1;
   blocked[1 * 5 + 2] = 1;
   return { grid: { width: 5, height: 1 }, period: 4, blocked, goal: [4] };
}

/** replays a plan: every step's source free at p and destination free at p + 1, inside the grid */
function replay(problem: PeriodicProblem, start: number, phase: number, plan: [number, number][]): number {
   const { width, height } = problem.grid;
   const cells = width * height;
   let c = start;
   let p = phase % problem.period;
   for (const [dx, dy] of plan) {
      expect(problem.blocked[p * cells + c]).toBe(0);
      const x = (c % width) + dx;
      const y = Math.floor(c / width) + dy;
      expect(x >= 0 && y >= 0 && x < width && y < height).toBe(true);
      c = y * width + x;
      p = (p + 1) % problem.period;
      expect(problem.blocked[p * cells + c]).toBe(0);
   }
   return c;
}

/** brute force: state sets advanced step by step until a goal shows up or nothing new appears */
function bruteArrival(problem: PeriodicProblem, start: number, phase: number): number {
   const { width, height } = problem.grid;
   const cells = width * height;
   const goal = problem.goal as number[];
   const P = problem.period;
   if (problem.blocked[(phase % P) * cells + start]) return -1;
   let frontier = new Set([start]);
   const seen = new Set([`${start}@${phase % P}`]);
   for (let t = 0; t <= cells * P; t++) {
      if ([...frontier].some((c) => goal.includes(c))) return t;
      const p = (phase + t) % P;
      const q = (p + 1) % P;
      const next = new Set<number>();
      for (const c of frontier) {
         for (const [dx, dy] of [[0, 0], ...(problem.moves ?? NEIGHBOURS_4)]) {
            const x = (c % width) + dx;
            const y = Math.floor(c / width) + dy;
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const n = y * width + x;
            if (problem.blocked[p * cells + c] || problem.blocked[q * cells + n]) continue;
            next.add(n);
         }
      }
      // a set of cells at time t is periodic in (set, phase): stop once it repeats
      const key = `${[...next].sort((a, b) => a - b).join(",")}@${q}`;
      if (next.size === 0 || seen.has(key)) return -1;
      seen.add(key);
      frontier = next;
   }
   return -1;
}

describe("periodic masks", () => {
   it("shifts cyclically in phase and ORs into out", () => {
      const m = periodicMask(2, 3);
      m[0 * 2 + 1] = 1; // cell 1 blocked at phase 0
      const ahead = shiftMask(m, 2, 3, 1);
      expect([...ahead]).toEqual([0, 0, 0, 0, 0, 1]); // out[p] = m[p + 1]: phase 2 reads phase 0
      expect([...shiftMask(m, 2, 3, -1)]).toEqual([0, 0, 0, 1, 0, 0]);
      expect([...shiftMask(m, 2, 3, 3)]).toEqual([...m]);
      const out = periodicMask(2, 3);
      expect(orMasks(out, m, ahead)).toBe(out);
      expect([...out]).toEqual([0, 1, 0, 0, 0, 1]);
      const reused = periodicMask(2, 3);
      expect(shiftMask(m, 2, 3, 4, reused)).toBe(reused);
      expect([...reused]).toEqual([...ahead]);
   });
});

describe("solvePeriodic", () => {
   it("needs waiting in a corridor with a periodically blocked cell", () => {
      const problem = corridor();
      const win = solvePeriodic(problem);
      // at x = 1 and phase 0 stepping on x = 2 at phase 1 is blocked; waiting until phase 1 lets it pass at 2
      expect(win[0 * 5 + 1]).toBe(1);
      const steps = solvePeriodicSteps(problem);
      expect(steps[0 * 5 + 1]).toBe(4); // wait once, then enter x = 2 at phase 2
      expect(planPeriodic(problem, 1, 0)).toEqual([[0, 0], [1, 0], [1, 0], [1, 0]]);
      // a blocked state is never winning; goal cells are winning at every free phase
      expect(win[0 * 5 + 2]).toBe(0);
      for (let p = 0; p < 4; p++) expect(win[p * 5 + 4]).toBe(1);
      // without waiting the walker at x = 1, phase 0 would have to pass at phase 1: earliest arrival counts the wait
      expect(earliestArrival(problem, 1, 0)).toBe(4);
      expect(earliestArrival(problem, 1, 2)).toBe(3);
   });

   it("has no route through a permanent block, and the goal predicate works", () => {
      const problem = corridor();
      for (let p = 0; p < 4; p++) problem.blocked[p * 5 + 3] = 1;
      const win = solvePeriodic(problem);
      for (let p = 0; p < 4; p++) for (let c = 0; c < 3; c++) expect(win[p * 5 + c]).toBe(0);
      expect(earliestArrival(problem, 0, 0)).toBe(-1);
      expect(planPeriodic(problem, 0, 0)).toBeNull();
      const left = solvePeriodic({ ...problem, goal: (c) => c === 0 });
      expect(left[2 * 5 + 2]).toBe(1);
      expect(left[0 * 5 + 4]).toBe(0);
   });

   it("uses extra moves such as 2-cell hops over a permanently blocked cell", () => {
      const problem = corridor();
      for (let p = 0; p < 4; p++) problem.blocked[p * 5 + 3] = 1;
      const hops = { ...problem, moves: [...NEIGHBOURS_4, [2, 0], [-2, 0]] as const };
      expect(earliestArrival(hops, 0, 2)).toBe(2); // hop 0 -> 2 at phase 2 -> 3, then 2 -> 4
      const plan = planPeriodic(hops, 0, 2)!;
      expect(plan).toEqual([[2, 0], [2, 0]]);
      expect(replay(hops, 0, 2, plan)).toBe(4);
   });

   it("plans replay safely and match earliest arrival on random grids (brute force)", () => {
      const rng = createRng(1234);
      for (let trial = 0; trial < 120; trial++) {
         const width = 2 + Math.floor(rng() * 5);
         const height = 1 + Math.floor(rng() * 4);
         const period = 1 + Math.floor(rng() * 5);
         const cells = width * height;
         const blocked = periodicMask(cells, period);
         for (let i = 0; i < blocked.length; i++) blocked[i] = rng() < 0.3 ? 1 : 0;
         const goal = [Math.floor(rng() * cells)];
         const problem: PeriodicProblem = { grid: { width, height }, period, blocked, goal };
         const steps = solvePeriodicSteps(problem);
         const win = solvePeriodic(problem);
         for (let p = 0; p < period; p++) {
            for (let c = 0; c < cells; c++) {
               const brute = bruteArrival(problem, c, p);
               expect(earliestArrival(problem, c, p)).toBe(brute);
               expect(win[p * cells + c]).toBe(brute >= 0 ? 1 : 0);
               expect(steps[p * cells + c]).toBe(brute);
               const plan = planPeriodic(problem, c, p, steps);
               if (brute < 0) expect(plan).toBeNull();
               else {
                  expect(plan!.length).toBe(brute);
                  expect(goal).toContain(replay(problem, c, p, plan!));
               }
            }
         }
      }
   });

   it("solves 120 × 120 cells × 108 phases with OR-ed shifted masks well under a second", () => {
      const width = 120;
      const height = 120;
      const cells = width * height;
      const period = 108;
      // vertical walls open in one row only, the gap sweeping down over the cycle
      const wall = (x: number) => {
         const mask = periodicMask(cells, period);
         for (let p = 0; p < period; p++) for (let y = 0; y < height; y++) if (y !== p) mask[p * cells + y * width + x] = 1;
         return mask;
      };
      const blocked = orMasks(periodicMask(cells, period), wall(40), shiftMask(wall(80), cells, period, 54));
      const goal: number[] = [];
      for (let y = 0; y < height; y++) goal.push(y * width + width - 1);
      const problem: PeriodicProblem = { grid: { width, height }, period, blocked, goal };
      const t0 = performance.now();
      const win = solvePeriodic(problem);
      const solveMs = performance.now() - t0;
      expect(win[0]).toBe(1);
      const t1 = performance.now();
      const arrival = earliestArrival(problem, 0, 0);
      expect(performance.now() - t1 + solveMs).toBeLessThan(1000);
      expect(arrival).toBeGreaterThanOrEqual(width - 1);
      const plan = planPeriodic(problem, 0, 0)!;
      expect(plan.length).toBe(arrival);
      expect(goal).toContain(replay(problem, 0, 0, plan));
   });
});
