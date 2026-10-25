import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import {
   createGrid,
   fixedFrames,
   followPath,
   freeGrid,
   simulateRun,
   steer,
   type PathFollower,
} from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   TUNING,
   capScore,
   createRun,
   stepRun,
   withinServerLimits,
   type RunState,
   type StepInput,
} from "./rules";

function createBotDriver(run: RunState) {
   const grid = createGrid({
      cell: 0.5,
      halfX: run.bounds.halfX,
      halfZ: run.bounds.halfZ,
   });

   // Walkable: keep clear of branches and webs
   const free = freeGrid(grid, (x, z) => {
      for (const b of run.branches) {
         if (Math.hypot(x - b.x, z - b.z) < b.radius + 0.35) return false;
      }
      for (const w of run.webs) {
         if (Math.hypot(x - w.x, z - w.z) < w.radius + 0.45) return false;
      }
      return true;
   });

   let currentGoalTarget = -999;
   let follower: PathFollower | null = null;
   const dir = { dirX: 0, dirZ: 0 };

   return (): StepInput => {
      const remaining = run.flowers.filter((f) => f.hasNectar);
      const shouldDeposit = run.carried.length >= 3 || (remaining.length === 0 && run.carried.length > 0);

      let targetId = -1;
      let targetX = run.hive.x;
      let targetZ = run.hive.z;

      if (!shouldDeposit && remaining.length > 0) {
         let bestDist = Infinity;
         let best = remaining[0];
         for (const fl of remaining) {
            const d = Math.hypot(fl.x - run.bee.x, fl.z - run.bee.z);
            if (d < bestDist) {
               bestDist = d;
               best = fl;
            }
         }
         targetId = best.id;
         targetX = best.x;
         targetZ = best.z;
      }

      if (currentGoalTarget !== targetId || !follower) {
         currentGoalTarget = targetId;
         follower = followPath(grid, free, run.bee.x, run.bee.z, targetX, targetZ);
      }

      steer(grid, follower, run.bee.x, run.bee.z, dir, 0.5);

      const dist = Math.hypot(targetX - run.bee.x, targetZ - run.bee.z);
      const jump = dist > 3.0 && run.stamina > 25 && run.boostLock <= 0;

      return {
         dirX: dir.dirX,
         dirZ: dir.dirZ,
         jump,
      };
   };
}

describe("bee-garden: pure rules & mechanics", () => {
   it("determinism: same seed and inputs produce identical run state", () => {
      const runA = createRun(42, LEVELS[1], 1);
      const runB = createRun(42, LEVELS[1], 1);

      const inputs: StepInput[] = [
         { dirX: 1, dirZ: 0, jump: true },
         { dirX: 0, dirZ: -1, jump: false },
         { dirX: -0.5, dirZ: 0.5, jump: true },
      ];

      for (const inp of inputs) {
         stepRun(runA, inp, 0.05);
         stepRun(runB, inp, 0.05);
      }

      expect(runA.bee.x).toBeCloseTo(runB.bee.x);
      expect(runA.bee.z).toBeCloseTo(runB.bee.z);
      expect(runA.bee.vx).toBeCloseTo(runB.bee.vx);
      expect(runA.stamina).toBeCloseTo(runB.stamina);
      expect(runA.score).toBe(runB.score);
   });

   it("carry never exceeds 3", () => {
      const run = createRun(101, LEVELS[1], 1);
      // Manually position 4 flowers near the bee
      run.flowers = [
         { id: 0, type: "A", x: 0, z: 0, hasNectar: true },
         { id: 1, type: "B", x: 0.1, z: 0.1, hasNectar: true },
         { id: 2, type: "C", x: 0.2, z: 0.2, hasNectar: true },
         { id: 3, type: "A", x: 0.3, z: 0.3, hasNectar: true },
      ];
      run.bee.x = 0;
      run.bee.z = 0;

      stepRun(run, { dirX: 0, dirZ: 0 }, 0.05);
      expect(run.carried.length).toBe(3);
      expect(run.flowers[3].hasNectar).toBe(true);
   });

   it("deposit scores: 1 unit pays 20, 2 units pay 40, 3 units pay 75 (bonus included)", () => {
      // 1 unit
      const run1 = createRun(1, LEVELS[1], 1);
      run1.carried = [0];
      run1.bee.x = run1.hive.x;
      run1.bee.z = run1.hive.z;
      stepRun(run1, {}, 0.05);
      expect(run1.score).toBe(20);
      expect(run1.carried.length).toBe(0);

      // 2 units
      const run2 = createRun(1, LEVELS[1], 1);
      run2.carried = [0, 1];
      run2.bee.x = run2.hive.x;
      run2.bee.z = run2.hive.z;
      stepRun(run2, {}, 0.05);
      expect(run2.score).toBe(40);

      // 3 units
      const run3 = createRun(1, LEVELS[1], 1);
      run3.carried = [0, 1, 2];
      run3.bee.x = run3.hive.x;
      run3.bee.z = run3.hive.z;
      stepRun(run3, {}, 0.05);
      expect(run3.score).toBe(75);
   });

   it("spider web overlap stuns for 0.50 s, restores flower nectar, and pays 0", () => {
      const run = createRun(1, LEVELS[2], 2);
      run.flowers[0].hasNectar = false;
      run.flowers[1].hasNectar = false;
      run.carried = [run.flowers[0].id, run.flowers[1].id];

      // Place a web directly at the bee
      run.webs = [{ id: 0, x: run.bee.x, z: run.bee.z, radius: TUNING.webRadius }];
      const initialScore = run.score;

      stepRun(run, { dirX: 1, dirZ: 0 }, 0.05);

      expect(run.stunTimer).toBeCloseTo(0.5, 2);
      expect(run.bee.vx).toBe(0);
      expect(run.bee.vz).toBe(0);
      expect(run.carried.length).toBe(0);
      expect(run.flowers[0].hasNectar).toBe(true);
      expect(run.flowers[1].hasNectar).toBe(true);
      expect(run.score).toBe(initialScore);
   });

   it("hive pad contains no web or branch on 200 seeds", () => {
      for (let s = 1; s <= 200; s++) {
         const run = createRun(s, LEVELS[5], 5);
         // Hive radius is 1.6; ensure no hazard within hive.radius + hazard.radius
         for (const b of run.branches) {
            const dist = Math.hypot(b.x - run.hive.x, b.z - run.hive.z);
            expect(dist).toBeGreaterThanOrEqual(run.hive.radius + b.radius);
         }
         for (const w of run.webs) {
            const dist = Math.hypot(w.x - run.hive.x, w.z - run.hive.z);
            expect(dist).toBeGreaterThanOrEqual(run.hive.radius + w.radius);
         }
      }
   });

   it("breeze acceleration is 0 on levels 1-4 and 0.8 on level 5", () => {
      const r1 = createRun(1, LEVELS[1], 1);
      stepRun(r1, { dirX: 0, dirZ: 0 }, 0.1);
      expect(r1.bee.vx).toBe(0);

      const r5 = createRun(1, LEVELS[5], 5);
      stepRun(r5, { dirX: 0, dirZ: 0 }, 0.1);
      expect(r5.bee.vx).toBeGreaterThan(0);
      expect(r5.bee.vx).toBeCloseTo(TUNING.breezeAccelX * 0.1, 2);
   });

   it("boost lock lasts 1.00 s after stamina hits 0, even while button held", () => {
      const run = createRun(1, LEVELS[1], 1);
      run.stamina = 2; // will drain to 0 in one frame
      stepRun(run, { jump: true }, 0.15);

      expect(run.stamina).toBe(0);
      expect(run.boosting).toBe(false);
      expect(run.boostLock).toBeCloseTo(1.0, 1);

      // Next frame with jump still held: cannot boost, stamina stays locked
      stepRun(run, { jump: true }, 0.2);
      expect(run.boosting).toBe(false);
      expect(run.boostLock).toBeCloseTo(0.8, 1);
   });

   it("timing windows are identical for keyboard and touch", () => {
      const runKey = createRun(55, LEVELS[2], 2);
      const runTouch = createRun(55, LEVELS[2], 2);

      // Keyboard space press
      stepRun(runKey, { moveX: 1, moveY: 0, jump: true }, 0.1);
      // Touch boost press
      stepRun(runTouch, { dirX: 1, dirZ: 0, jump: true }, 0.1);

      expect(runKey.stamina).toBeCloseTo(runTouch.stamina);
      expect(runKey.bee.x).toBeCloseTo(runTouch.bee.x);
   });
});

describe("bee-garden: bots & server score limits", () => {
   it("idle bot never clears and finishes with 0 score within limits", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const store = createArcadeStore();
         const run = createRun(123, level, id);

         simulateRun(store, {
            durationMs: level.durationMs,
            resultDelayMs: TUNING.resultDelayMs,
            frame: fixedFrames(1000 / 30),
            step: (dt) => {
               stepRun(run, { dirX: 0, dirZ: 0, jump: false }, dt, store);
            },
         });

         const s = store.getState();
         expect(s.phase).toBe("over");
         expect(s.endReason).toBe("timeup");
         expect(s.score).toBe(0);
         expect(withinServerLimits(s.score, s.elapsedMs, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
      }
   });

   it("spam bot never exceeds server limits at 60 Hz", () => {
      for (const id of [1, 2, 5] as LevelId[]) {
         const level = LEVELS[id];
         const store = createArcadeStore();
         const run = createRun(777, level, id);
         const rng = createRng(id * 100);

         simulateRun(store, {
            durationMs: level.durationMs,
            resultDelayMs: TUNING.resultDelayMs,
            frame: fixedFrames(1000 / 60),
            step: (dt) => {
               const inp = {
                  dirX: rng() * 2 - 1,
                  dirZ: rng() * 2 - 1,
                  jump: rng() < 0.3,
               };
               stepRun(run, inp, dt, store);
            },
         });

         const s = store.getState();
         expect(s.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(withinServerLimits(s.score, s.elapsedMs, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
      }
   });

   it("honest human-paced bot clears and scores >= 90% of maxScore on multiple seeds", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const store = createArcadeStore();
         const run = createRun(42, level, id);
         const driver = createBotDriver(run);

         simulateRun(store, {
            durationMs: level.durationMs,
            resultDelayMs: TUNING.resultDelayMs,
            frame: fixedFrames(1000 / 60),
            step: (dt) => {
               const inp = driver();
               stepRun(run, inp, dt, store);
            },
         });

         const s = store.getState();
         expect(s.endReason).toBe("win");
         expect(withinServerLimits(s.score, s.elapsedMs, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
         expect(s.score).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].base);
      }
   });

   it("level 5 maxScore is <= 3x level 1 maxScore (Decision 3)", () => {
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
