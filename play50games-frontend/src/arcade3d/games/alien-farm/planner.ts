// The oracle bot for rules.test.ts (tests only). It knows the whole seeded schedule (cycles and the
// ship's route) and plans one basket at a time: a depth-first search over the next crops that fill
// the basket (perfect presses where the peak can be met) followed by the beam intercept on the
// ship's real route, maximising points per second of that load. It replans after every pick and
// delivery. Its estimates are conservative (slower than the real top speeds, an acceleration
// allowance per leg) so the real rules can execute the plan; the tests count only what the real
// rules and store award.
import { DURATION_S, FARMER, HARVEST, SCORE, SHIP_PATH, cycleIndex, cyclePeak, halfWindow, shipDistance, type RunState } from "./rules";
import { pointAt } from "@/arcade3d/core/path";
import type { Bot } from "./bots";

const SLACK = 0.97;
const LEG_S = 0.12;
const STAND = 0.8;
/** where a moving farmer presses: just inside reach */
const REACH_IN = HARVEST.reach - 0.04;
const BEAM = 1.45;
const DT = 0.05;
const HORIZON = 10;
const runEnd = (run: RunState) => ((run.level?.durationMs ?? 100_000) / 1000) - 0.3;
const sp = (n: number) => FARMER.speeds[n] * SLACK;
const leg = (d: number, n: number) => (d <= 0 ? 0 : LEG_S + d / sp(n));

interface Cand {
   plot: number;
   cycle: number;
   open: number;
   close: number;
   peak: number;
   x: number;
   z: number;
}

interface Plan {
   picks: Array<{ plot: number; cycle: number; press: number; perfect: boolean }>;
   deliver: boolean;
}

/** The ship's XZ every 0.05 s of the run (one table per run). */
function shipTrack(run: RunState): Float64Array {
   const dur = (run.level?.durationMs ?? 100_000) / 1000;
   const n = Math.ceil(dur / DT) + 2, out = new Float64Array(2 * n), p = { x: 0, y: 0, z: 0 };
   const speeds = run.level?.shipSpeeds;
   for (let i = 0; i < n; i++) {
      pointAt(SHIP_PATH, run.ship.s0 + run.ship.dir * shipDistance(i * DT, speeds), p);
      out[2 * i] = p.x;
      out[2 * i + 1] = p.z;
   }
   return out;
}

/** Earliest beam meeting from (x, z) at t0 at speed v: index into the track, or -1. */
function meet(track: Float64Array, x: number, z: number, t0: number, v: number, end: number): number {
   const n = track.length / 2;
   for (let i = Math.ceil(t0 / DT) + 1; i < n && i * DT < end; i++) {
      if (Math.hypot(track[2 * i] - x, track[2 * i + 1] - z) - BEAM <= v * Math.max(0, i * DT - t0 - LEG_S)) return i;
   }
   return -1;
}

function candidates(run: RunState, t0: number, end: number): Cand[] {
   const out: Cand[] = [];
   for (const p of run.plots) {
      let k = Math.max(0, cycleIndex(p, Math.max(t0, p.b0)));
      for (let n = 0; n < 2; n++, k++) {
         if (p.picked === k || p.missed === k || p.reserved) continue;
         const peak = cyclePeak(p, k), w = halfWindow(peak, p.halfLate);
         const open = peak - w + 0.04, close = Math.min(peak + w - 0.05, end - HARVEST.channelS - 0.05);
         if (open > t0 + HORIZON) break;
         if (close < t0 || open > close) continue;
         out.push({ plot: p.id, cycle: k, open, close, peak, x: p.x, z: p.z });
      }
   }
   return out;
}

export function planLoad(run: RunState, track: Float64Array, fx: number, fz: number, t0: number, cargo: number): Plan {
   const end = runEnd(run);
   const cap = run.level?.capacity ?? HARVEST.capacity;
   const cands = candidates(run, t0, end);
   const used = new Uint8Array(cands.length);
   const chain: number[] = [], times: number[] = [], perf: boolean[] = [];
   let bestRate = 0, best: Plan = { picks: [], deliver: false };
   const record = (value: number, until: number, deliver: boolean) => {
      const rate = value / Math.max(0.5, until - t0);
      if (rate <= bestRate) return;
      bestRate = rate;
      best = { picks: chain.map((c, i) => ({ plot: cands[c].plot, cycle: cands[c].cycle, press: times[i], perfect: perf[i] })), deliver };
   };
   const dfs = (x: number, z: number, t: number, c: number, pts: number) => {
      if (c > 0) {
         const i = meet(track, x, z, t, sp(c), end);
         if (i >= 0) record(pts + SCORE.loadUnit * c * c, i * DT + 0.6, true);
      }
      // a basket the timer will end with still pays its harvests
      if (c > 0 && chain.length > 0) record(pts, end + 3, false);
      if (c >= cap) return;
      for (let m = 0; m < cands.length; m++) {
         if (used[m]) continue;
         const cd = cands[m];
         const dist = Math.hypot(cd.x - x, cd.z - z);
         const T0 = Math.max(cd.open, t + leg(dist - REACH_IN, c));
         if (T0 > cd.close) continue;
         // the press happens where the farmer enters reach (it stops on the press)
         const px = dist > REACH_IN ? cd.x + ((x - cd.x) / dist) * REACH_IN : x;
         const pz = dist > REACH_IN ? cd.z + ((z - cd.z) / dist) * REACH_IN : z;
         const tp = Math.max(T0, cd.peak - 0.02);
         const options = T0 <= cd.peak + 0.16 && tp <= cd.close ? (tp - T0 > 0.3 ? 2 : 1) : 0;
         for (let o = 0; o <= options; o++) {
            if (o === 0 && options === 1) continue;
            const perfect = o > 0;
            const T = perfect ? tp : T0;
            used[m] = 1;
            chain.push(m);
            times.push(T);
            perf.push(perfect);
            dfs(px, pz, T + HARVEST.channelS, c + 1, pts + (perfect ? SCORE.perfect : SCORE.harvest));
            chain.pop();
            times.pop();
            perf.pop();
            used[m] = 0;
         }
      }
   };
   dfs(fx, fz, t0, cargo, 0);
   return best;
}

/** The oracle: follows planLoad through the real rules, replanning after every pick and delivery. */
export function oracleBot(): Bot {
   let track: Float64Array | null = null;
   let plan: Plan | null = null;
   let lastHarvested = -1, lastDelivered = -1;
   return (run, input) => {
      input.press = false;
      input.dirX = 0;
      input.dirZ = 0;
      const f = run.farmer, t = run.time;
      if (!track) track = shipTrack(run);
      if (run.channel.active) return;
      const pick = plan?.picks[0];
      const stale = pick && (run.plots[pick.plot].picked === pick.cycle || run.plots[pick.plot].missed === pick.cycle || t > pick.press + 0.5);
      if (!plan || stale || run.harvested !== lastHarvested || run.delivered !== lastDelivered) {
         lastHarvested = run.harvested;
         lastDelivered = run.delivered;
         plan = planLoad(run, track, f.x, f.z, t, run.cargoCount);
      }
      const next = plan.picks[0];
      if (!next) {
         if (plan.deliver && run.cargoCount > 0) {
            const i = meet(track, f.x, f.z, t, FARMER.speeds[run.cargoCount], runEnd(run));
            if (i >= 0) {
               const dx = track[2 * i] - f.x, dz = track[2 * i + 1] - f.z, d = Math.hypot(dx, dz) || 1;
               input.dirX = dx / d;
               input.dirZ = dz / d;
            }
         }
         return;
      }
      const plot = run.plots[next.plot];
      const dx = f.x - plot.x, dz = f.z - plot.z, d = Math.hypot(dx, dz);
      const peak = cyclePeak(plot, next.cycle), w = halfWindow(peak, plot.halfLate);
      const aim = next.perfect ? Math.max(next.press, peak - 0.02) : next.press;
      // full speed at the crop when the press is due on arrival; otherwise wait just inside reach
      const due = t + (d - REACH_IN) / FARMER.speeds[run.cargoCount] >= aim - 0.05;
      const gx = (due ? plot.x : plot.x + (dx / (d || 1)) * STAND) - f.x, gz = (due ? plot.z : plot.z + (dz / (d || 1)) * STAND) - f.z, gd = Math.hypot(gx, gz);
      if (gd > 0.04) {
         const k = (due ? 1 : Math.min(1, gd / 0.8)) / gd;
         input.dirX = gx * k;
         input.dirZ = gz * k;
      }
      if (d <= HARVEST.reach - 0.01 && cycleIndex(plot, t) === next.cycle && t >= aim - 0.01 && t >= peak - w && t <= peak + w && t >= run.cooldownUntil) input.press = true;
   };
}
