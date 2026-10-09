import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { clearAt, createRun, DRONE, stepRun, winchEnergy, type Run, type StepInput } from "./rules";
import { deliveryDroneMeta } from "./meta";

/** The oracle knows the route and predicted impact, but moves and loads through the same rules as the player. */
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
      // Look ahead by braking distance along the validated path; the core follower is knowledge only.
      steer(grid, follower!, d.x, d.z, direction, 0.85);
      const f = follower!;
      let remaining = Math.hypot(gx - d.x, gz - d.z);
      let wx = gx, wz = gz;
      if (f.k < f.path.length - 1) {
         let k = f.k;
         const lookahead = Math.max(0.75, Math.hypot(d.vx, d.vz) * 0.45);
         while (k < f.path.length - 1 && Math.hypot(grid.x(f.path[k]) - d.x, grid.z(f.path[k]) - d.z) < lookahead) k++;
         wx = grid.x(f.path[k]); wz = grid.z(f.path[k]);
         // Never smooth across a blocked corner.
         for (let t = 0.15; t < 1; t += 0.15) if (!clearAt(run.city, d.x + (wx - d.x) * t, d.z + (wz - d.z) * t, 1.05)) { wx = grid.x(f.path[f.k]); wz = grid.z(f.path[f.k]); break; }
      }
      const dx = wx - d.x, dz = wz - d.z, distance = Math.hypot(dx, dz);
      const speed = Math.min(cautious ? 7.5 : 9, Math.sqrt(Math.max(0, remaining) * 16));
      let vx = distance > 0 ? dx / distance * speed : 0, vz = distance > 0 ? dz / distance * speed : 0;
      if (remaining < 0.8) { vx = (gx - d.x) * 5; vz = (gz - d.z) * 5; }
      let windX = 0, windZ = 0;
      if (run.time >= 60) for (const w of run.city.winds) if (d.x >= w.x - 4 && d.x < w.x + 4 && d.z >= w.z - 4 && d.z < w.z + 4) { windX += w.ax; windZ += w.az; }
      input.dirX = ((vx - d.vx) * 7 + DRONE.drag * d.vx - windX) / DRONE.accel;
      input.dirZ = ((vz - d.vz) * 7 + DRONE.drag * d.vz - windZ) / DRONE.accel;
      const magnitude = Math.hypot(input.dirX, input.dirZ);
      if (magnitude > 1) { input.dirX /= magnitude; input.dirZ /= magnitude; }
      input.drop = run.attached && run.preview.valid && run.preview.precision >= (cautious ? 65 : 90);
   };
}

describe("legal route bots through the real store", () => {
   it("records expert and novice results in both damping modes without teleportation or immunity", () => {
      const report = [];
      for (const steady of [false, true]) for (const cautious of [false, true]) {
         const row = { steady, cautious, wins: 0, minMs: Infinity, maxMs: 0, minWinMs: Infinity, maxWinMs: 0, bestScore: 0, worstScore: Infinity, clampXSeconds: 0, clampZSeconds: 0, clampXFraction: 0, clampZFraction: 0, peakEnergy: 0, meanFinalEnergy: 0, reasons: { win: 0, lose: 0, timeup: 0 }, bands: Array.from({ length: 3 }, () => ({ count: 0, minSeconds: Infinity, maxSeconds: 0, express: 0 })) };
         let cableTime = 0;
         for (let seed = 0; seed < 48; seed++) {
            const run = createRun(seed, steady), drive = driver(run, cautious);
            const input = { dirX: 0, dirZ: 0, drop: false };
            const frame = seed < 32 ? fixedFrames(1000 / 60) : seed < 40 ? fixedFrames(50) : randomFrames(seed);
            let maxRateExcess = -Infinity;
            const final = simulateRun(createArcadeStore(), { frame, step: (dt, _time, store) => {
               drive(input); stepRun(run, input, dt);
               const s = store.getState(); if (run.events.score > 0) s.addScore(run.events.score);
               maxRateExcess = Math.max(maxRateExcess, store.getState().score - (300 + 75 * s.elapsedMs / 1000));
               if (run.events.delivery) {
                  const band = row.bands[Math.floor((run.completed - 1) / 4)];
                  const seconds = run.fallAt + run.impact.time - run.pickupAt;
                  band.count++; band.minSeconds = Math.min(band.minSeconds, seconds); band.maxSeconds = Math.max(band.maxSeconds, seconds);
                  if (seconds <= 15) band.express++;
               }
               if (run.reason) { s.setScore(run.score); s.end(run.reason); }
            } });
            expect(maxRateExcess).toBeLessThanOrEqual(1e-8);
            expect(withinServerLimits(final.score, final.elapsedMs, deliveryDroneMeta.scoring)).toBe(true);
            expect(capScore(final.score, final.elapsedMs, deliveryDroneMeta.scoring)).toBe(final.score);
            if (final.endReason === "win") { row.wins++; row.minWinMs = Math.min(row.minWinMs, final.elapsedMs); row.maxWinMs = Math.max(row.maxWinMs, final.elapsedMs); }
            row.reasons[run.reason!]++;
            row.meanFinalEnergy += winchEnergy(run.swing) / 48;
            row.peakEnergy = Math.max(row.peakEnergy, run.swingMetrics.peakEnergy);
            row.clampXSeconds += run.swingMetrics.clampXSeconds; row.clampZSeconds += run.swingMetrics.clampZSeconds;
            cableTime += run.swingMetrics.seconds;
            row.minMs = Math.min(row.minMs, final.elapsedMs); row.maxMs = Math.max(row.maxMs, final.elapsedMs);
            row.bestScore = Math.max(row.bestScore, final.score); row.worstScore = Math.min(row.worstScore, final.score);
         }
         row.clampXFraction = row.clampXSeconds / cableTime; row.clampZFraction = row.clampZSeconds / cableTime; report.push(row);
         // A measured failure identifies tuning or controller work; it must not be concealed by a score cap.
         expect(row.wins).toBeGreaterThan(0);
         expect(row.minWinMs).toBeLessThan(cautious ? 175000 : 160000);
         if (!cautious) expect(row.bestScore).toBeGreaterThanOrEqual(3240);
      }
      console.info("P-15 legal route bot measurements", JSON.stringify(report));
   }, 60000);
});
