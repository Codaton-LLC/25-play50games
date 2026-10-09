import { describe, expect, it } from "vitest";
import { MAX_FRAME_DT } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { treasureIslandMeta } from "./meta";
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
   PALM_TRUNK,
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
   capScore,
   withinServerLimits,
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
/** seeds per bot (the arcade-score-limits skill asks for 200+) */
const BOT_SEEDS = 200;
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

// ---------- bots through the real store (core/testing/botHarness: grid, path, run loop) ----------

const GRID = createGrid({ cell: 0.25, halfX: 16, halfZ: 13 });
/** walkable for the bot: inside the full-tide reach and clear of every footprint, with small margins */
const freeFor = (island: Island) => freeGrid(GRID, (x, z) => rho(x, z) <= reachRho(1) - 0.06 && clearance(island, x, z) >= EXPLORER.radius + 0.12);

/** The order of the ideal route (centre to centre, the first best of the 120). */
function bestOrder(island: Island): number[] {
   const perms = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_v, j) => j !== i)).map((r) => [x, ...r])));
   const length = (o: number[]) => o.reduce((sum, i, k) => sum + dist(k ? island.treasures[o[k - 1]] : START, island.treasures[i]), 0);
   return perms([0, 1, 2, 3, 4]).reduce((a, b) => (length(b) < length(a) ? b : a));
}

type Driver = (run: RunState, step: StepInput) => void;

/** Walks the grid path to each treasure in `order` and digs once its centre is in reach: never a false dig. */
function pathBot(island: Island, order = bestOrder(island)): Driver {
   const free = freeFor(island);
   let goal = -1;
   let follower: PathFollower | null = null;
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
      if (goal !== target || !follower) {
         goal = target;
         follower = followPath(GRID, free, e.x, e.z, t.x, t.z);
      }
      steer(GRID, follower, e.x, e.z, step);
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

/** One run on the real store (simulateRun drives it like ShellStage) with the Scene's store calls. */
function simulate(island: Island, drive: Driver, frame: () => number) {
   const run = createRun(island);
   const step = input();
   // topSpeed: the longest step over its dt before the tide (m/s); plantedMove: a digger's longest step before it (0 = planted)
   const m = { topSpeed: 0, walked: 0, digTime: 0, playTime: 0, plantedMove: 0 };
   const end = simulateRun(createArcadeStore(), {
      durationMs: DURATION_MS,
      frame,
      step: (dt, time, store) => {
         drive(run, step);
         const { x, z } = run.explorer;
         stepRun(run, island, step, dt, time);
         m.playTime += dt;
         const moved = Math.hypot(run.explorer.x - x, run.explorer.z - z);
         if (run.dig.active || run.events.found >= 0 || run.events.falseDig) {
            m.digTime += dt;
            // planted: only the rising water may push a digger
            if (run.time < TIDE.startS) m.plantedMove = Math.max(m.plantedMove, moved);
         }
         m.walked += moved;
         if (run.time < TIDE.startS) m.topSpeed = Math.max(m.topSpeed, moved / dt);
         const ev = run.events;
         if (ev.found < 0) return;
         const s = store.getState();
         s.addScore(POINTS.find + (ev.foundClean ? POINTS.clean : 0));
         s.setStat("treasures", run.found);
         if (isWon(run)) {
            s.setScore(runScore(run.found, run.cleanFinds, true, s.timeLeftMs ?? 0));
            s.end("win");
         }
      },
   });
   return { won: end.endReason === "win", elapsedMs: end.elapsedMs, timeLeftMs: end.timeLeftMs ?? 0 /* may differ from DURATION_MS - elapsedMs in the last bits */, score: end.score, found: run.found, ...m };
}

/** 60 fps, 20 fps or seeded random 4-50 ms frames, by k. */
const framesFor = (k: number) => [fixedFrames(1000 / 60), fixedFrames(50), randomFrames(k)][k % 3];

// ---------- tests ----------

describe("treasure-island islands", () => {
   it("pins the tuning the islands, the band and the limit proof rest on", () => {
      expect(SPACING).toEqual({ treasures: 6, fromStart: 7, fromProps: 1.5, maxRho: 0.72 });
      expect(DIG).toEqual({ holdS: 0.6, reach: 0.9 });
      expect(TIDE).toEqual({ startS: 70, endS: 90, finalShore: 0.75 });
      expect(DETECTOR).toEqual({ range: 12, slowPeriod: 1.2, fastPeriod: 0.15 });
      expect(IDEAL_ROUTE).toEqual({ min: 38, max: 56 });
      expect([EXPLORER.radius, EXPLORER.maxSpeed, EXPLORER.wadeSpeed]).toEqual([0.4, 5, 3]);
   });

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
      const farIsland = { ...island, treasures: island.treasures.map(() => ({ x: 40, z: 0 })) };
      const far = runAt(farIsland, 0, 0);
      let farBeeps = 0;
      for (let f = 1; f <= 600; f++) {
         stepRun(far, farIsland, input(), DT, f * DT);
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

   it("a wader digging (Dig re-pressed every frame) from 75 s stays within the reach of the rising tide", () => {
      const island = FALLBACK_ISLAND;
      const run = runAt(island, ISLAND.rx * reachRho(shoreAt(75)), 0);
      for (let t = 75; t < TIDE.endS; t += DT) {
         stepRun(run, island, input(0, 0, true, true), DT, t + DT);
         expect(run.dig.active || run.events.found >= 0 || run.events.falseDig).toBe(true);
         expect(rho(run.explorer.x, run.explorer.z)).toBeLessThanOrEqual(reachRho(shoreAt(t + DT)) + 1e-9);
      }
      expect(run.explorer.x).toBeCloseTo(ISLAND.rx * reachRho(TIDE.finalShore), 6);
   });

   it("the rising tide never pushes the explorer into a prop: seaward of the rowboat, the crates or a palm, standing or digging", () => {
      // the final reach (rho 0.87) cuts through the rowboat and runs just south of the crates
      const palm = { x: 0.2, z: -ISLAND.rz * reachRho(TIDE.finalShore) + 0.3, r: PALM_TRUNK };
      const island: Island = { ...FALLBACK_ISLAND, circles: [...FALLBACK_ISLAND.circles, palm] };
      for (const [x, z] of [[-10, 7.1], [-2.4, 9.95], [0, -ISLAND.rz * reachRho(shoreAt(80))]]) {
         for (const dig of [false, true]) {
            const run = runAt(island, x, z);
            expect(clearance(island, x, z)).toBeGreaterThanOrEqual(EXPLORER.radius);
            for (let t = TIDE.startS; t < TIDE.endS; t += DT) {
               stepRun(run, island, input(0, 0, dig, dig), DT, t + DT);
               expect(clearance(island, run.explorer.x, run.explorer.z)).toBeGreaterThanOrEqual(EXPLORER.radius - 1e-6);
            }
         }
      }
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

   it("an explorer that does not move scores 0 and times out at 90 s", () => {
      const run = simulate(ISLANDS[0], () => {}, fixedFrames(1000 / 60));
      expect(run).toMatchObject({ won: false, found: 0, score: 0, elapsedMs: DURATION_MS });
   });
});

describe("treasure-island scoring limit proof (README.md)", () => {
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

   it("full-knowledge bots win through the real store on 200 seeds at 60 fps, 20 fps and random 4-50 ms frames, never before 8.98 s; the same run twice", { timeout: 60_000 }, () => {
      ISLANDS.slice(0, BOT_SEEDS).forEach((island, k) => {
         const sim = simulate(island, pathBot(island), framesFor(k));
         // deterministic: the same island, inputs and frames give the same run
         if (k < 3) expect(simulate(island, pathBot(island), framesFor(k))).toEqual(sim);
         expect(sim.won).toBe(true);
         expect(sim.found).toBe(TREASURE_COUNT);
         expect(sim.score).toBe(runScore(5, 5, true, sim.timeLeftMs));
         expect(sim.timeLeftMs).toBeCloseTo(DURATION_MS - sim.elapsedMs, 6);
         expect([sim.topSpeed <= EXPLORER.maxSpeed + 1e-9, sim.plantedMove]).toEqual([true, 0]);
         expect(sim.playTime).toBeCloseTo(sim.elapsedMs / 1000, 9);
         expect(sim.digTime).toBeGreaterThanOrEqual(TREASURE_COUNT * DIG.holdS - 1e-9);
         expect(sim.walked).toBeGreaterThanOrEqual(shortestRoute(island.treasures, DIG.reach) - 1e-6);
         expect(sim.elapsedMs).toBeGreaterThanOrEqual(EARLIEST_WIN_MS);
         expect(withinServerLimits(sim.score, sim.elapsedMs)).toBe(true);
      });
   });

   it("input spam and wandering on 200 seeds never win early and never score above what the clock allows", { timeout: 60_000 }, () => {
      ISLANDS.slice(0, BOT_SEEDS).forEach((island, k) => {
         const sim = simulate(island, spamBot(k), randomFrames(k));
         expect([sim.topSpeed <= EXPLORER.maxSpeed + 1e-9, sim.plantedMove]).toEqual([true, 0]);
         expect(withinServerLimits(sim.score, sim.elapsedMs)).toBe(true);
         if (sim.won) expect(sim.elapsedMs).toBeGreaterThanOrEqual(EARLIEST_WIN_MS);
         else expect(sim.score).toBeLessThanOrEqual(4 * (POINTS.find + POINTS.clean));
      });
   });

   it("matches the server limits; every win from 8.98 s and every time-up passes, capScore a no-op; bots reach >= 90 % of maxScore", () => {
      expect(treasureIslandMeta.scoring).toMatchObject({ kind: "points", maxScore: 2060, minDurationMs: 8500, maxDurationMs: 92000, base: 1250, maxPointsPerSec: 100 });
      for (let t = Math.ceil(EARLIEST_WIN_MS); t <= DURATION_MS; t += 10) {
         for (const clean of [0, 5]) {
            const score = runScore(5, clean, true, DURATION_MS - t);
            expect(withinServerLimits(score, t)).toBe(true);
            expect(capScore(score, t)).toBe(score);
         }
      }
      for (let found = 0; found < 5; found++) for (let clean = 0; clean <= found; clean++) expect(withinServerLimits(runScore(found, clean, false, 0), DURATION_MS)).toBe(true);
      // the edges: 2061 or a run under 8.5 s is rejected, the 8.98 s best case is maxScore
      expect(runScore(5, 5, true, DURATION_MS - Math.ceil(EARLIEST_WIN_MS))).toBe(2060);
      expect(withinServerLimits(2061, 30_000)).toBe(false);
      expect(withinServerLimits(2060, 8_499)).toBe(false);
      expect(withinServerLimits(1000, 92_001)).toBe(false);
      // the margin: 480 ms (5 %) under the earliest win
      expect(Math.round(EARLIEST_WIN_MS) - treasureIslandMeta.scoring.minDurationMs).toBe(480);
      // the measured best bot (10.25-10.5 s, 2040) is within 90-100 % of maxScore and passes
      const best = simulate(ISLANDS[94], pathBot(ISLANDS[94]), fixedFrames(1000 / 60));
      expect(best.won).toBe(true);
      expect(best.score).toBeGreaterThanOrEqual(0.9 * treasureIslandMeta.scoring.maxScore);
      expect(withinServerLimits(best.score, best.elapsedMs)).toBe(true);
      expect(capScore(best.score, best.elapsedMs)).toBe(best.score);
   });
});
