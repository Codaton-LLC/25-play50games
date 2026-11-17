// The fairness and limit checks every map level runs (fairness.level-N.test.ts, one file per map so
// they run in parallel). Level 1 keeps its own in rules.test.ts. For each map: every seeded island is
// valid and not the fallback; every spot is reachable from the dock start at the final tide through
// the gates open at its stage (an independent flood fill per spot), and with k spots found one more
// can always be sensed; the start is dry and free; each gate (and the rope bridge) seals what it
// claims; the detector never senses a sealed spot or the locked chest; and an honest path bot,
// through the real store, clears the level without ever breaking its server limits.
import { describe, expect, it } from "vitest";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS, type IslandLevel } from "./levels";
import { treasureIslandMeta as meta } from "./meta";
import {
   DIG,
   EXPLORER,
   PROPOSED_LEVEL_LIMITS,
   START,
   capScore,
   clearance,
   createRun,
   earliestWinMs,
   gateBox,
   generateIsland,
   isReachable,
   isWon,
   layoutFrom,
   mapFallback,
   mapIslandProblem,
   reachRho,
   reachableCells,
   rho,
   runScore,
   stagesFair,
   stepRun,
   updateDetector,
   withGates,
   withinServerLimits,
   type Island,
   type RunState,
   type StepInput,
} from "./rules";

export type MapLevelId = 2 | 3 | 4 | 5;

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** The cheapest find order the stages allow (centre to centre): spot order[k] needs unlockAt <= k. */
export function bestAllowedOrder(island: Island): number[] {
   const n = island.treasures.length;
   const lock = island.unlockAt ?? island.treasures.map(() => 0);
   let best: number[] = [];
   let bestLen = Infinity;
   const used = new Array<boolean>(n).fill(false);
   const order: number[] = [];
   const walk = (len: number) => {
      if (len >= bestLen) return;
      if (order.length === n) {
         bestLen = len;
         best = [...order];
         return;
      }
      const from = order.length ? island.treasures[order[order.length - 1]] : START;
      for (let i = 0; i < n; i++) {
         if (used[i] || lock[i] > order.length) continue;
         used[i] = true;
         order.push(i);
         walk(len + dist(from, island.treasures[i]));
         order.pop();
         used[i] = false;
      }
   };
   walk(0);
   return best;
}

const BOT_GRID = createGrid({ cell: 0.25, halfX: 20, halfZ: 14 });

type Driver = (run: RunState, step: StepInput) => void;

/** Walks the grid path to the next spot of the best allowed order and digs on it; replans when a gate opens. */
export function mapBot(island: Island, level: IslandLevel): Driver {
   const order = bestAllowedOrder(island);
   let prints = null as RunState["prints"] | null;
   let free: Uint8Array = new Uint8Array(0);
   let tight: Uint8Array = new Uint8Array(0);
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
      if (run.prints !== prints) {
         prints = run.prints;
         const p = prints;
         free = freeGrid(BOT_GRID, (x, z) => rho(x, z, level) <= reachRho(1) - 0.06 && clearance(p, x, z) >= EXPLORER.radius + 0.12);
         tight = freeGrid(BOT_GRID, (x, z) => rho(x, z, level) <= reachRho(1) - 0.06 && clearance(p, x, z) >= EXPLORER.radius + 0.03);
         follower = null;
      }
      if (goal !== target || !follower) {
         goal = target;
         follower = followPath(BOT_GRID, free, e.x, e.z, t.x, t.z);
         // a narrow passage (the explorer fits, with less than 0.12 m to spare): the tighter grid
         if (follower.path.length === 0) follower = followPath(BOT_GRID, tight, e.x, e.z, t.x, t.z);
      }
      steer(BOT_GRID, follower, e.x, e.z, step);
   };
}

/** One run through the real store (core simulateRun): the bot, the rules, the store's clock and score. */
export function simulateLevel(island: Island, level: IslandLevel, id: MapLevelId, drive: Driver, frame: () => number = fixedFrames(50)) {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const run = createRun(island, level);
   const step: StepInput = { dirX: 0, dirZ: 0, digHeld: false, digPressed: false };
   let rawScore = 0;
   let capped = false;
   let sensedLocked = false;
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      frame,
      step: (dt, time, store) => {
         drive(run, step);
         stepRun(run, island, step, dt, time);
         const target = run.detector.target;
         if (target >= 0 && island.unlockAt && island.unlockAt[target] > run.found) sensedLocked = true;
         if (run.events.found < 0) return;
         const s = store.getState();
         s.addScore(200 + (run.events.foundClean ? 50 : 0));
         s.setStat("treasures", run.found);
         if (isWon(run)) {
            rawScore = runScore(run.found, run.cleanFinds, true, s.timeLeftMs ?? 0);
            const stored = capScore(rawScore, s.elapsedMs, limits);
            capped = stored !== rawScore;
            s.setScore(stored);
            s.end("win");
         }
      },
   });
   return { won: end.endReason === "win", elapsedMs: end.elapsedMs, score: end.endReason === "win" ? rawScore : end.score, capped, found: run.found, sensedLocked };
}

/** Is `at` reachable from the start (final tide) with the gates as they are after `found` finds and `blocks` added? */
export interface SealCheck {
   what: string;
   at: { x: number; z: number };
   found: number;
   blocks?: ReadonlyArray<{ x: number; z: number; hx: number; hz: number }>;
   reachable: boolean;
}

export function fairnessSuite(id: MapLevelId, seals: readonly SealCheck[], seeds = 300, botSeeds = 48): void {
   const level = LEVELS[id];
   const map = level.map!;
   const layout = layoutFrom(level);
   const limits = PROPOSED_LEVEL_LIMITS[id];

   describe(`treasure-island L${id} (${meta.levels![id - 1].title}) fairness`, () => {
      it(`${seeds} seeds: valid islands, never the fallback, every spot reachable through its gates at the final tide`, () => {
         const fallback = mapFallback(level);
         expect(mapIslandProblem(fallback, level)).toBeNull();
         let gated = 0;
         for (let seed = 0; seed < seeds; seed++) {
            const island = generateIsland(seed * 7 + 1, level);
            expect(mapIslandProblem(island, level), `seed ${seed}`).toBeNull();
            expect(island.treasures).not.toBe(fallback.treasures);
            expect(island.treasures.length).toBe(level.treasures);
            const prints = { circles: island.circles, boxes: island.boxes };
            // independent of unlockStages: open exactly the gates due by each spot's stage, flood from the start
            island.treasures.forEach((t, i) => {
               const stage = island.unlockAt![i];
               const seen = reachableCells(withGates(prints, island.gates ?? [], stage), layout);
               expect(isReachable(seen, t), `seed ${seed} spot ${i} stage ${stage}`).toBe(true);
               expect(rho(t.x, t.z, level)).toBeLessThanOrEqual(layout.maxRho + 1e-9);
               if (stage > 0 && i !== island.finalChest) gated++;
            });
            expect(stagesFair(island.unlockAt!)).toBe(true);
            if (map.chain) {
               expect(island.finalChest).toBe(level.treasures - 1);
               expect(island.unlockAt![level.treasures - 1]).toBe(level.treasures - 1);
               expect(island.findTypes).toEqual(map.chain);
            }
            if (map.chestAt) expect(island.treasures[level.treasures - 1]).toEqual(map.chestAt);
         }
         if (map.gates.some((g) => g.opensAfter > 0 && g.kind !== "log" && g.kind !== "rockfall")) expect(gated).toBeGreaterThan(0);
      }, 600_000);

      it("the dock start is dry at the final tide, free of every footprint, and the same as today", () => {
         expect(START).toEqual({ x: 0, z: 9.2 });
         expect(rho(START.x, START.z, level)).toBeLessThan(reachRho(level.finalShore) - 0.02);
         const island = generateIsland(3, level);
         const shut = withGates({ circles: island.circles, boxes: island.boxes }, map.gates, -1);
         // the dock's foot is 1 m south, as on level 1; everything else keeps 2.5 m clear
         expect(clearance(shut, START.x, START.z)).toBeCloseTo(1.0, 6);
         expect(clearance({ circles: shut.circles, boxes: shut.boxes.slice(1) }, START.x, START.z)).toBeGreaterThanOrEqual(2.5);
         const seen = reachableCells(shut, layout);
         expect(isReachable(seen, START)).toBe(true);
         for (const g of map.gates) expect(dist(g, START)).toBeGreaterThan(4);
      });

      for (const seal of seals) {
         it(`${seal.what}`, () => {
            for (const seed of [5, 17, 29]) {
               const island = generateIsland(seed, level);
               const gated = withGates({ circles: island.circles, boxes: island.boxes }, map.gates, seal.found);
               const extra = (seal.blocks ?? []).map((b) => gateBox({ kind: "log", x: b.x, z: b.z, hx: b.hx, hz: b.hz, opensAfter: 99, label: "" }));
               const prints = { circles: gated.circles, boxes: [...gated.boxes, ...extra] };
               expect(isReachable(reachableCells(prints, layout), seal.at), `seed ${seed}`).toBe(seal.reachable);
            }
         });
      }

      it("the detector never senses a sealed spot or the locked chest", () => {
         const island = generateIsland(9, level);
         const run = createRun(island, level);
         for (let found = 0; found < level.treasures; found++) {
            run.found = found;
            for (const t of island.treasures) {
               run.explorer.x = t.x;
               run.explorer.z = t.z;
               updateDetector(run, island);
               if (run.detector.target >= 0) expect(island.unlockAt![run.detector.target]).toBeLessThanOrEqual(found);
            }
         }
      });

      it(`the honest bot clears ${botSeeds} seeds through the real store inside the level's limits (earliest win ${earliestWinMs(level).toFixed(0)} ms)`, () => {
         const clearAt = meta.levels![id - 1].clearScore!;
         let wins = 0;
         let rich = 0;
         let fastest = Infinity;
         for (let seed = 0; seed < botSeeds; seed++) {
            const island = generateIsland(seed * 13 + 2, level);
            const frame = seed % 3 === 0 ? fixedFrames(1000 / 60) : seed % 3 === 1 ? fixedFrames(50) : randomFrames(seed);
            const r = simulateLevel(island, level, id, mapBot(island, level), frame);
            expect(r.capped, `seed ${seed}`).toBe(false);
            expect(r.sensedLocked, `seed ${seed}`).toBe(false);
            if (r.won) {
               wins++;
               fastest = Math.min(fastest, r.elapsedMs);
               expect(r.elapsedMs).toBeGreaterThanOrEqual(earliestWinMs(level));
               expect(withinServerLimits(r.score, r.elapsedMs, limits), `seed ${seed} ${r.score} in ${r.elapsedMs} ms`).toBe(true);
               if (r.score >= clearAt) rich++;
            }
         }
         console.log(JSON.stringify({ level: id, seeds: botSeeds, wins, cleared: rich, fastestMs: Math.round(fastest), earliestMs: Math.round(earliestWinMs(level)) }));
         expect(wins / botSeeds).toBeGreaterThanOrEqual(0.97);
         expect(rich / botSeeds).toBeGreaterThanOrEqual(0.97);
      }, 600_000);
   });
}
