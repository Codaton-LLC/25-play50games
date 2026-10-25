// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's live game,
// monotone difficulty, open warehouses, and the limit proof per level. Bot sweeps: rules.levels.test.ts.
import { describe, expect, it, vi } from "vitest";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { EXTRA_RACKS, FORKLIFT_PATHS, LEVELS, SLOW_FACTOR, SLOW_ZONES } from "./levels";
import { warehouseRushMeta as meta } from "./meta";
import {
   ARENA,
   BOUNDS,
   DURATION_MS,
   EXTRA_RACK_AABBS,
   PALLET_COUNT,
   POINTS,
   RACKS,
   ROBOT,
   SCORE_BOUND,
   createRun,
   createStepInput,
   earliestFor,
   inReach,
   scoreBoundAt,
   scoreBoundFor,
   step,
   zoneAt,
   PROPOSED_LEVEL_LIMITS,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];

describe("warehouse-rush levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.scoring).toEqual({ kind: "points", maxScore: 1700, minDurationMs: 57000, maxDurationMs: 63000, base: 0, maxPointsPerSec: 29, unitLabel: "pts", display: "int" });
      expect(meta.levels!.map((level) => level.clearScore ?? null)).toEqual([600, 700, 850, 950, null]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's live game: same warehouse, clock, limits, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect(l1).toEqual({ id: 1, durationMs: DURATION_MS, slowZones: 0, extraRacks: 0, forklifts: 0, forkliftSpeed: 0, orderMs: 0 });
      for (const seed of [0, 1, 7, 42, 2 ** 32 - 1]) {
         const plain = createRun(seed);
         const leveled = createRun(seed, l1);
         expect(leveled.layout).toEqual(plain.layout);
         expect(leveled.pallets.map((p) => p.box)).toEqual(plain.pallets.map((p) => p.box));
         expect(leveled.order).toBe(plain.order);
         expect(leveled.durationMs).toBe(DURATION_MS);
         expect(leveled.obstacles).toHaveLength(RACKS.length + PALLET_COUNT);
         expect(leveled.forklifts).toHaveLength(0);
         expect(leveled.config).toBe(l1);
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: undefined });
      expect(levelEnvironment(definition, 1)).toEqual({ background: "#0b1220", lighting: "indoor" });
      expect(levelHudStats(definition, 1)).toEqual([{ key: "delivered", label: "Delivered" }]);
      expect(levelInstructions(definition, 1)).toEqual([
         "Read the order at the top: a box colour and its zone.",
         "Drive to a box of that colour and press Action (E or Space) to lift it.",
         "Drive into its zone and press Action again: +50. Wrong zone: -20.",
         "One box at a time. You have 60 seconds.",
      ]);
   });

   it("each level's clock, lighting and order chip come from its config", () => {
      for (const id of LEVEL_IDS) expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["indoor", "day", "sunset", "night", "sunset"]);
      // the deadline counts down in the order panel, not in a chip under it
      for (const id of LEVEL_IDS) expect(levelHudStats(definition, id)).toEqual(levelHudStats(definition, 1));
      expect(levelHudStats(definition, 2)).toEqual(levelHudStats(definition, 1));
      expect(LEVEL_IDS.map((id) => LEVELS[id].lamp ?? 0)).toEqual([0, 0, 0, 6, 5]);
   });
});

describe("warehouse-rush levels: difficulty", () => {
   it("is monotone: more time, and lanes, shelves, forklifts and the deadline never ease off", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.durationMs).toBeGreaterThan(a.durationMs);
         expect(b.slowZones).toBeGreaterThanOrEqual(a.slowZones);
         expect(b.extraRacks).toBeGreaterThanOrEqual(a.extraRacks);
         expect(b.forklifts).toBeGreaterThanOrEqual(a.forklifts);
         expect(b.forkliftSpeed).toBeGreaterThanOrEqual(a.forkliftSpeed);
         if (a.orderMs > 0) expect(b.orderMs).toBeLessThanOrEqual(a.orderMs);
         expect(b.slowZones + b.extraRacks + b.forklifts + (b.orderMs > 0 ? 1 : 0)).toBeGreaterThan(
            a.slowZones + a.extraRacks + a.forklifts + (a.orderMs > 0 ? 1 : 0)
         );
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].slowZones)).toEqual([0, 3, 3, 3, 3]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].extraRacks)).toEqual([0, 0, 2, 2, 2]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].forklifts)).toEqual([0, 0, 0, 1, 2]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].orderMs)).toEqual([0, 0, 0, 16_000, 12_000]);
   });

   it("later levels offer at least level 1's points, and level 5 stays within 3×", () => {
      for (const id of LEVEL_IDS) {
         const bound = scoreBoundFor(LEVELS[id].durationMs);
         expect(bound).toBeGreaterThanOrEqual(SCORE_BOUND);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBe(bound + POINTS.right);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * 1700);
   });
});

describe("warehouse-rush levels: the warehouse stays open", () => {
   it("extra shelves and forklift paths stay off the pallets, the zones and each other", () => {
      for (const rack of EXTRA_RACK_AABBS) {
         for (const main of RACKS) {
            const overlap = rack.min.x < main.max.x && rack.max.x > main.min.x && rack.min.z < main.max.z && rack.max.z > main.min.z;
            expect(overlap).toBe(false);
         }
         expect(Math.abs(rack.min.z)).toBeLessThan(2.5);
         expect(rack.max.x).toBeLessThanOrEqual(6.5);
         expect(rack.min.x).toBeGreaterThanOrEqual(-6.5);
      }
      expect(EXTRA_RACKS).toHaveLength(EXTRA_RACK_AABBS.length);
      for (const path of FORKLIFT_PATHS) {
         const z0 = path.z - path.hz;
         const z1 = path.z + path.hz;
         expect(z1).toBeLessThan(2);
         expect(z0).toBeGreaterThan(-2);
         for (const rack of EXTRA_RACK_AABBS) {
            const overlapZ = z0 < rack.max.z && z1 > rack.min.z;
            expect(overlapZ).toBe(false);
         }
      }
      for (const lane of SLOW_ZONES) {
         expect(Math.abs(3.4 - lane.z)).toBeGreaterThan(lane.hz);
         expect(Math.abs(-3.4 - lane.z)).toBeGreaterThan(lane.hz);
      }
      // the start pad is not inside a lane's solid shelf, and level 1 has no lane
      expect(distanceToBoxXZ(0, 0, EXTRA_RACK_AABBS[0])).toBeGreaterThan(ROBOT.radius);
      expect(SLOW_ZONES[0].x).toBe(0);
   });

   it("from the start, every zone and every pallet reach is walkable on every level", () => {
      const cell = 0.5;
      const nx = Math.round((2 * ARENA.halfX) / cell) + 1;
      const nz = Math.round((2 * ARENA.halfZ) / cell) + 1;
      const xOf = (i: number) => -ARENA.halfX + i * cell;
      const zOf = (j: number) => -ARENA.halfZ + j * cell;
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (const seed of [1, 8, 19]) {
            const run = createRun(seed, level);
            const blocked = (x: number, z: number) => {
               if (Math.abs(x) > BOUNDS.max.x - ROBOT.radius || Math.abs(z) > BOUNDS.max.z - ROBOT.radius) return true;
               for (let i = 0; i < RACKS.length; i++) if (distanceToBoxXZ(x, z, RACKS[i]) < ROBOT.radius) return true;
               for (let i = 0; i < level.extraRacks; i++) if (distanceToBoxXZ(x, z, EXTRA_RACK_AABBS[i]) < ROBOT.radius) return true;
               for (let i = 0; i < run.pallets.length; i++) if (distanceToBoxXZ(x, z, run.pallets[i].bounds) < ROBOT.radius) return true;
               return false;
            };
            const free = new Uint8Array(nx * nz);
            for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (!blocked(xOf(i), zOf(j))) free[i * nz + j] = 1;
            const start = Math.round((0 + ARENA.halfX) / cell) * nz + Math.round((0 + ARENA.halfZ) / cell);
            const seen = new Uint8Array(free.length);
            const stack = [start];
            seen[start] = 1;
            while (stack.length) {
               const n = stack.pop()!;
               const i = (n / nz) | 0;
               const j = n % nz;
               for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                  const ni = i + di;
                  const nj = j + dj;
                  if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
                  const m = ni * nz + nj;
                  if (seen[m] || !free[m]) continue;
                  seen[m] = 1;
                  stack.push(m);
               }
            }
            const reached = (x: number, z: number) => {
               const i = Math.round((x + ARENA.halfX) / cell);
               const j = Math.round((z + ARENA.halfZ) / cell);
               return seen[i * nz + j] === 1;
            };
            expect(reached(0, 0)).toBe(true);
            for (let c = 0; c < 4; c++) {
               const sx = (c & 1 ? 1 : -1) * 8;
               const sz = (c & 2 ? 1 : -1) * 4;
               expect(zoneAt(sx, sz)).toBe(c);
               expect(reached(sx, sz)).toBe(true);
            }
            for (const pallet of run.pallets) expect(reached(pallet.x, pallet.z > 0 ? pallet.z - 1.3 : pallet.z + 1.3)).toBe(true);
         }
      }
   });
});

describe("warehouse-rush levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: ceiling + one delivery, and the ±5% window stays under 29 pts/s`, () => {
      const level = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const bound = scoreBoundFor(level.durationMs);
      expect(limits.maxScore).toBe(bound + POINTS.right);
      expect(limits.base).toBe(0);
      expect(limits.maxPointsPerSec).toBe(29);
      expect(limits.minDurationMs).toBe(Math.round(level.durationMs * 0.95));
      expect(limits.maxDurationMs).toBe(Math.round(level.durationMs * 1.05));
      const table = earliestFor(level.durationMs);
      // The clock ends at durationMs. The ±5% max is only the server's jitter window; the live
      // level-1 proof checks the bound through the clock, where it stays under maxScore.
      for (let ms = limits.minDurationMs; ms <= level.durationMs; ms += 250) {
         const at = scoreBoundAt(ms, table);
         expect(at).toBeLessThanOrEqual(limits.maxScore);
         expect(at * 1000).toBeLessThanOrEqual(29 * ms);
      }
      expect(limits.maxScore * 1000).toBeLessThanOrEqual(29 * level.durationMs);
   });
});

describe("warehouse-rush levels: hazards", () => {
   it("a slow lane caps speed at SLOW_FACTOR and nothing exceeds the open-floor cap", () => {
      const run = createRun(3, LEVELS[2]);
      run.robot.x = 0;
      run.robot.z = 0;
      run.robot.vx = 0;
      run.robot.vz = 0;
      let top = 0;
      const input = createStepInput();
      input.moveY = 1;
      const lane = SLOW_ZONES[0];
      for (let i = 0; i < 30; i++) {
         const inside = Math.abs(run.robot.x - lane.x) <= lane.hx && Math.abs(run.robot.z - lane.z) <= lane.hz;
         const x = run.robot.x;
         const z = run.robot.z;
         step(run, 1000 / 60, input);
         if (inside && run.stepMs > 0) top = Math.max(top, Math.hypot(run.robot.x - x, run.robot.z - z) / (run.stepMs / 1000));
      }
      expect(SLOW_FACTOR).toBe(0.72);
      expect(top).toBeGreaterThan(1);
      expect(top).toBeLessThanOrEqual(ROBOT.speed * 0.72 + 1e-6);
      const open = createRun(4, LEVELS[5]);
      open.robot.x = -8;
      open.robot.z = -4;
      let over = 0;
      for (let i = 0; i < 4000; i++) {
         const x = open.robot.x;
         const z = open.robot.z;
         input.moveX = Math.sin(i * 0.17);
         input.moveY = Math.cos(i * 0.11);
         step(open, 1000 / 60, input);
         if (!(open.stepMs > 0)) continue;
         const moved = Math.hypot(open.robot.x - x, open.robot.z - z);
         const cap = (open.carrying === -1 ? ROBOT.speed : ROBOT.carrySpeed) * (open.stepMs / 1000) + 1e-6;
         if (moved > cap) over += 1;
      }
      expect(over).toBe(0);
   });

   it("a forklift patrols and reverses instead of driving through the robot", () => {
      const run = createRun(1, LEVELS[5]);
      expect(run.forklifts).toHaveLength(2);
      const fork = run.forklifts[0];
      const z0 = fork.z;
      const input = createStepInput();
      for (let i = 0; i < 30; i++) step(run, 1000 / 30, input);
      expect(fork.x).not.toBeCloseTo(-4, 1);
      // park the robot on the forklift and step: the body must not overlap the robot
      run.robot.x = fork.x;
      run.robot.z = fork.z;
      for (let i = 0; i < 10; i++) step(run, 1000 / 30, input);
      expect(distanceToBoxXZ(run.robot.x, run.robot.z, fork.bounds)).toBeGreaterThanOrEqual(ROBOT.radius - 1e-6);
      expect(fork.z).toBeCloseTo(z0, 0);
   });

   it("an order expires for −20 and a new order, the same on any input device", () => {
      const run = createRun(6, LEVELS[4]);
      const input = createStepInput();
      input.moveX = 1;
      while (run.misses === 0 && run.ended === null) step(run, 50, input);
      expect(run.misses).toBe(1);
      expect(run.score).toBe(0);
      expect(run.orders).toBe(2);
      expect(run.simMs).toBeGreaterThanOrEqual(16_000);
      expect(run.simMs).toBeLessThan(16_000 + 50);
      // keyboard and touch are the same StepInput: a second run with the same stream matches
      const again = createRun(6, LEVELS[4]);
      const touch = createStepInput();
      touch.moveX = 1;
      while (again.simMs < run.simMs) step(again, 50, touch);
      expect(again.score).toBe(run.score);
      expect(again.order).toBe(run.order);
      expect(again.forklifts.map((f) => [f.x, f.z, f.dir])).toEqual(run.forklifts.map((f) => [f.x, f.z, f.dir]));
   });

   it("level 1 never expires and never grows a forklift, whatever the clock does", () => {
      const run = createRun(2);
      const input = createStepInput();
      for (let i = 0; i < 50; i++) step(run, 50, input);
      expect(run.misses).toBe(0);
      expect(run.orders).toBe(1);
      expect(run.forklifts).toHaveLength(0);
      expect(inReach(0, 0, run.pallets[0].bounds)).toBe(false);
   });
});
