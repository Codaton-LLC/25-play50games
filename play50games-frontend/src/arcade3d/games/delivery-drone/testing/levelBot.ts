// Test-only driver for the level proofs. Runtime code never imports this file.
// The human bot is the game's cautious route follower (speed 7.5, drop at precision 65).
// The oracle is the same follower at full speed, dropping at precision 90. Both move, load
// and release through stepRun: no teleport and no score writes.
import { expect, it } from "vitest";
import type { LevelId } from "@/arcade3d/types";
import { isLevelCleared } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createGrid, fixedFrames, followPath, freeGrid, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS } from "../levels";
import { deliveryDroneMeta as meta } from "../meta";
import { DRONE, PROPOSED_LEVEL_LIMITS, clearAt, createRun, stepRun, type Run, type StepInput } from "../rules";

function driver(run: Run, cautious: boolean) {
   const grid = createGrid({ cell: 1.5, halfX: 28.5, halfZ: 28.5 });
   const free = freeGrid(grid, (x, z) => clearAt(run.city, x, z, 1.05));
   let goal = -2, follower: PathFollower;
   const direction = { dirX: 0, dirZ: 0 };
   return (input: StepInput) => {
      const d = run.drone;
      const next = run.attached ? run.completed : -1;
      const b = next >= 0 ? run.city.buildings[run.city.targets[next]] : null;
      const gx = b?.x ?? 0, gz = b?.z ?? 0;
      if (goal !== next) { follower = followPath(grid, free, d.x, d.z, gx, gz); goal = next; }
      steer(grid, follower!, d.x, d.z, direction, 0.85);
      const f = follower!;
      let remaining = Math.hypot(gx - d.x, gz - d.z);
      let wx = gx, wz = gz;
      if (f.k < f.path.length - 1) {
         let k = f.k;
         const lookahead = Math.max(0.75, Math.hypot(d.vx, d.vz) * 0.45);
         while (k < f.path.length - 1 && Math.hypot(grid.x(f.path[k]) - d.x, grid.z(f.path[k]) - d.z) < lookahead) k++;
         wx = grid.x(f.path[k]); wz = grid.z(f.path[k]);
         for (let t = 0.15; t < 1; t += 0.15) if (!clearAt(run.city, d.x + (wx - d.x) * t, d.z + (wz - d.z) * t, 1.05)) { wx = grid.x(f.path[f.k]); wz = grid.z(f.path[f.k]); break; }
      }
      const dx = wx - d.x, dz = wz - d.z, distance = Math.hypot(dx, dz);
      const speed = Math.min(cautious ? 7.5 : 9, Math.sqrt(Math.max(0, remaining) * 16));
      let vx = distance > 0 ? dx / distance * speed : 0, vz = distance > 0 ? dz / distance * speed : 0;
      if (remaining < 0.8) { vx = (gx - d.x) * 5; vz = (gz - d.z) * 5; }
      let windX = 0, windZ = 0;
      if (run.time >= run.level.windFrom) for (const w of run.city.winds) if (d.x >= w.x - 4 && d.x < w.x + 4 && d.z >= w.z - 4 && d.z < w.z + 4) { windX += w.ax; windZ += w.az; }
      input.dirX = ((vx - d.vx) * 7 + DRONE.drag * d.vx - windX) / DRONE.accel;
      input.dirZ = ((vz - d.vz) * 7 + DRONE.drag * d.vz - windZ) / DRONE.accel;
      const magnitude = Math.hypot(input.dirX, input.dirZ);
      if (magnitude > 1) { input.dirX /= magnitude; input.dirZ /= magnitude; }
      input.drop = run.attached && run.preview.valid && run.preview.precision >= (cautious ? 65 : 90);
   };
}

function rulesRun(seed: number, cautious: boolean, hz: number, id: LevelId) {
   const run = createRun(seed, seed % 2 === 1, LEVELS[id]);
   const drive = driver(run, cautious);
   const input = { dirX: 0, dirZ: 0, drop: false };
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const dt = 1 / hz;
   let steps = 0;
   const started = Date.now();
   while (!run.reason) {
      drive(input);
      stepRun(run, input, dt);
      steps++;
      if (run.score > limits.base! + limits.maxPointsPerSec! * run.time + 1e-6) throw new Error(`L${id} seed ${seed} broke the rate`);
      if (steps > 40000 || Date.now() - started > 15000) {
         throw new Error(`stuck L${id} seed ${seed} steps ${steps} t ${run.time.toFixed(2)} score ${run.score} done ${run.completed} battery ${run.battery.toFixed(1)} reason ${run.reason}`);
      }
   }
   return run;
}

/** A few seeds through the real store, the way Scene publishes score. */
function storeRun(seed: number, cautious: boolean, id: LevelId) {
   const run = createRun(seed, false, LEVELS[id]);
   const drive = driver(run, cautious);
   const input = { dirX: 0, dirZ: 0, drop: false };
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const final = simulateRun(createArcadeStore(), { frame: fixedFrames(1000 / 60), step: (dt, _time, store) => {
      drive(input);
      stepRun(run, input, dt);
      const s = store.getState();
      if (run.events.score > 0) s.addScore(run.events.score);
      if (run.reason) { s.setScore(run.score); s.end(run.reason); }
   } });
   expect(withinServerLimits(final.score, final.elapsedMs, limits)).toBe(true);
   expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
   expect(final.score).toBe(run.score);
   return run;
}

export function levelRows(ids: readonly LevelId[]): void {
   for (const id of ids) {
      const limits = PROPOSED_LEVEL_LIMITS[id], levelMeta = meta.levels![id - 1];

      it(`L${id}: human bot clears on 99% of 100 seeds and stays inside the limits`, () => {
         let clears = 0, best = 0, worst = Infinity, wins = 0;
         const missed: { seed: number; score: number; reason: string; time: number; done: number }[] = [];
         for (let seed = 0; seed < 100; seed++) {
            const run = rulesRun(seed, true, 60, id);
            expect(withinServerLimits(run.score, run.time * 1000, limits)).toBe(true);
            expect(capScore(run.score, run.time * 1000, limits)).toBe(run.score);
            if (isLevelCleared(run.reason, run.score, levelMeta)) clears++;
            else missed.push({ seed, score: run.score, reason: run.reason ?? "none", time: Math.round(run.time), done: run.completed });
            if (run.reason === "win") wins++;
            best = Math.max(best, run.score);
            worst = Math.min(worst, run.score);
         }
         console.info("delivery-drone level human", id, JSON.stringify({ clears, wins, best, worst, missed }));
         expect(clears).toBeGreaterThanOrEqual(99);
      }, 180000);

      it(`L${id}: oracle reaches 90% of maxScore; idle never clears; store runs stay legal`, () => {
         let best = 0, wins = 0;
         for (const hz of [30, 60, 144]) for (let seed = 0; seed < 4; seed++) {
            const run = rulesRun(seed, false, hz, id);
            expect(withinServerLimits(run.score, run.time * 1000, limits)).toBe(true);
            expect(capScore(run.score, run.time * 1000, limits)).toBe(run.score);
            best = Math.max(best, run.score);
            if (run.reason === "win") wins++;
         }
         const parked = createRun(0, false, LEVELS[id]);
         const input = { dirX: 0, dirZ: 0, drop: false };
         while (!parked.reason) stepRun(parked, input, 1 / 30);
         expect(parked.score).toBe(0);
         expect(isLevelCleared(parked.reason, parked.score, levelMeta)).toBe(false);
         for (let seed = 0; seed < 2; seed++) storeRun(seed, false, id);
         console.info("delivery-drone level oracle", id, JSON.stringify({ best, wins, parked: parked.score, parkedReason: parked.reason }));
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }, 180000);
   }
}
