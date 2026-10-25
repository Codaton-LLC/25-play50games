// Bots for rules.test.ts (tests only: nothing at runtime imports this file). Each bot turns the run
// state into one frame's StepInput; the tests drive them through the real store
// (core/testing/botHarness simulateRun: advanceRunClock + playedFrameDt) and rules.stepRun.
import { createRng } from "@/arcade3d/core/math";
import { pointAt } from "@/arcade3d/core/path";
import {
   CYCLE,
   DURATION_S,
   HARVEST,
   SHIP,
   SHIP_PATH,
   cycleBurst,
   cycleIndex,
   cyclePeak,
   guidePlot,
   halfWindow,
   shipDistance,
   topSpeed,
   type Plot,
   type RunState,
   type StepInput,
} from "./rules";

export type Bot = (run: RunState, input: StepInput) => void;

const P = { x: 0, y: 0, z: 0 };
/** The ship's position at a future play time (the rules' own route and speed schedule). */
export function shipAt(run: RunState, t: number): { x: number; z: number } {
   pointAt(SHIP_PATH, run.ship.s0 + run.ship.dir * shipDistance(t, run.level?.shipSpeeds ?? SHIP.speeds), P);
   return P;
}

/** Earliest time the farmer (at x, z from t0, top speed v) can stand in the beam: [time, x, z]. */
export function intercept(run: RunState, x: number, z: number, t0: number, v: number, margin = 1.6): [number, number, number] {
   for (let t = t0; t < t0 + 40; t += 0.05) {
      const s = shipAt(run, t);
      const d = Math.hypot(s.x - x, s.z - z) - margin;
      if (d <= v * (t - t0) * 0.92) return [t, s.x, s.z];
   }
   return [Infinity, 0, 0];
}

function steerTo(run: RunState, x: number, z: number, input: StepInput, stop = 0.08): number {
   const f = run.farmer;
   const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz);
   if (d < stop) {
      input.dirX = 0;
      input.dirZ = 0;
   } else {
      // slow down over the last metre so the stop lands inside reach
      const k = Math.min(1, d / 0.9) / d;
      input.dirX = dx * k;
      input.dirZ = dz * k;
   }
   return d;
}

/** Where to stand for a plot: 0.5 m from its centre on the farmer's side. */
function standPoint(plot: Plot, fx: number, fz: number, out: { x: number; z: number }): void {
   const dx = fx - plot.x, dz = fz - plot.z, d = Math.hypot(dx, dz);
   const r = Math.min(0.5, d);
   out.x = d > 1e-6 ? plot.x + (dx / d) * r : plot.x;
   out.z = d > 1e-6 ? plot.z + (dz / d) * r : plot.z;
}

interface Choice {
   plot: number;
   cycle: number;
   press: number;
   value: number;
}

/** The next pickable windows of a plot from t: current and next cycle. */
function windows(
   plot: Plot,
   t: number,
   cb: (k: number, open: number, close: number, peak: number) => void,
   deadline = DURATION_S,
): void {
   if (t >= deadline) return;
   const k0 = Math.max(0, cycleIndex(plot, Math.max(t, plot.b0)));
   for (let k = k0; k < k0 + 2; k++) {
      if (plot.picked === k || plot.missed === k) continue;
      const peak = cyclePeak(plot, k), w = halfWindow(peak, plot.halfLate);
      if (peak + w < t) continue;
      cb(k, peak - w, Math.min(peak + w, deadline - HARVEST.channelS - 0.06), peak);
   }
}

/** Travel time estimate over distance d at top speed v (with the acceleration ramp). */
const travel = (d: number, v: number) => (d <= 0 ? 0 : d / v + 0.12);

/**
 * A greedy player with full knowledge: picks the next crop by a two-step look-ahead on points per
 * second (aiming at the peak when it can), fills the basket to four and intercepts the beam.
 */
export function greedyBot(opts: { lookahead?: boolean } = {}): Bot {
   const goal = { x: 0, z: 0 };
   let plan: Choice | null = null;
   let deliver: [number, number, number] | null = null;
   const pick = (run: RunState, x: number, z: number, t: number, cargo: number, depth: number): Choice | null => {
      let best: Choice | null = null, bestRate = -Infinity;
      const v = topSpeed(cargo, false);
      const cap = run.level?.capacity ?? HARVEST.capacity;
      const dur = (run.level?.durationMs ?? 100_000) / 1000;
      for (const plot of run.plots) {
         if (t < plot.activateAt - 8) continue;
         const d = Math.max(0, Math.hypot(plot.x - x, plot.z - z) - 0.75);
         const eta = t + travel(d, v);
         windows(plot, t, (k, open, close, peak) => {
            if (plan && depth > 0 && plan.plot === plot.id && plan.cycle === k) return;
            let press = Math.max(eta, open + 0.03);
            let pts = 150;
            if (press <= peak + 0.18) {
               press = Math.max(press, peak - 0.01);
               pts = 200;
            }
            if (press > close - 0.03) return;
            let end = press + HARVEST.channelS;
            let value = pts;
            if (cargo + 1 >= cap) {
               // the basket is full after this one: count the trip to the beam
               const [ti] = intercept(run, plot.x, plot.z, end, topSpeed(cap, false));
               if (ti > dur - 0.1) return;
               end = ti;
            } else if (depth === 0 && opts.lookahead !== false) {
               const next = pick(run, plot.x, plot.z, end, cargo + 1, 1);
               if (next) {
                  value += next.value * 0.6;
                  end += (next.press + HARVEST.channelS - end) * 0.6;
               }
            }
            const rate = value / (end - t + 0.2);
            if (rate > bestRate) {
               bestRate = rate;
               best = { plot: plot.id, cycle: k, press, value: pts };
            }
         }, dur);
      }
      return best;
   };
   return (run, input) => {
      input.press = false;
      const f = run.farmer, t = run.time;
      if (run.channel.active) {
         input.dirX = 0;
         input.dirZ = 0;
         return;
      }
      const durationS = (run.level?.durationMs ?? 100_000) / 1000;
      const left = durationS - t;
      if (run.cargoCount > 0 && !deliver) {
         const [ti, sx, sz] = intercept(run, f.x, f.z, t, topSpeed(run.cargoCount, false));
         // full basket, or the last load before the timer
         const last = !pick(run, f.x, f.z, t, run.cargoCount, 1) || ti > durationS - 2.5 - ((run.level?.capacity ?? HARVEST.capacity) - run.cargoCount) * 1.6;
         if ((run.cargoCount >= (run.level?.capacity ?? HARVEST.capacity) || last) && ti < durationS - 0.1) deliver = [ti, sx, sz];
      }
      if (deliver) {
         if (run.cargoCount === 0 || t > deliver[0] + 3) deliver = null;
         else {
            // re-aim at the ship's real position at the planned meeting time
            const [ti, sx, sz] = intercept(run, f.x, f.z, t, topSpeed(run.cargoCount, false), 1.4);
            deliver = [ti, sx, sz];
            steerTo(run, sx, sz, input, 0.2);
            return;
         }
      }
      if (left <= 0.4) return;
      if (plan) {
         const plot = run.plots[plan.plot];
         if (plot.picked === plan.cycle || plot.missed === plan.cycle || t > plan.press + 0.4) plan = null;
      }
      if (!plan) plan = pick(run, f.x, f.z, t, run.cargoCount, 0);
      if (!plan) {
         input.dirX = 0;
         input.dirZ = 0;
         return;
      }
      const plot = run.plots[plan.plot];
      standPoint(plot, f.x, f.z, goal);
      steerTo(run, goal.x, goal.z, input);
      const inReach = Math.hypot(plot.x - f.x, plot.z - f.z) <= HARVEST.reach - 0.02;
      const k = cycleIndex(plot, t);
      const peak = cyclePeak(plot, k), w = halfWindow(peak, plot.halfLate);
      if (inReach && k === plan.cycle && t >= plan.press && t >= peak - w && t <= peak + w && t >= run.cooldownUntil) {
         input.press = true;
         plan = null;
      }
   };
}

/**
 * A human-paced player: follows the on-screen arrow (rules.guidePlot) to the next crop, re-aims its
 * stick only every `react` seconds, presses on the ring's peak with a seeded timing error, pauses
 * after each pick, and chases the beam's current position (no prediction) once the basket is full.
 */
export function humanBot(seed: number, opts: { react?: number; jitter?: number; pause?: number } = {}): Bot {
   const rng = createRng(seed ^ 0x5bd1e995);
   const react = opts.react ?? 0.2, jitter = opts.jitter ?? 0.12, pause = opts.pause ?? 0.35;
   let nextLook = 0, pauseUntil = 0, aimPlot = -1, pressAt = Infinity, aimCycle = -1;
   const goal = { x: 0, z: 0 };
   let lastHarvested = 0;
   return (run, input) => {
      input.press = false;
      const t = run.time, f = run.farmer;
      if (run.harvested !== lastHarvested) {
         lastHarvested = run.harvested;
         pauseUntil = t + pause;
      }
      if (run.channel.active || t < pauseUntil) {
         input.dirX = 0;
         input.dirZ = 0;
         return;
      }
      if (t >= nextLook) {
         nextLook = t + react;
         const durationS = (run.level?.durationMs ?? 100_000) / 1000;
         const late = durationS - t < 9 && run.cargoCount > 0;
         if (run.cargoCount >= (run.level?.capacity ?? HARVEST.capacity) || late) {
            aimPlot = -1;
            steerTo(run, run.ship.x, run.ship.z, input, 0.5);
         } else {
            const g = guidePlot(run);
            if (g !== aimPlot) {
               aimPlot = g;
               pressAt = Infinity;
               aimCycle = -1;
            }
            if (g >= 0) {
               standPoint(run.plots[g], f.x, f.z, goal);
               steerTo(run, goal.x, goal.z, input);
            } else {
               input.dirX = 0;
               input.dirZ = 0;
            }
         }
      }
      if (aimPlot < 0) return;
      const plot = run.plots[aimPlot];
      if (Math.hypot(plot.x - f.x, plot.z - f.z) > HARVEST.reach - 0.05) return;
      const k = cycleIndex(plot, t);
      if (k < 0 || plot.picked === k || plot.missed === k) return;
      if (aimCycle !== k) {
         // a reaction-limited press on the pulse: peak + error, never before the ring is full
         aimCycle = k;
         const peak = cyclePeak(plot, k);
         pressAt = peak + (rng() * 2 - 1) * jitter * 1.6 + jitter * 0.3;
      }
      if (t >= pressAt) {
         input.press = true;
         pressAt = Infinity;
      }
   };
}

/** Degenerate players that must not score high (README "Test plan"). */
export const idleBot: Bot = (_run, input) => {
   input.dirX = 0;
   input.dirZ = 0;
   input.press = false;
};

/** Holds Harvest the whole run: only the first frame is a press. */
export function holdBot(): Bot {
   let first = true;
   return (_run, input) => {
      input.dirX = 0;
      input.dirZ = 0;
      input.press = first;
      first = false;
   };
}

/** Walks onto one plot and presses perfectly on every peak; never delivers. */
export function campBot(plotId = 4): Bot {
   return (run, input) => {
      const plot = run.plots[plotId], t = run.time;
      steerTo(run, plot.x, plot.z, input);
      const k = cycleIndex(plot, t);
      input.press = k >= 0 && Math.abs(t - cyclePeak(plot, k)) < 0.02 && plot.picked !== k;
   };
}

/** Circles within 0.5 m of a bed and presses at random (seeded). */
export function spinBot(seed: number): Bot {
   const rng = createRng(seed);
   return (run, input) => {
      const a = run.time * 3;
      steerTo(run, 0.4 * Math.cos(a), 0.4 * Math.sin(a), input, 0.01);
      input.press = rng() < 0.08;
   };
}

/** Walks to the nearest unmissed plot and presses ONCE on arrival, ignoring the pulse; delivers at four. */
export function arriveBot(): Bot {
   let target = -1;
   return (run, input) => {
      input.press = false;
      const f = run.farmer, t = run.time;
      if (run.cargoCount >= (run.level?.capacity ?? HARVEST.capacity)) {
         steerTo(run, run.ship.x, run.ship.z, input, 0.5);
         return;
      }
      if (target >= 0) {
         const p = run.plots[target];
         const k = cycleIndex(p, t);
         if (k >= 0 && (p.missed === k || p.picked === k)) target = -1;
      }
      if (target < 0) {
         let best = Infinity;
         for (const p of run.plots) {
            const k = cycleIndex(p, t);
            if (k < 0 || t < p.activateAt || p.missed === k || p.picked === k || t >= cycleBurst(p, k)) continue;
            const d = Math.hypot(p.x - f.x, p.z - f.z);
            if (d < best && d > 0.95) {
               best = d;
               target = p.id;
            }
         }
      }
      if (target < 0) return;
      const p = run.plots[target];
      steerTo(run, p.x, p.z, input);
      if (Math.hypot(p.x - f.x, p.z - f.z) <= HARVEST.reach - 0.05) {
         input.press = true;
         target = -1;
      }
   };
}

/** Orbits the plots (delivering at four) and presses every `period` s, ignoring the pulse. */
export function metronomeBot(period = 0.61): Bot {
   let last = -Infinity, leg = 0;
   const route = [0, 1, 2, 5, 8, 7, 6, 3, 4];
   return (run, input) => {
      const t = run.time;
      if (run.cargoCount >= (run.level?.capacity ?? HARVEST.capacity)) steerTo(run, run.ship.x, run.ship.z, input, 0.5);
      else {
         const p = run.plots[route[leg % route.length]];
         if (steerTo(run, p.x, p.z, input) < 0.3) leg++;
      }
      input.press = t - last >= period;
      if (input.press) last = t;
   };
}

/** 5 Hz taps while orbiting: a cooldown regression (README). */
export function orbitSpamBot(): Bot {
   return metronomeBot(0.2);
}

// re-exported for tests that build their own schedules
export { CYCLE, SHIP };
