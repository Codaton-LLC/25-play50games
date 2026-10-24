// The certified harvest bound behind the score limits (README "Server limits and why they hold").
// Pure, used by rules.test.ts only. It relaxes the real game: no acceleration, no carry or spore
// slowdown, no deliveries (every crop is paid as if delivered in a full load of four), and presses
// at any real time. Each (plot, cycle) is a node with its ripe window; one harvest per node.
//
// From a press at t on plot i, the next press on plot j is at least
//    max(open_j, t + 0.30 + max(0, d(i, j) - 1.8) / 4.5)
// (planted 0.30 s, then from within 0.90 m of i to within 0.90 m of j at <= 4.5 m/s), and the
// first press at least max(open_j, max(0, d(start, j) - 0.90) / 4.5). A harvest must complete
// (press + 0.30) by the 100 s timer. Every crop pays at most 50 (+50 perfect) + 100 (its share of
// a 25 x 4^2 load), so a label search that maximises sum(150 + 50 [perfect]) over these chains is
// an upper bound on every real run's score, whatever the ship's seeded start and direction.
import { CYCLE, DURATION_S, FARMER, HARVEST, OFFSET_TABLES, PLOTS, halfWindow } from "./rules";

export interface BoundOptions {
   /** the deadline (s): a harvest completes by it */
   deadline?: number;
   /** weight of a normal / perfect harvest */
   normal?: number;
   perfect?: number;
   perfectHalf?: number;
}

export interface BoundNode {
   plot: number;
   cycle: number;
   open: number;
   close: number;
   peak: number;
}

export interface BoundResult {
   best: number;
   /** the best chain: node index and press time, and whether pressed as perfect */
   witness: Array<{ node: number; t: number; perfect: boolean }>;
   nodes: BoundNode[];
   labels: number;
}

const EPS = 1e-9;
const SPEED = FARMER.speeds[0];

export function boundNodes(table: number, deadline: number): BoundNode[] {
   const nodes: BoundNode[] = [];
   for (const plot of PLOTS) {
      const b0 = plot.activateAt + OFFSET_TABLES[table][plot.id] * CYCLE.tickS;
      for (let k = 0; ; k++) {
         const peak = b0 + k * plot.cycleS + plot.cycleS * CYCLE.peakFrac;
         const w = halfWindow(peak);
         const open = peak - w - EPS;
         const close = Math.min(peak + w, deadline - HARVEST.channelS) + EPS;
         if (open > close) break;
         nodes.push({ plot: plot.id, cycle: k, open, close, peak });
      }
   }
   // by window close, so a label only scans the nodes still open after it
   return nodes.sort((a, b) => a.close - b.close || a.plot - b.plot || a.cycle - b.cycle);
}

/** Lower bound on the time from one press to the next (outward-safe: rounded down). */
export function pressGap(a: number, b: number): number {
   if (a === b) return HARVEST.channelS - EPS;
   const d = Math.hypot(PLOTS[a].x - PLOTS[b].x, PLOTS[a].z - PLOTS[b].z);
   return HARVEST.channelS + Math.max(0, d - 2 * HARVEST.reach) / SPEED - EPS;
}

export function firstPress(j: number): number {
   const d = Math.hypot(PLOTS[j].x - FARMER.startX, PLOTS[j].z - FARMER.startZ);
   return Math.max(0, d - HARVEST.reach) / SPEED - EPS;
}

/** Exhaustive label search (Pareto on time / score per (last, previous) node). */
export function harvestBound(table: number, options: BoundOptions = {}): BoundResult {
   const deadline = options.deadline ?? DURATION_S;
   const wN = options.normal ?? 150, wP = options.perfect ?? 200, ph = (options.perfectHalf ?? HARVEST.perfectHalf) + EPS;
   const nodes = boundNodes(table, deadline);
   const n = nodes.length;
   const gap = new Float64Array(PLOTS.length * PLOTS.length);
   for (let a = 0; a < PLOTS.length; a++) for (let b = 0; b < PLOTS.length; b++) gap[a * PLOTS.length + b] = pressGap(a, b);
   // a state is (last node, previous node + 1): only a -> b -> a could reach one node twice inside
   // its window (two gaps >= 71/90 s fit in 1.8 s; three do not), so the previous node is enough
   const states = n * (n + 1);
   const best = new Float64Array(states).fill(-Infinity);
   // labels: a binary heap on time, label data in growable arrays
   let cap = 1 << 16, size = 0, count = 0;
   let lt = new Float64Array(cap), ls = new Float64Array(cap), lnode = new Int32Array(cap), lprev = new Int32Array(cap), lpar = new Int32Array(cap), lperf = new Uint8Array(cap);
   let heap = new Int32Array(cap);
   const grow = () => {
      cap *= 2;
      const g = <T extends Float64Array | Int32Array | Uint8Array>(a: T, C: new (n: number) => T): T => {
         const b = new C(cap);
         b.set(a);
         return b;
      };
      lt = g(lt, Float64Array);
      ls = g(ls, Float64Array);
      lnode = g(lnode, Int32Array);
      lprev = g(lprev, Int32Array);
      lpar = g(lpar, Int32Array);
      lperf = g(lperf, Uint8Array);
      heap = g(heap, Int32Array);
   };
   const push = (t: number, s: number, node: number, prev: number, par: number, perfect: boolean) => {
      if (s <= best[node * (n + 1) + prev + 1]) return;
      if (count >= cap) grow();
      const id = count++;
      lt[id] = t;
      ls[id] = s;
      lnode[id] = node;
      lprev[id] = prev;
      lpar[id] = par;
      lperf[id] = perfect ? 1 : 0;
      let i = size++;
      heap[i] = id;
      while (i > 0) {
         const p = (i - 1) >> 1;
         if (lt[heap[p]] <= lt[heap[i]]) break;
         const x = heap[p];
         heap[p] = heap[i];
         heap[i] = x;
         i = p;
      }
   };
   const pop = (): number => {
      const top = heap[0];
      heap[0] = heap[--size];
      let i = 0;
      for (;;) {
         const l = 2 * i + 1, r = l + 1;
         let m = i;
         if (l < size && lt[heap[l]] < lt[heap[m]]) m = l;
         if (r < size && lt[heap[r]] < lt[heap[m]]) m = r;
         if (m === i) break;
         const x = heap[m];
         heap[m] = heap[i];
         heap[i] = x;
         i = m;
      }
      return top;
   };
   const offer = (node: number, prev: number, T: number, base: number, par: number) => {
      const v = nodes[node];
      if (T < v.open) T = v.open;
      if (T > v.close) return;
      // the previous node matters only while it could still be reached again inside its window
      const keep = (time: number) => (prev >= 0 && time + gap[v.plot * PLOTS.length + nodes[prev].plot] <= nodes[prev].close ? prev : -1);
      push(T, base + wN, node, keep(T), par, false);
      const tp = Math.max(T, v.peak - ph);
      if (T <= v.peak + ph && tp <= v.close) push(tp, base + wP, node, keep(tp), par, true);
   };
   for (let j = 0; j < n; j++) offer(j, -1, firstPress(nodes[j].plot), 0, -1);
   let bestScore = 0, bestLabel = -1;
   while (size > 0) {
      const id = pop();
      const node = lnode[id], prev = lprev[id], s = ls[id], t = lt[id];
      const state = node * (n + 1) + prev + 1;
      if (s <= best[state]) continue;
      best[state] = s;
      if (s > bestScore) {
         bestScore = s;
         bestLabel = id;
      }
      const pa = nodes[node].plot * PLOTS.length;
      let lo = 0, hi = n;
      while (lo < hi) {
         const mid = (lo + hi) >> 1;
         if (nodes[mid].close < t) lo = mid + 1;
         else hi = mid;
      }
      for (let m = lo; m < n; m++) {
         if (m === node || m === prev) continue;
         offer(m, node, t + gap[pa + nodes[m].plot], s, id);
      }
   }
   const witness: BoundResult["witness"] = [];
   for (let id = bestLabel; id >= 0; id = lpar[id]) witness.unshift({ node: lnode[id], t: lt[id], perfect: lperf[id] === 1 });
   return { best: bestScore, witness, nodes, labels: count };
}

/** Brute force over every chain (small deadlines only): cross-checks harvestBound. */
export function bruteBound(table: number, options: BoundOptions = {}): number {
   const deadline = options.deadline ?? DURATION_S;
   const wN = options.normal ?? 150, wP = options.perfect ?? 200, ph = (options.perfectHalf ?? HARVEST.perfectHalf) + EPS;
   const nodes = boundNodes(table, deadline);
   const used = new Uint8Array(nodes.length);
   const dfs = (plot: number, t: number): number => {
      let best = 0;
      for (let m = 0; m < nodes.length; m++) {
         if (used[m]) continue;
         const v = nodes[m];
         const T = Math.max(v.open, plot < 0 ? firstPress(v.plot) : t + pressGap(plot, v.plot));
         if (T > v.close) continue;
         used[m] = 1;
         best = Math.max(best, wN + dfs(v.plot, T));
         const tp = Math.max(T, v.peak - ph);
         if (T <= v.peak + ph && tp <= v.close) best = Math.max(best, wP + dfs(v.plot, tp));
         used[m] = 0;
      }
      return best;
   };
   return dfs(-1, 0);
}
