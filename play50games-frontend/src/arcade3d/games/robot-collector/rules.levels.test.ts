// Bot proofs per level (docs/arcade-levels.md §5): the honest bots never break the level's limits,
// the best bot reaches >= 90 % of maxScore, the human-paced bot clears (wins) >= 90 % of 200 seeds,
// idle and input spam never clear. Level 1 also keeps its own proof and runs in rules.test.ts.
// The 200-seed sweeps run on the pure rules loop (rulesRun: the same bot at the same frame lengths;
// the store tick is most of a run's cost); a smaller set per level goes through the real store
// (storeRun, scoring exactly like Scene.tsx) for the end-to-end check.
import { describe, expect, it } from "vitest";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { isLevelCleared } from "@/arcade3d/core/levels";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, simulateRun, steer, type Grid, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { robotCollectorMeta as meta } from "./meta";
import { ARENA, BATTERY_POINTS, PROPOSED_LEVEL_LIMITS, ROBOT, createRun, isActive, isComplete, runScore, stepRun, type Battery } from "./rules";

type Profile = "oracle" | "human" | "spam" | "idle";
/** seconds the human-paced bot waits before it drives to a battery it has not targeted yet */
const REACTION_S = 0.35;

const grids = new Map<LevelId, { grid: Grid; free: Uint8Array }>();
function gridOf(id: LevelId) {
   let g = grids.get(id);
   if (!g) {
      const { obstacles } = createRun(0, LEVELS[id]).world;
      const grid = createGrid({ cell: 0.5, halfX: ARENA.halfX, halfZ: ARENA.halfZ });
      const free = freeGrid(grid, (x, z) => Math.abs(x) <= ARENA.halfX - ROBOT.radius && Math.abs(z) <= ARENA.halfZ - ROBOT.radius && obstacles.every((box) => distanceToBoxXZ(x, z, box) >= ROBOT.radius + 0.1));
      g = { grid, free };
      grids.set(id, g);
   }
   return g;
}

/** One bot on one level: the oracle and the human follow a grid path (static props only; they ignore oil and belts) to the nearest active battery. */
function createBot(seed: number, profile: Profile, id: LevelId) {
   const run = createRun(seed, LEVELS[id]), rng = createRng(seed ^ 0x5eed), { grid, free } = gridOf(id);
   const dir = { dirX: 0, dirZ: 0 };
   let goal: Battery | null = null, follower: PathFollower | null = null, waitUntil = 0;
   function step(dt: number): number {
      let dx = 0, dz = 0;
      if (profile === "spam") {
         const a = rng() * Math.PI * 2;
         dx = Math.cos(a); dz = Math.sin(a);
      } else if (profile !== "idle") {
         let target: Battery | null = null, best = Infinity;
         for (const b of run.layout.batteries) if (isActive(run.progress, b)) {
            const d = Math.hypot(b.x - run.robot.x, b.z - run.robot.z);
            if (d < best) { best = d; target = b; }
         }
         if (target && target !== goal) {
            goal = target;
            follower = followPath(grid, free, run.robot.x, run.robot.z, target.x, target.z);
            waitUntil = run.time + (profile === "human" ? REACTION_S : 0);
         }
         if (follower && run.time + 1e-9 >= waitUntil) {
            steer(grid, follower, run.robot.x, run.robot.z, dir);
            dx = dir.dirX; dz = dir.dirZ;
         }
      }
      return stepRun(run, dx, dz, dt);
   }
   return { run, step };
}

/** The bot on the pure rules loop: the run's own clock is the played time; the store would end it at durationMs. */
function rulesRun(seed: number, profile: Profile, hz: number, id: LevelId) {
   const bot = createBot(seed, profile, id), { run } = bot, clock = LEVELS[id].durationMs / 1000;
   while (!isComplete(run.progress) && run.time < clock - 1e-9) bot.step(Math.min(1 / hz, clock - run.time));
   const won = isComplete(run.progress);
   return { run, won, score: runScore(run.progress.collected, won, (clock - run.time) * 1000), ms: run.time * 1000 };
}

/** The bot through the real store, scoring exactly like Scene.tsx (addScore per battery, the capped win score). */
function storeRun(seed: number, profile: Profile, hz: number, id: LevelId) {
   const bot = createBot(seed, profile, id), { run } = bot, limits = PROPOSED_LEVEL_LIMITS[id];
   let raw = 0;
   const final = simulateRun(createArcadeStore(), { durationMs: LEVELS[id].durationMs, frame: fixedFrames(1000 / hz), step(dt, _time, store) {
      const got = bot.step(dt);
      if (got === 0) return;
      const s = store.getState();
      s.addScore(got * BATTERY_POINTS);
      if (isComplete(run.progress)) {
         const { timeLeftMs, elapsedMs } = store.getState();
         raw = runScore(run.progress.collected, true, timeLeftMs ?? 0);
         s.setScore(capToLimits(raw, elapsedMs, limits));
         s.end("win");
      }
   } });
   return { run, final, raw };
}

const HZ = [30, 60, 144];
const SWEEP: Record<Profile, number> = { human: 200, oracle: 30, spam: 6, idle: 3 };

describe("robot-collector levels: bots", () => {
   for (const id of LEVEL_IDS) {
      const limits = PROPOSED_LEVEL_LIMITS[id], level = meta.levels![id - 1];

      it(`L${id}: 200-seed sweep at 30/60/144 Hz (limits, clear rate, best reach)`, () => {
         const stats: Record<string, { clears: number; best: number; mean: number; slowestWin: number }> = {};
         for (const profile of Object.keys(SWEEP) as Profile[]) {
            let clears = 0, best = 0, sum = 0, slowestWin = 0;
            for (let seed = 0; seed < SWEEP[profile]; seed++) {
               const { won, score, ms } = rulesRun(seed, profile, HZ[seed % 3], id);
               expect(fitsLimits(score, Math.max(ms, won ? 0 : LEVELS[id].durationMs), limits)).toBe(true);
               if (isLevelCleared(won ? "win" : "timeup", score, level)) { clears++; slowestWin = Math.max(slowestWin, ms); }
               best = Math.max(best, score); sum += score;
            }
            stats[profile] = { clears, best, mean: Math.round(sum / SWEEP[profile]), slowestWin: Math.round(slowestWin) };
         }
         console.info("robot-collector levels", id, JSON.stringify(stats));
         expect(stats.human.clears).toBeGreaterThanOrEqual(0.9 * SWEEP.human);
         expect(stats.oracle.clears).toBe(SWEEP.oracle);
         expect(stats.oracle.best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         expect(stats.spam.clears).toBe(0);
         expect(stats.idle.clears).toBe(0);
      }, 60000);

      it(`L${id}: real store at 30/60/144 Hz: the submitted score is inside the limits, capScore a no-op`, () => {
         for (const profile of ["oracle", "human", "idle"] as const) for (const hz of HZ) {
            const { run, final, raw } = storeRun(id * 10 + hz, profile, hz, id);
            expect(final.phase).toBe("over");
            expect(fitsLimits(final.score, final.elapsedMs, limits)).toBe(true);
            if (final.endReason === "win") expect(final.score).toBe(raw);
            else expect(final.score).toBe(run.progress.collected * BATTERY_POINTS);
            if (profile === "oracle") expect(final.endReason).toBe("win");
            if (profile === "idle") expect(final.endReason).toBe("timeup");
         }
      }, 60000);
   }
});
