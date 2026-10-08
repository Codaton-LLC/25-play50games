import { describe, expect, it } from "vitest";
import { FRAME_PRIORITY, MAX_FRAME_DT, advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import {
   DETECTOR,
   DIG,
   DURATION_MS,
   EARLIEST_WIN_MS,
   EXPLORER,
   FALLBACK_ISLAND,
   HINT,
   IDEAL_ROUTE,
   ISLAND,
   MIN_ROUTE,
   POINTS,
   SPACING,
   START,
   TIDE,
   TREASURE_COUNT,
   behindCanopy,
   clearance,
   createExplorer,
   createRun,
   drawIsland,
   footprints,
   generateIsland,
   isReachable,
   isValidIsland,
   isWon,
   pulsePeriod,
   reachRho,
   reachableCells,
   rho,
   runScore,
   shoreAt,
   shortestRoute,
   stepExplorer,
   stepRun,
   strengthAt,
   timeBonus,
   type Island,
   type RunState,
   updateDetector,
   type StepInput,
} from "./rules";

const DT = 1 / 60;
const SEEDS = Array.from({ length: 1000 }, (_v, i) => i);
/** a few seeds like the Scene draws them (random 32-bit integers) */
const BIG_SEEDS = [2 ** 32 - 1, 123456789, 987654321, 3141592653, 2718281828];
const ISLANDS = [...SEEDS, ...BIG_SEEDS].map(generateIsland);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const input = (dirX = 0, dirZ = 0, digHeld = false, digPressed = false): StepInput => ({ dirX, dirZ, digHeld, digPressed });
const copyIsland = (island: Island, change: (i: Island) => void): Island => {
   const copy: Island = JSON.parse(JSON.stringify(island));
   change(copy);
   const prints = footprints(copy.palms, copy.rocks);
   return { ...copy, circles: prints.circles, boxes: prints.boxes };
};
/** A run on `island` with the explorer placed at (x, z), standing. */
function runAt(island: Island, x: number, z: number): RunState {
   const run = createRun(island);
   run.explorer.x = x;
   run.explorer.z = z;
   updateDetector(run, island);
   return run;
}
/** Holds the dig button for `seconds` of play from `time`, one frame at a time (the first frame is the press). */
function holdDig(run: RunState, island: Island, seconds: number, time = 1, dt = DT): number {
   let t = time;
   const frames = Math.round(seconds / dt);
   for (let f = 0; f < frames; f++) {
      t += dt;
      stepRun(run, island, input(0, 0, true, f === 0), dt, t);
   }
   return t;
}

// ---------- a full-knowledge bot through the real store (test helper, not game code) ----------

const CELL = 0.25;
const HX = 16;
const HZ = 13;
const NX = Math.round((2 * HX) / CELL) + 1;
const NZ = Math.round((2 * HZ) / CELL) + 1;
const nodeX = (n: number) => -HX + Math.floor(n / NZ) * CELL;
const nodeZ = (n: number) => -HZ + (n % NZ) * CELL;
const nodeOf = (x: number, z: number) => Math.round((x + HX) / CELL) * NZ + Math.round((z + HZ) / CELL);

function freeGrid(island: Island): Uint8Array {
   const free = new Uint8Array(NX * NZ);
   for (let n = 0; n < NX * NZ; n++) {
      const x = nodeX(n);
      const z = nodeZ(n);
      free[n] = rho(x, z) <= reachRho(1) - 0.06 && clearance(island, x, z) >= EXPLORER.radius + 0.12 ? 1 : 0;
   }
   return free;
}

/** Dijkstra (binary heap) over free nodes, 8 neighbours, no cut corners; the node path from -> to. */
function findPath(free: Uint8Array, from: number, to: number): number[] {
   const cost = new Float64Array(NX * NZ).fill(Infinity);
   const prev = new Int32Array(NX * NZ).fill(-1);
   const heap: Array<[number, number]> = [];
   const push = (c: number, n: number) => {
      heap.push([c, n]);
      for (let i = heap.length - 1; i > 0; ) {
         const p = (i - 1) >> 1;
         if (heap[p][0] <= heap[i][0]) break;
         [heap[p], heap[i]] = [heap[i], heap[p]];
         i = p;
      }
   };
   const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
         heap[0] = last;
         for (let i = 0; ; ) {
            const l = 2 * i + 1;
            const r = l + 1;
            let m = i;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === i) break;
            [heap[m], heap[i]] = [heap[i], heap[m]];
            i = m;
         }
      }
      return top;
   };
   cost[from] = 0;
   push(0, from);
   while (heap.length) {
      const [c, n] = pop();
      if (n === to) break;
      if (c > cost[n]) continue;
      const i = Math.floor(n / NZ);
      const j = n % NZ;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]) {
         const ni = i + di;
         const nj = j + dj;
         if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
         const m = ni * NZ + nj;
         if (!free[m] || !free[ni * NZ + j] || !free[i * NZ + nj]) continue;
         if (c + w < cost[m]) {
            cost[m] = c + w;
            prev[m] = n;
            push(cost[m], m);
         }
      }
   }
   const path: number[] = [];
   for (let n = to; n >= 0; n = prev[n]) path.unshift(n);
   return path[0] === from ? path : [];
}

function nearestFree(free: Uint8Array, x: number, z: number): number {
   let best = nodeOf(x, z);
   let bestD = Infinity;
   for (let n = 0; n < NX * NZ; n++) {
      if (!free[n]) continue;
      const d = Math.hypot(nodeX(n) - x, nodeZ(n) - z);
      if (d < bestD && d < 2) {
         bestD = d;
         best = n;
      }
   }
   return best;
}

/** The order of the ideal route (centre to centre, best of 120). */
function bestOrder(island: Island): number[] {
   let best: number[] = [];
   let bestLen = Infinity;
   const go = (order: number[], left: number[], len: number, at: { x: number; z: number }) => {
      if (len >= bestLen) return;
      if (!left.length) {
         bestLen = len;
         best = order;
         return;
      }
      for (const i of left) go([...order, i], left.filter((j) => j !== i), len + dist(at, island.treasures[i]), island.treasures[i]);
   };
   go([], [0, 1, 2, 3, 4], 0, START);
   return best;
}

type Driver = (run: RunState, step: StepInput) => void;

/** Walks the grid path to each treasure in `order` and digs once its centre is in reach: never a false dig. */
function pathBot(island: Island, order = bestOrder(island)): Driver {
   const free = freeGrid(island);
   let goal = -1;
   let path: number[] = [];
   let k = 0;
   return (run, step) => {
      step.digPressed = false;
      const target = order.find((i) => !run.dug[i]);
      if (target === undefined) return;
      if (run.dig.active) {
         step.digHeld = true;
         step.dirX = step.dirZ = 0;
         return;
      }
      step.digHeld = false;
      const e = run.explorer;
      const t = island.treasures[target];
      if (dist(e, t) <= DIG.reach - 0.02) {
         step.digPressed = step.digHeld = true;
         return;
      }
      if (goal !== target) {
         goal = target;
         path = findPath(free, nearestFree(free, e.x, e.z), nearestFree(free, t.x, t.z));
         k = 0;
      }
      while (k < path.length - 1 && Math.hypot(nodeX(path[k]) - e.x, nodeZ(path[k]) - e.z) < 0.6) k++;
      const last = k >= path.length - 1;
      const dx = (last ? t.x : nodeX(path[k])) - e.x;
      const dz = (last ? t.z : nodeZ(path[k])) - e.z;
      const len = Math.hypot(dx, dz) || 1;
      step.dirX = dx / len;
      step.dirZ = dz / len;
   };
}

/** Random walking and random dig presses (input spam). */
function spamBot(seed: number): Driver {
   const rng = createRng(seed);
   return (_run, step) => {
      if (rng() < 0.05) {
         const a = rng() * Math.PI * 2;
         step.dirX = Math.cos(a);
         step.dirZ = Math.sin(a);
      }
      step.digPressed = rng() < 0.08;
      step.digHeld = step.digPressed || (step.digHeld && rng() < 0.97);
   };
}

interface Sim {
   won: boolean;
   elapsedMs: number;
   score: number;
   found: number;
   /** the longest step over its dt before the tide (m/s) */
   topSpeed: number;
   walked: number;
   digTime: number;
   playTime: number;
}

/** One run on the real store, driven like ShellStage: advanceRunClock, then useRunFrame's dt; the Scene's store calls. */
function simulate(island: Island, drive: Driver, frame: () => number): Sim {
   const store = createArcadeStore();
   store.getState().configure({ durationMs: DURATION_MS });
   store.getState().markReady();
   store.getState().start();
   const run = createRun(island);
   const step = input();
   let topSpeed = 0;
   let walked = 0;
   let digTime = 0;
   let playTime = 0;
   while (store.getState().phase !== "over") {
      advanceRunClock(store, frame());
      const dt = playedFrameDt(store.getState());
      if (dt === 0) continue;
      drive(run, step);
      const { x, z } = run.explorer;
      stepRun(run, island, step, dt, store.getState().elapsedMs / 1000);
      playTime += dt;
      const moved = Math.hypot(run.explorer.x - x, run.explorer.z - z);
      if (run.dig.active || run.events.found >= 0 || run.events.falseDig) {
         digTime += dt;
         // planted: only the rising water may push a digger
         if (run.time < TIDE.startS) expect(moved).toBe(0);
      }
      walked += moved;
      if (run.time < TIDE.startS) topSpeed = Math.max(topSpeed, moved / dt);
      const ev = run.events;
      if (ev.found < 0) continue;
      const s = store.getState();
      s.addScore(POINTS.find + (ev.foundClean ? POINTS.clean : 0));
      s.setStat("treasures", run.found);
      if (isWon(run)) {
         s.setScore(runScore(run.found, run.cleanFinds, true, store.getState().timeLeftMs ?? 0));
         s.end("win");
      }
   }
   const s = store.getState();
   return { won: s.endReason === "win", elapsedMs: s.elapsedMs, score: s.score, found: run.found, topSpeed, walked, digTime, playTime };
}

const fixed = (ms: number) => () => ms / 1000;
const randomFrames = (seed: number) => {
   const rng = createRng(seed);
   return () => 0.004 + rng() * 0.046;
};

// ---------- tests ----------

describe("treasure-island islands", () => {
   it("are deterministic per seed and differ between seeds", () => {
      expect(generateIsland(42)).toEqual(generateIsland(42));
      expect(generateIsland(42).treasures).not.toEqual(generateIsland(43).treasures);
   });

   it("are valid on 1,000 seeds: five treasures inland, spaced, clear of props, reachable at the final tide, in the band", () => {
      ISLANDS.forEach((island, k) => {
         expect(island.seed).toBe([...SEEDS, ...BIG_SEEDS][k]);
         expect(isValidIsland(island)).toBe(true);
         const seen = reachableCells(island);
         island.treasures.forEach((t, i) => {
            expect(rho(t.x, t.z)).toBeLessThanOrEqual(SPACING.maxRho);
            expect(dist(t, START)).toBeGreaterThanOrEqual(SPACING.fromStart);
            expect(clearance(island, t.x, t.z)).toBeGreaterThanOrEqual(SPACING.fromProps);
            for (let j = 0; j < i; j++) expect(dist(t, island.treasures[j])).toBeGreaterThanOrEqual(SPACING.treasures);
            expect(isReachable(seen, t)).toBe(true);
            expect(behindCanopy(t, island.palms)).toBe(false);
         });
         const ideal = shortestRoute(island.treasures);
         expect(ideal).toBeGreaterThanOrEqual(IDEAL_ROUTE.min);
         expect(ideal).toBeLessThanOrEqual(IDEAL_ROUTE.max);
         expect(island.findTypes[3] === "chest" || island.findTypes[4] === "chest").toBe(true);
         expect([...island.findTypes].sort()).toEqual(["chest", "coins", "coins", "gem", "gem"]);
         expect(island.palms.length).toBeGreaterThanOrEqual(8);
         expect(island.palms.length).toBeLessThanOrEqual(12);
      });
   });

   it("the fallback is valid and never used; at least 30 % of first attempts pass", () => {
      expect(isValidIsland(FALLBACK_ISLAND)).toBe(true);
      expect(ISLANDS.filter((i) => i.treasures === FALLBACK_ISLAND.treasures)).toHaveLength(0);
      const firstOk = SEEDS.filter((s) => {
         const island = drawIsland(s, createRng(s));
         return island !== null && isValidIsland(island);
      }).length;
      expect(firstOk / SEEDS.length).toBeGreaterThanOrEqual(0.3);
   });

   it("isValidIsland rejects one broken rule at a time", () => {
      const base = FALLBACK_ISLAND;
      const bad = (change: (i: Island) => void) => isValidIsland(copyIsland(base, change));
      expect(bad(() => {})).toBe(true);
      expect(bad((i) => i.treasures.pop())).toBe(false); // four treasures
      expect(bad((i) => (i.treasures[1] = { x: 11, z: 0 }))).toBe(false); // rho 0.79 > 0.72
      expect(bad((i) => (i.treasures[3] = { x: 0, z: 3 }))).toBe(false); // 6.2 from the start
      expect(bad((i) => (i.treasures[4] = { x: i.treasures[0].x + 5, z: i.treasures[0].z }))).toBe(false); // 5 apart
      expect(bad((i) => (i.treasures[1] = { x: i.palms[2].x + 1.5, z: i.palms[2].z }))).toBe(false); // 1.2 from a trunk's edge
      expect(bad((i) => (i.findTypes = ["chest", "coins", "coins", "gem", "gem"]))).toBe(false); // the chest first
      expect(bad((i) => (i.findTypes = ["coins", "coins", "coins", "gem", "chest"]))).toBe(false); // three coin piles
      expect(bad((i) => i.palms.splice(0, 5))).toBe(false); // seven palms
      // behind a palm's crown, seen from the camera (north of it)
      const p = base.palms[2];
      expect(behindCanopy({ x: p.x, z: p.z - 1.8 }, base.palms)).toBe(true);
      expect(bad((i) => (i.treasures[1] = { x: p.x, z: p.z - 1.8 }))).toBe(false);
      // a treasure walled in by rocks is unreachable
      expect(
         bad((i) => {
            const t = i.treasures[3];
            for (let k = 0; k < 8; k++) i.rocks.push({ x: t.x + 2.3 * Math.cos((k * Math.PI) / 4), z: t.z + 2.3 * Math.sin((k * Math.PI) / 4), size: 2.5, yaw: 0 });
         })
      ).toBe(false);
      // the band: the same island with the treasures pulled together is too short
      expect(shortestRoute(base.treasures)).toBeGreaterThanOrEqual(IDEAL_ROUTE.min);
      expect(bad((i) => i.treasures.forEach((t) => ((t.x *= 0.8), (t.z *= 0.8))))).toBe(false);
   });
});

describe("treasure-island movement", () => {
   const open: Island = { ...FALLBACK_ISLAND, circles: [], boxes: [] };

   it("tops out at 5 m/s on land and 3 m/s in the shallows; diagonals are no faster", () => {
      const e = createExplorer();
      e.x = -8;
      e.z = -1;
      for (let f = 0; f < 120; f++) stepExplorer(e, open, 1, 1, DT, 1);
      expect(Math.hypot(e.vx, e.vz)).toBeCloseTo(EXPLORER.maxSpeed, 6);
      const w = createExplorer();
      w.x = 0;
      w.z = -11.6; // rho 1.05: the shallows
      for (let f = 0; f < 120; f++) stepExplorer(w, open, 1, 0, DT, 1);
      expect(rho(w.x, w.z)).toBeGreaterThan(1);
      expect(Math.hypot(w.vx, w.vz)).toBeLessThanOrEqual(EXPLORER.wadeSpeed + 1e-9);
      expect(Math.hypot(w.vx, w.vz)).toBeGreaterThan(EXPLORER.wadeSpeed - 0.3);
   });

   it("stops at a palm and a box, and slides along them", () => {
      const palm: Island = { ...FALLBACK_ISLAND, circles: [{ x: 0, z: 0, r: 0.3 }], boxes: [] };
      // straight at the trunk: it stops 0.7 from its centre
      const e = createExplorer();
      e.z = 3;
      for (let f = 0; f < 120; f++) stepExplorer(e, palm, 0, -1, DT, 1);
      expect([e.x, e.z]).toEqual([0, 0.3 + EXPLORER.radius]);
      // a little off centre: it slides round the trunk and walks on
      const s = createExplorer();
      s.x = 0.2;
      s.z = 3;
      for (let f = 0; f < 120; f++) stepExplorer(s, palm, 0, -1, DT, 1);
      expect(s.z).toBeLessThan(-2);
      // the crate box: walking west from the start stops 0.4 east of it
      const c = createExplorer();
      for (let f = 0; f < 120; f++) stepExplorer(c, FALLBACK_ISLAND, -1, 0, DT, 1);
      expect(c.x).toBeCloseTo(-2.4 + 0.85 + EXPLORER.radius, 3);
   });

   it("20,000 random steps never move faster than 5 dt, never enter a footprint, never leave the water's edge", () => {
      const rng = createRng(9);
      let worst = 0;
      let deepest = Infinity;
      for (const island of ISLANDS.slice(0, 20)) {
         const e = createExplorer();
         for (let s = 0; s < 1000; s++) {
            const dt = 0.004 + rng() * (MAX_FRAME_DT - 0.004);
            const a = rng() * Math.PI * 2;
            const len = rng() < 0.1 ? 0 : rng() * 1.6;
            const { x, z } = e;
            stepExplorer(e, island, Math.cos(a) * len, Math.sin(a) * len, dt, 1);
            worst = Math.max(worst, Math.hypot(e.x - x, e.z - z) / dt);
            deepest = Math.min(deepest, clearance(island, e.x, e.z));
            expect(rho(e.x, e.z)).toBeLessThanOrEqual(reachRho(1) + 1e-9);
         }
      }
      expect(worst).toBeLessThanOrEqual(EXPLORER.maxSpeed + 1e-9);
      expect(deepest).toBeGreaterThan(EXPLORER.radius - 0.05);
   });

   it("the rising tide pushes a wader inward at most 0.175 m/s", () => {
      const e = createExplorer();
      e.x = 14 * reachRho(1);
      e.z = 0;
      let worst = 0;
      for (let t = TIDE.startS; t < TIDE.endS; t += DT) {
         const x = e.x;
         stepExplorer(e, FALLBACK_ISLAND, 0, 0, DT, shoreAt(t + DT));
         worst = Math.max(worst, (x - e.x) / DT);
      }
      expect(e.x).toBeCloseTo(14 * reachRho(TIDE.finalShore), 6);
      expect(worst).toBeLessThanOrEqual((ISLAND.rx * (1 - TIDE.finalShore)) / (TIDE.endS - TIDE.startS) + 1e-6);
   });
});

describe("treasure-island detector", () => {
   it("strength 1 on the spot, 0 from 12 m, never rising with distance; period 1.2 s -> 0.15 s", () => {
      expect(strengthAt(0)).toBe(1);
      expect(strengthAt(DETECTOR.range)).toBe(0);
      expect(strengthAt(30)).toBe(0);
      let prev = Infinity;
      for (let d = 0; d <= 20; d += 0.001) {
         const s = strengthAt(d);
         expect(s).toBeLessThanOrEqual(prev);
         prev = s;
      }
      expect(pulsePeriod(0)).toBeCloseTo(1.2, 9);
      expect(pulsePeriod(1)).toBeCloseTo(0.15, 9);
   });

   it("beeps once per pulse: standing 6 m from the nearest treasure, 14 beeps in 10 s; none out of range", () => {
      const island = FALLBACK_ISLAND;
      // a spot 6 m from treasure 2, all the others further
      const t = island.treasures[2];
      const run = runAt(island, t.x, t.z - 6);
      expect(run.detector.target).toBe(2);
      let beeps = 0;
      for (let f = 1; f <= 600; f++) {
         stepRun(run, island, input(), DT, f * DT);
         if (run.events.beep) beeps++;
      }
      // s = 0.5, period 0.675 s: 10 / 0.675 = 14.8 wraps
      expect(run.detector.strength).toBeCloseTo(0.5, 9);
      expect(beeps).toBe(14);
      const far = runAt({ ...island, treasures: island.treasures.map(() => ({ x: 40, z: 0 })) }, 0, 0);
      let farBeeps = 0;
      for (let f = 1; f <= 600; f++) {
         stepRun(far, { ...island, treasures: island.treasures.map(() => ({ x: 40, z: 0 })) }, input(), DT, f * DT);
         if (far.events.beep) farBeeps++;
      }
      expect(farBeeps).toBe(0);
   });

   it("re-targets the nearest undug treasure after a find", () => {
      const island = FALLBACK_ISLAND;
      const t = island.treasures[3];
      const run = runAt(island, t.x, t.z);
      holdDig(run, island, 0.7);
      expect(run.dug[3]).toBe(true);
      expect(run.detector.target).not.toBe(3);
      const nearest = [0, 1, 2, 4].sort((a, b) => dist(island.treasures[a], t) - dist(island.treasures[b], t))[0];
      expect(run.detector.target).toBe(nearest);
   });
});

describe("treasure-island digging", () => {
   const island = FALLBACK_ISLAND;
   const t = island.treasures[1];

   it("finds a treasure within 0.9 m of the centre (0.899), not at 0.91", () => {
      const near = runAt(island, t.x + 0.899, t.z);
      holdDig(near, island, 0.65);
      expect(near.found).toBe(1);
      const off = runAt(island, t.x + 0.91, t.z);
      holdDig(off, island, 0.65);
      expect(off.found).toBe(0);
      expect(off.clean).toBe(false);
   });

   it("a release before 0.6 s cancels with no effect; the feet stay planted while held", () => {
      const run = runAt(island, t.x, t.z);
      holdDig(run, island, 0.59, 1, 0.01);
      stepRun(run, island, input(), DT, 2);
      expect(run.dig.active).toBe(false);
      expect(run.found).toBe(0);
      expect(run.clean).toBe(true);
      // pushing the stick while digging does not move
      const planted = runAt(island, t.x, t.z);
      stepRun(planted, island, input(1, 0, true, true), DT, 1);
      for (let f = 0; f < 20; f++) stepRun(planted, island, input(1, 0, true, false), DT, 1 + f * DT);
      expect([planted.explorer.x, planted.explorer.z]).toEqual([t.x, t.z]);
      // exactly 0.6 s of held play time resolves it (36 frames at 1/60 s)
      const exact = runAt(island, t.x, t.z);
      holdDig(exact, island, 35 / 60);
      expect(exact.found).toBe(0);
      stepRun(exact, island, input(0, 0, true), DT, 2);
      expect(exact.found).toBe(1);
   });

   it("one dig per press: holding on after a find digs nothing more", () => {
      const run = runAt(island, t.x + 0.3, t.z);
      holdDig(run, island, 0.6);
      expect(run.found).toBe(1);
      for (let f = 0; f < 120; f++) stepRun(run, island, input(0, 0, true), DT, 2 + f * DT);
      expect([run.found, run.dig.active, run.clean]).toEqual([1, false, true]);
   });

   it("a false dig voids only the next find's +50", () => {
      const run = runAt(island, 0, 9);
      holdDig(run, island, 0.6);
      expect(run.events.falseDig).toBe(true);
      run.explorer.x = t.x;
      run.explorer.z = t.z;
      holdDig(run, island, 0.6, 3);
      expect(run.events.found).toBe(1);
      expect(run.events.foundClean).toBe(false);
      const u = island.treasures[3];
      run.explorer.x = u.x;
      run.explorer.z = u.z;
      holdDig(run, island, 0.6, 5);
      expect(run.events.foundClean).toBe(true);
      expect([run.found, run.cleanFinds]).toEqual([2, 1]);
      expect(runScore(run.found, run.cleanFinds, false, 0)).toBe(450);
   });
});

describe("treasure-island tide and hint", () => {
   it("the shore is 1 until 70 s and 0.75 at 90 s; every treasure stays on land", () => {
      expect(shoreAt(0)).toBe(1);
      expect(shoreAt(70)).toBe(1);
      expect(shoreAt(80)).toBeCloseTo(0.875, 9);
      expect(shoreAt(90)).toBeCloseTo(0.75, 9);
      expect(shoreAt(120)).toBeCloseTo(0.75, 9);
      // the farthest treasure (rho 0.72) is on dry sand at the final tide (0.75), and the explorer
      // can stand on it (reachable at the final tide: the islands test)
      expect(SPACING.maxRho).toBeLessThan(TIDE.finalShore);
      expect(SPACING.maxRho).toBeLessThan(reachRho(TIDE.finalShore));
   });

   it("the hint comes exactly 20 s after the start or the last find, over the detector's target, until the next find", () => {
      const island = FALLBACK_ISLAND;
      const run = createRun(island);
      let f = 0;
      while ((f + 1) * DT < HINT.afterS - 1e-9) stepRun(run, island, input(), DT, ++f * DT);
      expect(run.hint.target).toBe(-1);
      stepRun(run, island, input(), DT, HINT.afterS);
      expect(run.hint.target).toBe(run.detector.target);
      const t = island.treasures[run.hint.target];
      run.explorer.x = t.x;
      run.explorer.z = t.z;
      const at = holdDig(run, island, 0.6, HINT.afterS);
      expect(run.found).toBe(1);
      expect(run.hint).toEqual({ target: -1, since: at });
      stepRun(run, island, input(), DT, at + HINT.afterS - 0.01);
      expect(run.hint.target).toBe(-1);
      stepRun(run, island, input(), DT, at + HINT.afterS);
      expect(run.hint.target).toBe(run.detector.target);
   });

   it("reports the tide turning once, at 70 s", () => {
      const run = createRun(FALLBACK_ISLAND);
      let turns = 0;
      for (let f = 1; f * DT <= 75; f++) {
         stepRun(run, FALLBACK_ISLAND, input(), DT, f * DT);
         if (run.events.tide) turns++;
      }
      expect(turns).toBe(1);
   });
});

describe("treasure-island scoring", () => {
   it("200 a treasure, +50 a clean one, +10 per full second left on a win", () => {
      expect(timeBonus(42_999)).toBe(420);
      expect(timeBonus(-5)).toBe(0);
      expect(runScore(3, 2, false, 50_000)).toBe(700);
      expect(runScore(5, 5, true, 81_020)).toBe(2060);
      expect(runScore(4, 4, false, 0)).toBe(1000);
   });

   it("is the same run for the same island and inputs", () => {
      const a = simulate(ISLANDS[3], pathBot(ISLANDS[3]), fixed(16));
      const b = simulate(ISLANDS[3], pathBot(ISLANDS[3]), fixed(16));
      expect(a).toEqual(b);
   });

   it("an explorer that does not move scores 0 and times out at 90 s", () => {
      const run = simulate(ISLANDS[0], () => {}, fixed(1000 / 60));
      expect(run).toMatchObject({ won: false, found: 0, score: 0, elapsedMs: DURATION_MS });
   });
});

describe("treasure-island scoring limit proof (README.md)", () => {
   it("the clock counts every moment the explorer walks or digs: walking + digging time = elapsedMs", () => {
      expect(FRAME_PRIORITY.clock).toBeLessThan(FRAME_PRIORITY.simulation);
      const store = createArcadeStore();
      store.getState().configure({ durationMs: DURATION_MS });
      store.getState().markReady();
      const rng = createRng(11);
      for (const ending of ["timeup", "win", "restart", "win", "timeup", "restart"] as const) {
         const { phase } = store.getState();
         if (phase === "ready" || phase === "over") store.getState().start();
         let played = 0;
         const stopAtMs = 5_000 + rng() * 60_000;
         while (store.getState().phase !== "over") {
            const roll = rng();
            if (roll < 0.01) store.getState().pause();
            else if (roll < 0.03) store.getState().resume();
            const before = store.getState().elapsedMs;
            advanceRunClock(store, rng() < 0.1 ? 0.05 + rng() * 0.25 : 0.004 + rng() * 0.03);
            const dt = playedFrameDt(store.getState());
            if (dt > 0) {
               played += dt;
               expect(dt * 1000).toBeLessThanOrEqual(store.getState().elapsedMs - before + 1e-9);
            }
            if (ending !== "timeup" && store.getState().elapsedMs >= stopAtMs) break;
         }
         if (ending === "win") store.getState().end("win");
         const { elapsedMs } = store.getState();
         if (ending === "timeup") expect(elapsedMs).toBe(DURATION_MS);
         expect(played).toBeLessThanOrEqual(elapsedMs / 1000 + 1e-9);
         if (ending !== "timeup") expect(played).toBeCloseTo(elapsedMs / 1000, 9);
         if (ending === "restart") store.getState().restart();
      }
   });

   it("MIN_ROUTE is 29.9 m and the earliest win 8.98 s; no leg is clipped by the reach", () => {
      expect(SPACING.fromStart).toBeGreaterThan(DIG.reach);
      expect(SPACING.treasures).toBeGreaterThan(2 * DIG.reach);
      expect(MIN_ROUTE).toBeCloseTo(IDEAL_ROUTE.min - 0.9 - 4 * 1.8, 9);
      expect(MIN_ROUTE).toBeCloseTo(29.9, 9);
      expect(Math.round(EARLIEST_WIN_MS)).toBe(8980);
      expect(runScore(5, 5, true, DURATION_MS - 8980)).toBe(2060);
   });

   it("on every seed the reach route is exactly the ideal route minus 8.1, so at least 29.9 m", () => {
      for (const island of [...ISLANDS, FALLBACK_ISLAND]) {
         const ideal = shortestRoute(island.treasures);
         const reach = shortestRoute(island.treasures, DIG.reach);
         expect(reach).toBeCloseTo(ideal - 8.1, 9);
         expect(reach).toBeGreaterThanOrEqual(MIN_ROUTE - 1e-9);
      }
   });

   it("full-knowledge bots win through the real store at 60 fps, 20 fps and random 4-50 ms frames, never before 8.98 s", () => {
      const frames = [fixed(1000 / 60), fixed(50), randomFrames(5)];
      ISLANDS.slice(0, 30).forEach((island, k) => {
         const sim = simulate(island, pathBot(island), frames[k % 3]);
         expect(sim.won).toBe(true);
         expect(sim.found).toBe(TREASURE_COUNT);
         expect(sim.score).toBe(runScore(5, 5, true, DURATION_MS - sim.elapsedMs));
         expect(sim.topSpeed).toBeLessThanOrEqual(EXPLORER.maxSpeed + 1e-9);
         expect(sim.playTime).toBeCloseTo(sim.elapsedMs / 1000, 9);
         expect(sim.digTime).toBeGreaterThanOrEqual(TREASURE_COUNT * DIG.holdS - 1e-9);
         expect(sim.walked).toBeGreaterThanOrEqual(shortestRoute(island.treasures, DIG.reach) - 1e-6);
         expect(sim.elapsedMs).toBeGreaterThanOrEqual(EARLIEST_WIN_MS);
      });
   });

   it("input spam and wandering never win early and never score above what the clock allows", () => {
      ISLANDS.slice(0, 20).forEach((island, k) => {
         const sim = simulate(island, spamBot(k), randomFrames(k));
         expect(sim.topSpeed).toBeLessThanOrEqual(EXPLORER.maxSpeed + 1e-9);
         if (sim.won) expect(sim.elapsedMs).toBeGreaterThanOrEqual(EARLIEST_WIN_MS);
         else expect(sim.score).toBeLessThanOrEqual(4 * (POINTS.find + POINTS.clean));
      });
   });
});
