// Test-only bots for Bee Garden (never imported by runtime code). They drive the real rules through a
// fresh store exactly like the canvas (core/testing/botHarness simulateRun).
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { TUNING, createRun, stepRun, type RunState, type StepInput } from "../rules";

export type BotKind = "oracle" | "greedy" | "idle" | "spam" | "boostSpam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   store: ArcadeStore;
   run: RunState;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
   /** the score before the rules' safety cap (equal to score when the cap is a no-op) */
   uncapped: number;
}

/** Grid nodes the bee can fly through with a margin (branches, webs, the hive box). */
export function flightGrid(run: RunState, margin: number) {
   const grid = createGrid({ cell: 0.25, halfX: run.bounds.halfX - TUNING.beeRadius, halfZ: run.bounds.halfZ - TUNING.beeRadius });
   const free = freeGrid(grid, (x, z) => {
      for (const b of run.branches) if (Math.hypot(x - b.x, z - b.z) < b.radius + TUNING.beeRadius + margin) return false;
      for (const w of run.webs) if (Math.hypot(x - w.x, z - w.z) < w.radius + TUNING.beeRadius + margin) return false;
      return Math.hypot(x - run.hive.x, z - run.hive.z) >= TUNING.hiveSolid + TUNING.beeRadius + 0.1;
   });
   return { grid, free };
}

function makeDriver(run: RunState, kind: BotKind, seed: number): (dt: number) => StepInput {
   const input: StepInput = { dirX: 0, dirZ: 0, jump: false };
   if (kind === "idle") return () => input;
   if (kind === "spam" || kind === "boostSpam") {
      const rng = createRng(seed ^ 0x5eed);
      return () => {
         input.dirX = rng() * 2 - 1;
         input.dirZ = rng() * 2 - 1;
         input.jump = kind === "boostSpam" ? rng() < 0.7 : rng() < 0.3;
         return input;
      };
   }
   // oracle: tight margin, plans the way home, boosts every leg over 2 m; greedy (a careful human): wider margin, boosts legs over 3 m
   const oracle = kind === "oracle";
   const { grid, free } = flightGrid(run, oracle ? 0.1 : 0.3);
   const dir = { dirX: 0, dirZ: 0 };
   let target = -2;
   let follower: PathFollower | null = null;
   let replanIn = 0;
   const hiveGoal = { x: run.hive.x, z: run.hive.z - (TUNING.hiveSolid + TUNING.beeRadius + 0.3) };
   return (dt: number) => {
      const bee = run.bee;
      let left = 0;
      for (const f of run.flowers) if (f.hasNectar) left++;
      const deposit = run.carried.length >= TUNING.carryCap || (left === 0 && run.carried.length > 0);
      let id = -1;
      let gx = hiveGoal.x;
      let gz = hiveGoal.z;
      if (!deposit) {
         let best = Infinity;
         for (const f of run.flowers) {
            if (!f.hasNectar) continue;
            // the oracle also weighs the way home on the last flower of a load
            const homeCost = oracle && run.carried.length === TUNING.carryCap - 1 ? 0.6 * Math.hypot(f.x - run.hive.x, f.z - run.hive.z) : 0;
            const d = Math.hypot(f.x - bee.x, f.z - bee.z) + homeCost;
            if (d < best) {
               best = d;
               id = f.id;
               gx = f.x;
               gz = f.z;
            }
         }
      }
      replanIn -= dt;
      if (id !== target || !follower || run.events.includes("web_hit") || replanIn <= 0) {
         target = id;
         replanIn = 0.5;
         follower = followPath(grid, free, bee.x, bee.z, gx, gz);
      }
      steer(grid, follower, bee.x, bee.z, dir, 0.45);
      // brake for the next bend: the bee carries its speed (accel 16 m/s²), so it slows to what it can turn
      let bend = Math.hypot(gx - bee.x, gz - bee.z) + 0.5;
      const path = follower.path;
      for (let k = follower.k; k + 1 < path.length; k++) {
         const ax = grid.x(path[k]) - (k === follower.k ? bee.x : grid.x(path[k - 1]));
         const az = grid.z(path[k]) - (k === follower.k ? bee.z : grid.z(path[k - 1]));
         const bx = grid.x(path[k + 1]) - grid.x(path[k]);
         const bz = grid.z(path[k + 1]) - grid.z(path[k]);
         const cos = (ax * bx + az * bz) / ((Math.hypot(ax, az) || 1) * (Math.hypot(bx, bz) || 1));
         if (cos < 0.85) {
            bend = Math.hypot(grid.x(path[k]) - bee.x, grid.z(path[k]) - bee.z);
            break;
         }
      }
      const far = Math.hypot(gx - bee.x, gz - bee.z);
      const top = oracle ? TUNING.boostSpeed : TUNING.normalSpeed;
      const want = Math.min(top, (oracle ? 2.2 : 1.6) + Math.sqrt(2 * (oracle ? 12 : 9) * Math.max(0, bend - 0.2)));
      input.jump = oracle ? far > 2 && run.stamina > 15 && want > TUNING.normalSpeed : far > 3 && run.stamina > 30 && want > TUNING.normalSpeed;
      const k = want / (input.jump && run.boosting ? TUNING.boostSpeed : TUNING.normalSpeed);
      input.dirX = dir.dirX * Math.min(1, k);
      input.dirZ = dir.dirZ * Math.min(1, k);
      return input;
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

/** One run of `kind` on level `id` with this seed and frame pattern. */
export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const store = createArcadeStore();
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   let uncapped = 0;
   const end = simulateRun(store, {
      durationMs: level.durationMs,
      resultDelayMs: TUNING.resultDelayMs,
      frame: frameOf(frames, seed),
      step: (dt, _time, s) => {
         const before = run.score;
         stepRun(run, drive(dt), dt, s);
         // the win score from its parts, before the rules' cap
         if (run.endReason === "win" && uncapped === 0) uncapped = before + run.lastDeposit + Math.floor(run.timeLeft) * TUNING.winBonusPerSecond;
      },
   });
   return { store: end, run, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason, uncapped: run.endReason === "win" ? uncapped : end.score };
}
