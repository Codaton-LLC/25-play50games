// Periodic solver for grids whose blocked cells repeat with a fixed period (patrols, sweeps,
// timed hazards): a safe-route proof for fairness tests and a planner for bots. Pure, no three.js
// or React, for vitest only (like botHarness).
//
// Cells are y * width + x. A mask is a Uint8Array of cells × phases laid out phase-major,
// mask[phase * cells + cell], 1 = the cell is blocked at that phase. One step goes from phase p
// to phase (p + 1) % period; a move (waiting included) needs its source free at p and its
// destination free at p + 1. A state (cell, phase) is only ever occupied while the cell is free.

export type PeriodicMove = readonly [dx: number, dy: number];

/** The 4 neighbours (waiting is always added by the solver). */
export const NEIGHBOURS_4: readonly PeriodicMove[] = [
   [1, 0],
   [-1, 0],
   [0, 1],
   [0, -1],
];

export interface PeriodicProblem {
   grid: { width: number; height: number };
   period: number;
   /** phase-major mask (see periodicMask), 1 = blocked */
   blocked: Uint8Array;
   /** goal cells (reached at any phase) or a predicate per cell */
   goal: ArrayLike<number> | ((cell: number) => boolean);
   /** cell offsets besides waiting, e.g. NEIGHBOURS_4 plus 2-cell hops; default NEIGHBOURS_4 */
   moves?: readonly PeriodicMove[];
}

/** An all-free mask of cells × phases. */
export function periodicMask(cells: number, phases: number): Uint8Array {
   return new Uint8Array(cells * phases);
}

/**
 * The same pattern started `steps` phases ahead: out[p] = mask[(p + steps) mod phases]
 * (negative steps delay it). Writes `out` when given (it must not be `mask`).
 */
export function shiftMask(mask: Uint8Array, cells: number, phases: number, steps: number, out: Uint8Array = new Uint8Array(cells * phases)): Uint8Array {
   const s = ((steps % phases) + phases) % phases;
   for (let p = 0; p < phases; p++) {
      const from = ((p + s) % phases) * cells;
      out.set(mask.subarray(from, from + cells), p * cells);
   }
   return out;
}

/** ORs every mask into `out` (out |= mask) and returns it. */
export function orMasks(out: Uint8Array, ...masks: Uint8Array[]): Uint8Array {
   for (const mask of masks) {
      for (let i = 0; i < out.length; i++) out[i] |= mask[i];
   }
   return out;
}

interface Prepared {
   width: number;
   height: number;
   cells: number;
   period: number;
   blocked: Uint8Array;
   goal: Uint8Array;
   /** waiting first, then the problem's moves */
   dx: Int32Array;
   dy: Int32Array;
}

function prepare(problem: PeriodicProblem): Prepared {
   const { width, height } = problem.grid;
   const cells = width * height;
   const { period, blocked } = problem;
   if (blocked.length !== cells * period) throw new RangeError(`blocked has ${blocked.length} entries, expected ${cells} cells × ${period} phases.`);
   const goal = new Uint8Array(cells);
   if (typeof problem.goal === "function") {
      for (let c = 0; c < cells; c++) goal[c] = problem.goal(c) ? 1 : 0;
   } else {
      for (let i = 0; i < problem.goal.length; i++) goal[problem.goal[i]] = 1;
   }
   const moves = (problem.moves ?? NEIGHBOURS_4).filter(([x, y]) => x !== 0 || y !== 0);
   const dx = new Int32Array(moves.length + 1);
   const dy = new Int32Array(moves.length + 1);
   moves.forEach(([x, y], i) => {
      dx[i + 1] = x;
      dy[i + 1] = y;
   });
   return { width, height, cells, period, blocked, goal, dx, dy };
}

/**
 * Steps to the nearest goal from every state (phase-major like the mask), -1 = no safe route.
 * Backward breadth-first search from the free goal states, so the counts are the fewest steps.
 */
export function solvePeriodicSteps(problem: PeriodicProblem): Int32Array {
   const { width, height, cells, period, blocked, goal, dx, dy } = prepare(problem);
   const states = cells * period;
   const steps = new Int32Array(states).fill(-1);
   const queue = new Int32Array(states);
   let head = 0;
   let tail = 0;
   for (let p = 0; p < period; p++) {
      for (let c = 0; c < cells; c++) {
         const s = p * cells + c;
         if (goal[c] && !blocked[s]) {
            steps[s] = 0;
            queue[tail++] = s;
         }
      }
   }
   while (head < tail) {
      const s = queue[head++];
      const p = (s / cells) | 0;
      const c = s - p * cells;
      const x = c % width;
      const y = (c - x) / width;
      const prev = (p === 0 ? period - 1 : p - 1) * cells;
      const next = steps[s] + 1;
      // predecessors: (c - move, p - 1) free at p - 1; c is free at p (it is winning)
      for (let m = 0; m < dx.length; m++) {
         const px = x - dx[m];
         const py = y - dy[m];
         if (px < 0 || py < 0 || px >= width || py >= height) continue;
         const ps = prev + py * width + px;
         if (steps[ps] !== -1 || blocked[ps]) continue;
         steps[ps] = next;
         queue[tail++] = ps;
      }
   }
   return steps;
}

/** The winning table (phase-major): 1 = from this cell at this phase a safe route reaches a goal. */
export function solvePeriodic(problem: PeriodicProblem): Uint8Array {
   const steps = solvePeriodicSteps(problem);
   const win = new Uint8Array(steps.length);
   for (let i = 0; i < steps.length; i++) win[i] = steps[i] >= 0 ? 1 : 0;
   return win;
}

/** Fewest steps from `start` at `phase` to a goal cell (forward search), 0 on a free goal, -1 = never. */
export function earliestArrival(problem: PeriodicProblem, start: number, phase: number): number {
   const { width, height, cells, period, blocked, goal, dx, dy } = prepare(problem);
   const p0 = ((phase % period) + period) % period;
   const first = p0 * cells + start;
   if (blocked[first]) return -1;
   if (goal[start]) return 0;
   const states = cells * period;
   const steps = new Int32Array(states).fill(-1);
   const queue = new Int32Array(states);
   let head = 0;
   let tail = 0;
   steps[first] = 0;
   queue[tail++] = first;
   while (head < tail) {
      const s = queue[head++];
      const p = (s / cells) | 0;
      const c = s - p * cells;
      const x = c % width;
      const y = (c - x) / width;
      const after = (p === period - 1 ? 0 : p + 1) * cells;
      const next = steps[s] + 1;
      for (let m = 0; m < dx.length; m++) {
         const nx = x + dx[m];
         const ny = y + dy[m];
         if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
         const nc = ny * width + nx;
         const ns = after + nc;
         if (steps[ns] !== -1 || blocked[ns]) continue;
         if (goal[nc]) return next;
         steps[ns] = next;
         queue[tail++] = ns;
      }
   }
   return -1;
}

/**
 * A shortest safe route from `start` at `phase` as one cell offset per step ([0, 0] = wait),
 * `[]` when the start is already a free goal, null when the start state is not winning.
 * Pass `steps` (from solvePeriodicSteps on the same problem) to plan many starts on one solve.
 */
export function planPeriodic(problem: PeriodicProblem, start: number, phase: number, steps = solvePeriodicSteps(problem)): [dx: number, dy: number][] | null {
   const { width, height, cells, period, dx, dy } = prepare(problem);
   let p = ((phase % period) + period) % period;
   let c = start;
   let left = steps[p * cells + c];
   if (left < 0) return null;
   const plan: [number, number][] = [];
   while (left > 0) {
      const x = c % width;
      const y = (c - x) / width;
      const after = (p + 1) % period;
      let found = -1;
      for (let m = 0; m < dx.length && found < 0; m++) {
         const nx = x + dx[m];
         const ny = y + dy[m];
         if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
         if (steps[after * cells + ny * width + nx] === left - 1) found = m;
      }
      // a state with k steps left always has a successor with k - 1 (that is how it got k)
      plan.push([dx[found], dy[found]]);
      c += dy[found] * width + dx[found];
      p = after;
      left -= 1;
   }
   return plan;
}
