import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, freeGrid, findPath, followPath, steer, simulateRun, fixedFrames, randomFrames, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { ghostVacuumMeta } from "./meta";
import { COUNT, DURATION_MS, GHOST, HUNTER, LIGHT, MANSION, MAX_STEP, PULL, ROOMS, SCHEDULE, SCORE, SOLIDS, active, capScore, createRun, fitsLimits, illuminated, inRoom, pullPosition, pullValid, runScore, stepRun, type Run, type StepInput } from "./rules";

const input = (): StepInput => ({ dirX: 0, dirZ: 0, held: false, aim: true, aimYaw: 0, coarse: false });
function advance(run: Run, i: StepInput, duration: number, frame = 1 / 120): void {
   const end = run.elapsed + duration;
   while (run.elapsed < end - 1e-10 && !run.ended) { const dt = Math.min(frame, end - run.elapsed); stepRun(run, i, dt, run.elapsed + dt); }
}
function fixture(kind: "normal" | "gold" | "big" = "normal") {
   const run = createRun(7), i = input(), g = run.ghosts[0];
   for (const other of run.ghosts) other.mode = "caught";
   Object.assign(g, { room: 2, x: 8, z: -7, baseX: 8, baseZ: -7, mode: "wandering", kind, vx: 0, vz: 0 });
   Object.assign(run.hunter, { x: 8, z: -9, yaw: 0 });
   return { run, i, g };
}
const walkable = (x: number, z: number) => Math.abs(x) <= 13.5 && Math.abs(z) <= 9.5 && SOLIDS.every((b) => distanceToBoxXZ(x, z, b) >= 0.401);
const grid = createGrid({ cell: 0.25, halfX: 14, halfZ: 10 });
const free = freeGrid(grid, walkable);

describe("approved tuning and generator", () => {
   it("pins every score and temporal gate by value", () => {
      expect(DURATION_MS).toBe(120000); expect(COUNT).toBe(12); expect(MAX_STEP).toBe(1 / 120);
      expect(SCHEDULE).toEqual([0, 0, 0, 20, 20, 30, 40, 40, 60, 60, 60, 90]);
      expect(SCORE).toEqual({ capture: 100, gold: 200, combo: 50, second: 10 });
      expect(HUNTER).toEqual({ radius: 0.4, speed: 4, accel: 20, brake: 24, turn: 14, startX: 0, startZ: 8 });
      expect(LIGHT).toEqual({ angle: 25 * Math.PI / 180, range: 5, exposure: 0.4, bigExposure: 0.8, stun: 2 });
      expect(PULL).toEqual({ angle: 12 * Math.PI / 180, range: 4, seconds: 1, grace: 0.3, nozzle: 0.6, tug: 0.25, assistAngle: Math.PI / 4, assistTurn: Math.PI });
      expect(MANSION).toEqual({ halfX: 14, halfZ: 10, hall: 3, wall: 0.2, height: 2.4, doorZ: 5, doorWidth: 2 });
      expect(GHOST).toEqual({ radius: 0.4, bigRadius: 0.5, accel: 4, jitter: 0.8, reveal: 3, wander: 0.8, flee: 1.2, lateWander: 1, lateFlee: 1.5, goldWander: 1.2, goldFlee: 1.8, bigWander: 0.6, bigFlee: 0.9 });
      expect(ghostVacuumMeta.scoring).toMatchObject({ maxScore: 2630, minDurationMs: 91000, maxDurationMs: 122000, base: 1720, maxPointsPerSec: 10 });
   });
   it("has reachable distinct slots and exactly three ghosts per room over 1000 seeds", () => {
      const reachable = new Set(findPath(grid, free, grid.node(0, 8), grid.node(8, -7)));
      expect(reachable.size).toBeGreaterThan(0);
      const destinations = ROOMS.flatMap((r) => [0, -1, 1].map((offset) => grid.node(r.x - r.side * 2, r.z + offset)));
      for (const node of destinations) expect(findPath(grid, free, grid.node(0, 8), node).length).toBeGreaterThan(0);
      for (let seed = 0; seed < 1000; seed++) {
         const run = createRun(seed);
         expect(run.ghosts.map((g) => g.room)).toEqual(createRun(seed).ghosts.map((g) => g.room));
         expect(new Set(run.ghosts.map((g) => `${g.x},${g.z}`)).size).toBe(12);
         expect(run.ghosts.filter(active).length).toBe(3);
         expect(ROOMS.map((_, room) => run.ghosts.filter((g) => g.room === room).length)).toEqual([3, 3, 3, 3]);
         expect(run.ghosts.filter((g) => g.kind === "gold").map((g) => g.id)).toEqual([5, 8, 11]);
         expect(run.ghosts.filter((g) => g.kind === "big").map((g) => g.id)).toEqual([9, 10]);
         expect(run.ghosts.every(inRoom)).toBe(true);
      }
   });
   it("keeps FIFO, cap and release boundaries without backdating", () => {
      const run = createRun(1), i = input();
      stepRun(run, i, 0.05, 20.025);
      expect(run.ghosts.filter(active).length).toBe(3);
      run.ghosts[0].mode = "caught";
      stepRun(run, i, 0.05, 20.075);
      expect(run.ghosts[3].mode).not.toBe("pending"); expect(run.ghosts[4].mode).toBe("pending");
      stepRun(run, i, 0.05, 40.025);
      expect(run.ghosts.filter(active).length).toBe(6);
      expect(run.ghosts[6].admittedAt).toBeGreaterThanOrEqual(40);
      stepRun(run, i, 0.05, 90.025);
      expect(run.ghosts[11].mode).toBe("pending");
   });
   it("same seed and frames give the same mutable state", () => {
      const a = createRun(52), b = createRun(52), rng = createRng(99), i = input();
      for (let k = 0; k < 3000; k++) {
         const dt = 0.004 + rng() * 0.046; i.dirX = rng() * 2 - 1; i.dirZ = rng() * 2 - 1; i.held = rng() > 0.5;
         stepRun(a, i, dt, a.elapsed + dt); stepRun(b, i, dt, b.elapsed + dt);
      }
      expect(a.ghosts).toEqual(b.ghosts); expect(a.hunter).toEqual(b.hunter); expect(a.score).toBe(b.score);
   });
});

describe("movement, light and pull", () => {
   it("never exceeds hunter speed or solid clearance through 20000 steps", () => {
      const run = createRun(4), i = input(), rng = createRng(200), h = run.hunter;
      let distanceError = 0, clearanceError = 0;
      for (let k = 0; k < 20000; k++) {
         const dt = 0.004 + rng() * 0.046, x = h.x, z = h.z;
         i.dirX = rng() * 4 - 2; i.dirZ = rng() * 4 - 2;
         // Reset only the clock to exercise movement longer than one game; no bot uses this fixture.
         run.elapsed = 0; stepRun(run, i, dt, dt);
         distanceError = Math.max(distanceError, Math.hypot(h.x - x, h.z - z) - 4 * dt);
         for (const box of SOLIDS) clearanceError = Math.max(clearanceError, 0.4 - distanceToBoxXZ(h.x, h.z, box));
      }
      expect(distanceError).toBeLessThan(1e-9); expect(clearanceError).toBeLessThan(1e-8);
   });
   it("uses inclusive cones, walls only, and the nozzle exemption", () => {
      const { run, g } = fixture();
      Object.assign(run.hunter, { x: 0, z: 0, yaw: 0 });
      Object.assign(g, { x: Math.sin(LIGHT.angle) * 5, z: Math.cos(LIGHT.angle) * 5 });
      expect(illuminated(run, g)).toBe(true);
      g.x += 0.01; expect(illuminated(run, g)).toBe(false);
      Object.assign(run.hunter, { x: 1, z: -5, yaw: Math.PI / 2 }); Object.assign(g, { x: 5, z: -5 });
      expect(pullValid(run, g)).toBe(true);
      run.hunter.z = -3; g.z = -3; expect(pullValid(run, g)).toBe(false);
      Object.assign(run.hunter, { x: 8, z: -9, yaw: Math.PI }); Object.assign(g, { x: 8, z: -8.5 });
      expect(pullValid(run, g)).toBe(true);
   });
   it.each(["normal", "big"] as const)("requires uninterrupted exposure for %s", (kind) => {
      const { run, i, g } = fixture(kind), duration = kind === "big" ? 0.8 : 0.4;
      advance(run, i, duration - 0.001); expect(g.mode).not.toBe("stunned");
      advance(run, i, 0.001); expect(g.mode).toBe("stunned"); expect(g.stun).toBeCloseTo(2, 8);
      i.aimYaw = Math.PI; advance(run, i, 2); expect(g.mode).toBe("wandering"); expect(g.exposure).toBe(0);
   });
   it("does not count exposure time as pull time and consumes the remainder", () => {
      const { run, i, g } = fixture(); i.held = true;
      advance(run, i, 0.425, 0.05); expect(g.mode).toBe("pulling"); expect(g.progress).toBeCloseTo(0.025, 8);
      advance(run, i, 0.974); expect(g.mode).toBe("pulling");
      advance(run, i, 0.001); expect(g.mode).toBe("caught"); expect(run.score).toBe(100);
      advance(run, i, 1); expect(run.score).toBe(100);
   });
   it("freezes invalid pulls through 0.3s, rebases on re-entry and breaks beyond grace", () => {
      const { run, i, g } = fixture(); i.held = true; advance(run, i, 0.7);
      const p = g.progress, x = g.x, z = g.z;
      i.aimYaw = Math.PI; run.hunter.yaw = Math.PI;
      advance(run, i, 0.3); expect(g.mode).toBe("pulling"); expect(g.progress).toBe(p); expect(g.x).toBe(x); expect(g.z).toBe(z);
      i.aimYaw = 0; run.hunter.yaw = 0; advance(run, i, 0.01);
      expect(g.progress).toBeGreaterThan(p); expect(g.grace).toBe(0);
      i.aimYaw = Math.PI; run.hunter.yaw = Math.PI; advance(run, i, 0.301);
      expect(g.mode).toBe("wandering"); expect(g.progress).toBe(0); expect(run.score).toBe(0);
   });
   it("release breaks immediately without paying", () => {
      const { run, i, g } = fixture(); i.held = true; advance(run, i, 0.9); i.held = false; advance(run, i, 0.001);
      expect(g.mode).toBe("wandering"); expect(run.score).toBe(0);
   });
   it("checks a pulling ghost against its tug-free logical position", () => {
      const { run, g } = fixture();
      Object.assign(g, { mode: "pulling", baseX: 8, baseZ: -8.3, x: 8.25, z: -8.3 });
      expect(pullValid(run, g)).toBe(true);
      // The rendered tug is outside 12 degrees, but must not interrupt the logical pull.
      expect(Math.atan2(g.x - run.hunter.x, g.z - run.hunter.z)).toBeGreaterThan(PULL.angle);
      g.baseX = 9;
      expect(pullValid(run, g)).toBe(false);
   });
   it("fresh global tug is independent of a rebased local fraction", () => {
      const { run, g } = fixture();
      Object.assign(g, { ax: 8, az: -7, hx: 8, hz: -9, p0: 0.2, progress: 0.35 }); pullPosition(run, g);
      expect(g.baseZ).toBeCloseTo(-7.375, 10);
      expect(g.x - g.baseX).toBeCloseTo(-0.25 * 0.65 * Math.sin(1.4 * Math.PI), 10);
   });
   it.each([{ dirX: -1, dirZ: 0 }, { dirX: 0, dirZ: 1 }])("walking/backing hunter rebases from tug-free base without drift (%j)", (direction) => {
      const { run, i, g } = fixture();
      Object.assign(run.hunter, { z: -5.5, yaw: Math.PI, vx: direction.dirX * 4, vz: direction.dirZ * 4 });
      Object.assign(g, { z: -8.5, baseZ: -8.5, mode: "stunned", stun: 2 });
      // Walk sideways or back away: crossing through the target instead requires a physical 180-degree turn.
      i.aimYaw = Math.PI; i.dirX = direction.dirX; i.dirZ = direction.dirZ; i.held = true;
      let maxTug = 0;
      for (let k = 0; k < 120; k++) {
         i.aimYaw = Math.atan2(g.baseX - run.hunter.x, g.baseZ - run.hunter.z);
         advance(run, i, 1 / 120);
         maxTug = Math.max(maxTug, Math.hypot(g.x - g.baseX, g.z - g.baseZ));
         if (g.mode === "caught") break;
         expect(g.grace).toBe(0);
      }
      expect(g.mode).toBe("caught"); expect(maxTug).toBeLessThanOrEqual(0.25);
   });
});

describe("scoring and deadlines", () => {
   it("awards each capture kind and simultaneous id-ordered combo once", () => {
      const { run, i, g } = fixture("gold"); i.held = true;
      const b = run.ghosts[1]; Object.assign(b, { ...g, id: 1, kind: "big", mode: "stunned", stun: 2 });
      Object.assign(g, { mode: "stunned", stun: 2 }); advance(run, i, 1);
      expect(run.score).toBe(450); expect(run.gold).toBe(1); expect(run.extras).toBe(1);
      expect(run.events.captures.slice(0, run.events.count)).toEqual([0, 1]);
      expect(run.session).toBe(0); advance(run, i, 1); expect(run.score).toBe(450);
   });
   it("wins only after the twelfth and floors the time bonus", () => {
      const { run, i, g } = fixture(); run.caught = 11; run.gold = 3; run.score = 1700;
      Object.assign(g, { mode: "stunned", stun: 2 }); run.elapsed = 91; i.held = true;
      advance(run, i, 1); expect(run.won).toBe(true); expect(run.score).toBe(2080);
      const score = run.score; advance(run, i, 1); expect(run.score).toBe(score);
   });
   it("deadline suppresses a capture on the shell timeout frame", () => {
      const { run, i, g } = fixture(); Object.assign(g, { mode: "pulling", progress: 0.99 }); i.held = true;
      stepRun(run, i, 0.05, 120); expect(run.score).toBe(0); expect(g.mode).toBe("pulling");
   });
   it("pins the analytical prefix bound and earliest legal win", () => {
      expect(runScore(12, 3, 11, false, 120)).toBe(2350);
      expect(runScore(12, 3, 11, true, 91.4)).toBe(2630);
      expect(90 + 0.4 + 1).toBe(91.4);
      for (let t = 0; t <= 120; t += 0.01) {
         const released = SCHEDULE.filter((at) => at <= t).length;
         const gold = [30, 60, 90].filter((at) => at <= t).length;
         const bound = 100 * released + 200 * gold + 50 * Math.max(0, released - 1);
         expect(capScore(bound, t * 1000)).toBe(bound);
      }
      for (let t = 91.4; t < 120; t += 0.05) expect(fitsLimits(runScore(12, 3, 11, true, t), t * 1000)).toBe(true);
   });
});

function bot(seed: number, coarse: boolean, spam: boolean) {
   const run = createRun(seed), i = input(), rng = createRng(seed + 904), frame = seed % 3 === 0 ? fixedFrames(1000 / 60) : seed % 3 === 1 ? fixedFrames(50) : randomFrames(seed + 80);
   i.coarse = coarse; i.aim = !coarse;
   let target = -1, path: PathFollower | null = null, planned = -1, prefixOk = true, maxScore = 0;
   const final = simulateRun(createArcadeStore(), { durationMs: 120000, resultDelayMs: 1600, frame,
      step: (dt, time, store) => {
         if (spam) { i.dirX = rng() * 2 - 1; i.dirZ = rng() * 2 - 1; i.held = rng() > 0.25; i.aimYaw = rng() * Math.PI * 2; }
         else {
            if (target < 0 || !active(run.ghosts[target])) {
               target = -1; let nearest = Infinity;
               for (const g of run.ghosts) if (active(g)) { const d = Math.hypot(g.x - run.hunter.x, g.z - run.hunter.z); if (d < nearest) { nearest = d; target = g.id; } }
               path = null;
            }
            i.dirX = 0; i.dirZ = 0; i.held = true;
            if (target >= 0) {
               const g = run.ghosts[target], h = run.hunter, r = ROOMS[g.room];
               // Reveal must approach the host within 3m; a 1.3m standoff from the pop slot can miss it.
               const x = g.mode === "hidden" ? r.x - r.side * 1.5 : g.mode === "pulling" ? g.baseX : g.x, z = g.mode === "hidden" ? r.z : g.mode === "pulling" ? g.baseZ : g.z;
               const d = Math.hypot(x - h.x, z - h.z);
               i.aimYaw = Math.atan2(x - h.x, z - h.z);
               // Stay far enough away to track fleeing targets without circling them at close range.
               if (g.mode !== "pulling" && (g.mode === "hidden" ? d > 0.7 : d > 2.5)) {
                  if (!path || (time - planned > 0.8 && Math.hypot(path.goalX - x, path.goalZ - z) > 0.75)) { path = followPath(grid, free, h.x, h.z, x, z); planned = time; }
                  steer(grid, path, h.x, h.z, i, 0.2);
               } else if (coarse) { i.dirX = Math.sin(i.aimYaw) * 0.02; i.dirZ = Math.cos(i.aimYaw) * 0.02; }
            }
         }
         stepRun(run, i, dt, time);
         const s = store.getState(); if (run.events.points) s.addScore(run.events.points);
         if (run.events.win) { s.setScore(run.score); s.end("win"); }
         const score = store.getState().score;
         prefixOk &&= capScore(score, store.getState().elapsedMs) === score; maxScore = Math.max(maxScore, score);
      },
   });
   return { final, prefixOk, maxScore, run };
}
describe("legal bots through clock-first real store", () => {
   it("200 wins and 200 spam runs across keyboard/coarse and three frame schedules", () => {
      let best = 0, earliest = Infinity, latest = 0;
      for (let seed = 0; seed < 200; seed++) for (const spam of [false, true]) {
         const result = bot(seed, seed % 6 >= 3, spam), f = result.final;
         expect(result.prefixOk, `seed ${seed} prefix`).toBe(true);
         expect(fitsLimits(f.score, f.elapsedMs), `seed ${seed}, spam ${spam}`).toBe(true);
         expect(capScore(f.score, f.elapsedMs)).toBe(f.score);
         if (!spam) {
            const uncaught = result.run.ghosts.filter((g) => g.mode !== "caught").map((g) => `${g.id}:${g.mode}`).join(", ");
            if (f.endReason !== "win") console.info(`seed ${seed} catch times`, result.run.ghosts.map((g) => ({ id: g.id, caughtAt: g.caughtAt })));
            expect(f.endReason, `seed ${seed} feasibility; uncaught [${uncaught}]`).toBe("win");
            expect(f.elapsedMs).toBeGreaterThanOrEqual(91400 - 1e-6);
            best = Math.max(best, f.score); earliest = Math.min(earliest, f.elapsedMs); latest = Math.max(latest, f.elapsedMs);
         }
      }
      console.info("ghost-vacuum bot extrema", { best, earliest, latest, wins: 200, spam: 200 });
   }, 55000);
   it.each([false, true])("idle times out without score (coarse=%s)", (coarse) => {
      const run = createRun(1), i = input(); i.coarse = coarse;
      const f = simulateRun(createArcadeStore(), { durationMs: 120000, frame: fixedFrames(50), step: (dt, time) => stepRun(run, i, dt, time) });
      expect(f.endReason).toBe("timeup"); expect(f.score).toBe(0); expect(f.elapsedMs).toBe(120000);
   });
});
